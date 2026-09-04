import React, { createContext, useState, ReactNode, useCallback, useRef } from 'react';
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

export interface DBSubFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  files: DBFile[];
  createdAt: Date;
}

export interface DBFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  files: DBFile[];
  subFolders: DBSubFolder[];
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

export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface WorkspaceTask {
  id: string;
  title: string;
  description: string;
  frequency: TaskFrequency;
  promptInjection: string;
  enabled: boolean;
  color: string;
  icon: string;
  lastCompleted: Date | null;
  nextDue: Date | null;
  createdAt: Date;
}

// ── Automations ────────────────────────────────────────────────────────────────
export type AutomationTrigger =
  | 'message_received'   // On every user message
  | 'conversation_start' // When a new conversation begins
  | 'keyword'            // When a specific keyword is detected in the message
  | 'scheduled'          // Time-based (uses frequency)
  | 'file_added'         // When a file is added to the database
  | 'mode_activated';    // When a mode is enabled

export type AutomationAction =
  | 'inject_prompt'      // Inject text into the system prompt
  | 'set_mode'           // Activate a workspace mode
  | 'send_message'       // Auto-send a message to the AI
  | 'change_model'       // Switch LLM model
  | 'notify';            // Display a notification banner in chat

export interface WorkspaceAutomation {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  triggerKeyword?: string;       // used when trigger === 'keyword'
  triggerFrequency?: TaskFrequency; // used when trigger === 'scheduled'
  action: AutomationAction;
  actionPayload: string;         // text for inject_prompt/send_message/notify, modeId for set_mode, model for change_model
  runCount: number;
  lastRun: Date | null;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  systemPrompt: string;
  modes: WorkspaceMode[];
  tasks: WorkspaceTask[];
  automations: WorkspaceAutomation[];
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
  addWorkspace: (ws: Omit<Workspace, 'id' | 'createdAt' | 'conversations' | 'activeConversationId' | 'tasks' | 'automations'>) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  hydrateFromCloud: (data: unknown) => void;
  // Modes
  addMode: (workspaceId: string, mode: Omit<WorkspaceMode, 'id'>) => void;
  updateMode: (workspaceId: string, modeId: string, updates: Partial<WorkspaceMode>) => void;
  removeMode: (workspaceId: string, modeId: string) => void;
  toggleMode: (workspaceId: string, modeId: string) => void;
  getActiveModes: (workspaceId: string) => WorkspaceMode[];
  // Tasks
  addTask: (workspaceId: string, task: Omit<WorkspaceTask, 'id' | 'createdAt' | 'lastCompleted' | 'nextDue'>) => void;
  updateTask: (workspaceId: string, taskId: string, updates: Partial<WorkspaceTask>) => void;
  removeTask: (workspaceId: string, taskId: string) => void;
  toggleTask: (workspaceId: string, taskId: string) => void;
  completeTask: (workspaceId: string, taskId: string) => void;
  getDueTasks: (workspaceId: string) => WorkspaceTask[];
  // Automations
  addAutomation: (workspaceId: string, automation: Omit<WorkspaceAutomation, 'id' | 'createdAt' | 'runCount' | 'lastRun'>) => void;
  updateAutomation: (workspaceId: string, autoId: string, updates: Partial<WorkspaceAutomation>) => void;
  removeAutomation: (workspaceId: string, autoId: string) => void;
  toggleAutomation: (workspaceId: string, autoId: string) => void;
  recordAutomationRun: (workspaceId: string, autoId: string) => void;
  getActiveAutomations: (workspaceId: string) => WorkspaceAutomation[];
  // Conversations
  addConversation: (workspaceId: string, title?: string) => string;
  removeConversation: (workspaceId: string, conversationId: string) => void;
  renameConversation: (workspaceId: string, conversationId: string, title: string) => void;
  setActiveConversation: (workspaceId: string, conversationId: string) => void;
  addMessageToConversation: (workspaceId: string, conversationId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearConversation: (workspaceId: string, conversationId: string) => void;
  getActiveConversation: (workspaceId: string) => Conversation | undefined;
  // Database — folders
  addFolder: (workspaceId: string, folder: Omit<DBFolder, 'id' | 'files' | 'subFolders' | 'createdAt'>) => void;
  updateFolder: (workspaceId: string, folderId: string, updates: Partial<DBFolder>) => void;
  removeFolder: (workspaceId: string, folderId: string) => void;
  // Database — sub-folders
  addSubFolder: (workspaceId: string, folderId: string, sub: Omit<DBSubFolder, 'id' | 'files' | 'createdAt'>) => void;
  updateSubFolder: (workspaceId: string, folderId: string, subId: string, updates: Partial<DBSubFolder>) => void;
  removeSubFolder: (workspaceId: string, folderId: string, subId: string) => void;
  // Database — files
  addFile: (workspaceId: string, location: FileLocation, file: Omit<DBFile, 'id' | 'createdAt' | 'updatedAt' | 'size'>) => void;
  updateFile: (workspaceId: string, location: FileLocation, fileId: string, updates: Partial<DBFile>) => void;
  removeFile: (workspaceId: string, location: FileLocation, fileId: string) => void;
  moveFile: (workspaceId: string, fileId: string, from: FileLocation, to: FileLocation) => void;
}

export type FileLocation = null | string | { folderId: string; subId: string };

const EMPTY_DATABASE: WorkspaceDatabase = { rootFiles: [], folders: [] };

function makeConversation(title: string = 'Nouvelle conversation'): Conversation {
  return { id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, messages: [], createdAt: new Date(), updatedAt: new Date() };
}

function computeNextDue(frequency: TaskFrequency, from: Date = new Date()): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

function reviveDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      result[key] = new Date(v);
    } else if (v && typeof v === 'object') {
      result[key] = reviveDates(v);
    } else {
      result[key] = v;
    }
  }
  return result;
}

function normalizeFolders(folders: DBFolder[]): DBFolder[] {
  return folders.map(f => ({ ...f, subFolders: f.subFolders ?? [] }));
}

function normalizeWorkspace(ws: any): Workspace {
  return {
    ...ws,
    automations: ws.automations ?? [],
    database: {
      ...ws.database,
      folders: normalizeFolders(ws.database?.folders ?? []),
    },
  };
}

const DEFAULT_CONV_GENERAL = makeConversation('Conversation générale');
const DEFAULT_CONV_DEV = makeConversation('Session de développement');
const DEFAULT_CONV_CREATIVE = makeConversation('Brainstorming créatif');

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'ws-default', name: 'Général', icon: 'home', color: '#3D7EFF',
    description: 'Workspace polyvalent par défaut',
    systemPrompt: 'Tu es un assistant IA utile, précis et concis. Tu répondras toujours en français sauf si on te parle dans une autre langue.',
    conversations: [DEFAULT_CONV_GENERAL], activeConversationId: DEFAULT_CONV_GENERAL.id,
    tasks: [{ id: 'task-daily-brief', title: 'Brief quotidien', description: "Résumer les priorités du jour", frequency: 'daily', promptInjection: "TÂCHE QUOTIDIENNE: Propose un brief quotidien structuré.", enabled: true, color: '#3D7EFF', icon: 'today', lastCompleted: null, nextDue: new Date(), createdAt: new Date() }],
    automations: [
      { id: 'auto-welcome', name: 'Message de bienvenue', description: 'Envoie un message de bienvenue au démarrage de chaque conversation', icon: 'waving-hand', color: '#3D7EFF', enabled: false, trigger: 'conversation_start', action: 'inject_prompt', actionPayload: 'Au début de cette conversation, souhaite la bienvenue à l\'utilisateur de façon chaleureuse et demande comment tu peux l\'aider.', runCount: 0, lastRun: null, createdAt: new Date() },
    ],
    database: {
      rootFiles: [{ id: 'file-demo-1', name: 'Bienvenue.md', type: 'markdown', content: '# Bienvenue dans votre base de données\n\nAjoutez ici vos documents, notes et références.', tags: ['intro'], size: 120, createdAt: new Date(), updatedAt: new Date() }],
      folders: [{ id: 'folder-docs', name: 'Documentation', icon: 'folder-special', color: '#3D7EFF', description: 'Documents de référence', files: [], subFolders: [], createdAt: new Date() }],
    },
    createdAt: new Date(),
    modes: [
      { id: 'mode-concis', label: 'Mode Concis', icon: 'compress', description: 'Réponses courtes et directes', promptInjection: 'IMPORTANT: Réponses très courtes (max 3 phrases).', enabled: false, color: '#3D7EFF', shortcut: '/court' },
      { id: 'mode-expert', label: 'Mode Expert', icon: 'school', description: 'Réponses détaillées avec explications techniques', promptInjection: "Tu es en mode EXPERT. Fournis des explications détaillées.", enabled: false, color: '#9B59B6', shortcut: '/détail' },
      { id: 'mode-traduction', label: 'Traducteur', icon: 'translate', description: 'Traduit chaque réponse en anglais', promptInjection: 'TRADUCTEUR ACTIF: Ajoute une section "🇬🇧 English:" après chaque réponse.', enabled: false, color: '#00CC6A', shortcut: '/traduis' },
    ],
  },
  {
    id: 'ws-dev', name: 'Développement', icon: 'code', color: '#00FF88',
    description: 'Assistant technique pour le code',
    systemPrompt: 'Tu es un expert développeur senior. Fournis toujours du code propre, commenté et testé.',
    conversations: [DEFAULT_CONV_DEV], activeConversationId: DEFAULT_CONV_DEV.id,
    tasks: [{ id: 'task-weekly-review', title: 'Revue hebdomadaire du code', description: "Rappeler les bonnes pratiques", frequency: 'weekly', promptInjection: "TÂCHE HEBDOMADAIRE: Propose une revue hebdomadaire.", enabled: true, color: '#00FF88', icon: 'rate-review', lastCompleted: null, nextDue: new Date(), createdAt: new Date() }],
    automations: [
      { id: 'auto-debug-keyword', name: 'Mode debug auto', description: 'Active le mode debug quand "error" ou "bug" est détecté', icon: 'bug-report', color: '#FF4455', enabled: false, trigger: 'keyword', triggerKeyword: 'error|bug|erreur', action: 'inject_prompt', actionPayload: 'MODE DEBUG AUTO: L\'utilisateur rencontre une erreur. Analyse le problème méthodiquement: cause racine, explication, solution étape par étape, prévention future.', runCount: 0, lastRun: null, createdAt: new Date() },
    ],
    database: { ...EMPTY_DATABASE, folders: [] },
    createdAt: new Date(),
    modes: [
      { id: 'mode-review', label: 'Code Review', icon: 'rate-review', description: 'Analyse le code', promptInjection: 'MODE CODE REVIEW: Analyse le code. Bugs, perf, sécurité, note /10.', enabled: false, color: '#FF6B35', shortcut: '/review' },
      { id: 'mode-doc', label: 'Auto-Documentation', icon: 'description', description: 'Génère la doc JSDoc/docstring', promptInjection: 'AUTO-DOC: Génère la documentation complète.', enabled: false, color: '#3D7EFF', shortcut: '/doc' },
      { id: 'mode-debug', label: 'Debugger', icon: 'bug-report', description: "Mode investigation d'erreurs", promptInjection: "MODE DEBUG: Cause racine, explication, solution step-by-step.", enabled: false, color: '#FF4455', shortcut: '/debug' },
    ],
  },
  {
    id: 'ws-creative', name: 'Créatif', icon: 'brush', color: '#FF6B35',
    description: 'Écriture, créativité et brainstorming',
    systemPrompt: "Tu es un assistant créatif passionné.",
    conversations: [DEFAULT_CONV_CREATIVE], activeConversationId: DEFAULT_CONV_CREATIVE.id,
    tasks: [],
    automations: [],
    database: { rootFiles: [], folders: [] },
    createdAt: new Date(),
    modes: [
      { id: 'mode-brainstorm', label: 'Brainstorm', icon: 'lightbulb', description: 'Génère 10 idées pour chaque demande', promptInjection: 'BRAINSTORM: Génère toujours minimum 10 idées créatives.', enabled: false, color: '#FFB800', shortcut: '/idées' },
      { id: 'mode-storytelling', label: 'Narrateur', icon: 'auto-stories', description: 'Répond sous forme narrative', promptInjection: 'MODE NARRATEUR: Transforme tes réponses en récit immersif.', enabled: false, color: '#9B59B6', shortcut: '/raconte' },
    ],
  },
];

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface Props { children: ReactNode; onDataChange?: (workspaces: Workspace[]) => void; }

export function WorkspaceProvider({ children, onDataChange }: Props) {
  const [workspaces, setWorkspacesRaw] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-default');
  const isHydrating = useRef(false);

  const setWorkspaces = useCallback((updater: Workspace[] | ((prev: Workspace[]) => Workspace[])) => {
    setWorkspacesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!isHydrating.current) onDataChange?.(next);
      return next;
    });
  }, [onDataChange]);

  const hydrateFromCloud = useCallback((data: unknown) => {
    if (!data) return;
    try {
      isHydrating.current = true;
      const parsed = reviveDates(data) as Workspace[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(normalizeWorkspace);
        setWorkspacesRaw(normalized);
        setActiveWorkspaceId(normalized[0].id);
      }
    } catch (e) {
      console.warn('[WorkspaceContext] hydrateFromCloud failed:', e);
    } finally {
      isHydrating.current = false;
    }
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const setActiveWorkspace = (id: string) => setActiveWorkspaceId(id);

  const addWorkspace = (ws: Omit<Workspace, 'id' | 'createdAt' | 'conversations' | 'activeConversationId' | 'tasks' | 'automations'>) => {
    const firstConv = makeConversation('Nouvelle conversation');
    const newWs: Workspace = { ...ws, id: `ws-${Date.now()}`, createdAt: new Date(), conversations: [firstConv], activeConversationId: firstConv.id, tasks: [], automations: [] };
    setWorkspaces(prev => [...prev, newWs]);
  };

  const updateWorkspace = (id: string, updates: Partial<Workspace>) =>
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));

  const removeWorkspace = (id: string) => {
    if (workspaces.length <= 1) return;
    setWorkspaces(prev => prev.filter(w => w.id !== id));
    if (activeWorkspaceId === id)
      setActiveWorkspaceId(workspaces.find(w => w.id !== id)?.id || 'ws-default');
  };

  // ─── Modes ───────────────────────────────────────────────────────
  const addMode = (wid: string, mode: Omit<WorkspaceMode, 'id'>) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, modes: [...w.modes, { ...mode, id: `mode-${Date.now()}` }] } : w));
  const updateMode = (wid: string, mid: string, updates: Partial<WorkspaceMode>) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, modes: w.modes.map(m => m.id === mid ? { ...m, ...updates } : m) } : w));
  const removeMode = (wid: string, mid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, modes: w.modes.filter(m => m.id !== mid) } : w));
  const toggleMode = (wid: string, mid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, modes: w.modes.map(m => m.id === mid ? { ...m, enabled: !m.enabled } : m) } : w));
  const getActiveModes = (wid: string) => (workspaces.find(w => w.id === wid)?.modes ?? []).filter(m => m.enabled);

  // ─── Tasks ───────────────────────────────────────────────────────
  const addTask = (wid: string, task: Omit<WorkspaceTask, 'id' | 'createdAt' | 'lastCompleted' | 'nextDue'>) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, tasks: [...w.tasks, { ...task, id: `task-${Date.now()}`, lastCompleted: null, nextDue: new Date(), createdAt: new Date() }] } : w));
  const updateTask = (wid: string, tid: string, updates: Partial<WorkspaceTask>) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, tasks: w.tasks.map(t => t.id === tid ? { ...t, ...updates } : t) } : w));
  const removeTask = (wid: string, tid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, tasks: w.tasks.filter(t => t.id !== tid) } : w));
  const toggleTask = (wid: string, tid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, tasks: w.tasks.map(t => t.id === tid ? { ...t, enabled: !t.enabled } : t) } : w));
  const completeTask = (wid: string, tid: string) => {
    const now = new Date();
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : { ...w, tasks: w.tasks.map(t => t.id !== tid ? t : { ...t, lastCompleted: now, nextDue: computeNextDue(t.frequency, now) }) }));
  };
  const getDueTasks = (wid: string): WorkspaceTask[] => {
    const ws = workspaces.find(w => w.id === wid);
    if (!ws) return [];
    return ws.tasks.filter(t => t.enabled && (!t.nextDue || new Date(t.nextDue) <= new Date()));
  };

  // ─── Automations ─────────────────────────────────────────────────
  const addAutomation = (wid: string, auto: Omit<WorkspaceAutomation, 'id' | 'createdAt' | 'runCount' | 'lastRun'>) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, automations: [...(w.automations ?? []), { ...auto, id: `auto-${Date.now()}`, runCount: 0, lastRun: null, createdAt: new Date() }] } : w));
  const updateAutomation = (wid: string, aid: string, updates: Partial<WorkspaceAutomation>) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, automations: (w.automations ?? []).map(a => a.id === aid ? { ...a, ...updates } : a) } : w));
  const removeAutomation = (wid: string, aid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, automations: (w.automations ?? []).filter(a => a.id !== aid) } : w));
  const toggleAutomation = (wid: string, aid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, automations: (w.automations ?? []).map(a => a.id === aid ? { ...a, enabled: !a.enabled } : a) } : w));
  const recordAutomationRun = (wid: string, aid: string) => {
    const now = new Date();
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, automations: (w.automations ?? []).map(a => a.id === aid ? { ...a, runCount: a.runCount + 1, lastRun: now } : a) } : w));
  };
  const getActiveAutomations = (wid: string) => {
    const ws = workspaces.find(w => w.id === wid);
    return (ws?.automations ?? []).filter(a => a.enabled);
  };

  // ─── Conversations ───────────────────────────────────────────────
  const addConversation = (wid: string, title?: string): string => {
    const conv = makeConversation(title || 'Nouvelle conversation');
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, conversations: [...w.conversations, conv], activeConversationId: conv.id } : w));
    return conv.id;
  };
  const removeConversation = (wid: string, cid: string) =>
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== wid) return w;
      const remaining = w.conversations.filter(c => c.id !== cid);
      if (remaining.length === 0) { const fb = makeConversation(); return { ...w, conversations: [fb], activeConversationId: fb.id }; }
      const newActive = w.activeConversationId === cid ? remaining[remaining.length - 1].id : w.activeConversationId;
      return { ...w, conversations: remaining, activeConversationId: newActive };
    }));
  const renameConversation = (wid: string, cid: string, title: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, conversations: w.conversations.map(c => c.id === cid ? { ...c, title, updatedAt: new Date() } : c) } : w));
  const setActiveConversation = (wid: string, cid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, activeConversationId: cid } : w));
  const addMessageToConversation = (wid: string, cid: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMsg: ChatMessage = { ...msg, id: `msg-${Date.now()}`, timestamp: new Date() };
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : {
      ...w, conversations: w.conversations.map(c => {
        if (c.id !== cid) return c;
        const isFirst = c.messages.length === 0 && msg.role === 'user';
        const title = isFirst ? msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : '') : c.title;
        return { ...c, title, messages: [...c.messages, newMsg], updatedAt: new Date() };
      })
    }));
  };
  const clearConversation = (wid: string, cid: string) =>
    setWorkspaces(prev => prev.map(w => w.id === wid ? { ...w, conversations: w.conversations.map(c => c.id === cid ? { ...c, messages: [], updatedAt: new Date() } : c) } : w));
  const getActiveConversation = (wid: string) => {
    const ws = workspaces.find(w => w.id === wid);
    return ws?.conversations.find(c => c.id === ws.activeConversationId);
  };

  // ─── File helpers ─────────────────────────────────────────────────
  function getFilesAt(db: WorkspaceDatabase, loc: FileLocation): DBFile[] {
    if (loc === null) return db.rootFiles;
    if (typeof loc === 'string') return db.folders.find(f => f.id === loc)?.files ?? [];
    return db.folders.find(f => f.id === loc.folderId)?.subFolders?.find(s => s.id === loc.subId)?.files ?? [];
  }
  function setFilesAt(db: WorkspaceDatabase, loc: FileLocation, files: DBFile[]): WorkspaceDatabase {
    if (loc === null) return { ...db, rootFiles: files };
    if (typeof loc === 'string') return { ...db, folders: db.folders.map(f => f.id === loc ? { ...f, files } : f) };
    return { ...db, folders: db.folders.map(f => f.id === loc.folderId ? { ...f, subFolders: (f.subFolders ?? []).map(s => s.id === loc.subId ? { ...s, files } : s) } : f) };
  }

  // ─── Folders ─────────────────────────────────────────────────────
  const addFolder = (wid: string, folder: Omit<DBFolder, 'id' | 'files' | 'subFolders' | 'createdAt'>) =>
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : { ...w, database: { ...w.database, folders: [...w.database.folders, { ...folder, id: `folder-${Date.now()}`, files: [], subFolders: [], createdAt: new Date() }] } }));
  const updateFolder = (wid: string, fid: string, updates: Partial<DBFolder>) =>
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : { ...w, database: { ...w.database, folders: w.database.folders.map(f => f.id === fid ? { ...f, ...updates } : f) } }));
  const removeFolder = (wid: string, fid: string) =>
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : { ...w, database: { ...w.database, folders: w.database.folders.filter(f => f.id !== fid) } }));

  // ─── Sub-Folders ──────────────────────────────────────────────────
  const addSubFolder = (wid: string, fid: string, sub: Omit<DBSubFolder, 'id' | 'files' | 'createdAt'>) =>
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : { ...w, database: { ...w.database, folders: w.database.folders.map(f => f.id !== fid ? f : { ...f, subFolders: [...(f.subFolders ?? []), { ...sub, id: `sub-${Date.now()}`, files: [], createdAt: new Date() }] }) } }));
  const updateSubFolder = (wid: string, fid: string, sid: string, updates: Partial<DBSubFolder>) =>
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : { ...w, database: { ...w.database, folders: w.database.folders.map(f => f.id !== fid ? f : { ...f, subFolders: (f.subFolders ?? []).map(s => s.id === sid ? { ...s, ...updates } : s) }) } }));
  const removeSubFolder = (wid: string, fid: string, sid: string) =>
    setWorkspaces(prev => prev.map(w => w.id !== wid ? w : { ...w, database: { ...w.database, folders: w.database.folders.map(f => f.id !== fid ? f : { ...f, subFolders: (f.subFolders ?? []).filter(s => s.id !== sid) }) } }));

  // ─── Files ───────────────────────────────────────────────────────
  const addFile = (wid: string, location: FileLocation, file: Omit<DBFile, 'id' | 'createdAt' | 'updatedAt' | 'size'>) => {
    const newFile: DBFile = { ...file, id: `file-${Date.now()}`, size: file.content.length, createdAt: new Date(), updatedAt: new Date() };
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== wid) return w;
      return { ...w, database: setFilesAt(w.database, location, [...getFilesAt(w.database, location), newFile]) };
    }));
  };
  const updateFile = (wid: string, location: FileLocation, fileId: string, updates: Partial<DBFile>) =>
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== wid) return w;
      const files = getFilesAt(w.database, location).map(f => f.id === fileId ? { ...f, ...updates, updatedAt: new Date(), size: (updates.content ?? f.content).length } : f);
      return { ...w, database: setFilesAt(w.database, location, files) };
    }));
  const removeFile = (wid: string, location: FileLocation, fileId: string) =>
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== wid) return w;
      return { ...w, database: setFilesAt(w.database, location, getFilesAt(w.database, location).filter(f => f.id !== fileId)) };
    }));
  const moveFile = (wid: string, fileId: string, from: FileLocation, to: FileLocation) =>
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== wid) return w;
      const file = getFilesAt(w.database, from).find(f => f.id === fileId);
      if (!file) return w;
      let db = setFilesAt(w.database, from, getFilesAt(w.database, from).filter(f => f.id !== fileId));
      db = setFilesAt(db, to, [...getFilesAt(db, to), file]);
      return { ...w, database: db };
    }));

  return (
    <WorkspaceContext.Provider value={{
      workspaces, activeWorkspaceId, activeWorkspace,
      setActiveWorkspace, addWorkspace, updateWorkspace, removeWorkspace, hydrateFromCloud,
      addMode, updateMode, removeMode, toggleMode, getActiveModes,
      addTask, updateTask, removeTask, toggleTask, completeTask, getDueTasks,
      addAutomation, updateAutomation, removeAutomation, toggleAutomation, recordAutomationRun, getActiveAutomations,
      addConversation, removeConversation, renameConversation, setActiveConversation,
      addMessageToConversation, clearConversation, getActiveConversation,
      addFolder, updateFolder, removeFolder,
      addSubFolder, updateSubFolder, removeSubFolder,
      addFile, updateFile, removeFile, moveFile,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
