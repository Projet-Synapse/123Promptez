// Powered by OnSpace.AI
import React, { createContext, useState, ReactNode } from 'react';

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
  apiKey: string;
}

interface BotContextType {
  bot: BotConfig;
  updateBot: (updates: Partial<BotConfig>) => void;
  updateLLMConfig: (updates: Partial<LLMConfig>) => void;
  addKBSource: (source: Omit<KBSource, 'id' | 'addedAt'>) => void;
  removeKBSource: (id: string) => void;
  addFAQItem: (item: Omit<FAQItem, 'id'>) => void;
  removeFAQItem: (id: string) => void;
  toggleAgentTool: (toolId: string) => void;
  updateAgentToolConfig: (toolId: string, config: Record<string, string>) => void;
  addConnectedApp: (app: Omit<ConnectedApp, 'id'>) => void;
  removeConnectedApp: (id: string) => void;
  toggleConnectedApp: (id: string) => void;
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
    model: 'gpt-4o',
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
    { id: 'db_access', enabled: false },
    { id: 'automation', enabled: false },
    { id: 'code_exec', enabled: false },
    { id: 'file_read', enabled: true },
  ],
  connectedApps: [],
};

export const BotContext = createContext<BotContextType | undefined>(undefined);

export function BotProvider({ children }: { children: ReactNode }) {
  const [bot, setBot] = useState<BotConfig>(DEFAULT_BOT);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const updateBot = (updates: Partial<BotConfig>) => {
    setBot(prev => ({ ...prev, ...updates }));
  };

  const updateLLMConfig = (updates: Partial<LLMConfig>) => {
    setBot(prev => ({ ...prev, llmConfig: { ...prev.llmConfig, ...updates } }));
  };

  const addKBSource = (source: Omit<KBSource, 'id' | 'addedAt'>) => {
    const newSource: KBSource = { ...source, id: `kb-${Date.now()}`, addedAt: new Date() };
    setBot(prev => ({ ...prev, kbSources: [...prev.kbSources, newSource] }));
  };

  const removeKBSource = (id: string) => {
    setBot(prev => ({ ...prev, kbSources: prev.kbSources.filter(s => s.id !== id) }));
  };

  const addFAQItem = (item: Omit<FAQItem, 'id'>) => {
    const newItem: FAQItem = { ...item, id: `faq-${Date.now()}` };
    setBot(prev => ({ ...prev, faqItems: [...prev.faqItems, newItem] }));
  };

  const removeFAQItem = (id: string) => {
    setBot(prev => ({ ...prev, faqItems: prev.faqItems.filter(f => f.id !== id) }));
  };

  const toggleAgentTool = (toolId: string) => {
    setBot(prev => ({
      ...prev,
      agentTools: prev.agentTools.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t),
    }));
  };

  const updateAgentToolConfig = (toolId: string, config: Record<string, string>) => {
    setBot(prev => ({
      ...prev,
      agentTools: prev.agentTools.map(t => t.id === toolId ? { ...t, config } : t),
    }));
  };

  const addConnectedApp = (app: Omit<ConnectedApp, 'id'>) => {
    const newApp: ConnectedApp = { ...app, id: `app-${Date.now()}` };
    setBot(prev => ({ ...prev, connectedApps: [...prev.connectedApps, newApp] }));
  };

  const removeConnectedApp = (id: string) => {
    setBot(prev => ({ ...prev, connectedApps: prev.connectedApps.filter(a => a.id !== id) }));
  };

  const toggleConnectedApp = (id: string) => {
    setBot(prev => ({
      ...prev,
      connectedApps: prev.connectedApps.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a),
    }));
  };

  const addChatMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = { ...msg, id: `msg-${Date.now()}`, timestamp: new Date() };
    setChatMessages(prev => [...prev, newMsg]);
  };

  const clearChat = () => setChatMessages([]);

  return (
    <BotContext.Provider value={{
      bot, updateBot, updateLLMConfig,
      addKBSource, removeKBSource,
      addFAQItem, removeFAQItem,
      toggleAgentTool, updateAgentToolConfig,
      addConnectedApp, removeConnectedApp, toggleConnectedApp,
      chatMessages, addChatMessage, clearChat,
    }}>
      {children}
    </BotContext.Provider>
  );
}
