// VaultLiveSync — surveille les dossiers locaux (vault + dépôts connectés) et
// fusionne le contenu disque dans l'appli en temps réel (disque → app).
// Monté une seule fois à la racine (app/_layout.tsx) : il n'affiche rien.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useWorkspace } from '@/hooks/useWorkspace';
import { resyncLocalVault, watchVaultPath, getElectronVault, type VaultMeta } from '@/services/vaultService';

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
        unsubs.push(watchVaultPath(meta, async () => {
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
        }));
      }
    }
    return () => unsubs.forEach(unsub => unsub());
  }, [watchSig]);

  return null;
}
