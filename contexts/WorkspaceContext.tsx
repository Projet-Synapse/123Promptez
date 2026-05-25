// Powered by OnSpace.AI
import React, { createContext, useState, ReactNode } from 'react';
import type { ChatMessage } from '@/contexts/BotContext';

export interface DBFile {
  id: string;
  name: string;
  type: 'note' | 'text' | 'url' | 'markdown' | 'json' | 'code';
  content: string;
  tags: string[];
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  files: DBFile[];
  createdAt: Date;
}

export interface WorkspaceMode {
  id: string;
  label: string;
  icon: string;
  description: string;
  promptInjection: string;
  enabled: boolean;
  color: string;
  shortcut?: string;
}

export interface WorkspaceDatabase {
  rootFiles: DBFile[];
  folders: DBFolder[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  systemPrompt: string;
  modes: WorkspaceMode[];
  database: WorkspaceDatabase;
  conversations: Conversation[];
  activeConversationId: string;
  createdAt: Date;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeWorkspace: Workspace;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (ws: Omit<Workspace, 'id' | 'createdAt' | 'conversations' | 'activeConversationId'>) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  // Modes
  addMode: (workspaceId: string, mode: Omit<WorkspaceMode, 'id'>) => void;
  updateMode: (workspaceId: string, modeId: string, updates: Partial<WorkspaceMode>) => void;
  removeMode: (workspaceId: string, modeId: string) => void;
  toggleMode: (workspaceId: string, modeId: string) => void;
  getActiveModes: (workspaceId: string) => WorkspaceMode[];
  // Conversations
  addConversation: (workspaceId: string, title?: string) => string;
  removeConversation: (workspaceId: string, conversationId: string) => void;
  renameConversation: (workspaceId: string, conversationId: string, title: string) => void;
  setActiveConversation: (workspaceId: string, conversationId: string) => void;
  addMessageToConversation: (workspaceId: string, conversationId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearConversation: (workspaceId: string, conversationId: string) => void;
  getActiveConversation: (workspaceId: string) => Conversation | undefined;
  // Database
  addFolder: (workspaceId: string, folder: Omit<DBFolder, 'id' | 'files' | 'createdAt'>) => void;
  updateFolder: (workspaceId: string, folderId: string, updates: Partial<DBFolder>) => void;
  removeFolder: (workspaceId: string, folderId: string) => void;
  addFile: (workspaceId: string, folderId: string | null, file: Omit<DBFile, 'id' | 'createdAt' | 'updatedAt' | 'size'>) => void;
  updateFile: (workspaceId: string, folderId: string | null, fileId: string, updates: Partial<DBFile>) => void;
  removeFile: (workspaceId: string, folderId: string | null, fileId: string) => void;
  moveFile: (workspaceId: string, fileId: string, fromFolderId: string | null, toFolderId: string | null) => void;
}

const EMPTY_DATABASE: WorkspaceDatabase = { rootFiles: [], folders: [] };

function makeConversation(title: string = 'Nouvelle conversation'): Conversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const DEFAULT_CONV_GENERAL = makeConversation('Conversation générale');
const DEFAULT_CONV_DEV = makeConversation('Session de développement');
const DEFAULT_CONV_CREATIVE = makeConversation('Brainstorming créatif');

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'ws-default',
    name: 'Général',
    icon: 'home',
    color: '#3D7EFF',
    description: 'Workspace polyvalent par défaut',
    systemPrompt: 'Tu es un assistant IA utile, précis et concis. Tu répondras toujours en français sauf si on te parle dans une autre langue.',
    conversations: [DEFAULT_CONV_GENERAL],
    activeConversationId: DEFAULT_CONV_GENERAL.id,
    database: {
      rootFiles: [
        {
          id: 'file-demo-1',
          name: 'Bienvenue.md',
          type: 'markdown',
          content: '# Bienvenue dans votre base de données\n\nAjoutez ici vos documents, notes et références utilisés par votre assistant IA.',
          tags: ['intro'],
          size: 120,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      folders: [
        {
          id: 'folder-docs',
          name: 'Documentation',
          icon: 'folder-special',
          color: '#3D7EFF',
          description: 'Documents de référence',
          files: [],
          createdAt: new Date(),
        },
      ],
    },
    createdAt: new Date(),
    modes: [
      {
        id: 'mode-concis',
        label: 'Mode Concis',
        icon: 'compress',
        description: 'Réponses courtes et directes, sans fioritures',
        promptInjection: 'IMPORTANT: Tes réponses doivent être TRÈS courtes (max 3 phrases). Va droit au but. Pas de listes longues.',
        enabled: false,
        color: '#3D7EFF',
        shortcut: '/court',
      },
      {
        id: 'mode-expert',
        label: 'Mode Expert',
        icon: 'school',
        description: 'Réponses détaillées avec explications techniques',
        promptInjection: 'Tu es en mode EXPERT. Fournis des explications détaillées, des exemples concrets, des références techniques. Structure tes réponses avec des titres et listes.',
        enabled: false,
        color: '#9B59B6',
        shortcut: '/détail',
      },
      {
        id: 'mode-traduction',
        label: 'Traducteur',
        icon: 'translate',
        description: 'Traduit automatiquement chaque réponse en anglais',
        promptInjection: 'TRADUCTEUR ACTIF: Après chaque réponse normale, ajoute automatiquement une section "🇬🇧 English:" avec la traduction anglaise complète.',
        enabled: false,
        color: '#00CC6A',
        shortcut: '/traduis',
      },
    ],
  },
  {
    id: 'ws-dev',
    name: 'Développement',
    icon: 'code',
    color: '#00FF88',
    description: 'Assistant technique pour le code',
    systemPrompt: 'Tu es un expert développeur senior. Tu maîtrises TypeScript, React Native, Python, et les architectures modernes. Fournis toujours du code propre, commenté et testé. Signale les potentiels problèmes de sécurité et de performance.',
    conversations: [DEFAULT_CONV_DEV],
    activeConversationId: DEFAULT_CONV_DEV.id,
    database: { ...EMPTY_DATABASE },
    createdAt: new Date(),
    modes: [
      {
        id: 'mode-review',
        label: 'Code Review',
        icon: 'rate-review',
        description: 'Analyse le code pour bugs, perf et sécurité',
        promptInjection: 'MODE CODE REVIEW: Analyse systématiquement tout code soumis. Identifie: 1) Bugs potentiels 2) Problèmes de performance 3) Failles de sécurité 4) Mauvaises pratiques. Note sur 10.',
        enabled: false,
        color: '#FF6B35',
        shortcut: '/review',
      },
      {
        id: 'mode-doc',
        label: 'Auto-Documentation',
        icon: 'description',
        description: 'Génère automatiquement la doc JSDoc/docstring',
        promptInjection: 'AUTO-DOC ACTIF: Pour chaque fonction/classe soumise, génère automatiquement la documentation complète (JSDoc, paramètres, retours, exemples).',
        enabled: false,
        color: '#3D7EFF',
        shortcut: '/doc',
      },
      {
        id: 'mode-debug',
        label: 'Debugger',
        icon: 'bug-report',
        description: "Mode investigation d'erreurs et stack traces",
        promptInjection: "MODE DEBUG: Analyse les erreurs de façon systématique. Donne: 1) Cause racine 2) Explication simple 3) Solution step-by-step 4) Comment éviter à l'avenir.",
        enabled: false,
        color: '#FF4455',
        shortcut: '/debug',
      },
      {
        id: 'mode-refactor',
        label: 'Refactoring',
        icon: 'auto-fix-high',
        description: 'Propose des refactorisations propres',
        promptInjection: 'MODE REFACTORING: Propose systématiquement une version refactorisée améliorée du code avec explication des changements et leurs bénéfices.',
        enabled: false,
        color: '#9B59B6',
        shortcut: '/refactor',
      },
    ],
  },
  {
    id: 'ws-creative',
    name: 'Créatif',
    icon: 'brush',
    color: '#FF6B35',
    description: 'Écriture, créativité et brainstorming',
    systemPrompt: "Tu es un assistant créatif passionné. Tu aides à la rédaction, au storytelling, à la génération d'idées et à la créativité sous toutes ses formes. Tu as un style expressif et inspirant.",
    conversations: [DEFAULT_CONV_CREATIVE],
    activeConversationId: DEFAULT_CONV_CREATIVE.id,
    database: { ...EMPTY_DATABASE },
    createdAt: new Date(),
    modes: [
      {
        id: 'mode-brainstorm',
        label: 'Brainstorm',
        icon: 'lightbulb',
        description: 'Génère 10 idées créatives pour chaque demande',
        promptInjection: 'BRAINSTORM MODE: Pour chaque demande, génère TOUJOURS au minimum 10 idées créatives et originales. Pense hors des sentiers battus. Inclus des idées audacieuses.',
        enabled: false,
        color: '#FFB800',
        shortcut: '/idées',
      },
      {
        id: 'mode-storytelling',
        label: 'Narrateur',
        icon: 'auto-stories',
        description: 'Répond sous forme de récit narratif immersif',
        promptInjection: 'MODE NARRATEUR: Transforme tes réponses en récit narratif immersif. Utilise des métaphores, des anecdotes et un style littéraire engageant.',
        enabled: false,
        color: '#9B59B6',
        shortcut: '/raconte',
      },
      {
        id: 'mode-critique',
        label: 'Critique Constructif',
        icon: 'thumbs-up-down',
        description: 'Analyse critique bienveillante de tout contenu',
        promptInjection: 'MODE CRITIQUE: Analyse tout contenu soumis de façon constructive. Structure: Points forts → Points à améliorer → Suggestions concrètes.',
        enabled: false,
        color: '#00CC6A',
        shortcut: '/critique',
      },
    ],
  },
];

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-default');

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  const setActiveWorkspace = (id: string) => setActiveWorkspaceId(id);

  const addWorkspace = (ws: Omit<Workspace, 'id' | 'createdAt' | 'conversations' | 'activeConversationId'>) => {
    const firstConv = makeConversation('Nouvelle conversation');
    const newWs: Workspace = {
      ...ws,
      id: `ws-${Date.now()}`,
      createdAt: new Date(),
      conversations: [firstConv],
      activeConversationId: firstConv.id,
    };
    setWorkspaces(prev => [...prev, newWs]);
  };

  const updateWorkspace = (id: string, updates: Partial<Workspace>) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const removeWorkspace = (id: string) => {
    if (workspaces.length <= 1) return;
    setWorkspaces(prev => prev.filter(w => w.id !== id));
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(workspaces.find(w => w.id !== id)?.id || 'ws-default');
    }
  };

  // ─── Modes ───────────────────────────────────────────────────────
  const addMode = (workspaceId: string, mode: Omit<WorkspaceMode, 'id'>) => {
    const newMode: WorkspaceMode = { ...mode, id: `mode-${Date.now()}` };
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId ? { ...w, modes: [...w.modes, newMode] } : w
    ));
  };

  const updateMode = (workspaceId: string, modeId: string, updates: Partial<WorkspaceMode>) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? { ...w, modes: w.modes.map(m => m.id === modeId ? { ...m, ...updates } : m) }
        : w
    ));
  };

  const removeMode = (workspaceId: string, modeId: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId ? { ...w, modes: w.modes.filter(m => m.id !== modeId) } : w
    ));
  };

  const toggleMode = (workspaceId: string, modeId: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? { ...w, modes: w.modes.map(m => m.id === modeId ? { ...m, enabled: !m.enabled } : m) }
        : w
    ));
  };

  const getActiveModes = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    return ws ? ws.modes.filter(m => m.enabled) : [];
  };

  // ─── Conversations ────────────────────────────────────────────────
  const addConversation = (workspaceId: string, title?: string): string => {
    const conv = makeConversation(title || 'Nouvelle conversation');
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? { ...w, conversations: [...w.conversations, conv], activeConversationId: conv.id }
        : w
    ));
    return conv.id;
  };

  const removeConversation = (workspaceId: string, conversationId: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      const remaining = w.conversations.filter(c => c.id !== conversationId);
      if (remaining.length === 0) {
        const fallback = makeConversation('Nouvelle conversation');
        return { ...w, conversations: [fallback], activeConversationId: fallback.id };
      }
      const newActive = w.activeConversationId === conversationId
        ? remaining[remaining.length - 1].id
        : w.activeConversationId;
      return { ...w, conversations: remaining, activeConversationId: newActive };
    }));
  };

  const renameConversation = (workspaceId: string, conversationId: string, title: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? {
            ...w,
            conversations: w.conversations.map(c =>
              c.id === conversationId ? { ...c, title, updatedAt: new Date() } : c
            ),
          }
        : w
    ));
  };

  const setActiveConversation = (workspaceId: string, conversationId: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId ? { ...w, activeConversationId: conversationId } : w
    ));
  };

  const addMessageToConversation = (
    workspaceId: string,
    conversationId: string,
    msg: Omit<ChatMessage, 'id' | 'timestamp'>
  ) => {
    const newMsg: ChatMessage = { ...msg, id: `msg-${Date.now()}`, timestamp: new Date() };
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      return {
        ...w,
        conversations: w.conversations.map(c => {
          if (c.id !== conversationId) return c;
          // Auto-title from first user message
          const isFirst = c.messages.length === 0 && msg.role === 'user';
          const title = isFirst
            ? msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : '')
            : c.title;
          return { ...c, title, messages: [...c.messages, newMsg], updatedAt: new Date() };
        }),
      };
    }));
  };

  const clearConversation = (workspaceId: string, conversationId: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? {
            ...w,
            conversations: w.conversations.map(c =>
              c.id === conversationId ? { ...c, messages: [], updatedAt: new Date() } : c
            ),
          }
        : w
    ));
  };

  const getActiveConversation = (workspaceId: string): Conversation | undefined => {
    const ws = workspaces.find(w => w.id === workspaceId);
    return ws?.conversations.find(c => c.id === ws.activeConversationId);
  };

  // ─── Database ─────────────────────────────────────────────────────
  const addFolder = (workspaceId: string, folder: Omit<DBFolder, 'id' | 'files' | 'createdAt'>) => {
    const newFolder: DBFolder = { ...folder, id: `folder-${Date.now()}`, files: [], createdAt: new Date() };
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? { ...w, database: { ...w.database, folders: [...w.database.folders, newFolder] } }
        : w
    ));
  };

  const updateFolder = (workspaceId: string, folderId: string, updates: Partial<DBFolder>) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? { ...w, database: { ...w.database, folders: w.database.folders.map(f => f.id === folderId ? { ...f, ...updates } : f) } }
        : w
    ));
  };

  const removeFolder = (workspaceId: string, folderId: string) => {
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? { ...w, database: { ...w.database, folders: w.database.folders.filter(f => f.id !== folderId) } }
        : w
    ));
  };

  const addFile = (workspaceId: string, folderId: string | null, file: Omit<DBFile, 'id' | 'createdAt' | 'updatedAt' | 'size'>) => {
    const newFile: DBFile = {
      ...file,
      id: `file-${Date.now()}`,
      size: file.content.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      if (folderId === null) {
        return { ...w, database: { ...w.database, rootFiles: [...w.database.rootFiles, newFile] } };
      }
      return {
        ...w,
        database: {
          ...w.database,
          folders: w.database.folders.map(f =>
            f.id === folderId ? { ...f, files: [...f.files, newFile] } : f
          ),
        },
      };
    }));
  };

  const updateFile = (workspaceId: string, folderId: string | null, fileId: string, updates: Partial<DBFile>) => {
    const patch = { ...updates, updatedAt: new Date(), size: updates.content?.length };
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      if (folderId === null) {
        return { ...w, database: { ...w.database, rootFiles: w.database.rootFiles.map(f => f.id === fileId ? { ...f, ...patch } : f) } };
      }
      return {
        ...w,
        database: {
          ...w.database,
          folders: w.database.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, files: folder.files.map(f => f.id === fileId ? { ...f, ...patch } : f) }
              : folder
          ),
        },
      };
    }));
  };

  const removeFile = (workspaceId: string, folderId: string | null, fileId: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      if (folderId === null) {
        return { ...w, database: { ...w.database, rootFiles: w.database.rootFiles.filter(f => f.id !== fileId) } };
      }
      return {
        ...w,
        database: {
          ...w.database,
          folders: w.database.folders.map(folder =>
            folder.id === folderId
              ? { ...folder, files: folder.files.filter(f => f.id !== fileId) }
              : folder
          ),
        },
      };
    }));
  };

  const moveFile = (workspaceId: string, fileId: string, fromFolderId: string | null, toFolderId: string | null) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      let file: DBFile | undefined;
      if (fromFolderId === null) {
        file = w.database.rootFiles.find(f => f.id === fileId);
      } else {
        file = w.database.folders.find(f => f.id === fromFolderId)?.files.find(f => f.id === fileId);
      }
      if (!file) return w;
      let db = { ...w.database };
      if (fromFolderId === null) {
        db = { ...db, rootFiles: db.rootFiles.filter(f => f.id !== fileId) };
      } else {
        db = { ...db, folders: db.folders.map(folder => folder.id === fromFolderId ? { ...folder, files: folder.files.filter(f => f.id !== fileId) } : folder) };
      }
      if (toFolderId === null) {
        db = { ...db, rootFiles: [...db.rootFiles, file] };
      } else {
        db = { ...db, folders: db.folders.map(folder => folder.id === toFolderId ? { ...folder, files: [...folder.files, file!] } : folder) };
      }
      return { ...w, database: db };
    }));
  };

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspace,
      addWorkspace,
      updateWorkspace,
      removeWorkspace,
      addMode,
      updateMode,
      removeMode,
      toggleMode,
      getActiveModes,
      addConversation,
      removeConversation,
      renameConversation,
      setActiveConversation,
      addMessageToConversation,
      clearConversation,
      getActiveConversation,
      addFolder,
      updateFolder,
      removeFolder,
      addFile,
      updateFile,
      removeFile,
      moveFile,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
