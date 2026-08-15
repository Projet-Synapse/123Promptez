// chatService — routes to Anthropic Claude via a Supabase Edge Function, with streaming support
import { BotConfig, KBSource, FAQItem } from '@/contexts/BotContext';
import { Workspace } from '@/contexts/WorkspaceContext';
import type { UserProfile } from '@/contexts/ProfileContext';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

export function buildSystemPrompt(
  bot: BotConfig,
  workspace: Workspace,
  profile: UserProfile | null,
  dueTasks: any[],
  langInjection?: string
): string {
  let prompt = workspace.systemPrompt || bot.llmConfig.systemPrompt;

  // Inject language instruction first (highest priority)
  if (langInjection) {
    prompt = langInjection + '\n\n' + prompt;
  }

  prompt += '\n\n';

  // Inject user profile
  if (profile && (profile.name || profile.bio || profile.role || profile.aiMemory.length > 0)) {
    prompt += '## PROFIL UTILISATEUR\n\n';
    if (profile.name) prompt += `Nom: ${profile.name}\n`;
    if (profile.role) prompt += `Rôle: ${profile.role}\n`;
    if (profile.language) prompt += `Langue préférée: ${profile.language}\n`;
    if (profile.bio) prompt += `Biographie: ${profile.bio}\n`;
    if (profile.aiMemory.length > 0) {
      prompt += '\nMémoire personnalisée:\n';
      profile.aiMemory.forEach(mem => {
        prompt += `- [${mem.category.toUpperCase()}] ${mem.content}\n`;
      });
    }
    prompt += '\n';
  }

  // Inject due tasks
  if (dueTasks.length > 0) {
    prompt += '## TÂCHES PLANIFIÉES DUE\n\n';
    prompt += 'Les tâches suivantes sont dues et doivent être exécutées dans cette session:\n\n';
    dueTasks.forEach(task => {
      prompt += `### ${task.title} (${task.frequency})\n${task.promptInjection}\n\n`;
    });
  }

  // Inject active modes
  const activeModes = workspace.modes.filter(m => m.enabled);
  if (activeModes.length > 0) {
    prompt += '## MODES ACTIFS\n\n';
    activeModes.forEach(mode => {
      prompt += `### ${mode.label}\n${mode.promptInjection}\n\n`;
    });
  }

  // KB sources
  if (bot.kbSources.length > 0) {
    prompt += '## BASE DE CONNAISSANCES\n\n';
    bot.kbSources.forEach((src: KBSource) => {
      prompt += `### ${src.label} (${src.type})\n${src.content}\n\n`;
    });
  }

  // Database files
  const allFiles = [
    ...workspace.database.rootFiles,
    ...workspace.database.folders.flatMap(f => [
      ...f.files,
      ...(f.subFolders ?? []).flatMap(s => s.files),
    ]),
  ];
  if (allFiles.length > 0) {
    prompt += '## BASE DE DONNÉES DU WORKSPACE\n\n';
    allFiles.slice(0, 10).forEach(file => {
      prompt += `### ${file.name} (${file.type})\n${file.content}\n\n`;
    });
  }

  // FAQ
  if (bot.faqItems.length > 0) {
    prompt += '## FAQ\n\n';
    bot.faqItems.forEach((faq: FAQItem) => {
      prompt += `Q: ${faq.question}\nR: ${faq.answer}\n\n`;
    });
  }

  // Agent tools
  const enabledTools = bot.agentTools.filter(t => t.enabled);
  if (enabledTools.length > 0) {
    prompt += '## OUTILS DISPONIBLES\n';
    enabledTools.forEach(t => {
      prompt += `- ${t.id}\n`;
    });
    prompt += '\n';
  }

  // Connected apps
  const enabledApps = bot.connectedApps.filter(a => a.enabled);
  if (enabledApps.length > 0) {
    prompt += '## APPLICATIONS CONNECTÉES\n';
    enabledApps.forEach(a => {
      prompt += `- ${a.name}: ${a.description}\n`;
    });
  }

  // Custom agents (active ones)
  const activeAgents = (bot.customAgents ?? []).filter((a: any) => a.enabled);
  if (activeAgents.length > 0) {
    prompt += '\n## AGENTS IA ACTIFS\n';
    prompt += 'Les agents suivants sont actifs et doivent être sollicités selon la complexité des tâches:\n\n';
    activeAgents.forEach((a: any) => {
      const complexityLabel = a.complexity === 1 ? 'Tâches simples' : a.complexity === 2 ? 'Tâches modérées' : 'Tâches complexes';
      prompt += `### Agent: ${a.name} (${a.role}) — ${complexityLabel}\n`;
      if (a.description) prompt += `Description: ${a.description}\n`;
      if (a.promptPrefix) prompt += `Instructions: ${a.promptPrefix}\n`;
      prompt += `Modèle: ${a.model}\n\n`;
    });
  }

  return prompt;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Parse a single SSE data line and extract the text delta.
// The edge function emits `data: {"delta": "..."}` chunks (see
// supabase/functions/chat/index.ts), terminated by `data: [DONE]`.
function parseSSEChunk(raw: string): string {
  const lines = raw.split('\n');
  let result = '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') continue;
    try {
      const json = JSON.parse(payload);
      if (json.error) continue; // surfaced separately via response.ok checks
      result += json.delta ?? '';
    } catch {
      // Skip malformed lines
    }
  }
  return result;
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  bot: BotConfig,
  workspace: Workspace,
  onToken?: (token: string) => void,
  profile?: UserProfile | null,
  dueTasks?: any[],
  langInjection?: string
): Promise<string> {
  const resolvedProfile = profile ?? null;
  const resolvedDueTasks = dueTasks ?? [];

  const systemPrompt = buildSystemPrompt(bot, workspace, resolvedProfile, resolvedDueTasks, langInjection);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-12), // keep last 12 messages for context
    { role: 'user', content: userMessage },
  ];

  // bot.llmConfig.model is already a real Claude model ID (see constants/config.ts
  // LLM_MODELS); fall back to Sonnet if it's ever unset or stale.
  const model = bot.llmConfig.model || 'claude-sonnet-5';

  try {
    // Use raw fetch for streaming support
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token ? `Bearer ${session.access_token}` : '';

    // Get the supabase URL for constructing the edge function URL
    const supabaseUrl = (supabase as any).supabaseUrl as string ?? '';
    const fnUrl = `${supabaseUrl}/functions/v1/chat`;

    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'apikey': (supabase as any).supabaseKey as string ?? '',
      },
      body: JSON.stringify({
        messages,
        model,
        temperature: bot.llmConfig.temperature,
        maxTokens: bot.llmConfig.maxTokens,
        topP: bot.llmConfig.topP,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur IA: ${errText}`);
    }

    let fullText = '';
    const reader = response.body?.getReader();

    if (reader) {
      // Streaming path
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Process complete SSE events (split on double newlines)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.trim()) continue;
          const chunk = parseSSEChunk(part);
          if (chunk) {
            fullText += chunk;
            if (onToken) onToken(fullText);
          }
        }
      }
      // Process remaining buffer
      if (buffer.trim()) {
        const chunk = parseSSEChunk(buffer);
        if (chunk) {
          fullText += chunk;
          if (onToken) onToken(fullText);
        }
      }
    } else {
      // Non-streaming fallback
      const text = await response.text();
      // Try to parse as SSE
      const chunk = parseSSEChunk(text);
      if (chunk) {
        fullText = chunk;
      } else {
        // Try plain JSON
        try {
          const json = JSON.parse(text);
          fullText = json.delta ?? '';
        } catch {
          fullText = text;
        }
      }
      if (onToken && fullText) onToken(fullText);
    }

    return fullText || 'Aucune réponse reçue.';
  } catch (error: any) {
    console.error('[chatService] Error:', error.message);
    throw error;
  }
}
