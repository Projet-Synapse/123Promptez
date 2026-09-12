// VaultLiveSync — surveille les dossiers locaux (vault + dépôts connectés) et
// fusionne le contenu disque dans l'appli en temps réel (disque → app).
// Monté une seule fois à la racine (app/_layout.tsx) : il n'affiche rien.
//  - Electron  : watcher disque natif (fs.watch, pont IPC)
//  - Navigateur: polling léger sur les handles File System Access (Chrome/Edge)
//    — signature métadonnées toutes les 6 s, lecture complète seulement si
//    le dossier a réellement changé (anti-écho avec les écritures de l'app).
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  resyncLocalVault, watchVaultPath, getElectronVault, getFsHandle,
  fsAccessSignature, restoreFsHandles, getLastLocalWriteAt, hasFsAccess,
  type VaultMeta,
} from '@/services/vaultService';

export function VaultLiveSync() {
  const { workspaces, syncFolderFromDisk, updateFolder } = useWorkspace();

  // Signature stable = l'ensemble des chemins surveillés. L'effet ne se
  // ré-abonne que si cet ensemble change ; les callbacks lisent l'état
  // courant via des refs (aucun re-watch à chaque frappe dans le chat).
  const watchSig = workspaces
    .map(w => w.database.folders.map(f => (f.vault ?? f.repo)?.path ?? '').join('|'))
    .join(';;');
  const latest = useRef({ workspaces, syncFolderFromDisk, updateFolder });
  latest.current = { workspaces, syncFolderFromDisk, updateFolder };
  // Signatures connues + dossiers signalés « permission requise » (anti-spam)
  const sigs = useRef<Record<string, string>>({});
  const warned = useRef<Set<string>>(new Set());

  const mergeResync = async (folderId: string, meta: VaultMeta) => {
    const res = await resyncLocalVault(meta);
    if (!res) return;
    const { workspaces: wsNow, syncFolderFromDisk: sync, updateFolder: upd } = latest.current;
    for (const w2 of wsNow) {
      const fld = w2.database.folders.find(f => f.id === folderId || (f.vault ?? f.repo)?.path === meta.path);
      if (!fld) continue;
      sync(w2.id, fld.id, res.files, res.dirs);
      if (fld.vault) upd(w2.id, fld.id, { vault: res.meta });
      else if (fld.repo) upd(w2.id, fld.id, { repo: res.meta });
    }
  };

  // ── Electron : watcher natif ──
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const bridge = getElectronVault();
    if (!bridge?.watch) return;

    const unsubs: (() => void)[] = [];
    const seenPaths = new Set<string>();
    for (const w of latest.current.workspaces) {
      for (const folder of w.database.folders) {
        const meta: VaultMeta | undefined = folder.vault ?? folder.repo;
        if (!meta || meta.sourceKind !== 'local' || !meta.path || meta.liveSync === false) continue;
        if (seenPaths.has(meta.path)) continue;
        seenPaths.add(meta.path);
        const folderId = folder.id;
        unsubs.push(watchVaultPath(meta, () => {
          void mergeResync(folderId, meta);
        }));
      }
    }
    return () => unsubs.forEach(unsub => unsub());
  }, [watchSig]);

  // ── Navigateur (File System Access) : restaure les handles + polling ──
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (getElectronVault() || !hasFsAccess()) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      // anti-écho : laisse passer une éventuelle écriture initiée par l'app
      if (Date.now() - getLastLocalWriteAt() < 2500) return;
      const { workspaces: wsNow, updateFolder: upd } = latest.current;
      const seen = new Set<string>();
      for (const w of wsNow) {
        for (const folder of w.database.folders) {
          const meta: VaultMeta | undefined = folder.vault ?? folder.repo;
          if (!meta || meta.sourceKind !== 'local' || !meta.path || meta.liveSync === false) continue;
          if (seen.has(meta.path)) continue;
          seen.add(meta.path);
          const key = `${w.id}:${folder.id}:${meta.path}`;
          const root = getFsHandle(meta.path);
          if (!root) continue;
          const sig = await fsAccessSignature(root);
          if (sig === null) {
            // Permission perdue (rechargement) : un « Resynchroniser » la redonne
            if (!warned.current.has(key)) {
              warned.current.add(key);
              const flagged = { ...meta, syncMessage: 'Autorisation du navigateur requise — clique « Resynchroniser »', liveSync: false };
              if (meta === folder.vault) upd(w.id, folder.id, { vault: flagged });
              else if (meta === folder.repo) upd(w.id, folder.id, { repo: flagged });
            }
            continue;
          }
          warned.current.delete(key);
          if (sigs.current[key] === undefined) {
            sigs.current[key] = sig; // premier scan : référence
            continue;
          }
          if (sigs.current[key] === sig) continue;
          sigs.current[key] = sig;
          await mergeResync(folder.id, meta);
        }
      }
    };

    void restoreFsHandles().then(() => {
      if (!stopped) timer = setInterval(() => { void poll(); }, 6000);
    });

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [watchSig]);

  return null;
}
