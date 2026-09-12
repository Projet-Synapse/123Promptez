/**
 * Vault folder sync helpers — Electron (node/fs via preload) + Web File System
 * Access API + graceful import fallback. GitHub repo search when a token exists.
 */
import { Platform } from 'react-native';
import { recordDiag } from '@/services/diagnostics';
import type { DBFile } from '@/contexts/WorkspaceContext';

export type VaultSourceKind = 'local' | 'github';
export type VaultSyncStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'unsupported';

export interface VaultMeta {
  sourceKind: VaultSourceKind;
  /** Absolute path (Electron) or display name (web FS Access / import) */
  path?: string;
  /** GitHub: owner/repo */
  repoFullName?: string;
  repoId?: number;
  /** GitHub: branche par défaut réelle du dépôt (resync sans re-deviner) */
  defaultBranch?: string;
  /** URL du site déployé associé (dépôts : Vercel, Pages…) — choisie par l'utilisateur */
  siteUrl?: string;
  /** Last sync ISO or Date string */
  lastSyncedAt?: string | null;
  syncStatus?: VaultSyncStatus;
  syncMessage?: string;
  /** Whether live FS handle / Electron path is available this session */
  liveSync?: boolean;
}

export interface VaultCapability {
  mode: 'electron' | 'fs-access' | 'import-only';
  canPickFolder: boolean;
  canLiveSync: boolean;
  labelFr: string;
  hintFr: string;
}

export interface VaultDirEntry {
  kind: 'file' | 'dir';
  name: string;
  relativePath: string;
  content?: string;
}

declare global {
  interface Window {
    electronVault?: {
      pickFolder: () => Promise<{ path: string; name: string } | null>;
      listTextFiles: (dirPath: string) => Promise<VaultDirEntry[]>;
      writeFile: (rootPath: string, relPath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
      makeDir: (rootPath: string, relPath: string) => Promise<{ ok: boolean; error?: string }>;
      deletePath: (rootPath: string, relPath: string, isDir: boolean) => Promise<{ ok: boolean; error?: string }>;
      movePath: (rootPath: string, fromRel: string, toRel: string) => Promise<{ ok: boolean; error?: string }>;
      openPath: (targetPath: string) => Promise<{ ok: boolean; error?: string }>;
      watch: (rootPath: string) => Promise<{ ok: boolean; error?: string }>;
      unwatch: (rootPath: string) => Promise<{ ok: boolean; error?: string }>;
      onChanged: (callback: (payload: { rootPath: string }) => void) => () => void;
    };
  }
}

export function getElectronVault(): Window['electronVault'] | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.electronVault?.pickFolder) {
    return window.electronVault;
  }
  return null;
}

/** Dernière écriture locale (app → disque), pour ignorer les échos du watcher. */
let lastLocalWriteAt = 0;
export function getLastLocalWriteAt(): number {
  return lastLocalWriteAt;
}
function markLocalWrite() {
  lastLocalWriteAt = Date.now();
}

/** Un dossier local (vault ou dépôt) peut-il être répercuté sur le disque ? */
export function canMirrorToDisk(meta?: VaultMeta | null): boolean {
  if (!meta || meta.sourceKind !== 'local' || !meta.path || meta.liveSync === false) return false;
  if (getElectronVault()?.writeFile) return true;
  return !!getFsHandle(meta.path);
}

export function hasFsAccess(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof (window as any).showDirectoryPicker === 'function'
  );
}

// ── File System Access (navigateur Chrome / Edge) ────────────────────────────
// Les handles ne sont pas sérialisables dans le cloud : on les garde en
// session ET dans IndexedDB pour les retrouver après un rechargement.

type FsHandle = any;

export function getFsHandle(name?: string): FsHandle | null {
  if (!hasFsAccess() || !name) return null;
  return (window as any).__promptezVaultHandles?.[name] ?? null;
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('promptez-vault-handles', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Conserve le handle en session + IndexedDB (survit au rechargement). */
export async function saveFsHandle(handle: FsHandle): Promise<void> {
  const store = (window as any).__promptezVaultHandles ?? {};
  store[handle.name] = handle;
  (window as any).__promptezVaultHandles = store;
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, handle.name);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB indisponible : la synchro fonctionnera quand même cette session
  }
}

/** Restaure les handles au démarrage de l'app (permission réaccordée par le
 *  navigateur = synchro silencieuse ; sinon un clic « Resynchroniser » la
 *  redonnera — geste utilisateur requis par le navigateur). */
export async function restoreFsHandles(): Promise<void> {
  if (!hasFsAccess()) return;
  try {
    const db = await openHandleDb();
    const entries = await new Promise<{ name: string; handle: FsHandle }[]>((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly');
      const out: { name: string; handle: FsHandle }[] = [];
      const cursorReq = tx.objectStore('handles').openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          out.push({ name: String(cursor.key), handle: cursor.value });
          cursor.continue();
        } else resolve(out);
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    const store = (window as any).__promptezVaultHandles ?? {};
    for (const { name, handle } of entries) store[name] = handle;
    (window as any).__promptezVaultHandles = store;
  } catch {
    // pas grave : la session courante garde ses handles en mémoire
  }
}

/** Permission readwrite ; `requestPermission` ne passe que dans un geste utilisateur. */
async function ensureFsPerm(root: FsHandle): Promise<boolean> {
  try {
    if ((await root.queryPermission?.({ mode: 'readwrite' })) === 'granted') return true;
    if ((await root.requestPermission?.({ mode: 'readwrite' })) === 'granted') return true;
    recordDiag('vault.permission', 'permission readwrite refusée/absente (pas de geste utilisateur ?)');
    return false;
  } catch (e: any) {
    recordDiag('vault.permission.erreur', e?.message ?? 'inconnue');
    return false;
  }
}

async function fsDirHandle(root: FsHandle, relDir: string, create: boolean): Promise<FsHandle> {
  let cur = root;
  for (const part of relDir.split('/').filter(Boolean)) {
    cur = await cur.getDirectoryHandle(part, { create });
  }
  return cur;
}

async function fsWrite(root: FsHandle, relPath: string, content: string): Promise<void> {
  const parts = relPath.split('/');
  const fileName = parts.pop() as string;
  const dir = await fsDirHandle(root, parts.join('/'), true);
  const fh = await dir.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(content);
  await writable.close();
}

async function fsDelete(root: FsHandle, relPath: string, isDir: boolean): Promise<void> {
  const parts = relPath.split('/');
  const name = parts.pop() as string;
  const dir = await fsDirHandle(root, parts.join('/'), false);
  await dir.removeEntry(name, { recursive: isDir });
}

/** L'API n'a pas de renommage : déplacer = réécrire puis supprimer. */
async function fsMove(root: FsHandle, fromRel: string, toRel: string, isDir: boolean): Promise<void> {
  if (!isDir) {
    const src = await fsDirHandle(root, fromRel.split('/').slice(0, -1).join('/'), false);
    const fh = await src.getFileHandle(fromRel.split('/').pop() as string);
    const file = await fh.getFile();
    const content = await file.text();
    await fsWrite(root, toRel, content);
    await fsDelete(root, fromRel, false);
    return;
  }
  const copyDir = async (srcDir: FsHandle, destRel: string) => {
    for await (const [name, entry] of srcDir.entries()) {
      if (entry.kind === 'directory') {
        await fsDirHandle(root, `${destRel}/${name}`, true);
        const sub = await srcDir.getDirectoryHandle(name);
        await copyDir(sub, `${destRel}/${name}`);
      } else {
        const fh = await srcDir.getFileHandle(name);
        const file = await fh.getFile();
        if (file.size > 512_000) continue;
        await fsWrite(root, `${destRel}/${name}`, await file.text());
      }
    }
  };
  const fromParts = fromRel.split('/');
  const fromName = fromParts.pop() as string;
  const srcRoot = await fsDirHandle(root, fromParts.join('/'), false);
  const toParts = toRel.split('/');
  const toName = toParts.pop() as string;
  const destParentRel = toParts.join('/');
  await fsDirHandle(root, destParentRel, true);
  await copyDir(await srcRoot.getDirectoryHandle(fromName), destParentRel ? `${destParentRel}/${toName}` : toName);
  await fsDelete(root, fromRel, true);
}

/** Signature MÉTADONNÉES du dossier (chemins + taille + mtime) — sans lire les
 *  contenus : assez légère pour un polling toutes les quelques secondes.
 *  Retourne null si le handle est indisponible ou la permission perdue. */
export async function fsAccessSignature(root: FsHandle): Promise<string | null> {
  const parts: string[] = [];
  try {
    const walk = async (dir: FsHandle, prefix: string): Promise<void> => {
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind === 'directory') {
          if (name === 'node_modules' || name === '.git') continue;
          await walk(entry, prefix ? `${prefix}/${name}` : name);
        } else {
          const ext = name.split('.').pop()?.toLowerCase() ?? '';
          if (!TEXT_EXT.has(ext)) continue;
          const file = await entry.getFile();
          parts.push(`${prefix}/${name}:${file.size}:${file.lastModified}`);
        }
      }
    };
    await walk(root, '');
    return parts.join('|');
  } catch {
    return null; // NotAllowedError / handle perdu
  }
}

function hasElectronVault(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    !!window.electronVault?.pickFolder
  );
}

export function getVaultCapability(): VaultCapability {
  if (hasElectronVault()) {
    return {
      mode: 'electron',
      canPickFolder: true,
      canLiveSync: true,
      labelFr: 'Electron — synchronisation dossier locale',
      hintFr:
        'Sur l’app bureau (Windows / macOS / Linux), choisissez un dossier du disque : son contenu texte est relu automatiquement dans la base.',
    };
  }
  if (hasFsAccess()) {
    return {
      mode: 'fs-access',
      canPickFolder: true,
      canLiveSync: true,
      labelFr: 'Navigateur — File System Access API',
      hintFr:
        'Votre navigateur autorise l’accès à un dossier local pour cette session. Sur GitHub Pages, la synchro live dépend du navigateur (Chrome / Edge recommandés).',
    };
  }
  return {
    mode: 'import-only',
    canPickFolder: false,
    canLiveSync: false,
    labelFr: 'Web — import manuel',
    hintFr:
      'Sur cette plateforme, l’accès direct au disque n’est pas disponible. Importez des fichiers un par un, ou utilisez l’app Electron Windows pour une synchro dossier.',
  };
}

const TEXT_EXT = new Set([
  'md', 'markdown', 'txt', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go',
  'java', 'kt', 'swift', 'c', 'cpp', 'cs', 'css', 'html', 'yml', 'yaml', 'toml',
  'env', 'sh', 'sql', 'xml', 'csv',
]);

function inferType(name: string): DBFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'json') return 'json';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'swift', 'kt', 'go', 'rs', 'cpp', 'c', 'cs'].includes(ext)) {
    return 'code';
  }
  return 'text';
}

export type VaultFileInput = { name: string; type: DBFile['type']; content: string; tags: string[] };

export interface VaultPickResult {
  meta: VaultMeta;
  files: VaultFileInput[];
  /** Chemins relatifs des dossiers présents sur le disque (dossiers vides inclus). */
  dirs: string[];
}

export async function pickLocalVaultFolder(): Promise<VaultPickResult | null> {
  if (hasElectronVault()) {
    const picked = await window.electronVault!.pickFolder();
    if (!picked) return null;
    const listed = await window.electronVault!.listTextFiles(picked.path);
    const files = listed.filter(e => e.kind === 'file');
    return {
      meta: {
        sourceKind: 'local',
        path: picked.path,
        syncStatus: 'ok',
        lastSyncedAt: new Date().toISOString(),
        liveSync: true,
        syncMessage: `${files.length} fichier(s) synchronisé(s)`,
      },
      files: files.map(f => ({
        name: f.relativePath || f.name,
        type: inferType(f.name),
        content: f.content ?? '',
        tags: ['vault', 'local'],
      })),
      dirs: listed.filter(e => e.kind === 'dir').map(d => d.relativePath),
    };
  }

  if (hasFsAccess()) {
    // @ts-expect-error File System Access API
    // mode 'readwrite' dès la sélection : un handle obtenu en 'read' ne peut
    // JAMAIS être écrit (l'élévation readwrite exige un geste utilisateur,
    // que les écritures de l'agent n'ont pas) — cause des fichiers d'agent
    // absents de l'explorateur.
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const files: VaultFileInput[] = [];
    const dirs: string[] = [];
    // Handle conservé en session + IndexedDB (re-synchro et écritures disque)
    await saveFsHandle(handle);

    async function walk(dir: any, prefix: string) {
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind === 'directory') {
          if (name === 'node_modules' || name === '.git') continue;
          dirs.push(prefix ? `${prefix}/${name}` : name);
          await walk(entry, prefix ? `${prefix}/${name}` : name);
        } else if (entry.kind === 'file') {
          const ext = name.split('.').pop()?.toLowerCase() ?? '';
          if (!TEXT_EXT.has(ext)) continue;
          const file = await entry.getFile();
          if (file.size > 512_000) continue; // skip large binaries/text
          const content = await file.text();
          files.push({
            name: prefix ? `${prefix}/${name}` : name,
            type: inferType(name),
            content,
            tags: ['vault', 'local'],
          });
        }
      }
    }
    await walk(handle, '');
    return {
      meta: {
        sourceKind: 'local',
        path: handle.name,
        syncStatus: 'ok',
        lastSyncedAt: new Date().toISOString(),
        liveSync: true,
        syncMessage: `${files.length} fichier(s) synchronisé(s)`,
      },
      files,
      dirs,
    };
  }

  return null;
}

export async function resyncLocalVault(meta: VaultMeta): Promise<VaultPickResult | null> {
  if (meta.sourceKind !== 'local') return null;
  if (hasElectronVault() && meta.path) {
    try {
      const listed = await window.electronVault!.listTextFiles(meta.path);
      const files = listed.filter(e => e.kind === 'file');
      return {
        meta: {
          ...meta,
          syncStatus: 'ok',
          lastSyncedAt: new Date().toISOString(),
          syncMessage: `${files.length} fichier(s) synchronisé(s)`,
          liveSync: true,
        },
        files: files.map(f => ({
          name: f.relativePath || f.name,
          type: inferType(f.name),
          content: f.content ?? '',
          tags: ['vault', 'local'],
        })),
        dirs: listed.filter(e => e.kind === 'dir').map(d => d.relativePath),
      };
    } catch (e: any) {
      return {
        meta: {
          ...meta,
          syncStatus: 'error',
          syncMessage: e?.message ?? 'Échec de synchronisation',
          liveSync: false,
        },
        files: [],
        dirs: [],
      };
    }
  }
  if (hasFsAccess() && meta.path) {
    const handle = (window as any).__promptezVaultHandles?.[meta.path];
    if (!handle) {
      return {
        meta: {
          ...meta,
          syncStatus: 'unsupported',
          syncMessage: 'Handle de dossier perdu — resélectionnez le dossier (limitation navigateur).',
          liveSync: false,
        },
        files: [],
        dirs: [],
      };
    }
    const files: VaultFileInput[] = [];
    const dirs: string[] = [];
    async function walk(dir: any, prefix: string) {
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind === 'directory') {
          if (name === 'node_modules' || name === '.git') continue;
          dirs.push(prefix ? `${prefix}/${name}` : name);
          await walk(entry, prefix ? `${prefix}/${name}` : name);
        } else if (entry.kind === 'file') {
          const ext = name.split('.').pop()?.toLowerCase() ?? '';
          if (!TEXT_EXT.has(ext)) continue;
          const file = await entry.getFile();
          if (file.size > 512_000) continue;
          const content = await file.text();
          files.push({
            name: prefix ? `${prefix}/${name}` : name,
            type: inferType(name),
            content,
            tags: ['vault', 'local'],
          });
        }
      }
    }
    await walk(handle, '');
    return {
      meta: {
        ...meta,
        syncStatus: 'ok',
        lastSyncedAt: new Date().toISOString(),
        syncMessage: `${files.length} fichier(s) synchronisé(s)`,
        liveSync: true,
      },
      files,
      dirs,
    };
  }
  return {
    meta: {
      ...meta,
      syncStatus: 'unsupported',
      syncMessage: 'Synchro live indisponible sur cette plateforme.',
      liveSync: false,
    },
    files: [],
    dirs: [],
  };
}

// ── Écritures (app → disque) — Electron ET navigateur (File System Access) ──

/** Complète l'extension disque d'un fichier créé depuis l'appli (nom sans point). */
export function ensureVaultExt(name: string, type: DBFile['type']): string {
  if (name.includes('.')) return name;
  const ext = type === 'markdown' || type === 'note' ? 'md' : type === 'json' ? 'json' : 'txt';
  return `${name}.${ext}`;
}

/** Répartit vers le pont Electron ou le handle File System Access. */
async function mirrorWrite(
  meta: VaultMeta | null,
  kind: 'write' | 'mkdir' | 'delete' | 'move',
  relPath: string,
  content: string,
  opts?: { toRel?: string; isDir?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (!canMirrorToDisk(meta) || !meta!.path) {
    recordDiag('vault.miroir.indisponible', `${kind} ${relPath} — canMirrorToDisk=false (handle absent ? liveSync=false ?)`);
    return { ok: false, error: 'Miroir disque indisponible' };
  }
  markLocalWrite();
  const bridge = getElectronVault();
  if (bridge) {
    switch (kind) {
      case 'write': return bridge.writeFile!(meta!.path, relPath, content);
      case 'mkdir': return bridge.makeDir!(meta!.path, relPath);
      case 'delete': return bridge.deletePath!(meta!.path, relPath, !!opts?.isDir);
      case 'move': return bridge.movePath!(meta!.path, relPath, opts!.toRel!);
    }
  }
  try {
    const root = getFsHandle(meta!.path);
    if (!root) {
      recordDiag('vault.miroir.handle', `${kind} ${relPath} — handle non retrouvé cette session`);
      return { ok: false, error: 'Dossier non relié cette session — clique « Resynchroniser » pour le relier' };
    }
    if (!(await ensureFsPerm(root))) {
      return { ok: false, error: 'Autorisation du navigateur requise — clique « Resynchroniser » pour la redonner' };
    }
    switch (kind) {
      case 'write': await fsWrite(root, relPath, content); break;
      case 'mkdir': await fsDirHandle(root, relPath, true); break;
      case 'delete': await fsDelete(root, relPath, !!opts?.isDir); break;
      case 'move': await fsMove(root, relPath, opts!.toRel!, !!opts?.isDir); break;
    }
    return { ok: true };
  } catch (e: any) {
    recordDiag('vault.miroir.erreur', `${kind} ${relPath} — ${e?.name ?? ''} ${e?.message ?? 'inconnue'}`);
    return { ok: false, error: e?.message ?? 'Échec de l’écriture disque' };
  }
}

export async function vaultWriteFile(meta: VaultMeta | null, relPath: string, content: string): Promise<{ ok: boolean; error?: string }> {
  return mirrorWrite(meta, 'write', relPath, content);
}

export async function vaultMakeDir(meta: VaultMeta | null, relPath: string): Promise<{ ok: boolean; error?: string }> {
  return mirrorWrite(meta, 'mkdir', relPath, '');
}

export async function vaultDeletePath(meta: VaultMeta | null, relPath: string, isDir: boolean): Promise<{ ok: boolean; error?: string }> {
  return mirrorWrite(meta, 'delete', relPath, '', { isDir });
}

export async function vaultMovePath(meta: VaultMeta | null, fromRel: string, toRel: string): Promise<{ ok: boolean; error?: string }> {
  return mirrorWrite(meta, 'move', fromRel, '', { toRel });
}

export async function vaultOpenPath(targetPath: string): Promise<{ ok: boolean; error?: string }> {
  const bridge = getElectronVault();
  if (!bridge?.openPath) return { ok: false, error: 'Disponible uniquement dans l’application bureau' };
  return bridge.openPath(targetPath);
}

/**
 * Surveille un dossier local ; `onChange` est appelé (déboursé côté main) quand
 * le disque change, sauf dans la seconde qui suit une écriture initiée par l'app.
 */
export function watchVaultPath(meta: VaultMeta, onChange: () => void): () => void {
  const bridge = getElectronVault();
  if (!bridge?.watch || !bridge.onChanged || meta.sourceKind !== 'local' || !meta.path) return () => {};
  let disposed = false;
  void bridge.watch(meta.path);
  const off = bridge.onChanged(payload => {
    if (disposed || payload?.rootPath !== meta.path) return;
    if (Date.now() - lastLocalWriteAt < 1500) return; // écho d'une écriture locale
    onChange();
  });
  return () => {
    disposed = true;
    off();
    void bridge.unwatch?.(meta.path!);
  };
}

export interface GitHubRepoHit {
  id: number;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export async function searchGitHubRepos(
  token: string,
  query: string,
): Promise<{ repos: GitHubRepoHit[]; error?: string }> {
  if (!token.trim()) {
    return {
      repos: [],
      error: 'Aucun jeton GitHub. Activez le connecteur GitHub et renseignez un Personal Access Token.',
    };
  }
  const q = query.trim() ? `${query.trim()} in:name fork:true` : 'user:@me';
  const url = query.trim()
    ? `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=20`
    : 'https://api.github.com/user/repos?per_page=20&sort=updated';
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.trim()}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      return { repos: [], error: `GitHub API ${res.status} : ${body.slice(0, 180)}` };
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items ?? [];
    return {
      repos: items.map((r: any) => ({
        id: r.id,
        full_name: r.full_name,
        description: r.description,
        private: r.private,
        html_url: r.html_url,
        default_branch: r.default_branch,
      })),
    };
  } catch (e: any) {
    return { repos: [], error: e?.message ?? 'Erreur réseau GitHub' };
  }
}

/** Import d'un dépôt GitHub : ARBRE COMPLET des dossiers/fichiers texte via
 *  l'API git trees + raw.githubusercontent (les chemins relatifs materialisent
 *  l'arborescence côté base). Fonctionne avec un jeton (dépôts privés) OU
 *  anonymement (dépôts publics) — retombe en anonyme si le jeton est refusé
 *  (ex. fine-grained sans ce dépôt sélectionné). */
export async function importGitHubRepoAsVault(
  token: string,
  repo: GitHubRepoHit,
): Promise<{
  meta: VaultMeta;
  files: VaultFileInput[];
  dirs: string[];
  error?: string;
}> {
  const [owner, name] = repo.full_name.split('/');
  const branch = repo.default_branch || 'main';
  const t = token.trim();
  const anonHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const authHeaders: Record<string, string> = t
    ? { ...anonHeaders, Authorization: `Bearer ${t}` }
    : anonHeaders;
  const fail = (message: string): { meta: VaultMeta; files: VaultFileInput[]; dirs: string[]; error?: string } => ({
    meta: {
      sourceKind: 'github',
      repoFullName: repo.full_name,
      repoId: repo.id,
      defaultBranch: branch,
      syncStatus: 'error',
      syncMessage: message,
    },
    files: [],
    dirs: [],
    error: message,
  });
  /** Fetch API GitHub : ANONYME d'abord (dépôts publics marchent toujours),
   *  puis avec jeton seulement si anonyme échoue (dépôts privés). */
  const ghFetch = async (url: string): Promise<{ res: Response | null; headers: Record<string, string> }> => {
    // Anonyme d'abord — suffit pour tous les dépôts publics
    let res = await fetch(url, { headers: anonHeaders });
    let headers = anonHeaders;
    // Si anonyme échoue (404 = dépôt privé) et qu'on a un jeton, réessaie avec
    if (res.status === 404 && t) {
      res = await fetch(url, { headers: authHeaders });
      headers = authHeaders;
    }
    return { res, headers };
  };
  try {
    // 1) Arbre complet du dépôt (une seule requête, récursif)
    const { res: treeRes } = await ghFetch(
      `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
    );
    if (!treeRes) return fail('Réseau indisponible');
    if (treeRes.status === 404) {
      return fail('Dépôt introuvable ou privé — connecte un jeton GitHub ayant accès (Builder ▸ Connecteurs ▸ GitHub).');
    }
    if (treeRes.status === 403) {
      const resetHeader = treeRes.headers.get('x-ratelimit-reset');
      const waitMin = resetHeader
        ? Math.max(1, Math.ceil((Number(resetHeader) * 1000 - Date.now()) / 60_000))
        : null;
      return fail(
        `Limite de taux GitHub atteinte (60 requêtes/h anonymes) — réessaie dans ~${waitMin ?? 60} min ou connecte un jeton (Builder ▸ Connecteurs ▸ GitHub).`,
      );
    }
    if (!treeRes.ok) {
      return fail(`GitHub API ${treeRes.status} — impossible de lister ${repo.full_name}`);
    }
    const treeData: any = await treeRes.json();

    // 2) Fichiers texte exploitables (plafond de taille + quantité)
    const blobs = (treeData.tree ?? [])
      .filter((e: any) =>
        e.type === 'blob' &&
        TEXT_EXT.has(String(e.path).split('.').pop()?.toLowerCase() ?? '') &&
        (e.size ?? 0) > 0 &&
        (e.size ?? 0) <= 512_000,
      )
      .slice(0, 600);

    // 3) Contenus via raw.githubusercontent SANS Authorization : c'est un CDN
    //    SANS limite de taux (l'API Contents en comptait 1 par fichier → 403
    //    rate-limit dès 60 fichiers anonymes), et son CORS accepte les GET
    //    simples sans en-tête custom. Repli Contents API (avec jeton) pour
    //    les dépôts privés.
    const rawBase = `https://raw.githubusercontent.com/${owner}/${name}/${encodeURIComponent(branch)}`;
    const files: VaultFileInput[] = [];
    let rawOk = 0;
    let contentsFallback = 0;
    let rateLimited = false;
    for (const blob of blobs) {
      const encPath = blob.path.split('/').map((p: string) => encodeURIComponent(p)).join('/');
      try {
        let content = '';
        const rawRes = await fetch(`${rawBase}/${encPath}`);
        if (rawRes.ok) {
          content = await rawRes.text();
          rawOk++;
        } else {
          // Repli : API Contents (dépôt privé, ou raw momentanément indisponible)
          const contentRes = await ghFetch(
            `https://api.github.com/repos/${owner}/${name}/contents/${encPath}?ref=${encodeURIComponent(branch)}`,
          );
          if (!contentRes.res || !contentRes.res.ok) {
            if (contentRes.res?.status === 403) rateLimited = true;
            continue;
          }
          const contentData: any = await contentRes.res.json();
          // L'API Contents renvoie le contenu en base64
          content = atob(String(contentData.content ?? '').replace(/\n/g, ''));
          contentsFallback++;
        }
        files.push({
          name: blob.path,
          type: inferType(blob.path),
          content,
          tags: ['dépôt', 'github', repo.full_name],
        });
      } catch {
        // fichier suivant
      }
    }

    const partial = treeData.truncated ? ' (arbre partiel — dépôt très volumineux)' : '';
    const viaRaw = contentsFallback > 0 ? `, dont ${contentsFallback} via API (privé)` : '';
    const rateNote = rateLimited && files.length < blobs.length
      ? ` — ${blobs.length - files.length} fichier(s) sautés (limite API atteinte, réessaie plus tard)`
      : '';
    return {
      meta: {
        sourceKind: 'github',
        repoFullName: repo.full_name,
        repoId: repo.id,
        defaultBranch: branch,
        path: repo.html_url,
        syncStatus: 'ok',
        lastSyncedAt: new Date().toISOString(),
        liveSync: false,
        syncMessage: `${files.length}/${blobs.length} fichier(s) importé(s)${viaRaw}${partial}${rateNote}`,
      },
      files,
      dirs: [],
    };
  } catch (e: any) {
    return {
      meta: {
        sourceKind: 'github',
        repoFullName: repo.full_name,
        repoId: repo.id,
        defaultBranch: branch,
        syncStatus: 'error',
        syncMessage: e?.message ?? 'Erreur import GitHub',
      },
      files: [],
      dirs: [],
      error: e?.message,
    };
  }
}

/** Resolve GitHub PAT from connectedApps entry (stored in webhookUrl when preset is github). */
export function resolveGitHubToken(connectedApps: { presetId?: string; id: string; enabled: boolean; webhookUrl?: string }[]): string | null {
  const gh = connectedApps.find(a => (a.presetId === 'github' || a.id === 'github' || a.id.startsWith('preset-github')) && a.enabled);
  if (!gh) return null;
  const token = (gh.webhookUrl || '').trim();
  // Ignore placeholder webhook URLs
  if (!token || token.startsWith('http')) return null;
  return token;
}
