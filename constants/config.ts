// Powered by OnSpace.AI
export const LLM_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', tokens: 128000 },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'OpenAI', tokens: 128000 },
  { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'OpenAI', tokens: 16385 },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic', tokens: 200000 },
  { id: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'Anthropic', tokens: 200000 },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google', tokens: 1000000 },
  { id: 'llama-3.1-70b', label: 'Llama 3.1 70B', provider: 'Meta / Local', tokens: 128000 },
  { id: 'mistral-large', label: 'Mistral Large', provider: 'Mistral AI', tokens: 128000 },
];

export const AGENT_TOOLS = [
  { id: 'web_search', label: 'Recherche Web', icon: 'search', description: 'Recherche en temps réel via DuckDuckGo / Serper' },
  { id: 'db_access', label: 'Accès Base de données', icon: 'storage', description: 'Lire / écrire dans une base de données structurée' },
  { id: 'automation', label: 'Automatisations', icon: 'bolt', description: 'Déclencher des webhooks et intégrations externes' },
  { id: 'code_exec', label: 'Exécution de code', icon: 'code', description: 'Exécuter du Python / JS dans un sandbox sécurisé' },
  { id: 'file_read', label: 'Lecture de fichiers', icon: 'folder-open', description: 'Accéder aux fichiers uploadés dans la knowledge base' },
];

export const KB_SOURCE_TYPES = [
  { id: 'text', label: 'Texte libre', icon: 'text-fields' },
  { id: 'file', label: 'Fichier (PDF/TXT/DOCX)', icon: 'upload-file' },
  { id: 'url', label: 'URL / Lien web', icon: 'link' },
  { id: 'faq', label: 'FAQ structurée', icon: 'question-answer' },
  { id: 'schema', label: 'Schéma de données', icon: 'account-tree' },
];
