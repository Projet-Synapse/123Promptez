// Models available to the chat edge function (supabase/functions/chat).
// IDs must match real Anthropic Claude model IDs — see ANTHROPIC_API_KEY setup in README.
export const LLM_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', provider: 'Anthropic', tokens: 1000000 },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Anthropic', tokens: 1000000 },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic', tokens: 200000 },
];

export const AGENT_TOOLS = [
  {
    id: 'web_search',
    label: 'Recherche Web',
    icon: 'search',
    description: 'Recherche en temps réel · Google, Brave, DuckDuckGo, Bing au choix',
  },
  {
    id: 'image_analysis',
    label: "Analyse d'image",
    icon: 'image-search',
    description: "Analyse et décrit le contenu d'images (vision IA via GPT-4V / Gemini Vision)",
  },
  {
    id: 'db_access',
    label: 'Accès Base de données',
    icon: 'storage',
    description: 'Lire / écrire dans une base de données structurée',
  },
  {
    id: 'automation',
    label: 'Automatisations',
    icon: 'bolt',
    description: 'Déclencher des webhooks et intégrations externes',
  },
  {
    id: 'code_exec',
    label: 'Exécution de code',
    icon: 'code',
    description: 'Exécuter du Python / JS dans un sandbox sécurisé',
  },
  {
    id: 'file_read',
    label: 'Lecture de fichiers',
    icon: 'folder-open',
    description: 'Accéder aux fichiers uploadés dans la knowledge base',
  },
];

export const WEB_SEARCH_ENGINES = [
  { id: 'google', label: 'Google', icon: 'language', color: '#4285F4' },
  { id: 'brave', label: 'Brave Search', icon: 'shield', color: '#FB542B' },
  { id: 'duckduckgo', label: 'DuckDuckGo', icon: 'search', color: '#DE5833' },
  { id: 'bing', label: 'Bing', icon: 'travel-explore', color: '#008373' },
];

export const KB_SOURCE_TYPES = [
  { id: 'text', label: 'Texte libre', icon: 'text-fields' },
  { id: 'file', label: 'Fichier joint', icon: 'upload-file' },
  { id: 'image', label: 'Image', icon: 'image' },
  { id: 'url', label: 'URL / Lien web', icon: 'link' },
  { id: 'faq', label: 'FAQ structurée', icon: 'question-answer' },
  { id: 'schema', label: 'Schéma de données', icon: 'account-tree' },
];

export const APP_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

/** Catalogue de connecteurs Builder — OAuth réel non requis (UI + persistence). */
export const CONNECTOR_PRESETS = [
  {
    id: 'github',
    label: 'GitHub',
    icon: 'code',
    color: '#E6EDF3',
    description: 'Recherche de dépôts pour les dossiers vault (Personal Access Token)',
    comingSoon: false,
  },
  {
    id: 'supabase',
    label: 'Supabase',
    icon: 'storage',
    color: '#3ECF8E',
    description: 'Base de données, auth et edge functions',
    comingSoon: true,
  },
  {
    id: 'google',
    label: 'Google',
    icon: 'cloud',
    color: '#4285F4',
    description: 'Drive, Gmail et calendrier',
    comingSoon: true,
  },
  {
    id: 'slack',
    label: 'Slack',
    icon: 'forum',
    color: '#E01E5A',
    description: 'Canaux et notifications d’équipe',
    comingSoon: true,
  },
  {
    id: 'notion',
    label: 'Notion',
    icon: 'description',
    color: '#FFFFFF',
    description: 'Pages et bases de connaissances',
    comingSoon: true,
  },
  {
    id: 'discord',
    label: 'Discord',
    icon: 'chat',
    color: '#5865F2',
    description: 'Serveurs et webhooks Discord',
    comingSoon: true,
  },
] as const;
