/** Types pour l'espace Simulation (roleplay) — worldbuilding, personas, chat. */

import {
  emptySimulationMemory,
  formatMemoryForPrompt,
  normalizeSimulationMemory,
  type SimulationMemory,
} from '@/types/simulationMemory';
import { SIMULATION_OUTPUT_FORMAT_INSTRUCTIONS } from '@/services/simulationRoleplayFormat';
import {
  normalizeSimulationThemeId,
  type SimulationThemeId,
} from '@/types/simulationTheme';
import {
  emptyFeatureContent,
  formatFeaturesForPrompt,
  normalizeFeatureContent,
  type SimulationFeatureContent,
} from '@/types/simulationFeatureContent';

export type {
  SimulationFeatureContent,
  SimulationInventoryItem,
  SimulationAlbumItem,
  SimulationSkillItem,
  SimulationFeatureMessageItem,
} from '@/types/simulationFeatureContent';
export {
  emptyFeatureContent,
  normalizeFeatureContent,
  formatFeaturesForPrompt,
} from '@/types/simulationFeatureContent';

export type { SimulationThemeId } from '@/types/simulationTheme';
export {
  SIMULATION_THEME_META,
  resolveSimulationThemeColors,
  simulationThemeLabel,
  normalizeSimulationThemeId,
} from '@/types/simulationTheme';

export type {
  SimulationMemory,
  SimulationMemoryEntry,
  SimulationMemoryItem,
  MemorySectionId,
  MemoryCharacterCategory,
  MemoryLinkSubsection,
} from '@/types/simulationMemory';
export {
  MEMORY_AUTO_UPDATE_EVERY_N,
  MEMORY_SECTION_META,
  normalizeMemoryKey,
  resolveMemoryWikilink,
  shouldAutoUpdateMemory,
  mergeMemoryItems,
  formatMemoryForPrompt,
  emptySimulationMemory,
  MEMORY_CHARACTER_CATEGORY_META,
  MEMORY_LINK_SUBSECTION_META,
} from '@/types/simulationMemory';

export type ConversationKind = 'classique' | 'simulation';

/** PNJ / personnages du monde (réponses séparées plus tard). */
export interface SimulationCharacter {
  id: string;
  name: string;
  description: string;
  /** Traits / personnalité (remplis plus tard via UI ou vault) */
  traits: string[];
  avatarColor?: string;
  avatarUri?: string;
}

/** Persona joueur (switchable). */
export interface SimulationPersona {
  id: string;
  /** Nom court affiché dans le switcher */
  name: string;
  avatarUri?: string;
  identity: string;
  physique: string;
  personality: string;
  tastes: string;
  /** Le reste des infos du personnage */
  background: string;
}

export interface SimulationWorld {
  /** Titre court (liste / en-tête) — dérivé de l'introduction si vide */
  title: string;
  /** URI locale ou data-URI de l'icône du monde */
  iconUri?: string;
  /** Contexte primordial de l'histoire */
  introduction: string;
  /** Message de bienvenue (affiché / injecté au démarrage) */
  welcomeMessage: string;
  /** Grand champ : monde, contexte, personnages importants */
  backgroundContext: string;
  /**
   * Règles du roleplay — priorité absolue pour l'IA (au-dessus de tout le reste).
   * Absent des apps chatbot classiques ; migration douce → chaîne vide.
   */
  rules: string;
  /**
   * Ancien champ étape 1 — conservé pour migration douce.
   * Si `backgroundContext` est vide, on lit `synopsis`.
   */
  synopsis?: string;
  /**
   * Ids de dossiers du vault 123Écriture choisis pour le worldbuilding.
   * Remplis à l'étape d'import (pas encore branché).
   */
  knowledgeFolderIds: string[];
}

/** Identifiants des modules gameplay optionnels (Simulation). */
export type SimulationFeatureId = 'inventory' | 'album' | 'skills' | 'messages';

/**
 * Interrupteurs des fonctionnalités complémentaires — par conversation.
 * Défauts : tout à off (activés seulement si le roleplay en a besoin).
 */
export interface SimulationFeatures {
  /** Inventaire — items qui entrent/sortent selon la progression */
  inventory: boolean;
  /** Album photo — photos partagées ou générées pendant la partie */
  album: boolean;
  /** Carnet d'acquisitions — progression des compétences */
  skills: boolean;
  /** Messages — petits messages d'interaction à influence ultérieure */
  messages: boolean;
}

export const DEFAULT_SIMULATION_FEATURES: SimulationFeatures = {
  inventory: false,
  album: false,
  skills: false,
  messages: false,
};

export const SIMULATION_FEATURE_META: Record<
  SimulationFeatureId,
  { label: string; description: string; emptyHint: string; icon: string }
> = {
  inventory: {
    label: 'Inventaire',
    description: 'Items qui entrent ou sortent selon la progression du roleplay',
    emptyHint: 'Aucun objet pour l’instant. Les items apparaîtront ici au fil de la partie.',
    icon: 'inventory-2',
  },
  album: {
    label: 'Album photo',
    description: 'Photos partagées ou générées pendant la partie',
    emptyHint: 'Aucune photo pour l’instant. Les images partagées ou générées s’afficheront ici.',
    icon: 'photo-library',
  },
  skills: {
    label: 'Carnet d’acquisitions',
    description: 'Progression des compétences au fil du roleplay',
    emptyHint: 'Aucune compétence suivie pour l’instant. Les acquisitions s’ajouteront ici.',
    icon: 'menu-book',
  },
  messages: {
    label: 'Messages',
    description: 'Petits messages d’interaction à influence ultérieure',
    emptyHint: 'Aucun message pour l’instant. Les interactions notables s’afficheront ici.',
    icon: 'mark-unread-chat-alt',
  },
};

export function emptySimulationFeatures(partial?: Partial<SimulationFeatures>): SimulationFeatures {
  return {
    inventory: partial?.inventory ?? false,
    album: partial?.album ?? false,
    skills: partial?.skills ?? false,
    messages: partial?.messages ?? false,
  };
}

export interface SimulationData {
  world: SimulationWorld;
  /** Personas joueur (plusieurs possibles, un actif) */
  personas: SimulationPersona[];
  activePersonaId?: string;
  /** PNJ — moteur multi-persos plus tard */
  characters: SimulationCharacter[];
  /** Mémoire structurée (Personnages / Liens / Lieux) + journal legacy */
  memory: SimulationMemory;
  notes: string;
  /**
   * false = afficher la page de création avant le chat.
   * Les simulations déjà créées en 1.7.5 passent à true à la normalisation
   * si du contenu existait déjà.
   */
  setupComplete: boolean;
  /**
   * Fonctionnalités complémentaires (gameplay) — toggles par conversation.
   * Défauts off ; contenu dans `featureContent` (CRUD + injection prompt).
   */
  features: SimulationFeatures;
  /**
   * Contenu CRUD des modules activés (inventaire, album, compétences, messages).
   */
  featureContent: SimulationFeatureContent;
  /**
   * Thème UI de cette conversation uniquement (fond + bulles).
   * `default` = thème global de l’app.
   */
  theme: SimulationThemeId;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyPersona(partial?: Partial<SimulationPersona>): SimulationPersona {
  return {
    id: partial?.id ?? newId('persona'),
    name: partial?.name ?? '',
    avatarUri: partial?.avatarUri,
    identity: partial?.identity ?? '',
    physique: partial?.physique ?? '',
    personality: partial?.personality ?? '',
    tastes: partial?.tastes ?? '',
    background: partial?.background ?? '',
  };
}

export function emptySimulationData(): SimulationData {
  const persona = emptyPersona({ name: 'Mon persona' });
  return {
    world: {
      title: '',
      iconUri: undefined,
      introduction: '',
      welcomeMessage: '',
      backgroundContext: '',
      rules: '',
      knowledgeFolderIds: [],
    },
    personas: [persona],
    activePersonaId: persona.id,
    characters: [],
    memory: emptySimulationMemory(),
    notes: '',
    setupComplete: false,
    features: emptySimulationFeatures(),
    featureContent: emptyFeatureContent(),
    theme: 'default',
  };
}

/** Migration douce depuis l'étape 1 (1.7.5) et champs manquants → vides. */
export function normalizeSimulationData(raw: any, opts?: { hadMessages?: boolean }): SimulationData {
  const base = emptySimulationData();
  const sim = raw && typeof raw === 'object' ? raw : {};
  const worldIn = sim.world && typeof sim.world === 'object' ? sim.world : {};
  const synopsis = String(worldIn.synopsis ?? '');
  const backgroundContext = String(worldIn.backgroundContext ?? '') || synopsis;
  const introduction = String(worldIn.introduction ?? '');
  const title =
    String(worldIn.title ?? '').trim() ||
    introduction.trim().slice(0, 48) ||
    synopsis.trim().slice(0, 48) ||
    '';

  const personasRaw = Array.isArray(sim.personas) ? sim.personas : [];
  let personas: SimulationPersona[] = personasRaw.map((p: any) =>
    emptyPersona({
      id: String(p?.id ?? newId('persona')),
      name: String(p?.name ?? '') || 'Persona',
      avatarUri: p?.avatarUri ? String(p.avatarUri) : undefined,
      identity: String(p?.identity ?? ''),
      physique: String(p?.physique ?? ''),
      personality: String(p?.personality ?? ''),
      tastes: String(p?.tastes ?? ''),
      background: String(p?.background ?? ''),
    }),
  );
  if (personas.length === 0) {
    personas = [emptyPersona({ name: 'Mon persona' })];
  }

  const activePersonaId = personas.some((p) => p.id === sim.activePersonaId)
    ? String(sim.activePersonaId)
    : personas[0].id;

  // setupComplete : explicite, ou déjà un peu rempli / messages existants
  const explicitSetup = typeof sim.setupComplete === 'boolean' ? sim.setupComplete : undefined;
  const looksConfigured =
    !!(title || introduction || backgroundContext || String(worldIn.welcomeMessage ?? '').trim() || String(worldIn.rules ?? '').trim());
  const setupComplete =
    explicitSetup ?? (opts?.hadMessages === true || looksConfigured);

  return {
    world: {
      title,
      iconUri: worldIn.iconUri ? String(worldIn.iconUri) : undefined,
      introduction,
      welcomeMessage: String(worldIn.welcomeMessage ?? ''),
      backgroundContext,
      rules: String(worldIn.rules ?? ''),
      synopsis: synopsis || undefined,
      knowledgeFolderIds: Array.isArray(worldIn.knowledgeFolderIds)
        ? worldIn.knowledgeFolderIds.map(String)
        : [],
    },
    personas,
    activePersonaId,
    characters: Array.isArray(sim.characters)
      ? sim.characters.map((c: any) => ({
          id: String(c?.id ?? newId('char')),
          name: String(c?.name ?? ''),
          description: String(c?.description ?? ''),
          traits: Array.isArray(c?.traits) ? c.traits.map(String) : [],
          avatarColor: c?.avatarColor ? String(c.avatarColor) : undefined,
          avatarUri: c?.avatarUri ? String(c.avatarUri) : undefined,
        }))
      : [],
    memory: normalizeSimulationMemory(sim.memory),
    notes: String(sim.notes ?? ''),
    setupComplete,
    features: emptySimulationFeatures({
      inventory: !!(sim.features && sim.features.inventory),
      album: !!(sim.features && sim.features.album),
      skills: !!(sim.features && sim.features.skills),
      messages: !!(sim.features && sim.features.messages),
    }),
    featureContent: normalizeFeatureContent(sim.featureContent),
    theme: normalizeSimulationThemeId(sim.theme),
  };
}

export function defaultTitleForKind(kind: ConversationKind): string {
  return kind === 'simulation' ? 'Nouvelle simulation' : 'Nouvelle conversation';
}

export function getActivePersona(sim?: SimulationData | null): SimulationPersona | undefined {
  if (!sim?.personas?.length) return undefined;
  return sim.personas.find((p) => p.id === sim.activePersonaId) ?? sim.personas[0];
}

/** Injection prompt pour le moteur de chat existant (une voix pour l'instant). */
export function buildSimulationPromptInjection(
  sim: SimulationData,
  opts?: { maxBotChars?: number },
): string {
  const w = sim.world;
  const persona = getActivePersona(sim);
  const lines: string[] = [
    '## MODE SIMULATION (roleplay)',
    'Tu incarnes le narrateur / les personnages du monde décrit ci-dessous.',
    'Reste immersif, cohérent avec le worldbuilding et le persona joueur.',
    'Contenu mature autorisé si l’utilisateur le demande.',
    'Ne montre JAMAIS ton raisonnement, plan ou « thinking » — uniquement la scène.',
    SIMULATION_OUTPUT_FORMAT_INSTRUCTIONS,
  ];
  const maxBot = opts?.maxBotChars;
  if (typeof maxBot === 'number' && maxBot > 0) {
    lines.push(
      '### LIMITE DE LONGUEUR DES RÉPONSES',
      `Tes réponses doivent faire AU MAXIMUM ${maxBot} caractères (espaces inclus).`,
      'Adapte-toi : sois concis si besoin, coupe proprement, ne dépasse JAMAIS cette limite.',
      'Cette contrainte de longueur s’applique à chaque message que tu produis.',
    );
  }
  // PRIORITÉ MAXIMALE : les règles battent intro, bienvenue, contexte et persona.
  if (w.rules?.trim()) {
    lines.push(
      '### RÈGLES DU ROLEPLAY — PRIORITÉ ABSOLUE',
      'Ces règles sont NON NÉGOCIABLES. Elles prévalent sur toute autre instruction',
      'de ce mode (introduction, message de bienvenue, contexte d’arrière-plan,',
      'persona joueur, mémoire, notes). En cas de conflit, applique TOUJOURS les règles.',
      w.rules.trim(),
    );
  }
  // Mémoire structurée — priorité juste sous les Règles
  const memBlock = formatMemoryForPrompt(sim.memory);
  if (memBlock) lines.push(memBlock);
  // Modules gameplay actifs (contenu joueur)
  const featBlock = formatFeaturesForPrompt(
    sim.features ?? { inventory: false, album: false, skills: false, messages: false },
    sim.featureContent,
  );
  if (featBlock) lines.push(featBlock);
  if (w.title?.trim()) lines.push(`### Monde — ${w.title.trim()}`);
  if (w.introduction?.trim()) lines.push(`Introduction :\n${w.introduction.trim()}`);
  if (w.backgroundContext?.trim()) lines.push(`Contexte d’arrière-plan :\n${w.backgroundContext.trim()}`);
  if (w.welcomeMessage?.trim()) lines.push(`(Message de bienvenue prévu : ${w.welcomeMessage.trim().slice(0, 280)})`);
  if (persona) {
    lines.push(`### Persona joueur — ${persona.name || 'sans nom'}`);
    if (persona.identity.trim()) lines.push(`Identité : ${persona.identity.trim()}`);
    if (persona.physique.trim()) lines.push(`Physique : ${persona.physique.trim()}`);
    if (persona.personality.trim()) lines.push(`Personnalité : ${persona.personality.trim()}`);
    if (persona.tastes.trim()) lines.push(`Goûts : ${persona.tastes.trim()}`);
    if (persona.background.trim()) lines.push(`Arrière-plan : ${persona.background.trim()}`);
  }
  if (sim.characters.length > 0) {
    lines.push('### Personnages (PNJ)');
    for (const c of sim.characters) {
      lines.push(`- ${c.name || 'PNJ'}: ${c.description || ''}${c.traits?.length ? ` [${c.traits.join(', ')}]` : ''}`);
    }
  }
  if (sim.notes.trim()) lines.push(`### Notes\n${sim.notes.trim()}`);
  return `\n\n${lines.join('\n')}`;
}
