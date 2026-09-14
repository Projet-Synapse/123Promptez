// chatService — routes to Anthropic Claude via a Supabase Edge Function, with streaming support
import { BotConfig, KBSource, FAQItem } from '@/contexts/BotContext';
import { Workspace } from '@/contexts/WorkspaceContext';
import type { UserProfile } from '@/contexts/ProfileContext';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { buildCapabilitiesPrompt, buildWorkspaceContextPrompt } from '@/services/agentCapabilities';

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

  // Capacités RÉELLES de l'agent — source de vérité unique (services/agentCapabilities.ts)
  prompt += buildCapabilitiesPrompt(workspace, bot);

  // Inject due tasks
  if (dueTasks.length > 0) {
    prompt += '## TÂCHES À FAIRE\n\n';
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

  // Contexte du workspace : inventaire + contenus de fichiers, check-list
  // des tâches actives, automatisations (source de vérité : agentCapabilities)
  prompt += buildWorkspaceContextPrompt(workspace);

  // FAQ
  if (bot.faqItems.length > 0) {
    prompt += '## FAQ\n\n';
    bot.faqItems.forEach((faq: FAQItem) => {
      prompt += `Q: ${faq.question}\nR: ${faq.answer}\n\n`;
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
// The edge function emits `data: {"delta": "..."}` chunks, terminated by
// `data: [DONE]`. Les évènements `{"error": …}` sont remontés via onError,
// les évènements `{"toolEvent": …}` (outils exécutés côté serveur) via onTool.
function parseSSEChunk(raw: string, onError?: (message: string) => void, onTool?: (label: string) => void): string {
  const lines = raw.split('\n');
  let result = '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') continue;
    try {
      const json = JSON.parse(payload);
      if (json.error) {
        onError?.(String(json.error));
        continue;
      }
      if (json.toolEvent) {
        onTool?.(String(json.toolEvent));
        continue;
      }
      result += json.delta ?? '';
    } catch {
      // Skip malformed lines
    }
  }
  return result;
}

export interface ChatToolExtras {
  /** Jeton GitHub de l'utilisateur — active les outils serveur de lecture de dépôts */
  githubToken?: string;
  /** Active les outils de lecture du stockage cloud */
  supabaseTools?: boolean;
  /** IDs des outils IA activés par l'utilisateur (gèrent les outils serveur disponibles) */
  enabledTools?: string[];
  /** Notifié quand la fonction Edge exécute un outil côté serveur */
  onToolEvent?: (label: string) => void;
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  bot: BotConfig,
  workspace: Workspace,
  onToken?: (token: string) => void,
  profile?: UserProfile | null,
  dueTasks?: any[],
  langInjection?: string,
  signal?: AbortSignal,
  extra?: ChatToolExtras,
): Promise<string> {
  const resolvedProfile = profile ?? null;
  const resolvedDueTasks = dueTasks ?? [];

  const systemPrompt = buildSystemPrompt(bot, workspace, resolvedProfile, resolvedDueTasks, langInjection);
  const raw: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-12), // keep last 12 messages for context
    { role: 'user', content: userMessage },
  ];
  // L'API Anthropic EXIGE des rôles alternés : deux messages consécutifs du
  // même rôle (ex. résultats d'outils [RÉSULTATS D'OUTILS] suivis du vrai
  // message utilisateur) provoquent une erreur 400 — « réponse vide au 2e
  // message ». On fusionne les doublons consécutifs.
  const messages: ChatMessage[] = [];
  for (const m of raw) {
    const prev = messages[messages.length - 1];
    if (prev && prev.role === m.role) prev.content += `\n\n${m.content}`;
    else messages.push({ ...m });
  }

  // bot.llmConfig.model is already a real Claude model ID (see constants/config.ts
  // LLM_MODELS); fall back to Sonnet if it's ever unset or stale.
  const model = bot.llmConfig.model || 'claude-sonnet-5';

  // ── Chemin GEMINI (gratuit) : appel DIRECT depuis l'app, sans Edge ni
  // crédits. Clé Google AI Studio collée dans Paramètres ▸ Clé API. Les outils
  // clients ([OUTIL:…]) sont du texte : ils fonctionnent à l'identique.
  if (model.startsWith('gemini')) {
    const geminiKey = String((bot as any).apiKey ?? '').trim();
    if (!geminiKey) {
      throw new Error('Aucune clé Gemini — colle ta clé Google AI Studio (gratuite, aistudio.google.com) dans Builder ▸ Paramètres ▸ Clé API');
    }
    try {
      return await streamGemini({
        messages: messages.filter(m => m.role !== 'system'),
        systemPrompt,
        model,
        apiKey: geminiKey,
        temperature: bot.llmConfig.temperature,
        maxOutputTokens: Math.max(bot.llmConfig.maxTokens, 16384),
        topP: bot.llmConfig.topP,
        onToken,
        signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError' || signal?.aborted) {
        throw new Error('Génération interrompue');
      }
      throw error;
    }
  }

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
        // Le « thinking » adaptatif (Sonnet/Opus) puise DANS max_tokens : avec
        // un budget faible, la réflexion consomme tout et la réponse arrive
        // vide. 16384 = plancher confortable (plafond Edge : 32000).
        maxTokens: Math.max(bot.llmConfig.maxTokens, 16384),
        topP: bot.llmConfig.topP,
        // Clé API PERSONNELLE (Builder ▸ Paramètres) : le serveur l'utilise en
        // priorité — paiement à l'usage indépendant des crédits du projet.
        apiKey: (bot as any).apiKey ?? null,
        // Outils serveur (source de vérité : agentCapabilities / connecteurs)
        githubToken: extra?.githubToken ?? null,
        enableSupabase: extra?.supabaseTools === true,
        enabledTools: extra?.enabledTools ?? [],
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur IA: ${errText}`);
    }

    let fullText = '';
    let streamError: string | null = null; // erreurs émises DANS le flux (HTTP 200)
    const reader = response.body?.getReader();

    if (reader) {
      // Streaming path
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        if (signal?.aborted) {
          try { await reader.cancel(); } catch { /* ignore */ }
          throw new DOMException('Aborted', 'AbortError');
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Process complete SSE events (split on double newlines)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.trim()) continue;
          const chunk = parseSSEChunk(part, err => { streamError = err; }, label => extra?.onToolEvent?.(label));
          if (chunk) {
            fullText += chunk;
            if (onToken) onToken(fullText);
          }
        }
      }
      // Process remaining buffer
      if (buffer.trim()) {
        const chunk = parseSSEChunk(buffer, err => { streamError = err; }, label => extra?.onToolEvent?.(label));
        if (chunk) {
          fullText += chunk;
          if (onToken) onToken(fullText);
        }
      }
    } else {
      // Non-streaming fallback
      const text = await response.text();
      // Try to parse as SSE
      const chunk = parseSSEChunk(text, err => { streamError = err; }, label => extra?.onToolEvent?.(label));
      if (chunk) {
        fullText = chunk;
      } else {
        // Try plain JSON
        try {
          const json = JSON.parse(text);
          fullText = json.delta ?? '';
          if (json.error) streamError = json.error;
        } catch {
          fullText = text;
        }
      }
      if (onToken && fullText) onToken(fullText);
    }

    // Le edge function signale ses erreurs DANS le flux (HTTP 200) :
    // une réponse vide + erreur = vraie erreur, pas une réponse à afficher.
    if (!fullText.trim() && streamError) {
      throw new Error(`Erreur IA: ${streamError}`);
    }

    return fullText;
  } catch (error: any) {
    if (error?.name === 'AbortError' || signal?.aborted) {
      const err = new Error('Génération interrompue');
      (err as any).name = 'AbortError';
      throw err;
    }
    console.error('[chatService] Error:', error.message);
    throw error;
  }
}

// ─── Gemini (Google AI Studio) — chemin GRATUIT, appel direct sans Edge ──────
// Streaming SSE (`streamGenerateContent?alt=sse`). Même interface que le chemin
// Anthropic : onToken reçoit le texte accumulé, AbortError respecté.

interface GeminiOpts {
  messages: ChatMessage[];
  systemPrompt: string;
  model: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
  topP?: number;
  onToken?: (fullText: string) => void;
  signal?: AbortSignal;
}

async function streamGemini(opts: GeminiOpts): Promise<string> {
  const contents = opts.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  };
  if (typeof opts.topP === 'number') generationConfig.topP = opts.topP;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(opts.apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      generationConfig,
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    let msg = errText.slice(0, 300);
    try {
      const j = JSON.parse(errText);
      msg = j?.error?.message ?? msg;
    } catch { /* texte brut */ }
    // Pièges fréquents : jeton OAuth au lieu d'une clé AI Studio (les clés
    // Gemini commencent par AIza), ou projet basculé sur la facturation.
    if (response.status === 401 || response.status === 403) {
      if (!opts.apiKey.startsWith('AIza')) {
        msg = 'La valeur collée n’est pas une clé AI Studio — une clé Gemini commence par « AIza ». Paramètres ▸ Clé API ▸ recopie la bonne clé (aistudio.google.com ▸ Obtenir une clé API), puis « Tester la clé ».';
      } else {
        msg += ' — si Google demande des crédits : crée la clé dans un NOUVEAU projet (aistudio.google.com ▸ Obtenir une clé API ▸ nouveau projet), sans compte de facturation.';
      }
    }
    throw new Error(`Erreur Gemini: ${msg}`);
  }

  let fullText = '';
  let streamError: string | null = null;
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Flux Gemini indisponible');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    if (opts.signal?.aborted) {
      try { await reader.cancel(); } catch { /* ignore */ }
      const err = new Error('Génération interrompue');
      (err as any).name = 'AbortError';
      throw err;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.error) { streamError = ev.error.message ?? 'Erreur Gemini'; continue; }
          const delta: string = (ev.candidates?.[0]?.content?.parts ?? [])
            .map((p: any) => p.text ?? '')
            .join('');
          if (delta) {
            fullText += delta;
            if (opts.onToken) opts.onToken(fullText);
          }
        } catch { /* événement partiel : suivant */ }
      }
    }
  }

  if (!fullText.trim() && streamError) {
    throw new Error(`Erreur Gemini: ${streamError}`);
  }
  return fullText;
}
