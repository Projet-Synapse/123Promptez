// Models available to the chat edge function (supabase/functions/chat).
// IDs must match real Anthropic Claude model IDs — see ANTHROPIC_API_KEY setup in README.
// Gemini models are called DIRECTLY from the client (no Edge, no credits):
// a free Google AI Studio key (aistudio.google.com) pasted in Settings is enough.
export const LLM_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', provider: 'Anthropic', tokens: 1000000 },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Anthropic', tokens: 1000000 },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic', tokens: 200000 },
  { id: 'gemini-2.5-flash', label: 'Gemini Flash (gratuit · limites)', provider: 'Google', tokens: 1000000 },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini Flash-Lite (gratuit)', provider: 'Google', tokens: 1000000 },
];

export const AGENT_TOOLS = [
  {
    id: 'web_search',
    label: 'Recherche Web',
    icon: 'search',
    description: 'Recherche en temps réel sur le web — bientôt disponible',
    soon: true,
  },
  {
    id: 'image_analysis',
    label: "Analyse d'image",
    icon: 'image-search',
    description: "Analyse et décrit le contenu d'images — bientôt disponible",
    soon: true,
  },
  {
    id: 'db_access',
    label: 'Accès Base de données',
    icon: 'storage',
    description: 'Lire / écrire dans une base externe — bientôt disponible',
    soon: true,
  },
  {
    id: 'automation',
    label: 'Automatisations',
    icon: 'bolt',
    description: 'Déclencher des webhooks externes — bientôt disponible',
    soon: true,
  },
  {
    id: 'code_exec',
    label: 'Exécution de code',
    icon: 'code',
    description: 'Exécuter du JavaScript réel dans le chat (sandbox navigateur, console capturée)',
  },
  {
    id: 'file_read',
    label: 'Lecture de fichiers',
    icon: 'folder-open',
    description: 'Lire / modifier les fichiers de la bibliothèque et des dépôts GitHub publics',
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

/**
 * Catalogue de connecteurs — UNIQUEMENT des connecteurs réellement
 * fonctionnels (source de vérité partagée Builder + chat).
 * `iconSet: 'FontAwesome'` = icônes de marques réelles.
 */
export const CONNECTOR_PRESETS = [
  {
    id: 'github',
    label: 'GitHub',
    iconSet: 'FontAwesome' as const,
    icon: 'github',
    color: '#24292F',
    description: 'Dépôts privés et publics — arborescence complète importée dans la base',
    connectUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=123Promptez',
  },
  {
    id: 'supabase',
    label: 'Supabase',
    iconSet: 'FontAwesome' as const,
    icon: 'database',
    color: '#3ECF8E',
    description: 'Base de données cloud du workspace — sauvegarde et lecture par l’IA',
    connectUrl: '',
  },
] as const;
