/** Types pour l'espace Simulation (roleplay) — worldbuilding, personas, chat. */

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

export interface SimulationMemoryEntry {
  id: string;
  text: string;
  createdAt: string; // ISO — JSON-friendly for cloud sync
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

export interface SimulationData {
  world: SimulationWorld;
  /** Personas joueur (plusieurs possibles, un actif) */
  personas: SimulationPersona[];
  activePersonaId?: string;
  /** PNJ — moteur multi-persos plus tard */
  characters: SimulationCharacter[];
  memory: {
    entries: SimulationMemoryEntry[];
  };
  notes: string;
  /**
   * false = afficher la page de création avant le chat.
   * Les simulations déjà créées en 1.7.5 passent à true à la normalisation
   * si du contenu existait déjà.
   */
  setupComplete: boolean;
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
      knowledgeFolderIds: [],
    },
    personas: [persona],
    activePersonaId: persona.id,
    characters: [],
    memory: { entries: [] },
    notes: '',
    setupComplete: false,
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
    !!(title || introduction || backgroundContext || String(worldIn.welcomeMessage ?? '').trim());
  const setupComplete =
    explicitSetup ?? (opts?.hadMessages === true || looksConfigured);

  return {
    world: {
      title,
      iconUri: worldIn.iconUri ? String(worldIn.iconUri) : undefined,
      introduction,
      welcomeMessage: String(worldIn.welcomeMessage ?? ''),
      backgroundContext,
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
    memory: {
      entries: Array.isArray(sim.memory?.entries)
        ? sim.memory.entries.map((e: any) => ({
            id: String(e?.id ?? newId('mem')),
            text: String(e?.text ?? ''),
            createdAt: String(e?.createdAt ?? new Date().toISOString()),
          }))
        : [],
    },
    notes: String(sim.notes ?? ''),
    setupComplete,
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
export function buildSimulationPromptInjection(sim: SimulationData): string {
  const w = sim.world;
  const persona = getActivePersona(sim);
  const lines: string[] = [
    '## MODE SIMULATION (roleplay)',
    'Tu incarnes le narrateur / les personnages du monde décrit ci-dessous.',
    'Reste immersif, cohérent avec le worldbuilding et le persona joueur.',
    'Contenu mature autorisé si l’utilisateur le demande.',
  ];
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
  if (sim.memory.entries.length > 0) {
    lines.push('### Mémoire de partie');
    for (const e of sim.memory.entries.slice(-12)) lines.push(`- ${e.text}`);
  }
  if (sim.notes.trim()) lines.push(`### Notes\n${sim.notes.trim()}`);
  return `\n\n${lines.join('\n')}`;
}
