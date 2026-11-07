/**
 * Import 123Écriture → connaissances du monde (LECTURE SEULE).
 * Lit les .md des dossiers du vault déjà synchronisés dans l’app ; n’écrit jamais dans le vault.
 */
type FileLike = { name: string; path?: string; type?: string; content: string };
type FolderLike = { id: string; name: string; files: FileLike[]; subFolders?: FolderLike[]; vault?: unknown };

export type KnowledgeFolderOption = { id: string; label: string; depth: number; mdCount: number };

export const KNOWLEDGE_MAX_CHARS = 12000;

const isMd = (f: FileLike) => f.type === 'markdown' || /\.md$/i.test(f.path || f.name);

function countMd(f: FolderLike): number {
  return f.files.filter(isMd).length + (f.subFolders ?? []).reduce((n, s) => n + countMd(s), 0);
}

/** Dossiers issus d’un vault (et leurs sous-dossiers), pour le sélecteur. */
export function listKnowledgeFolderOptions(folders: FolderLike[]): KnowledgeFolderOption[] {
  const out: KnowledgeFolderOption[] = [];
  const walk = (f: FolderLike, depth: number, prefix: string) => {
    const label = prefix ? `${prefix} / ${f.name}` : f.name;
    out.push({ id: f.id, label, depth, mdCount: countMd(f) });
    for (const s of f.subFolders ?? []) walk(s, depth + 1, label);
  };
  for (const f of folders) if (f.vault) walk(f, 0, '');
  return out;
}

function findFolder(folders: FolderLike[], id: string): FolderLike | null {
  for (const f of folders) {
    if (f.id === id) return f;
    const hit = findFolder(f.subFolders ?? [], id);
    if (hit) return hit;
  }
  return null;
}

function collectFiles(f: FolderLike, prefix: string, acc: { path: string; content: string }[]) {
  for (const file of f.files) if (isMd(file)) acc.push({ path: `${prefix}${file.path || file.name}`, content: file.content });
  for (const s of f.subFolders ?? []) collectFiles(s, `${prefix}${s.name}/`, acc);
}

/** Bloc prompt des notes .md des dossiers choisis (borné). Vide si rien. */
export function buildKnowledgePromptBlock(folders: FolderLike[], ids: string[], maxChars = KNOWLEDGE_MAX_CHARS): string {
  if (!ids?.length) return '';
  const files: { path: string; content: string }[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const f = findFolder(folders, id);
    if (!f) continue;
    const acc: { path: string; content: string }[] = [];
    collectFiles(f, `${f.name}/`, acc);
    for (const x of acc) if (!seen.has(x.path)) { seen.add(x.path); files.push(x); }
  }
  if (!files.length) return '';
  let budget = maxChars;
  const parts: string[] = [];
  let truncated = 0;
  for (const x of files) {
    const body = String(x.content ?? '').trim();
    if (!body) continue;
    const chunk = `--- ${x.path} ---\n${body}`;
    if (budget <= 200) { truncated++; continue; }
    parts.push(chunk.length > budget ? `${chunk.slice(0, budget)}…` : chunk);
    budget -= Math.min(chunk.length, budget);
  }
  return [
    '### Connaissances du monde (notes 123Écriture — référence, lecture seule)',
    'Faits établis de l’univers : respecte-les ; ne les contredis pas.',
    ...parts,
    truncated ? `(${truncated} note(s) non incluse(s) : limite de taille atteinte)` : '',
  ].filter(Boolean).join('\n');
}
