// Powered by OnSpace.AI
import { BotConfig, KBSource, FAQItem } from '@/contexts/BotContext';
import { Workspace } from '@/contexts/WorkspaceContext';

function buildSystemPrompt(bot: BotConfig, workspace: Workspace): string {
  // Use workspace-specific system prompt if available, else fall back to bot's
  let prompt = workspace.systemPrompt || bot.llmConfig.systemPrompt;
  prompt += '\n\n';

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

  return prompt;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  bot: BotConfig,
  workspace: Workspace,
  onToken?: (token: string) => void
): Promise<string> {
  if (!bot.apiKey) {
    // Mock response for demo
    await new Promise(r => setTimeout(r, 1200));
    const activeModes = workspace.modes.filter(m => m.enabled);
    const modesInfo = activeModes.length > 0
      ? ` Modes actifs : ${activeModes.map(m => m.label).join(', ')}.`
      : '';
    const mockResponses = [
      `Bonjour ! Je suis **${bot.name}** dans le workspace **${workspace.name}**.${modesInfo} Ajoutez votre clé API dans les Paramètres pour activer un vrai LLM.`,
      `Je comprends votre question. En mode démonstration, je simule des réponses.${modesInfo} Configurez votre clé API pour activer le vrai LLM.`,
      `Excellente question ! Mon système contient ${bot.kbSources.length} sources KB, ${activeModes.length} mode(s) actif(s) et ${bot.faqItems.length} entrées FAQ.`,
    ];
    const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    if (onToken) {
      for (const char of response) {
        onToken(char);
        await new Promise(r => setTimeout(r, 10));
      }
    }
    return response;
  }

  const systemPrompt = buildSystemPrompt(bot, workspace);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bot.apiKey}`,
    },
    body: JSON.stringify({
      model: bot.llmConfig.model,
      messages,
      temperature: bot.llmConfig.temperature,
      max_tokens: bot.llmConfig.maxTokens,
      top_p: bot.llmConfig.topP,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Erreur API');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';

  if (onToken) {
    for (const char of content) {
      onToken(char);
      await new Promise(r => setTimeout(r, 5));
    }
  }

  return content;
}
