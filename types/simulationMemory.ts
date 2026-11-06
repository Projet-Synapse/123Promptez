/**
 * Mémoire de roleplay (Simulation) — Personnages / Liens / Lieux clés.
 * Inspirée PolyBuzz, sans doublons (fusion par nom normalisé) ni écrasement
 * des edits manuels (`userEdited`).
 */

/** MAJ auto tous les N messages (user + assistant). Documenté / constant. */
export const MEMORY_AUTO_UPDATE_EVERY_N = 10;

export type MemorySectionId = 'characters' | 'links' | 'places';

/** Catégories Personnages — LEGACY (bulles retirées t209u). Conservé pour migration. */
export type MemoryCharacterCategory = 'principal' | 'secondaires' | 'enjeux' | 'anecdotiques';

/** Sous-sections Liens : Objets / Rapports / Évènements marquants. */
export type MemoryLinkSubsection = 'objets' | 'rapports' | 'evenements';

export const MEMORY_CHARACTER_CATEGORY_META: Record<
  MemoryCharacterCategory,
  { label: string; hint: string }
> = {
  principal: {
    label: 'Principal',
    hint: 'PNJ le plus présent (un seul) — pas le persona joueur',
  },
  secondaires: {
    label: 'Secondaires',
    hint: 'Personnages récurrents importants',
  },
  enjeux: {
    label: 'Enjeux',
    hint: 'Figures liées aux enjeux / conflits du roleplay',
  },
  anecdotiques: {
    label: 'Anecdotiques',
    hint: 'Apparitions ponctuelles',
  },
};

export const MEMORY_LINK_SUBSECTION_META: Record<
  MemoryLinkSubsection,
  { label: string; hint: string }
> = {
  objets: {
    label: 'Objets clés',
    hint: 'Objets narratifs importants',
  },
  rapports: {
    label: 'Rapports',
    hint: 'Liens relationnels entre personnages',
  },
  evenements: {
    label: 'Évènements marquants',
    hint: 'Moments clés du roleplay',
  },
};

/** Champs fiche Personnage (remplacent les bulles catégories). */
export const MEMORY_CHARACTER_FICHE_FIELDS: {
  key: 'age' | 'physique' | 'personality' | 'extraInfo' | 'location';
  label: string;
  multiline?: boolean;
}[] = [
  { key: 'age', label: 'Âge' },
  { key: 'physique', label: 'Description physique', multiline: true },
  { key: 'personality', label: 'Personnalité', multiline: true },
  { key: 'extraInfo', label: 'Informations complémentaires', multiline: true },
  { key: 'location', label: 'Emplacement' },
];

/** Champs fiche Évènement marquant (Description = summary). */
export const MEMORY_EVENT_FICHE_FIELDS: {
  key: 'participants' | 'summary' | 'time' | 'location';
  label: string;
  multiline?: boolean;
}[] = [
  { key: 'participants', label: 'Participants' },
  { key: 'summary', label: 'Description', multiline: true },
  { key: 'time', label: 'Temps' },
  { key: 'location', label: 'Emplacement' },
];

export const MEMORY_CHARACTER_CATEGORIES: MemoryCharacterCategory[] = [
  'principal',
  'secondaires',
  'enjeux',
  'anecdotiques',
];

export const MEMORY_LINK_SUBSECTIONS: MemoryLinkSubsection[] = ['objets', 'rapports', 'evenements'];


export interface SimulationMemoryEntry {
  id: string;
  text: string;
  createdAt: string;
}

/** Entrée structurée d'une section mémoire. */
export interface SimulationMemoryItem {
  id: string;
  name: string;
  summary: string;
  /** true = l'utilisateur a modifié à la main → les MAJ auto ne l'écrasent pas */
  userEdited: boolean;
  /** Clé normalisée (accents/casse) pour fusion et résolution [[wikilink]] */
  key: string;
  /** Liens objets/rapports : extrémités optionnelles */
  from?: string;
  to?: string;
  /** Personnages : catégorie LEGACY (bulles retirées). Conservée en migration. */
  characterCategory?: MemoryCharacterCategory;
  /** Personnages : true si c'est le persona joueur */
  isPlayerPersona?: boolean;
  /** Liens : Objets clés / Rapports / Évènements marquants */
  linkSubsection?: MemoryLinkSubsection;
  /** Fiche personnage */
  age?: string;
  physique?: string;
  personality?: string;
  extraInfo?: string;
  /** Emplacement (personnage ou évènement) */
  location?: string;
  /** Évènements : participants */
  participants?: string;
  /** Évènements : temps / moment */
  time?: string;
  updatedAt: string;
  /** true = nouveauté non encore consultée → badge 🔴 */
  isNew?: boolean;
}

export interface SimulationMemory {
  /** Ancien journal libre — conservé pour migration douce */
  entries: SimulationMemoryEntry[];
  /** false = jamais générée ; première ouverture de la page → génération */
  initialized: boolean;
  lastUpdatedAt?: string;
  /** messages.length au moment de la dernière génération / MAJ auto */
  messageCountAtLastUpdate: number;
  /** Intervalle de MAJ auto (défaut MEMORY_AUTO_UPDATE_EVERY_N) */
  updateEveryN: number;
  characters: SimulationMemoryItem[];
  links: SimulationMemoryItem[];
  places: SimulationMemoryItem[];
}

export const MEMORY_SECTION_META: Record<
  MemorySectionId,
  { label: string; icon: string; empty: string; addLabel: string }
> = {
  characters: {
    label: 'Personnages',
    icon: 'groups',
    empty: 'Aucun personnage mémorisé pour l’instant.',
    addLabel: 'Ajouter un personnage',
  },
  links: {
    label: 'Liens',
    icon: 'hub',
    empty: 'Aucun lien / relation mémorisé pour l’instant.',
    addLabel: 'Ajouter un lien',
  },
  places: {
    label: 'Lieux clés',
    icon: 'place',
    empty: 'Aucun lieu clé mémorisé pour l’instant.',
    addLabel: 'Ajouter un lieu',
  },
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Normalise un nom pour fusion / wikilink (casse, accents, ponctuation). */
export function normalizeMemoryKey(name: string): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function optStr(v: unknown): string | undefined {
  const s = String(v ?? '').trim();
  return s ? s : undefined;
}

export function emptyMemoryItem(
  partial?: Partial<SimulationMemoryItem> & { name?: string },
): SimulationMemoryItem {
  const name = String(partial?.name ?? '').trim() || 'Sans nom';
  const key = partial?.key?.trim() || normalizeMemoryKey(name);
  const characterCategory = normalizeCharacterCategory(partial?.characterCategory);
  const linkSubsection = normalizeLinkSubsection(partial?.linkSubsection);
  return {
    id: partial?.id ?? newId('memitem'),
    name,
    summary: String(partial?.summary ?? ''),
    userEdited: partial?.userEdited === true,
    key: key || normalizeMemoryKey(name) || newId('key'),
    from: optStr(partial?.from),
    to: optStr(partial?.to),
    characterCategory,
    isPlayerPersona: partial?.isPlayerPersona === true,
    linkSubsection,
    age: optStr(partial?.age),
    physique: optStr(partial?.physique),
    personality: optStr(partial?.personality),
    extraInfo: optStr(partial?.extraInfo),
    location: optStr(partial?.location),
    participants: optStr(partial?.participants),
    time: optStr(partial?.time),
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
    isNew: partial?.isNew === true,
  };
}

export function normalizeCharacterCategory(raw: any): MemoryCharacterCategory {
  const v = String(raw ?? '').toLowerCase().trim();
  if (v === 'principal') return 'principal';
  if (v === 'enjeux') return 'enjeux';
  if (v === 'anecdotiques' || v === 'anecdotique') return 'anecdotiques';
  return 'secondaires';
}

export function normalizeLinkSubsection(raw: any): MemoryLinkSubsection {
  const v = String(raw ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (v === 'objets' || v === 'objet' || v === 'objets cles' || v.includes('objet')) return 'objets';
  if (
    v === 'evenements' ||
    v === 'evenement' ||
    v.includes('evenement') ||
    v.includes('event')
  ) {
    return 'evenements';
  }
  return 'rapports';
}

export function emptySimulationMemory(partial?: Partial<SimulationMemory>): SimulationMemory {
  return {
    entries: Array.isArray(partial?.entries) ? partial!.entries! : [],
    initialized: partial?.initialized === true,
    lastUpdatedAt: partial?.lastUpdatedAt,
    messageCountAtLastUpdate:
      typeof partial?.messageCountAtLastUpdate === 'number' ? partial!.messageCountAtLastUpdate! : 0,
    updateEveryN:
      typeof partial?.updateEveryN === 'number' && partial!.updateEveryN! > 0
        ? Math.floor(partial!.updateEveryN!)
        : MEMORY_AUTO_UPDATE_EVERY_N,
    characters: Array.isArray(partial?.characters) ? partial!.characters! : [],
    links: Array.isArray(partial?.links) ? partial!.links! : [],
    places: Array.isArray(partial?.places) ? partial!.places! : [],
  };
}

function normalizeItemList(raw: any): SimulationMemoryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SimulationMemoryItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const item = emptyMemoryItem({
      id: r.id ? String(r.id) : undefined,
      name: String(r.name ?? ''),
      summary: String(r.summary ?? r.description ?? ''),
      userEdited: r.userEdited === true,
      key: r.key ? String(r.key) : undefined,
      from: r.from ? String(r.from) : undefined,
      to: r.to ? String(r.to) : undefined,
      characterCategory: r.characterCategory,
      isPlayerPersona: r.isPlayerPersona === true,
      linkSubsection: r.linkSubsection,
      age: r.age,
      physique: r.physique ?? r.physicalDescription ?? r.descriptionPhysique,
      personality: r.personality ?? r.personnalite,
      extraInfo: r.extraInfo ?? r.infosComplementaires ?? r.notes,
      location: r.location ?? r.emplacement ?? r.place,
      participants: r.participants,
      time: r.time ?? r.temps ?? r.when,
      updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
      isNew: r.isNew === true,
    });
    if (!item.key || seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

export function normalizeSimulationMemory(raw: any): SimulationMemory {
  const mem = raw && typeof raw === 'object' ? raw : {};
  const entries = Array.isArray(mem.entries)
    ? mem.entries.map((e: any) => ({
        id: String(e?.id ?? newId('mem')),
        text: String(e?.text ?? ''),
        createdAt: String(e?.createdAt ?? new Date().toISOString()),
      }))
    : [];
  const base = emptySimulationMemory({
    entries,
    initialized: mem.initialized === true,
    lastUpdatedAt: mem.lastUpdatedAt ? String(mem.lastUpdatedAt) : undefined,
    messageCountAtLastUpdate:
      typeof mem.messageCountAtLastUpdate === 'number' ? mem.messageCountAtLastUpdate : 0,
    updateEveryN:
      typeof mem.updateEveryN === 'number' && mem.updateEveryN > 0
        ? Math.floor(mem.updateEveryN)
        : MEMORY_AUTO_UPDATE_EVERY_N,
    characters: normalizeItemList(mem.characters),
    links: normalizeItemList(mem.links),
    places: normalizeItemList(mem.places),
  });
  // Si des sections existent déjà (données cloud), considérer comme initialisé
  if (
    !base.initialized &&
    (base.characters.length > 0 || base.links.length > 0 || base.places.length > 0)
  ) {
    base.initialized = true;
  }
  return base;
}

/**
 * Fusionne `incoming` dans `existing` :
 * - même `key` + `userEdited` → on garde l'entrée manuelle intacte
 * - même `key` sans edit → on met à jour résumé / from / to
 * - nouvelle clé → on ajoute
 * Déduplique aussi l'incoming sur sa propre clé.
 */
export function mergeMemoryItems(
  existing: SimulationMemoryItem[],
  incoming: SimulationMemoryItem[],
): SimulationMemoryItem[] {
  const map = new Map<string, SimulationMemoryItem>();
  for (const e of existing) {
    if (!e.key) continue;
    map.set(e.key, e);
  }
  const seenIncoming = new Set<string>();
  for (const raw of incoming) {
    const item = emptyMemoryItem(raw);
    if (!item.key || seenIncoming.has(item.key)) continue;
    seenIncoming.add(item.key);
    const prev = map.get(item.key);
    if (!prev) {
      // Ajout manuel (userEdited) : pas de badge ; ajout IA / seed → nouveauté
      map.set(item.key, {
        ...item,
        userEdited: item.userEdited === true,
        isNew: item.userEdited === true ? false : true,
      });
      continue;
    }
    if (prev.userEdited) {
      // Préserve fiche manuelle ; enrichit seulement les champs vides
      map.set(item.key, {
        ...prev,
        from: prev.from || item.from,
        to: prev.to || item.to,
        characterCategory: prev.characterCategory ?? item.characterCategory,
        linkSubsection: prev.linkSubsection ?? item.linkSubsection,
        isPlayerPersona: prev.isPlayerPersona || item.isPlayerPersona,
        age: prev.age || item.age,
        physique: prev.physique || item.physique,
        personality: prev.personality || item.personality,
        extraInfo: prev.extraInfo || item.extraInfo,
        location: prev.location || item.location,
        participants: prev.participants || item.participants,
        time: prev.time || item.time,
        updatedAt: prev.updatedAt,
        isNew: prev.isNew === true,
      });
      continue;
    }
    map.set(item.key, {
      ...prev,
      name: item.name.trim() || prev.name,
      summary: item.summary.trim() || prev.summary,
      from: item.from ?? prev.from,
      to: item.to ?? prev.to,
      characterCategory: item.characterCategory ?? prev.characterCategory,
      linkSubsection: item.linkSubsection ?? prev.linkSubsection,
      isPlayerPersona: prev.isPlayerPersona || item.isPlayerPersona,
      age: item.age || prev.age,
      physique: item.physique || prev.physique,
      personality: item.personality || prev.personality,
      extraInfo: item.extraInfo || prev.extraInfo,
      location: item.location || prev.location,
      participants: item.participants || prev.participants,
      time: item.time || prev.time,
      userEdited: false,
      updatedAt: new Date().toISOString(),
      isNew: true,
    });
  }
  return ensureSinglePrincipal(Array.from(map.values()));
}

/**
 * Garantit au plus un Principal, et jamais le persona joueur.
 * Si plusieurs / invalides → le premier PNJ non-persona en Principal, le reste en secondaires.
 */
export function ensureSinglePrincipal(items: SimulationMemoryItem[]): SimulationMemoryItem[] {
  const principals = items.filter(
    (it) => it.characterCategory === 'principal' && !it.isPlayerPersona,
  );
  let keepId: string | null = principals[0]?.id ?? null;
  return items.map((it) => {
    if (it.isPlayerPersona && it.characterCategory === 'principal') {
      return { ...it, characterCategory: 'secondaires' as MemoryCharacterCategory };
    }
    if (it.characterCategory === 'principal') {
      if (keepId && it.id === keepId) return it;
      if (!keepId) {
        keepId = it.id;
        return it;
      }
      return { ...it, characterCategory: 'secondaires' as MemoryCharacterCategory };
    }
    return it;
  });
}

/** Choisit le PNJ le plus mentionné dans l'historique comme Principal (hors persona). */
export function pickPrincipalByMentions(
  characters: SimulationMemoryItem[],
  messages: { content: string }[],
): SimulationMemoryItem[] {
  const corpus = messages.map((m) => m.content || '').join('\n').toLowerCase();
  const candidates = characters.filter((c) => !c.isPlayerPersona);
  if (!candidates.length) return ensureSinglePrincipal(characters);

  // Respecte un Principal déjà userEdited
  const locked = characters.find(
    (c) => c.characterCategory === 'principal' && c.userEdited && !c.isPlayerPersona,
  );
  if (locked) return ensureSinglePrincipal(characters);

  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const name = c.name.trim();
    if (name.length < 2) continue;
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const score = (corpus.match(re) || []).length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return ensureSinglePrincipal(
    characters.map((c) => {
      if (c.isPlayerPersona) {
        return { ...c, characterCategory: (c.characterCategory === 'principal' ? 'secondaires' : c.characterCategory) as MemoryCharacterCategory };
      }
      if (c.id === best.id) return { ...c, characterCategory: 'principal' as MemoryCharacterCategory };
      if (c.characterCategory === 'principal' && !c.userEdited) {
        return { ...c, characterCategory: 'secondaires' as MemoryCharacterCategory };
      }
      return c;
    }),
  );
}

export function shouldAutoUpdateMemory(
  memory: SimulationMemory,
  messageCount: number,
): boolean {
  if (!memory.initialized) return false;
  const every = memory.updateEveryN || MEMORY_AUTO_UPDATE_EVERY_N;
  const since = messageCount - (memory.messageCountAtLastUpdate || 0);
  return since >= every;
}

/** Résumé injecté dans le prompt (sous les Règles). */
/** Retire le badge nouveauté après consultation d'une fiche. */
export function markMemoryItemSeen(
  memory: SimulationMemory,
  section: MemorySectionId,
  itemId: string,
): SimulationMemory {
  const list = memory[section].map((it) =>
    it.id === itemId && it.isNew ? { ...it, isNew: false } : it,
  );
  return emptySimulationMemory({ ...memory, [section]: list });
}

/** true s'il reste au moins une nouveauté non consultée. */
export function memoryHasUnseen(memory: SimulationMemory | undefined | null): boolean {
  if (!memory) return false;
  return (
    memory.characters.some((it) => it.isNew) ||
    memory.links.some((it) => it.isNew) ||
    memory.places.some((it) => it.isNew)
  );
}

export function formatMemoryForPrompt(memory: SimulationMemory, maxPerSection = 24): string {
  if (!memory.initialized) return '';
  const blocks: string[] = [];
  const pushSection = (title: string, items: SimulationMemoryItem[]) => {
    if (!items.length) return;
    const lines = items.slice(0, maxPerSection).map((it) => {
      const bits: string[] = [];
      if (title === 'Personnages') {
        if (it.age) bits.push(`âge: ${it.age}`);
        if (it.physique) bits.push(`physique: ${it.physique}`);
        if (it.personality) bits.push(`personnalité: ${it.personality}`);
        if (it.extraInfo) bits.push(`infos: ${it.extraInfo}`);
        if (it.location) bits.push(`emplacement: ${it.location}`);
        if (it.summary) bits.push(it.summary);
      } else if (title === 'Liens' && it.linkSubsection === 'evenements') {
        if (it.participants) bits.push(`participants: ${it.participants}`);
        if (it.summary) bits.push(it.summary);
        if (it.time) bits.push(`temps: ${it.time}`);
        if (it.location) bits.push(`emplacement: ${it.location}`);
      } else {
        if (it.from || it.to) bits.push([it.from, it.to].filter(Boolean).join(' → '));
        if (it.summary) bits.push(it.summary);
      }
      const kind =
        title === 'Liens' && it.linkSubsection
          ? ` [${MEMORY_LINK_SUBSECTION_META[it.linkSubsection]?.label ?? it.linkSubsection}]`
          : '';
      const persona = it.isPlayerPersona ? ' (persona joueur)' : '';
      return `- ${it.name}${kind}${persona}: ${bits.filter(Boolean).join(' · ') || '—'}`;
    });
    blocks.push(`#### ${title}\n${lines.join('\n')}`);
  };
  pushSection('Personnages', memory.characters);
  pushSection('Liens', memory.links);
  pushSection('Lieux clés', memory.places);
  if (!blocks.length && memory.entries.length) {
    blocks.push(
      '#### Notes libres\n' +
        memory.entries
          .slice(-12)
          .map((e) => `- ${e.text}`)
          .join('\n'),
    );
  }
  if (!blocks.length) return '';
  return [
    '### MÉMOIRE DE PARTIE — À RESPECTER',
    'Résumé structuré du roleplay (personnages, relations, lieux).',
    'Priorité : sous les Règles du roleplay uniquement — ne contredis pas les règles.',
    'Ne réinvente pas un personnage / lieu déjà listé ; fusionne plutôt les infos.',
    ...blocks,
  ].join('\n');
}

/** Résout un [[cible]] vers une entrée mémoire (prépare le clic futur). */
export function resolveMemoryWikilink(
  memory: SimulationMemory | undefined | null,
  target: string,
): { section: MemorySectionId; item: SimulationMemoryItem } | null {
  if (!memory) return null;
  const key = normalizeMemoryKey(target);
  if (!key) return null;
  const sections: MemorySectionId[] = ['characters', 'links', 'places'];
  for (const section of sections) {
    const item = memory[section].find(
      (it) => it.key === key || normalizeMemoryKey(it.name) === key,
    );
    if (item) return { section, item };
  }
  return null;
}
