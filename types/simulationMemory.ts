/**
 * Mémoire de roleplay (Simulation) — Personnages / Liens / Lieux clés.
 * Inspirée PolyBuzz, sans doublons (fusion par nom normalisé) ni écrasement
 * des edits manuels (`userEdited`).
 */

/** MAJ auto tous les N messages (user + assistant). Documenté / constant. */
export const MEMORY_AUTO_UPDATE_EVERY_N = 10;

export type MemorySectionId = 'characters' | 'links' | 'places';

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
  /** Liens uniquement : extrémités optionnelles */
  from?: string;
  to?: string;
  updatedAt: string;
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

export function emptyMemoryItem(
  partial?: Partial<SimulationMemoryItem> & { name?: string },
): SimulationMemoryItem {
  const name = String(partial?.name ?? '').trim() || 'Sans nom';
  const key = partial?.key?.trim() || normalizeMemoryKey(name);
  return {
    id: partial?.id ?? newId('memitem'),
    name,
    summary: String(partial?.summary ?? ''),
    userEdited: partial?.userEdited === true,
    key: key || normalizeMemoryKey(name) || newId('key'),
    from: partial?.from ? String(partial.from) : undefined,
    to: partial?.to ? String(partial.to) : undefined,
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
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
      summary: String(r.summary ?? ''),
      userEdited: r.userEdited === true,
      key: r.key ? String(r.key) : undefined,
      from: r.from ? String(r.from) : undefined,
      to: r.to ? String(r.to) : undefined,
      updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
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
      map.set(item.key, { ...item, userEdited: false });
      continue;
    }
    if (prev.userEdited) {
      // Préserve nom + résumé manuels ; on peut enrichir from/to vides seulement
      map.set(item.key, {
        ...prev,
        from: prev.from || item.from,
        to: prev.to || item.to,
        updatedAt: prev.updatedAt,
      });
      continue;
    }
    map.set(item.key, {
      ...prev,
      name: item.name.trim() || prev.name,
      summary: item.summary.trim() || prev.summary,
      from: item.from ?? prev.from,
      to: item.to ?? prev.to,
      userEdited: false,
      updatedAt: new Date().toISOString(),
    });
  }
  return Array.from(map.values());
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
export function formatMemoryForPrompt(memory: SimulationMemory, maxPerSection = 24): string {
  if (!memory.initialized) return '';
  const blocks: string[] = [];
  const pushSection = (title: string, items: SimulationMemoryItem[]) => {
    if (!items.length) return;
    const lines = items.slice(0, maxPerSection).map((it) => {
      const extra =
        it.from || it.to ? ` (${[it.from, it.to].filter(Boolean).join(' → ')})` : '';
      return `- ${it.name}${extra}: ${it.summary || '—'}`;
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
