import React, { createContext, useState, ReactNode, useCallback } from 'react';

export interface KBSource {
  id: string;
  type: 'text' | 'file' | 'url' | 'faq' | 'schema';
  label: string;
  content: string;
  addedAt: Date;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface AgentTool {
  id: string;
  enabled: boolean;
  config?: Record<string, string>;
}

export interface ConnectedApp {
  id: string;
  name: string;
  webhookUrl: string;
  description: string;
  enabled: boolean;
  /** MaterialIcons name for catalogue presets */
  icon?: string;
  color?: string;
  /** Stable catalogue id (github, supabase, …) — kept alongside legacy webhook apps */
  presetId?: string;
  comingSoon?: boolean;
}

// Custom AI agent definition
export interface CustomAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string; // provider/model id
  icon: string;
  color: string;
  enabled: boolean;
  complexity: 1 | 2 | 3; // 1=simple, 2=moderate, 3=complex tasks
  promptPrefix: string; // injected before user message when agent is active
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
  streaming: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

export interface BotConfig {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  llmConfig: LLMConfig;
  kbSources: KBSource[];
  faqItems: FAQItem[];
  agentTools: AgentTool[];
  connectedApps: ConnectedApp[];
  customAgents: CustomAgent[];
  apiKey: string;
}

interface BotContextType {
  bot: BotConfig;
  updateBot: (updates: Partial<BotConfig>) => void;
  updateLLMConfig: (updates: Partial<LLMConfig>) => void;
  resetBot: () => void;
  addKBSource: (source: Omit<KBSource, 'id' | 'addedAt'>) => void;
  removeKBSource: (id: string) => void;
  addFAQItem: (item: Omit<FAQItem, 'id'>) => void;
  removeFAQItem: (id: string) => void;
  toggleAgentTool: (toolId: string) => void;
  updateAgentToolConfig: (toolId: string, config: Record<string, string>) => void;
  addConnectedApp: (app: Omit<ConnectedApp, 'id'>) => void;
  removeConnectedApp: (id: string) => void;
  toggleConnectedApp: (id: string) => void;
  updateConnectedApp: (id: string, updates: Partial<ConnectedApp>) => void;
  /** Enable/disable a catalogue connector; creates connectedApps entry if missing (field name kept for cloud compat). */
  setPresetConnectorEnabled: (preset: Omit<ConnectedApp, 'id' | 'enabled'> & { id: string }, enabled: boolean) => void;
  // Custom agents
  addCustomAgent: (agent: Omit<CustomAgent, 'id'>) => void;
  updateCustomAgent: (id: string, updates: Partial<CustomAgent>) => void;
  removeCustomAgent: (id: string) => void;
  toggleCustomAgent: (id: string) => void;
  // Cloud hydration
  hydrateFromCloud: (data: Partial<BotConfig>) => void;
  // Legacy
  chatMessages: ChatMessage[];
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
}

const DEFAULT_BOT: BotConfig = {
  id: 'bot-1',
  name: 'Mon Assistant IA',
  description: 'Un assistant IA personnalisé et agentique',
  avatarColor: '#3D7EFF',
  apiKey: '',
  llmConfig: {
    model: 'claude-sonnet-5',
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    systemPrompt: 'Tu es un assistant IA utile, précis et concis. Tu répondras toujours en français sauf si on te parle dans une autre langue.',
    streaming: true,
  },
  kbSources: [
    { id: 'kb-demo', type: 'text', label: 'Instructions générales', content: 'Cet assistant a été créé pour démontrer les capacités de la plateforme.', addedAt: new Date() },
  ],
  faqItems: [
    { id: 'faq-1', question: 'Comment fonctionne cet assistant ?', answer: 'Il utilise un LLM enrichi avec votre base de connaissances personnalisée.' },
  ],
  agentTools: [
    { id: 'web_search', enabled: false },
    { id: 'image_analysis', enabled: false },
    { id: 'db_access', enabled: false },
    { id: 'automation', enabled: false },
    { id: 'code_exec', enabled: false },
    { id: 'file_read', enabled: true },
  ],
  connectedApps: [],
  customAgents: [],
};

export const BotContext = createContext<BotContextType | undefined>(undefined);

export function BotProvider({ children, onDataChange }: { children: ReactNode; onDataChange?: (bot: BotConfig) => void }) {
  const [bot, setBot] = useState<BotConfig>(DEFAULT_BOT);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const notify = useCallback((newBot: BotConfig) => {
    if (onDataChange) onDataChange(newBot);
  }, [onDataChange]);

  const updateBot = (updates: Partial<BotConfig>) => {
    setBot(prev => {
      const next = { ...prev, ...updates };
      notify(next);
      return next;
    });
  };

  const updateLLMConfig = (updates: Partial<LLMConfig>) => {
    setBot(prev => {
      const next = { ...prev, llmConfig: { ...prev.llmConfig, ...updates } };
      notify(next);
      return next;
    });
  };

  // Restores the bot to its factory defaults, keeping its id stable so
  // any cloud record tied to this bot is updated rather than orphaned.
  const resetBot = () => {
    setBot(prev => {
      const next = { ...DEFAULT_BOT, id: prev.id };
      notify(next);
      return next;
    });
  };

  const addKBSource = (source: Omit<KBSource, 'id' | 'addedAt'>) => {
    const newSource: KBSource = { ...source, id: `kb-${Date.now()}`, addedAt: new Date() };
    setBot(prev => {
      const next = { ...prev, kbSources: [...prev.kbSources, newSource] };
      notify(next);
      return next;
    });
  };

  const removeKBSource = (id: string) => {
    setBot(prev => {
      const next = { ...prev, kbSources: prev.kbSources.filter(s => s.id !== id) };
      notify(next);
      return next;
    });
  };

  const addFAQItem = (item: Omit<FAQItem, 'id'>) => {
    const newItem: FAQItem = { ...item, id: `faq-${Date.now()}` };
    setBot(prev => {
      const next = { ...prev, faqItems: [...prev.faqItems, newItem] };
      notify(next);
      return next;
    });
  };

  const removeFAQItem = (id: string) => {
    setBot(prev => {
      const next = { ...prev, faqItems: prev.faqItems.filter(f => f.id !== id) };
      notify(next);
      return next;
    });
  };

  const toggleAgentTool = (toolId: string) => {
    setBot(prev => {
      const next = {
        ...prev,
        agentTools: prev.agentTools.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t),
      };
      notify(next);
      return next;
    });
  };

  const updateAgentToolConfig = (toolId: string, config: Record<string, string>) => {
    setBot(prev => {
      const next = {
        ...prev,
        agentTools: prev.agentTools.map(t => t.id === toolId ? { ...t, config } : t),
      };
      notify(next);
      return next;
    });
  };

  const addConnectedApp = (app: Omit<ConnectedApp, 'id'>) => {
    const newApp: ConnectedApp = { ...app, id: `app-${Date.now()}` };
    setBot(prev => {
      const next = { ...prev, connectedApps: [...prev.connectedApps, newApp] };
      notify(next);
      return next;
    });
  };

  const removeConnectedApp = (id: string) => {
    setBot(prev => {
      const next = { ...prev, connectedApps: prev.connectedApps.filter(a => a.id !== id) };
      notify(next);
      return next;
    });
  };

  const toggleConnectedApp = (id: string) => {
    setBot(prev => {
      const next = {
        ...prev,
        connectedApps: prev.connectedApps.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a),
      };
      notify(next);
      return next;
    });
  };


  const updateConnectedApp = (id: string, updates: Partial<ConnectedApp>) => {
    setBot(prev => {
      const next = {
        ...prev,
        connectedApps: prev.connectedApps.map(a => a.id === id ? { ...a, ...updates } : a),
      };
      notify(next);
      return next;
    });
  };

  const setPresetConnectorEnabled = (
    preset: Omit<ConnectedApp, 'id' | 'enabled'> & { id: string },
    enabled: boolean,
  ) => {
    setBot(prev => {
      const apps = prev.connectedApps ?? [];
      const existing = apps.find(a => a.id === preset.id || a.presetId === preset.id);
      let connectedApps: ConnectedApp[];
      if (existing) {
        connectedApps = apps.map(a =>
          a.id === existing.id
            ? {
                ...a,
                enabled,
                name: preset.name,
                description: preset.description,
                icon: preset.icon ?? a.icon,
                color: preset.color ?? a.color,
                presetId: preset.presetId ?? preset.id,
                comingSoon: preset.comingSoon ?? a.comingSoon,
                webhookUrl: a.webhookUrl || preset.webhookUrl || '',
              }
            : a,
        );
      } else {
        connectedApps = [
          ...apps,
          {
            id: preset.id,
            name: preset.name,
            description: preset.description,
            webhookUrl: preset.webhookUrl || '',
            enabled,
            icon: preset.icon,
            color: preset.color,
            presetId: preset.presetId ?? preset.id,
            comingSoon: preset.comingSoon,
          },
        ];
      }
      const next = { ...prev, connectedApps };
      notify(next);
      return next;
    });
  };

  // ── Custom agents ────────────────────────────────────────────────────────────
  const addCustomAgent = (agent: Omit<CustomAgent, 'id'>) => {
    const newAgent: CustomAgent = { ...agent, id: `agent-${Date.now()}` };
    setBot(prev => {
      const next = { ...prev, customAgents: [...(prev.customAgents ?? []), newAgent] };
      notify(next);
      return next;
    });
  };

  const updateCustomAgent = (id: string, updates: Partial<CustomAgent>) => {
    setBot(prev => {
      const next = {
        ...prev,
        customAgents: (prev.customAgents ?? []).map(a => a.id === id ? { ...a, ...updates } : a),
      };
      notify(next);
      return next;
    });
  };

  const removeCustomAgent = (id: string) => {
    setBot(prev => {
      const next = { ...prev, customAgents: (prev.customAgents ?? []).filter(a => a.id !== id) };
      notify(next);
      return next;
    });
  };

  const toggleCustomAgent = (id: string) => {
    setBot(prev => {
      const next = {
        ...prev,
        customAgents: (prev.customAgents ?? []).map(a => a.id === id ? { ...a, enabled: !a.enabled } : a),
      };
      notify(next);
      return next;
    });
  };

  // ── Cloud hydration ──────────────────────────────────────────────────────────
  const hydrateFromCloud = useCallback((data: Partial<BotConfig>) => {
    if (!data) return;
    setBot(prev => ({
      ...prev,
      ...data,
      // Ensure nested objects are merged properly, not replaced with stale defaults
      llmConfig: data.llmConfig ? { ...prev.llmConfig, ...data.llmConfig } : prev.llmConfig,
      kbSources: data.kbSources ? data.kbSources.map(s => ({ ...s, addedAt: new Date(s.addedAt) })) : prev.kbSources,
      agentTools: data.agentTools ?? prev.agentTools,
      customAgents: data.customAgents ?? prev.customAgents ?? [],
      connectedApps: (data as any).connectedApps
        ?? (data as any).connectors
        ?? prev.connectedApps,
      faqItems: data.faqItems ?? prev.faqItems,
    }));
  }, []);

  const addChatMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = { ...msg, id: `msg-${Date.now()}`, timestamp: new Date() };
    setChatMessages(prev => [...prev, newMsg]);
  };

  const clearChat = () => setChatMessages([]);

  return (
    <BotContext.Provider value={{
      bot, updateBot, updateLLMConfig, resetBot,
      addKBSource, removeKBSource,
      addFAQItem, removeFAQItem,
      toggleAgentTool, updateAgentToolConfig,
      addConnectedApp, removeConnectedApp, toggleConnectedApp, updateConnectedApp, setPresetConnectorEnabled,
      addCustomAgent, updateCustomAgent, removeCustomAgent, toggleCustomAgent,
      hydrateFromCloud,
      chatMessages, addChatMessage, clearChat,
    }}>
      {children}
    </BotContext.Provider>
  );
}
