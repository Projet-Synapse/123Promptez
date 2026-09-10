/**
 * Vault folder sync helpers — Electron (node/fs via preload) + Web File System
 * Access API + graceful import fallback. GitHub repo search when a token exists.
 */
import { Platform } from 'react-native';
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
  const bridge = getElectronVault();
  return !!bridge?.writeFile && !!meta && meta.sourceKind === 'local' && !!meta.path && meta.liveSync !== false;
}

function hasFsAccess(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof (window as any).showDirectoryPicker === 'function'
  );
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
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    const files: VaultFileInput[] = [];
    const dirs: string[] = [];
    // Store handle on window for session re-sync (not serializable to cloud)
    (window as any).__promptezVaultHandles = (window as any).__promptezVaultHandles || {};
    const key = handle.name;
    (window as any).__promptezVaultHandles[key] = handle;

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

// ── Écritures (app → disque) — actives sur la build Electron ─────────────────

/** Complète l'extension disque d'un fichier créé depuis l'appli (nom sans point). */
export function ensureVaultExt(name: string, type: DBFile['type']): string {
  if (name.includes('.')) return name;
  const ext = type === 'markdown' || type === 'note' ? 'md' : type === 'json' ? 'json' : 'txt';
  return `${name}.${ext}`;
}

export async function vaultWriteFile(meta: VaultMeta | null, relPath: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const bridge = getElectronVault();
  if (!bridge?.writeFile || !canMirrorToDisk(meta) || !meta!.path) return { ok: false, error: 'Miroir disque indisponible' };
  markLocalWrite();
  return bridge.writeFile(meta!.path, relPath, content);
}

export async function vaultMakeDir(meta: VaultMeta | null, relPath: string): Promise<{ ok: boolean; error?: string }> {
  const bridge = getElectronVault();
  if (!bridge?.makeDir || !canMirrorToDisk(meta) || !meta!.path) return { ok: false, error: 'Miroir disque indisponible' };
  markLocalWrite();
  return bridge.makeDir(meta!.path, relPath);
}

export async function vaultDeletePath(meta: VaultMeta | null, relPath: string, isDir: boolean): Promise<{ ok: boolean; error?: string }> {
  const bridge = getElectronVault();
  if (!bridge?.deletePath || !canMirrorToDisk(meta) || !meta!.path) return { ok: false, error: 'Miroir disque indisponible' };
  markLocalWrite();
  return bridge.deletePath(meta!.path, relPath, isDir);
}

export async function vaultMovePath(meta: VaultMeta | null, fromRel: string, toRel: string): Promise<{ ok: boolean; error?: string }> {
  const bridge = getElectronVault();
  if (!bridge?.movePath || !canMirrorToDisk(meta) || !meta!.path) return { ok: false, error: 'Miroir disque indisponible' };
  markLocalWrite();
  return bridge.movePath(meta!.path, fromRel, toRel);
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

/** Shallow import of README + a few root text files from a public/private repo via Contents API. */
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
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.trim()}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      return {
        meta: {
          sourceKind: 'github',
          repoFullName: repo.full_name,
          repoId: repo.id,
          syncStatus: 'error',
          syncMessage: `Impossible de lister ${repo.full_name}`,
        },
        files: [],
        dirs: [],
        error: `GitHub API ${res.status}`,
      };
    }
    const entries = await res.json();
    const files: Omit<DBFile, 'id' | 'createdAt' | 'updatedAt' | 'size'>[] = [];
    for (const entry of entries) {
      if (entry.type !== 'file') continue;
      const ext = (entry.name as string).split('.').pop()?.toLowerCase() ?? '';
      if (!TEXT_EXT.has(ext)) continue;
      if (entry.size > 512_000) continue;
      const fileRes = await fetch(entry.download_url, {
        headers: token ? { Authorization: `Bearer ${token.trim()}` } : {},
      });
      if (!fileRes.ok) continue;
      const content = await fileRes.text();
      files.push({
        name: entry.name,
        type: inferType(entry.name),
        content,
        tags: ['vault', 'github', repo.full_name],
      });
    }
    return {
      meta: {
        sourceKind: 'github',
        repoFullName: repo.full_name,
        repoId: repo.id,
        path: repo.html_url,
        syncStatus: 'ok',
        lastSyncedAt: new Date().toISOString(),
        liveSync: false,
        syncMessage: `${files.length} fichier(s) importé(s) depuis GitHub (racine du dépôt)`,
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
