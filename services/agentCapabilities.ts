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
import type { Workspace, DBFile } from '@/contexts/WorkspaceContext';

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
  return (
    ws.database.rootFiles.length +
    ws.database.folders.reduce(
      (acc, f) => acc + f.files.length + (f.subFolders ?? []).reduce((sa, s) => sa + s.files.length, 0),
      0,
    )
  );
}

function collectFiles(ws: Workspace): DBFile[] {
  return [
    ...ws.database.rootFiles,
    ...ws.database.folders.flatMap(f => [
      ...f.files,
      ...(f.subFolders ?? []).flatMap(s => s.files),
    ]),
  ];
}

// ─── Capacités fixes (toujours évaluées sur l'état courant) ─────────────────
export const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: 'workspace_files',
    label: 'Lecture de la base du workspace',
    description: 'Fichiers, vault et dépôts — leur contenu est fourni dans la conversation',
    icon: 'folder-open',
    truth: 'Lire le contenu des fichiers listés dans « BASE DU WORKSPACE » ci-dessous (lecture seule : tu ne peux pas créer, modifier ni supprimer de fichiers, ni accéder à des fichiers absents de cette liste).',
    enabled: ws => countWorkspaceFiles(ws) > 0,
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

// ─── Connecteurs : décrits honnêtement (aucune exécution externe) ────────────
function connectorCapabilities(bot: BotConfig): AgentCapability[] {
  return bot.connectedApps
    .filter(a => a.enabled)
    .map(a => ({
      id: `connector_${a.id}`,
      label: a.name,
      description: a.description,
      icon: 'cable',
      truth: `Parler de la connexion « ${a.name} » (${a.description}) si l'utilisateur en parle — c'est une référence d'information : aucune action externe n'est déclenchée automatiquement, ne promets pas de lire ou modifier des données chez ces services.`,
      enabled: () => true,
    }));
}

/** Liste honnête des capacités actives, pour l'UI comme pour le prompt. */
export function getActiveCapabilities(ws: Workspace, bot: BotConfig): AgentCapability[] {
  return [...AGENT_CAPABILITIES.filter(c => c.enabled(ws, bot)), ...connectorCapabilities(bot)];
}

/** Section « CE QUE TU PEUX FAIRE » pour le prompt système. */
export function buildCapabilitiesPrompt(ws: Workspace, bot: BotConfig): string {
  const caps = getActiveCapabilities(ws, bot);
  if (caps.length === 0) return '';
  let out = '## CE QUE TU PEUX FAIRE (capacités réelles — ne promets rien d\'autre)\n\n';
  caps.forEach(c => {
    out += `- ${c.truth}\n`;
  });
  return `${out}\n`;
}

// ─── Contexte du workspace injecté au modèle ────────────────────────────────
const CONTENT_BUDGET_CHARS = 60_000; // contenu total des fichiers
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
    const tree = ws.database.folders
      .map(f => {
        const subs = (f.subFolders ?? [])
          .map(s => `  - ${s.name}/ (${s.files.length} fichier(s))`)
          .join('\n');
        return `- ${f.name}/ (${f.files.length} fichier(s)${subs ? '\n' + subs : ''})`;
      })
      .join('\n');
    const rootCount = ws.database.rootFiles.length;
    out += `## BASE DU WORKSPACE (lecture seule)\n\n`;
    out += `Inventaire : ${rootCount} fichier(s) à la racine, ${ws.database.folders.length} dossier(s).\n`;
    if (ws.database.rootFiles.length > 0) {
      out += `Racine : ${ws.database.rootFiles.map(f => f.name).join(', ')}\n`;
    }
    if (ws.database.folders.length > 0) out += `${tree}\n`;
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
