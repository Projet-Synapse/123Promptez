// agentCapabilities — SOURCE DE VÉRITÉ UNIQUE des capacités RÉELLES de l'agent.
//
// Tout ce qui touche aux capacités de l'IA lit CE fichier :
//  - le prompt système (services/chatService.ts) y puise la section
//    « CE QUE TU PEUX FAIRE » + le contexte du workspace ;
//  - l'interface (popover « + » du chat, Builder, flux d'activités) affiche
//    exactement la même liste.
//
// ⇒ Quand une capacité évolue ou qu'une nouvelle fonctionnalité agentique
//   arrive, on ne modifie QUE ici : prompt et interface restent synchronisés
//   et honnêtes (plus de promesses non tenues).
import type { BotConfig } from '@/contexts/BotContext';
import type { Workspace, DBFile, DBSubFolder } from '@/contexts/WorkspaceContext';

export interface AgentCapability {
  id: string;
  /** Libellé court (UI) */
  label: string;
  /** Une ligne d'explication (UI) */
  description: string;
  /** Icône MaterialIcons (UI) */
  icon: string;
  /**
   * Ce que l'IA peut VRAIMENT faire — injecté tel quel dans le prompt système.
   * Formulé à l'impératif, à la deuxième personne (« Lire… », « Cocher… »).
   */
  truth: string;
  enabled: (ws: Workspace, bot: BotConfig) => boolean;
}

export function countWorkspaceFiles(ws: Workspace): number {
  const countSubs = (subs?: DBSubFolder[]): number =>
    (subs ?? []).reduce((acc, s) => acc + s.files.length + countSubs(s.subFolders), 0);
  return (
    ws.database.rootFiles.length +
    ws.database.folders.reduce(
      (acc, f) => acc + f.files.length + countSubs(f.subFolders),
      0,
    )
  );
}

/** Tous les fichiers du workspace, TOUTE PROFONDEUR de sous-dossiers confondue. */
function collectFiles(ws: Workspace): DBFile[] {
  const fromSubs = (subs?: DBSubFolder[]): DBFile[] =>
    (subs ?? []).flatMap(s => [...s.files, ...fromSubs(s.subFolders)]);
  return [
    ...ws.database.rootFiles,
    ...ws.database.folders.flatMap(f => [...f.files, ...fromSubs(f.subFolders)]),
  ];
}

// ─── Capacités fixes (toujours évaluées sur l'état courant) ─────────────────
export const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: 'workspace_files',
    label: 'Bibliothèque du workspace',
    description: 'Lire et écrire réellement dans les fichiers via [OUTIL:…]',
    icon: 'folder-open',
    truth: 'Lire un fichier de la BIBLIOTHÈQUE DU WORKSPACE avec [OUTIL:lire_fichier:{"chemin":"…"}] et le MODIFIER ou en CRÉER un avec [OUTIL:ecrire_fichier:{"chemin":"…","contenu":"…"}] — exécution réelle par l\'application, résultat au tour suivant. Utilise ces outils dès que l\'utilisateur parle de ses fichiers.',
    enabled: ws => countWorkspaceFiles(ws) > 0,
  },
  {
    id: 'code_exec_client',
    label: 'Exécution de code',
    description: 'JavaScript réel dans une sandbox navigateur, console capturée',
    icon: 'code',
    truth: 'Exécuter du JavaScript RÉEL avec [OUTIL:executer_js:{"code":"…"}] — console.log et erreurs te reviennent au tour suivant (timeout 10 s). Sers-t-en pour calculer, tester un algorithme, vérifier une logique ou déboguer du code de la bibliothèque.',
    enabled: (_ws, bot) => bot.agentTools.some(t => t.id === 'code_exec' && t.enabled),
  },
  {
    id: 'workspace_tasks',
    label: 'Check-list des tâches',
    description: 'Lecture de la check-list, cochage via marqueur [x:id]',
    icon: 'checklist',
    truth: 'Lire la check-list « TÂCHES DU WORKSPACE » et cocher une tâche réellement accomplie en écrivant exactement son marqueur [x:<id>] sur une ligne séparée en fin de réponse.',
    enabled: ws => ws.tasks.some(t => t.enabled),
  },
  {
    id: 'workspace_automations',
    label: 'Connaissance des automatisations',
    description: 'Scénarios automatiques actifs du workspace',
    icon: 'bolt',
    truth: 'Connaître les automatisations actives listées dans « AUTOMATISATIONS ACTIVES » (elles sont déclenchées par l\'application, pas par toi : ne promets pas de les exécuter).',
    enabled: ws => (ws.automations ?? []).some(a => a.enabled),
  },
  {
    id: 'workspace_modes',
    label: 'Modes et instructions du workspace',
    description: 'Prompt système et compétences actives',
    icon: 'psychology',
    truth: 'Suivre le prompt système, les modes actifs et les instructions du workspace.',
    enabled: () => true,
  },
];

// ─── Connecteurs : décrits honnêtement, avec leurs prérequis ─────────────────
function connectorCapabilities(bot: BotConfig): AgentCapability[] {
  const caps: AgentCapability[] = [];

  // GitHub : capacité RÉELLE quand le connecteur est activé ET connecté (jeton)
  const github = bot.connectedApps.find(
    a => a.enabled && (a.id === 'github' || a.presetId === 'github'),
  );
  if (github) {
    const fileReadOn = bot.agentTools.some(t => t.id === 'file_read' && t.enabled);
    caps.push({
      id: 'github_repos',
      label: 'Dépôts GitHub',
      description: fileReadOn
        ? 'Lecture réelle des fichiers de dépôts publics via [OUTIL:…]'
        : 'Active l’outil « Lecture de fichiers » pour lire tes dépôts',
      icon: 'github',
      truth: fileReadOn
        ? 'Lire un fichier d\'un dépôt GitHub PUBLIC avec [OUTIL:lire_fichier_github:{"depot":"propriétaire/nom","chemin":"…"}] (paramètre « branche » optionnel, « main » par défaut) — exécution réelle, résultat au tour suivant.'
        : 'Le connecteur GitHub est activé, mais l\'outil « Lecture de fichiers » est désactivé : demande à l\'utilisateur de l\'activer dans les outils du chat pour lire les dépôts.',
      enabled: () => true,
    });
  }

  // Autres connecteurs (aucun pour l'instant) : références descriptives only.
  for (const app of bot.connectedApps.filter(
    a => a.enabled && !(a.id === 'github' || a.presetId === 'github' || a.id === 'supabase' || a.presetId === 'supabase'),
  )) {
    caps.push({
      id: `connector_${app.id}`,
      label: app.name,
      description: app.description,
      icon: 'cable',
      truth: `Parler de la connexion « ${app.name} » (${app.description}) si l'utilisateur en parle — c'est une référence d'information : aucune action externe n'est déclenchée automatiquement, ne promets pas de lire ou modifier des données chez ces services.`,
      enabled: () => true,
    });
  }
  return caps;
}

/** Liste honnête des capacités actives, pour l'UI comme pour le prompt. */
export function getActiveCapabilities(ws: Workspace, bot: BotConfig): AgentCapability[] {
  const caps = [...AGENT_CAPABILITIES.filter(c => c.enabled(ws, bot)), ...connectorCapabilities(bot)];

  // Supabase = backend de l'application (pas un connecteur externe) :
  // activé, il garantit que la base du workspace est synchronisée et à jour.
  const supabase = bot.connectedApps.find(
    a => a.enabled && (a.id === 'supabase' || a.presetId === 'supabase'),
  );
  if (supabase) {
    caps.push({
      id: 'supabase_backend',
      label: 'Sauvegarde Supabase',
      description: 'Ton workspace est synchronisé dans le cloud',
      icon: 'storage',
      truth: 'Le workspace actif est sauvegardé dans Supabase : les fichiers de la section « BIBLIOTHÈQUE DU WORKSPACE » en proviennent directement et sont à jour — toute écriture via ecrire_fichier est sauvegardée dans le cloud.',
      enabled: () => true,
    });
  }
  return caps;
}

/** Section « CE QUE TU PEUX FAIRE » pour le prompt système. */
export function buildCapabilitiesPrompt(ws: Workspace, bot: BotConfig): string {
  const caps = getActiveCapabilities(ws, bot);
  if (caps.length === 0) return '';
  let out = '## CE QUE TU PEUX FAIRE (capacités réelles — ne promets rien d\'autre)\n\n';
  caps.forEach(c => {
    out += `- ${c.truth}\n`;
  });

  // Protocole d'outils client : décrit précisément dès qu'au moins un outil
  // [OUTIL:…] est annoncé dans les capacités ci-dessus.
  if (caps.some(c => c.truth.includes('[OUTIL:'))) {
    out += `
### PROTOCOLE DES OUTILS (très important)

Pour exécuter une action réelle, écris dans ta réponse un marqueur EXACT de cette forme, sur sa propre ligne :
[OUTIL:nom_outil:{"parametre":"valeur"}]

L'application exécute le marqueur PUIS t'envoie un message « [RÉSULTATS D'OUTILS — …] ». Tu continues alors ta réponse en te servant de ces résultats.
- Le contenu entre [OUTIL: et ] doit être du JSON VALIDE : échappe les guillemets et les retours à la ligne (\\n) dans les chaînes.
- Écris d'abord une phrase courte annonçant l'action, puis le(s) marqueur(s) en fin de réponse. N'écris JAMAIS un marqueur dans un bloc de code.
- Tu peux mettre plusieurs marqueurs dans une même réponse pour plusieurs actions indépendantes.
- Pour modifier un fichier : ecrire_fichier REMPLACE tout le contenu du fichier par « contenu » — renvoie donc le fichier COMPLET, pas seulement un extrait.
- Ne réinvente jamais un résultat d'outil : attends le message [RÉSULTATS D'OUTILS].
- Après 3 tours d'outils consécutifs, conclus avec ce que tu sais.

`;
  }
  return `${out}\n`;
}

// ─── Contexte du workspace injecté au modèle ────────────────────────────────
const CONTENT_BUDGET_CHARS = 150_000; // contenu total des fichiers (~35k tokens, OK en 200k ctx)
const PER_FILE_CAP = 8_000;          // plafond par fichier

/**
 * Inventaire COMPLET des fichiers + contenus des fichiers les plus récents
 * dans la limite du budget, + check-list des tâches actives + automatisations.
 * C'est LA section de contexte du workspace, partagée par tous les appels IA.
 */
export function buildWorkspaceContextPrompt(ws: Workspace): string {
  let out = '';

  // 1) Inventaire complet (tous les fichiers, même hors budget contenu)
  const files = collectFiles(ws);
  if (files.length > 0) {
    // Arborescence COMPLÈTE (toute profondeur) : l'agent doit voir chaque
    // fichier pour pouvoir les lire/modifier via ses outils [OUTIL:…].
    const lines: string[] = [];
    const MAX_LINES = 900;
    const renderDir = (
      name: string,
      dirFiles: DBFile[],
      subs: { name: string; files: DBFile[]; subFolders?: any[] }[] | undefined,
      indent: string,
      depth: number,
    ) => {
      if (lines.length >= MAX_LINES) return;
      lines.push(`${indent}- ${name}/ (${dirFiles.length} fichier(s))`);
      if (depth >= 8 || lines.length >= MAX_LINES) return;
      for (const s of subs ?? []) {
        if (lines.length >= MAX_LINES) { lines.push(`${indent}  …`); return; }
        renderDir(s.name, s.files, s.subFolders, `${indent}  `, depth + 1);
      }
      for (const file of dirFiles) {
        if (lines.length >= MAX_LINES) { lines.push(`${indent}  …`); return; }
        lines.push(`${indent}  - ${file.name}`);
      }
    };
    for (const f of ws.database.folders) renderDir(f.name, f.files, f.subFolders, '', 0);
    if (lines.length >= MAX_LINES) lines.push('… (arborescence tronquée)');
    const rootCount = ws.database.rootFiles.length;
    out += `## BIBLIOTHÈQUE DU WORKSPACE (lecture et écriture via les outils [OUTIL:lire_fichier] et [OUTIL:ecrire_fichier])\n\n`;
    out += `Inventaire complet : ${rootCount} fichier(s) à la racine, ${ws.database.folders.length} dossier(s), ${files.length} fichier(s) au total. Les chemins ci-dessous sont EXACTEMENT ceux à utiliser dans les outils.\n`;
    if (ws.database.rootFiles.length > 0) {
      out += `Racine :\n${ws.database.rootFiles.map(f => `- ${f.name}`).join('\n')}\n`;
    }
    if (lines.length > 0) out += `${lines.join('\n')}\n`;
    out += '\n';

    // 2) Contenus : fichiers les plus récents d'abord, dans la limite du budget
    const sorted = [...files].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    let budget = CONTENT_BUDGET_CHARS;
    const withContent: DBFile[] = [];
    for (const file of sorted) {
      if (file.type === 'url') continue; // liens : pas de contenu à fournir
      if (budget <= 0) break;
      withContent.push(file);
      budget -= Math.min(file.content.length, PER_FILE_CAP);
    }
    if (withContent.length > 0) {
      out += `### Contenu des fichiers (les plus récents d'abord)\n\n`;
      for (const file of withContent) {
        const content =
          file.content.length > PER_FILE_CAP
            ? `${file.content.slice(0, PER_FILE_CAP)}\n[… tronqué]`
            : file.content;
        out += `#### ${file.name} (${file.type})\n${content}\n\n`;
      }
    }
    const withoutContent = sorted.filter(f => !withContent.includes(f) && f.type !== 'url');
    if (withoutContent.length > 0) {
      out += `### Fichiers dont le contenu n'est PAS fourni\n${withoutContent.map(f => f.name).join(', ')}\n`;
      out += `(Ne prétends pas connaître leur contenu — dis seulement qu'ils existent dans la base.)\n\n`;
    }
  }

  // 3) Check-list des tâches actives (avec marqueurs de cochage)
  const activeTasks = ws.tasks.filter(t => t.enabled);
  if (activeTasks.length > 0) {
    out += `## TÂCHES DU WORKSPACE (check-list partagée)\n\n`;
    activeTasks.forEach(t => {
      out += `- ${t.title} → marqueur de cochage : [x:${t.id}]\n`;
    });
    out += `Coche une tâche uniquement si tu viens réellement de l'accomplir dans cet échange.\n\n`;
  }

  // 4) Automatisations actives (information)
  const autos = (ws.automations ?? []).filter(a => a.enabled);
  if (autos.length > 0) {
    out += `## AUTOMATISATIONS ACTIVES\n\n`;
    autos.forEach(a => {
      out += `- ${a.name} : ${a.description}\n`;
    });
    out += '\n';
  }

  return out;
}
