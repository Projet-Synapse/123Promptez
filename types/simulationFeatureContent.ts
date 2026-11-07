import { SimulationNeeds, emptyNeeds, formatNeedsForPrompt } from '@/types/simulationNeeds';
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
  /** Date réelle d’ajout (absente pour les anciennes entrées) */
  createdAt?: string;
}

export interface SimulationAlbumItem {
  id: string;
  title: string;
  description: string;
  /** URI optionnelle (photo) — saisie manuelle pour l’instant */
  uri?: string;
  updatedAt: string;
}

export const SKILL_MAX_LEVEL = 10;
export const SKILL_XP_PER_LEVEL = 100;
/** Gain max d’XP par passe d’extraction (progression douce) */
export const SKILL_MAX_XP_PER_PASS = 60;

export interface SkillNotion {
  level: number;
  text: string;
}

export interface SimulationSkillItem {
  id: string;
  name: string;
  /** Niveau 0–10 */
  level: number;
  /** XP partielle vers le niveau suivant (0–99) */
  xp: number;
  description: string;
  /** Notions acquises par palier */
  notions: SkillNotion[];
  updatedAt: string;
  /** Date réelle d’ajout (absente pour les anciennes entrées) */
  createdAt?: string;
}

/** Étape de vie du persona (impact sur son avenir) */
export interface SimulationLifeStage {
  id: string;
  title: string;
  description: string;
  /** Moment / date RP */
  when: string;
  impact: string;
  updatedAt: string;
  /** Date réelle d’ajout (absente pour les anciennes entrées) */
  createdAt?: string;
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
  lifeStages: SimulationLifeStage[];
  messages: SimulationFeatureMessageItem[];
  contacts: SimulationContactItem[];
  knownNumbers: SimulationKnownNumber[];
  /** Numéro imaginaire du persona joueur */
  personaNumber?: string;
  /** Personnages à qui le persona a donné son numéro (message à venir) */
  pendingNumberGivenTo: string[];
  /** Besoins (module needs) */
  needs?: SimulationNeeds;
}

export function emptyFeatureContent(
  partial?: Partial<SimulationFeatureContent>,
): SimulationFeatureContent {
  return {
    inventory: Array.isArray(partial?.inventory) ? partial!.inventory! : [],
    album: Array.isArray(partial?.album) ? partial!.album! : [],
    skills: Array.isArray(partial?.skills) ? partial!.skills! : [],
    lifeStages: Array.isArray(partial?.lifeStages) ? partial!.lifeStages! : [],
    messages: Array.isArray(partial?.messages) ? partial!.messages! : [],
    contacts: Array.isArray(partial?.contacts) ? partial!.contacts! : [],
    knownNumbers: Array.isArray(partial?.knownNumbers) ? partial!.knownNumbers! : [],
    personaNumber: partial?.personaNumber ? String(partial.personaNumber) : undefined,
    pendingNumberGivenTo: Array.isArray(partial?.pendingNumberGivenTo) ? partial!.pendingNumberGivenTo! : [],
    needs: partial?.needs ? emptyNeeds(partial.needs) : undefined,
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
    createdAt: partial?.createdAt ?? (partial?.id ? undefined : new Date().toISOString()),
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

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : dflt;
}

export function emptySkillItem(partial?: Partial<SimulationSkillItem> & { level?: unknown; xp?: unknown }): SimulationSkillItem {
  const level = clampInt(partial?.level, 0, SKILL_MAX_LEVEL, 0);
  return {
    id: partial?.id ?? newId('skl'),
    name: optStr(partial?.name) || 'Compétence',
    level,
    xp: level >= SKILL_MAX_LEVEL ? 0 : clampInt(partial?.xp, 0, SKILL_XP_PER_LEVEL - 1, 0),
    description: optStr(partial?.description),
    notions: Array.isArray(partial?.notions)
      ? partial!.notions!
        .filter((n: any) => n && optStr(n.text))
        .map((n: any) => ({ level: clampInt(n.level, 0, SKILL_MAX_LEVEL, level), text: optStr(n.text) }))
      : [],
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
    createdAt: partial?.createdAt ?? (partial?.id ? undefined : new Date().toISOString()),
  };
}

export function emptyLifeStage(partial?: Partial<SimulationLifeStage>): SimulationLifeStage {
  return {
    id: partial?.id ?? newId('life'),
    title: optStr(partial?.title) || 'Étape de vie',
    description: optStr(partial?.description),
    when: optStr(partial?.when),
    impact: optStr(partial?.impact),
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
    createdAt: partial?.createdAt ?? (partial?.id ? undefined : new Date().toISOString()),
  };
}

const normKey = (n: string) => n.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

export type SkillGain = { name: string; xp: number; description?: string; notion?: string };

/**
 * Applique des gains d’XP (progressifs, plafonnés par passe).
 * Renvoie les compétences créées et les montées de niveau.
 */
export function applySkillGains(
  existing: SimulationSkillItem[],
  gains: SkillGain[],
): {
  next: SimulationSkillItem[];
  created: SimulationSkillItem[];
  levelUps: { name: string; level: number }[];
} {
  const list = existing.map((s) => ({ ...s, notions: [...s.notions] }));
  const created: SimulationSkillItem[] = [];
  const levelUps: { name: string; level: number }[] = [];
  for (const g of gains) {
    const name = optStr(g.name);
    if (!name) continue;
    const xpGain = clampInt(g.xp, 0, SKILL_MAX_XP_PER_PASS, 0);
    let sk = list.find((s) => normKey(s.name) === normKey(name));
    if (!sk) {
      sk = emptySkillItem({ name, description: g.description });
      list.push(sk);
      created.push(sk);
    }
    if (sk.level >= SKILL_MAX_LEVEL) continue;
    const before = sk.level;
    let xp = sk.xp + xpGain;
    let level = sk.level;
    while (xp >= SKILL_XP_PER_LEVEL && level < SKILL_MAX_LEVEL) {
      xp -= SKILL_XP_PER_LEVEL;
      level += 1;
    }
    if (level >= SKILL_MAX_LEVEL) xp = 0;
    sk.level = level;
    sk.xp = xp;
    if (!sk.description && g.description) sk.description = optStr(g.description);
    if (level > before) {
      levelUps.push({ name: sk.name, level });
      const notion = optStr(g.notion);
      if (notion && !sk.notions.some((n) => normKey(n.text) === normKey(notion))) {
        sk.notions.push({ level, text: notion });
      }
    }
    sk.updatedAt = new Date().toISOString();
  }
  return { next: list, created, levelUps };
}

export function mergeLifeStages(
  existing: SimulationLifeStage[],
  incoming: Partial<SimulationLifeStage>[],
): { next: SimulationLifeStage[]; added: SimulationLifeStage[] } {
  const next = [...existing];
  const added: SimulationLifeStage[] = [];
  for (const r of incoming) {
    const title = optStr(r.title);
    if (!title || next.some((s) => normKey(s.title) === normKey(title))) continue;
    const it = emptyLifeStage(r);
    next.unshift(it);
    added.push(it);
  }
  return { next, added };
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
        createdAt: r.createdAt ? String(r.createdAt) : undefined,
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
        level: r.level ?? r.rank ?? 0,
        xp: r.xp ?? 0,
        description: String(r.description ?? ''),
        notions: Array.isArray(r.notions) ? r.notions : [],
        createdAt: r.createdAt ? String(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
      }),
    ),
    lifeStages: normalizeList(src.lifeStages, (r) =>
      emptyLifeStage({
        id: r.id ? String(r.id) : undefined,
        title: String(r.title ?? r.name ?? ''),
        description: String(r.description ?? ''),
        when: String(r.when ?? r.date ?? ''),
        impact: String(r.impact ?? ''),
        createdAt: r.createdAt ? String(r.createdAt) : undefined,
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
    needs: src.needs && typeof src.needs === 'object' ? emptyNeeds(src.needs) : undefined,
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
  features: { inventory: boolean; album: boolean; skills: boolean; messages: boolean; needs?: boolean },
  content: SimulationFeatureContent | undefined | null,
  maxPer = 20,
): string {
  if (!content) return '';
  const blocks: string[] = [];
  if (features.needs) blocks.push(formatNeedsForPrompt(emptyNeeds(content.needs)));

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
      const notions = it.notions.length ? ` | notions acquises : ${it.notions.map((n) => n.text).join(' ; ')}` : '';
      return `- ${it.name} : niveau ${it.level}/10${desc}${notions}`;
    });
    blocks.push([
      '#### Compétences du persona (niveaux 0–10)',
      ...lines,
      'Tiens compte du niveau pour décider du succès ou de l’échec des actions : niveau bas = maladresse/échecs fréquents, niveau élevé = réussite plus probable et actions avancées possibles.',
      'N’autorise PAS d’action clairement hors de portée du niveau actuel (ou compétence absente) : elle échoue ou reste partielle de façon crédible.',
      'Le persona connaît les notions acquises listées.',
    ].join('\n'));
  }
  if (features.skills && content.lifeStages?.length) {
    const lines = content.lifeStages.slice(0, maxPer).map((s) =>
      `- ${s.title}${s.when ? ` (${s.when})` : ''}${s.description ? ` — ${s.description}` : ''}${s.impact ? ` → impact : ${s.impact}` : ''}`);
    blocks.push(`#### Étapes de vie du persona (faits établis, à respecter)\n${lines.join('\n')}`);
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
