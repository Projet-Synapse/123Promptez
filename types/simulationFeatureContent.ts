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
}

export interface SimulationFeatureContent {
  inventory: SimulationInventoryItem[];
  album: SimulationAlbumItem[];
  skills: SimulationSkillItem[];
  messages: SimulationFeatureMessageItem[];
}

export function emptyFeatureContent(
  partial?: Partial<SimulationFeatureContent>,
): SimulationFeatureContent {
  return {
    inventory: Array.isArray(partial?.inventory) ? partial!.inventory! : [],
    album: Array.isArray(partial?.album) ? partial!.album! : [],
    skills: Array.isArray(partial?.skills) ? partial!.skills! : [],
    messages: Array.isArray(partial?.messages) ? partial!.messages! : [],
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
      }),
    ),
  });
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
  if (features.messages && content.messages.length) {
    const lines = content.messages.slice(0, maxPer).map((it) => {
      const inf = it.influence ? ` [influence: ${it.influence}]` : '';
      return `- De ${it.from}: ${it.content || '—'}${inf}`;
    });
    blocks.push(`#### Messages d’interaction\n${lines.join('\n')}`);
  }

  if (!blocks.length) return '';
  return [
    '### MODULES GAMEPLAY ACTIFS — À RESPECTER',
    'Contenu géré par le joueur. Tiens-en compte dans la narration (objets possédés, compétences, messages reçus…).',
    'Ne crée pas d’objets / compétences hors inventaire sans que le joueur les ait acquis.',
    ...blocks,
  ].join('\n');
}
