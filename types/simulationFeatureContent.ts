/**
 * Contenu des modules gameplay Simulation (CRUD) — par conversation.
 * Les toggles `features` activent l’UI + l’injection prompt.
 */

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function optStr(v: unknown): string {
  return String(v ?? '').trim();
}

export interface SimulationInventoryItem {
  id: string;
  name: string;
  quantity: number;
  description: string;
  updatedAt: string;
}

export interface SimulationAlbumItem {
  id: string;
  title: string;
  description: string;
  /** URI optionnelle (photo) — saisie manuelle pour l’instant */
  uri?: string;
  updatedAt: string;
}

export interface SimulationSkillItem {
  id: string;
  name: string;
  /** Niveau libre (ex. « Novice », « 3/10 ») */
  level: string;
  description: string;
  updatedAt: string;
}

export interface SimulationFeatureMessageItem {
  id: string;
  from: string;
  content: string;
  /** Influence / effet potentiel */
  influence: string;
  read: boolean;
  updatedAt: string;
  /** Numéro de l’expéditeur (xxx-xxx) */
  fromNumber?: string;
  /** Affiché « Numéro inconnu » tant que non enregistré */
  unknownSender?: boolean;
  /** Identité réelle (cachée) d’un numéro inconnu */
  hiddenName?: string;
  /** Numéro étrange / suspect */
  suspicious?: boolean;
}

/** Numéro découvert en RP (chat ou papier) — sert à valider l’ajout de contact. */
export interface SimulationKnownNumber {
  number: string;
  name: string;
  source: 'chat' | 'paper' | 'message';
  discoveredAt: string;
}

/** Contact = personnage mémoire autorisé à envoyer des messages. */
export interface SimulationContactItem {
  id: string;
  /** Clé normalisée (mémoire) */
  key: string;
  name: string;
  addedAt: string;
  number?: string;
}

export interface SimulationFeatureContent {
  inventory: SimulationInventoryItem[];
  album: SimulationAlbumItem[];
  skills: SimulationSkillItem[];
  messages: SimulationFeatureMessageItem[];
  contacts: SimulationContactItem[];
  knownNumbers: SimulationKnownNumber[];
  /** Numéro imaginaire du persona joueur */
  personaNumber?: string;
  /** Personnages à qui le persona a donné son numéro (message à venir) */
  pendingNumberGivenTo: string[];
}

export function emptyFeatureContent(
  partial?: Partial<SimulationFeatureContent>,
): SimulationFeatureContent {
  return {
    inventory: Array.isArray(partial?.inventory) ? partial!.inventory! : [],
    album: Array.isArray(partial?.album) ? partial!.album! : [],
    skills: Array.isArray(partial?.skills) ? partial!.skills! : [],
    messages: Array.isArray(partial?.messages) ? partial!.messages! : [],
    contacts: Array.isArray(partial?.contacts) ? partial!.contacts! : [],
    knownNumbers: Array.isArray(partial?.knownNumbers) ? partial!.knownNumbers! : [],
    personaNumber: partial?.personaNumber ? String(partial.personaNumber) : undefined,
    pendingNumberGivenTo: Array.isArray(partial?.pendingNumberGivenTo) ? partial!.pendingNumberGivenTo! : [],
  };
}

export function emptyInventoryItem(
  partial?: Partial<SimulationInventoryItem>,
): SimulationInventoryItem {
  const qty = typeof partial?.quantity === 'number' && Number.isFinite(partial.quantity)
    ? Math.max(0, Math.floor(partial.quantity))
    : 1;
  return {
    id: partial?.id ?? newId('inv'),
    name: optStr(partial?.name) || 'Objet',
    quantity: qty,
    description: optStr(partial?.description),
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}

export function emptyAlbumItem(partial?: Partial<SimulationAlbumItem>): SimulationAlbumItem {
  return {
    id: partial?.id ?? newId('alb'),
    title: optStr(partial?.title) || 'Photo',
    description: optStr(partial?.description),
    uri: optStr(partial?.uri) || undefined,
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}

export function emptySkillItem(partial?: Partial<SimulationSkillItem>): SimulationSkillItem {
  return {
    id: partial?.id ?? newId('skl'),
    name: optStr(partial?.name) || 'Compétence',
    level: optStr(partial?.level) || '1',
    description: optStr(partial?.description),
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}

export function emptyFeatureMessageItem(
  partial?: Partial<SimulationFeatureMessageItem>,
): SimulationFeatureMessageItem {
  return {
    id: partial?.id ?? newId('msg'),
    from: optStr(partial?.from) || 'Inconnu',
    content: optStr(partial?.content),
    influence: optStr(partial?.influence),
    read: partial?.read === true,
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
    fromNumber: normalizePhone(partial?.fromNumber) ?? undefined,
    unknownSender: partial?.unknownSender === true,
    hiddenName: optStr(partial?.hiddenName) || undefined,
    suspicious: partial?.suspicious === true,
  };
}

/** Format numéro RP : xxx-xxx (chiffres). */
export const PHONE_RE = /\b(\d{3})[-‐–](\d{3})\b/g;

export function normalizePhone(v: unknown): string | null {
  const m = String(v ?? '').match(/(\d{3})\s*[-‐–]\s*(\d{3})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function extractPhones(text: string): string[] {
  const out = new Set<string>();
  for (const m of String(text ?? '').matchAll(PHONE_RE)) out.add(`${m[1]}-${m[2]}`);
  return Array.from(out);
}

export function randomPhone(): string {
  const d = () => Math.floor(Math.random() * 900 + 100);
  return `${d()}-${d()}`;
}

/** Ajoute / met à jour des numéros découverts (dédupliqués par numéro). */
export function mergeKnownNumbers(
  existing: SimulationKnownNumber[],
  incoming: { number: string; name?: string; source?: SimulationKnownNumber['source'] }[],
): SimulationKnownNumber[] {
  const map = new Map(existing.map((k) => [k.number, k]));
  for (const r of incoming) {
    const n = normalizePhone(r.number);
    if (!n) continue;
    const prev = map.get(n);
    const name = optStr(r.name);
    if (!prev) {
      map.set(n, { number: n, name, source: r.source ?? 'chat', discoveredAt: new Date().toISOString() });
    } else if (!prev.name && name) {
      map.set(n, { ...prev, name });
    }
  }
  return Array.from(map.values());
}

/** Tente d’ajouter un contact par numéro. null = introuvable. */
export function addContactByNumber(
  content: SimulationFeatureContent,
  raw: string,
): { next: SimulationFeatureContent; contact: SimulationContactItem } | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  const known = content.knownNumbers.find((k) => k.number === n);
  const fromMsg = content.messages.find((m) => m.fromNumber === n);
  if (!known && !fromMsg) return null;
  if (content.contacts.some((c) => c.number === n)) {
    return { next: content, contact: content.contacts.find((c) => c.number === n)! };
  }
  const name = known?.name || fromMsg?.hiddenName || `Contact ${n}`;
  const contact = emptyContactItem({ name, key: name.toLowerCase(), number: n });
  const messages = content.messages.map((m) =>
    m.fromNumber === n ? { ...m, unknownSender: false, from: name } : m,
  );
  return { next: { ...content, contacts: [...content.contacts, contact], messages }, contact };
}

export function emptyContactItem(
  partial?: Partial<SimulationContactItem>,
): SimulationContactItem {
  const name = optStr(partial?.name) || 'Contact';
  const key = optStr(partial?.key) || name.toLowerCase();
  return {
    id: partial?.id ?? newId('ctc'),
    key,
    name,
    addedAt: partial?.addedAt ?? new Date().toISOString(),
    number: normalizePhone(partial?.number) ?? undefined,
  };
}

function normalizeList<T>(
  raw: any,
  factory: (r: any) => T,
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && typeof r === 'object').map(factory);
}

export function normalizeFeatureContent(raw: any): SimulationFeatureContent {
  const src = raw && typeof raw === 'object' ? raw : {};
  return emptyFeatureContent({
    inventory: normalizeList(src.inventory, (r) =>
      emptyInventoryItem({
        id: r.id ? String(r.id) : undefined,
        name: String(r.name ?? ''),
        quantity: typeof r.quantity === 'number' ? r.quantity : Number(r.qty ?? 1) || 1,
        description: String(r.description ?? ''),
        updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
      }),
    ),
    album: normalizeList(src.album, (r) =>
      emptyAlbumItem({
        id: r.id ? String(r.id) : undefined,
        title: String(r.title ?? r.name ?? ''),
        description: String(r.description ?? ''),
        uri: r.uri ? String(r.uri) : undefined,
        updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
      }),
    ),
    skills: normalizeList(src.skills, (r) =>
      emptySkillItem({
        id: r.id ? String(r.id) : undefined,
        name: String(r.name ?? ''),
        level: String(r.level ?? r.rank ?? '1'),
        description: String(r.description ?? ''),
        updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
      }),
    ),
    messages: normalizeList(src.messages, (r) =>
      emptyFeatureMessageItem({
        id: r.id ? String(r.id) : undefined,
        from: String(r.from ?? r.sender ?? ''),
        content: String(r.content ?? r.text ?? r.body ?? ''),
        influence: String(r.influence ?? r.effect ?? ''),
        read: r.read === true,
        updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
        fromNumber: r.fromNumber,
        unknownSender: r.unknownSender === true,
        hiddenName: r.hiddenName,
        suspicious: r.suspicious === true,
      }),
    ),
    knownNumbers: normalizeList(src.knownNumbers, (r) => ({
      number: normalizePhone(r.number) ?? '',
      name: String(r.name ?? ''),
      source: (['chat', 'paper', 'message'].includes(r.source) ? r.source : 'chat') as SimulationKnownNumber['source'],
      discoveredAt: String(r.discoveredAt ?? new Date().toISOString()),
    })).filter((k) => k.number),
    personaNumber: normalizePhone(src.personaNumber) ?? undefined,
    pendingNumberGivenTo: Array.isArray(src.pendingNumberGivenTo) ? src.pendingNumberGivenTo.map(String) : [],
    contacts: normalizeList(src.contacts, (r) =>
      emptyContactItem({
        id: r.id ? String(r.id) : undefined,
        key: String(r.key ?? r.name ?? ''),
        name: String(r.name ?? r.key ?? ''),
        addedAt: r.addedAt ? String(r.addedAt) : undefined,
        number: r.number,
      }),
    ),
  });
}

/** Fusion inventaire : ajoute / incrémente par nom (casse-insensible). */
export function mergeInventoryItems(
  existing: SimulationInventoryItem[],
  incoming: { name: string; quantity?: number; description?: string }[],
): { next: SimulationInventoryItem[]; added: SimulationInventoryItem[] } {
  const map = new Map<string, SimulationInventoryItem>();
  const keyOf = (n: string) => n.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  for (const e of existing) map.set(keyOf(e.name), e);
  const added: SimulationInventoryItem[] = [];
  for (const raw of incoming) {
    const name = String(raw.name ?? '').trim();
    if (!name) continue;
    const k = keyOf(name);
    const qty = typeof raw.quantity === 'number' && Number.isFinite(raw.quantity)
      ? Math.max(1, Math.floor(raw.quantity))
      : 1;
    const prev = map.get(k);
    if (!prev) {
      const it = emptyInventoryItem({
        name,
        quantity: qty,
        description: String(raw.description ?? '').trim(),
      });
      map.set(k, it);
      added.push(it);
    } else {
      map.set(k, {
        ...prev,
        quantity: Math.max(prev.quantity, qty),
        description: prev.description || String(raw.description ?? '').trim(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return { next: Array.from(map.values()), added };
}

/** Retire des objets par nom (casse/accents-insensible). */
export function removeInventoryItems(
  existing: SimulationInventoryItem[],
  names: string[],
): { next: SimulationInventoryItem[]; removed: SimulationInventoryItem[] } {
  const keyOf = (n: string) => n.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const kill = new Set(names.map(keyOf).filter(Boolean));
  const removed = existing.filter((i) => kill.has(keyOf(i.name)));
  return { next: existing.filter((i) => !kill.has(keyOf(i.name))), removed };
}

export function countUnreadMessages(content: SimulationFeatureContent | undefined | null): number {
  if (!content?.messages) return 0;
  return content.messages.filter((m) => !m.read).length;
}

/** Injection prompt — uniquement les modules activés. */
export function formatFeaturesForPrompt(
  features: { inventory: boolean; album: boolean; skills: boolean; messages: boolean },
  content: SimulationFeatureContent | undefined | null,
  maxPer = 20,
): string {
  if (!content) return '';
  const blocks: string[] = [];

  if (features.inventory && content.inventory.length) {
    const lines = content.inventory.slice(0, maxPer).map((it) => {
      const desc = it.description ? ` — ${it.description}` : '';
      return `- ${it.name} ×${it.quantity}${desc}`;
    });
    blocks.push(`#### Inventaire\n${lines.join('\n')}`);
  }
  if (features.skills && content.skills.length) {
    const lines = content.skills.slice(0, maxPer).map((it) => {
      const desc = it.description ? ` — ${it.description}` : '';
      return `- ${it.name} (niv. ${it.level})${desc}`;
    });
    blocks.push(`#### Compétences / acquisitions\n${lines.join('\n')}`);
  }
  if (features.album && content.album.length) {
    const lines = content.album.slice(0, maxPer).map((it) => {
      const desc = it.description ? ` — ${it.description}` : '';
      return `- ${it.title}${desc}`;
    });
    blocks.push(`#### Album photo\n${lines.join('\n')}`);
  }
  if (features.messages) {
    if (content.contacts?.length) {
      blocks.push(
        `#### Contacts (peuvent écrire au persona)\n`
        + content.contacts.slice(0, maxPer).map((c) => `- ${c.name}${c.number ? ` (${c.number})` : ''}`).join('\n'),
      );
    }
    if (content.personaNumber) {
      blocks.push(`#### Numéro du persona joueur\n${content.personaNumber} (le joueur peut le donner aux personnages)`);
    }
    if (content.messages.length) {
      const lines = content.messages.slice(0, maxPer).map((it) => {
        const inf = it.influence ? ` [influence: ${it.influence}]` : '';
        const lu = it.read ? '' : ' [NON LU]';
        return `- De ${it.from}: ${it.content || '—'}${inf}${lu}`;
      });
      blocks.push(`#### Messages d’interaction\n${lines.join('\n')}`);
    }
  }

  if (!blocks.length) return '';
  return [
    '### MODULES GAMEPLAY ACTIFS — À RESPECTER',
    'Contenu géré par le joueur. Tiens-en compte dans la narration (objets possédés, compétences, messages reçus…).',
    'Ne crée pas d’objets / compétences hors inventaire sans que le joueur les ait acquis.',
    ...blocks,
  ].join('\n');
}
