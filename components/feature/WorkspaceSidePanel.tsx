// WorkspaceSidePanel — panneau latéral droit façon Grok :
// accès direct aux fichiers du workspace (avec glisser-déposer), aux
// instructions, aux dépôts de code connectés et à des sites web / sandbox.
import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { IconButton } from '@/components/ui/IconButton';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useBot } from '@/hooks/useBot';
import { useToast } from '@/contexts/ToastContext';
import { Draggable, DropZone, useDnDState } from '@/components/feature/dnd';
import { ResizeHandle } from '@/components/feature/ResizeHandle';
import {
  canMirrorToDisk, vaultWriteFile, vaultDeletePath, vaultMovePath, vaultOpenPath,
  resyncLocalVault, importGitHubRepoAsVault, resolveGitHubToken,
  type VaultMeta,
} from '@/services/vaultService';
import type { Workspace, DBFile, DBFolder, DBSubFolder, FileLocation } from '@/contexts/WorkspaceContext';

type PanelTab = 'files' | 'instructions' | 'web';

// iframe n'existe que sur web — on le crée dynamiquement pour éviter le crash natif.
// `reloadKey` change ⇒ remontage complet = vrai rechargement de la page.
const Iframe: React.FC<{ src: string; onLoad?: () => void; reloadKey?: number }> = Platform.OS === 'web'
  ? (props) => (React as any).createElement('iframe', {
      src: props.src,
      title: 'web-preview',
      key: props.reloadKey,
      style: { flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' },
      sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
      onLoad: props.onLoad,
    })
  : () => null;

const FILE_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  note: { label: 'Note', icon: 'sticky-note-2', color: '#FFB800' },
  markdown: { label: 'Markdown', icon: 'article', color: '#3D7EFF' },
  text: { label: 'Texte brut', icon: 'text-snippet', color: '#8899BB' },
  url: { label: 'URL', icon: 'link', color: '#00CC6A' },
  json: { label: 'JSON', icon: 'data-object', color: '#FF6B35' },
  code: { label: 'Code', icon: 'code', color: '#9B59B6' },
};

function fileTypeInfo(type: string) {
  return FILE_TYPES[type] ?? FILE_TYPES.text;
}

// ─── Onglet Fichiers ──────────────────────────────────────────────────────────
function FileChip({ file, depth, active, fromLoc, onPress }: {
  file: DBFile; depth: number; active: boolean; fromLoc: FileLocation; onPress: () => void;
}) {
  const C = useThemeColors();
  const info = fileTypeInfo(file.type);
  return (
    <Draggable
      getItem={() => ({
        kind: 'file' as const,
        id: file.id,
        label: file.name,
        icon: info.icon,
        color: info.color,
        data: { file, fromLoc },
      })}
      onTap={onPress}
      style={{ marginLeft: depth * Spacing.md, borderRadius: Radius.sm, backgroundColor: active ? C.accent + '18' : 'transparent' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.sm }}>
        <MaterialIcons name={info.icon as any} size={14} color={info.color} />
        <Text style={{ flex: 1, fontSize: FontSize.sm, color: active ? C.accent : C.textSecondary }} numberOfLines={1}>{file.name}</Text>
      </View>
    </Draggable>
  );
}

function FilesTab({ workspace, onOpenFull }: { workspace: Workspace; onOpenFull: () => void }) {
  const C = useThemeColors();
  const { moveFile, updateFile } = useWorkspace();
  const { showToast } = useToast();
  const dragState = useDnDState();
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<DBFile | null>(null);

  const toggleFolder = (id: string) => setOpenFolderIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ── Miroir disque (vault / dépôts locaux) ────────────────────────
  const metaAt = (loc: FileLocation): VaultMeta | null => {
    const folderOf = (fid: string) => workspace.database.folders.find(f => f.id === fid);
    if (typeof loc === 'string') {
      const f = folderOf(loc);
      return f?.vault ?? f?.repo ?? null;
    }
    if (loc && typeof loc === 'object') {
      const f = folderOf(loc.folderId);
      return f?.vault ?? f?.repo ?? null;
    }
    return null;
  };
  const prefixOf = (loc: FileLocation): string => {
    if (!loc || typeof loc !== 'object') return '';
    const f = workspace.database.folders.find(x => x.id === loc.folderId);
    const subName = f?.subFolders?.find(s => s.id === loc.subId)?.name ?? '';
    return subName ? `${subName}/` : '';
  };
  const performMove = async (file: DBFile, fromLoc: FileLocation, toLoc: FileLocation) => {
    const fromMeta = metaAt(fromLoc);
    const toMeta = metaAt(toLoc);
    const fromMirror = canMirrorToDisk(fromMeta);
    const toMirror = canMirrorToDisk(toMeta);
    const base = file.name.split('/').pop() ?? file.name;
    if (file.type !== 'url' && fromMirror && toMirror && fromMeta!.path === toMeta!.path) {
      const toRel = `${prefixOf(toLoc)}${base}`;
      const r = await vaultMovePath(fromMeta, file.name, toRel);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'déplacement impossible'}`, { tone: 'error' }); return; }
      moveFile(workspace.id, file.id, fromLoc, toLoc);
      updateFile(workspace.id, toLoc, file.id, { name: toRel });
      return;
    }
    if (file.type !== 'url' && fromMirror && !toMirror) {
      const r = await vaultDeletePath(fromMeta, file.name, false);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'suppression impossible'}`, { tone: 'error' }); return; }
      moveFile(workspace.id, file.id, fromLoc, toLoc);
      updateFile(workspace.id, toLoc, file.id, { name: base });
      showToast('Fichier retiré du disque (conservé dans la base)', { tone: 'success' });
      return;
    }
    if (file.type !== 'url' && !fromMirror && toMirror) {
      const toRel = `${prefixOf(toLoc)}${base}`;
      const r = await vaultWriteFile(toMeta, toRel, file.content);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'écriture impossible'}`, { tone: 'error' }); return; }
      moveFile(workspace.id, file.id, fromLoc, toLoc);
      updateFile(workspace.id, toLoc, file.id, { name: toRel });
      return;
    }
    moveFile(workspace.id, file.id, fromLoc, toLoc);
  };

  // Lignes dépliables : dossiers racine + sous-dossiers IMBRIQUÉS à toute
  // profondeur (vault et dépôts inclus). `loc` = localisation exacte de la ligne.
  const rows: { key: string; folder: DBFolder; depth: number; loc: FileLocation }[] = [];
  const walkRows = (subs: DBSubFolder[], folderId: string, depth: number) => {
    subs.forEach(s => {
      rows.push({ key: s.id, folder: s as unknown as DBFolder, depth, loc: { folderId, subId: s.id } });
      if (openFolderIds.has(s.id)) walkRows(s.subFolders ?? [], folderId, depth + 1);
    });
  };
  for (const folder of workspace.database.folders) {
    rows.push({ key: folder.id, folder, depth: 0, loc: folder.id });
    if (openFolderIds.has(folder.id)) walkRows(folder.subFolders ?? [], folder.id, 1);
  }

  const folderMeta = (folder: DBFolder): VaultMeta | null => folder.vault ?? folder.repo ?? null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.sm, gap: 2 }} showsVerticalScrollIndicator={false}>
        {/* Bande de dépôt vers la racine, visible pendant un glisser-déposer */}
        {dragState ? (
          <DropZone
            zoneId="panel-root-strip"
            accepts={() => true}
            onDrop={(item) => {
              if (item.kind !== 'file') return;
              const { file, fromLoc } = item.data ?? {};
              if (!file) return;
              void performMove(file, fromLoc ?? null, null);
              showToast(`« ${file.name.split('/').pop()} » déplacé à la racine`, { tone: 'success' });
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: C.accent + '66', borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: Spacing.sm, backgroundColor: C.accent + '10' }}
          >
            <MaterialIcons name="home" size={14} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Déposer ici → Racine du workspace</Text>
          </DropZone>
        ) : null}

        {/* Fichiers racine */}
        {workspace.database.rootFiles.map(f => (
          <FileChip
            key={f.id}
            file={f}
            depth={0}
            active={selectedFile?.id === f.id}
            fromLoc={null}
            onPress={() => setSelectedFile(f)}
          />
        ))}

        {/* Dossiers dépliables (vault et dépôts inclus, sous-dossiers imbriqués) — zones de dépôt */}
        {rows.map(row => {
          const { folder, depth, loc } = row;
          const open = openFolderIds.has(folder.id);
          const meta = folderMeta(folder);
          return (
            <DropZone
              key={row.key}
              zoneId={`panel-folder-${folder.id}`}
              accepts={(item) => item.kind === 'file'}
              onDrop={(item) => {
                if (item.kind !== 'file') return;
                const { file, fromLoc } = item.data ?? {};
                if (file) void performMove(file, fromLoc ?? null, loc);
              }}
              style={{ borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent' }}
              activeStyle={{ borderColor: C.accent, opacity: 0.85 }}
            >
              <Pressable
                onPress={() => toggleFolder(folder.id)}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 7, paddingHorizontal: Spacing.sm, marginLeft: depth * Spacing.md }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name={open ? 'folder-open' : (folder.icon as any) || 'folder'} size={16} color={folder.color} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600' }} numberOfLines={1}>{folder.name}</Text>
                  {meta?.path ? (
                    <Text style={{ fontSize: 10, color: C.textMuted }} numberOfLines={1}>
                      {meta.sourceKind === 'github' ? 'GitHub' : 'Local'} · {meta.path}
                    </Text>
                  ) : null}
                </View>
                {folder.vault ? (
                  <View style={{ backgroundColor: (folder.color || '#9B59B6') + '22', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, color: folder.color || '#9B59B6', fontWeight: '700' }}>vault</Text>
                  </View>
                ) : folder.repo ? (
                  <View style={{ backgroundColor: (folder.color || '#00BFFF') + '22', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, color: folder.color || '#00BFFF', fontWeight: '700' }}>dépôt</Text>
                  </View>
                ) : null}
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={14} color={C.textMuted} />
              </Pressable>
              {open ? (folder.files ?? []).map(f => (
                <FileChip
                  key={f.id}
                  file={f}
                  depth={depth + 1}
                  active={selectedFile?.id === f.id}
                  fromLoc={loc}
                  onPress={() => setSelectedFile(f)}
                />
              )) : null}
            </DropZone>
          );
        })}

        {workspace.database.rootFiles.length === 0 && workspace.database.folders.length === 0 ? (
          <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center', paddingVertical: Spacing.lg }}>
            Aucun fichier dans ce workspace
          </Text>
        ) : null}
      </ScrollView>

      {/* Aperçu du fichier sélectionné */}
      {selectedFile ? (
        <View style={{ maxHeight: '55%', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgCard, padding: Spacing.md, gap: Spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name={fileTypeInfo(selectedFile.type).icon as any} size={16} color={fileTypeInfo(selectedFile.type).color} />
            <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{selectedFile.name}</Text>
            <IconButton icon="close" label="Fermer l aperçu" bare size={16} color={C.textSecondary} onPress={() => setSelectedFile(null)} />
          </View>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 17, fontFamily: selectedFile.type === 'code' || selectedFile.type === 'json' ? 'monospace' : undefined }}>
              {selectedFile.content || '(Contenu vide)'}
            </Text>
          </ScrollView>
          <Pressable onPress={onOpenFull} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.xs + 2, borderRadius: Radius.md, backgroundColor: C.accent + '18', borderWidth: 1, borderColor: C.accent + '44' }, pressed && { opacity: 0.75 }]}>
            <MaterialIcons name="open-in-new" size={13} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Gérer dans la bibliothèque</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ─── Onglet Instructions ──────────────────────────────────────────────────────
function InstructionsTab({ workspace, onEdit }: { workspace: Workspace; onEdit: () => void }) {
  const C = useThemeColors();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 20, fontFamily: 'monospace' }}>
        {workspace.systemPrompt || 'Aucune instruction définie pour ce workspace. Ajoutez-en dans les paramètres du workspace.'}
      </Text>
      <Pressable onPress={onEdit} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: workspace.color + '22', borderWidth: 1, borderColor: workspace.color + '55' }, pressed && { opacity: 0.75 }]}>
        <MaterialIcons name="edit" size={14} color={workspace.color} />
        <Text style={{ fontSize: FontSize.sm, color: workspace.color, fontWeight: '700' }}>Modifier les instructions</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Onglet Sites (web + dépôts connectés) ────────────────────────────────────
function SitesTab({ workspace }: { workspace: Workspace }) {
  const C = useThemeColors();
  const { showToast } = useToast();
  const { bot } = useBot();
  const { updateFolder, syncFolderFromDisk } = useWorkspace();
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  // Dépôts connectés au workspace (séparés du vault)
  const repos = useMemo(() => workspace.database.folders.filter(f => f.repo), [workspace]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [busyRepoSync, setBusyRepoSync] = useState(false);
  // Site du dépôt (Vercel, Pages…) affiché dans l'iframe
  const [repoSiteUrl, setRepoSiteUrl] = useState<string | null>(null);
  const [siteUrlDraft, setSiteUrlDraft] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const activeRepo = repos.find(r => r.id === activeRepoId) ?? null;
  const activeRepoMeta = activeRepo?.repo ?? null;

  const normalize = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

  const openHere = (target?: string) => {
    const t = (target ?? url).trim();
    if (!t) return;
    const full = normalize(t);
    setLoading(true);
    setLoadedUrl(full);
  };

  const openRepo = (folder: DBFolder) => {
    setActiveRepoId(folder.id);
    const meta = folder.repo!;
    // Le site du dépôt est celui ENREGISTRÉ par l'utilisateur (Vercel, Pages…)
    // — exactement le même chemin que coller l'URL dans le champ.
    if (meta.siteUrl) {
      setRepoSiteUrl(meta.siteUrl);
      setUrl(meta.siteUrl);
      setLoadedUrl(meta.siteUrl);
      setLoading(true);
      setSiteUrlDraft(meta.siteUrl);
    } else {
      setRepoSiteUrl(null);
      // Pré-remplissage : hypothèse GitHub Pages (l'utilisatrice peut coller
      // son URL réelle — Vercel, Grok… — qui sera ensuite chargée d'un clic).
      const full = meta.repoFullName;
      if (meta.sourceKind === 'github' && full) {
        const [owner, repo] = full.split('/');
        setSiteUrlDraft(`https://${owner}.github.io/${repo}/`);
      } else {
        setSiteUrlDraft('');
      }
    }
  };

  /** Enregistre l'URL du site sur le dépôt puis l'ouvre dans l'iframe. */
  const saveAndOpenSite = () => {
    if (!activeRepo || !siteUrlDraft.trim()) return;
    const raw = siteUrlDraft.trim();
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const meta = activeRepo.repo;
    if (meta) updateFolder(workspace.id, activeRepo.id, { repo: { ...meta, siteUrl: url } });
    setRepoSiteUrl(url);
    setUrl(url);
    setLoadedUrl(url);
    setLoading(true);
    showToast('URL du site enregistrée pour ce dépôt', { tone: 'success' });
  };

  const handleRepoSync = async () => {
    if (!activeRepo?.repo) return;
    const meta = activeRepo.repo;
    setBusyRepoSync(true);
    try {
      if (meta.sourceKind === 'local') {
        const result = await resyncLocalVault(meta);
        if (result) {
          updateFolder(workspace.id, activeRepo.id, { repo: result.meta });
          syncFolderFromDisk(workspace.id, activeRepo.id, result.files, result.dirs);
          showToast(result.meta.syncMessage || 'Dépôt resynchronisé', { tone: 'success' });
        }
      } else if (meta.sourceKind === 'github' && meta.repoFullName) {
        // Jeton optionnel : les dépôts publics s'importent anonymement
        const token = resolveGitHubToken(bot.connectedApps) ?? '';
        const result = await importGitHubRepoAsVault(token, {
          id: meta.repoId || 0,
          full_name: meta.repoFullName,
          description: null,
          private: false,
          html_url: meta.path || '',
          default_branch: meta.defaultBranch || 'main',
        });
        updateFolder(workspace.id, activeRepo.id, { repo: result.meta });
        // Import échoué : on NE touche PAS aux fichiers existants
        if (!result.error) {
          syncFolderFromDisk(workspace.id, activeRepo.id, result.files, result.dirs);
          showToast(result.meta.syncMessage || 'Dépôt resynchronisé', { tone: 'success' });
        } else {
          showToast(result.meta.syncMessage || 'Resynchronisation impossible', { tone: 'error' });
        }
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Resynchronisation impossible', { tone: 'error' });
    } finally {
      setBusyRepoSync(false);
    }
  };

  const openRepoExternal = () => {
    if (!activeRepoMeta) return;
    if (activeRepoMeta.sourceKind === 'github') {
      const target = activeRepoMeta.path || `https://github.com/${activeRepoMeta.repoFullName}`;
      if (typeof window !== 'undefined') window.open(target, '_blank', 'noopener');
    } else if (activeRepoMeta.path) {
      void vaultOpenPath(activeRepoMeta.path).then(r => {
        if (!r.ok) showToast(r.error ?? 'Ouverture impossible', { tone: 'error' });
      });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Barre d'adresse */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TextInput
          style={{ flex: 1, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.sm, paddingVertical: 6, color: C.textPrimary, fontSize: FontSize.sm }}
          value={url}
          onChangeText={setUrl}
          placeholder="https://… (site à consulter)"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={() => openHere()}
        />
        <IconButton icon="refresh" label="Recharger la page" onPress={() => { setReloadNonce(n => n + 1); setLoading(true); }} bare size={18} color={C.textSecondary} disabled={!loadedUrl && !repoSiteUrl} />
        <IconButton icon="arrow-forward" label="Charger" onPress={() => openHere()} bare size={18} color={C.accent} />
      </View>

      {/* Dépôts connectés — ouvrables ici */}
      {repos.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <MaterialIcons name="source" size={12} color={C.textMuted} />
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Dépôts</Text>
          {repos.map(folder => {
            const active = folder.id === activeRepoId;
            return (
              <Pressable
                key={folder.id}
                onPress={() => openRepo(folder)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? (folder.color || '#00BFFF') : C.border, backgroundColor: active ? (folder.color || '#00BFFF') + '22' : C.bgCardAlt }}
              >
                <MaterialIcons name="code" size={12} color={folder.color || '#00BFFF'} />
                <Text style={{ fontSize: FontSize.xs, color: active ? (folder.color || '#00BFFF') : C.textSecondary, fontWeight: '700' }} numberOfLines={1}>{folder.name}</Text>
                {active ? (
                  <Pressable onPress={() => { setActiveRepoId(null); setRepoSiteUrl(null); }} hitSlop={6}>
                    <MaterialIcons name="close" size={12} color={folder.color || '#00BFFF'} />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {activeRepo ? (
        /* Panneau du dépôt : le SITE déployé (GitHub Pages) dans l'iframe,
           avec tiroir fichiers/README en dessous */
        <View style={{ flex: 1, backgroundColor: C.bgCardAlt }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <MaterialIcons name="folder-open" size={14} color={activeRepo.color || '#00BFFF'} />
            <Text style={{ flex: 1, fontSize: FontSize.xs, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>
              {activeRepoMeta?.sourceKind === 'github' ? activeRepoMeta.repoFullName : activeRepoMeta?.path}
            </Text>
            {busyRepoSync ? <ActivityIndicator size="small" color={C.accent} /> : null}
            <Pressable onPress={() => void handleRepoSync()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.accent + '55', backgroundColor: C.accent + '18' }, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="sync" size={11} color={C.accent} />
              <Text style={{ fontSize: 10, color: C.accent, fontWeight: '700' }}>Resynchroniser</Text>
            </Pressable>
            <Pressable onPress={openRepoExternal} hitSlop={4} accessibilityLabel="Ouvrir sur GitHub">
              <MaterialIcons name="open-in-new" size={15} color={C.accent} />
            </Pressable>
            <Pressable onPress={() => { setActiveRepoId(null); setRepoSiteUrl(null); }} hitSlop={4} accessibilityLabel="Fermer le dépôt">
              <MaterialIcons name="close" size={15} color={C.textSecondary} />
            </Pressable>
          </View>

          {/* Le site du dépôt */}
          <View style={{ flex: 1 }}>
            {loading ? <ActivityIndicator color={C.accent} style={{ position: 'absolute', top: 20, alignSelf: 'center', zIndex: 2 }} /> : null}
            {repoSiteUrl ? (
              <Iframe src={repoSiteUrl} reloadKey={reloadNonce} onLoad={() => setLoading(false)} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg }}>
                <MaterialIcons name="public" size={32} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700', textAlign: 'center' }}>Quelle est l’URL du site de ce dépôt ?</Text>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted, textAlign: 'center', lineHeight: 16 }}>
                  Colle l’adresse déployée (Vercel, Pages…) — elle sera enregistrée et s’ouvrira ici à chaque fois.
                </Text>
                <TextInput
                  value={siteUrlDraft}
                  onChangeText={setSiteUrlDraft}
                  placeholder="https://mon-site.vercel.app"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={{ width: '100%', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.sm, paddingVertical: 6, color: C.textPrimary, fontSize: FontSize.xs }}
                />
                <Pressable
                  onPress={saveAndOpenSite}
                  disabled={!siteUrlDraft.trim()}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: C.accent, opacity: !siteUrlDraft.trim() ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}
                >
                  <MaterialIcons name="open-in-browser" size={13} color={C.bg} />
                  <Text style={{ fontSize: FontSize.xs, color: C.bg, fontWeight: '700' }}>Enregistrer et ouvrir le site</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Zone d'affichage web classique */
        <View style={{ flex: 1, backgroundColor: C.bgCardAlt }}>
          {loadedUrl ? (
            Platform.OS === 'web' ? (
              <View style={{ flex: 1 }}>
                {loading ? <ActivityIndicator color={C.accent} style={{ position: 'absolute', top: 20, alignSelf: 'center', zIndex: 2 }} /> : null}
                <Iframe src={loadedUrl} reloadKey={reloadNonce} onLoad={() => setLoading(false)} />
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg }}>
                <MaterialIcons name="public" size={32} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>L’affichage intégré n’est disponible que sur la version web.</Text>
              </View>
            )
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg }}>
              <MaterialIcons name="language" size={36} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>
                Saisissez une URL pour consulter un site directement ici, sans quitter la conversation de {workspace.name}.
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, textAlign: 'center', marginTop: Spacing.xs }}>
                Certains sites refusent l’intégration (X-Frame-Options). Dans ce cas :
              </Text>
              <Pressable
                onPress={() => { if (typeof window !== 'undefined') window.open(loadedUrl, '_blank', 'noopener'); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: C.accent + '18', borderWidth: 1, borderColor: C.accent + '44' }}
              >
                <MaterialIcons name="open-in-new" size={13} color={C.accent} />
                <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Ouvrir dans un nouvel onglet</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Panneau principal ────────────────────────────────────────────────────────
export function WorkspaceSidePanel({
  visible, onClose, workspace, onOpenDatabase, onOpenSettings,
}: {
  visible: boolean;
  onClose: () => void;
  workspace: Workspace;
  onOpenDatabase: () => void;
  onOpenSettings: () => void;
}) {
  const C = useThemeColors();
  const [tab, setTab] = useState<PanelTab>('files');
  // Largeur ajustable à la souris (poignée sur le bord gauche), persistée
  const [panelW, setPanelW] = useState(() => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return 420;
    const v = parseInt(localStorage.getItem('promptez.panelWidth') ?? '', 10);
    return Number.isFinite(v) ? Math.min(720, Math.max(300, v)) : 420;
  });
  if (!visible) return null;

  const tabs: { id: PanelTab; label: string; icon: string }[] = [
    { id: 'files', label: 'Fichiers', icon: 'folder-open' },
    { id: 'instructions', label: 'Instructions', icon: 'psychology' },
    { id: 'web', label: 'Sites', icon: 'language' },
  ];

  return (
    <View style={{
      position: 'absolute', top: 0, bottom: 0, right: 0, width: '100%', maxWidth: panelW,
      backgroundColor: C.bgCard, borderLeftWidth: 1, borderLeftColor: C.border, zIndex: 110,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
    }}>
      {/* Poignée de redimensionnement (bord gauche du panneau) */}
      <ResizeHandle
        edge="left"
        width={panelW}
        onResize={setPanelW}
        onEnd={w => { if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem('promptez.panelWidth', String(w)); }}
      />
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: workspace.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={workspace.icon as any} size={15} color={workspace.color} />
        </View>
        <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{workspace.name}</Text>
        <IconButton icon="open-in-new" label="Bibliothèque complète" onPress={onOpenDatabase} bare size={18} color={C.textSecondary} />
        <IconButton icon="close" label="Fermer le panneau" onPress={onClose} bare size={20} color={C.textSecondary} />
      </View>

      {/* Onglets */}
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.sm, paddingTop: 6 }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={({ pressed }) => [{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                paddingVertical: 7, borderRadius: Radius.md,
                backgroundColor: active ? C.accent + '18' : 'transparent',
                borderWidth: 1, borderColor: active ? C.accent + '44' : 'transparent',
              }, pressed && { opacity: 0.75 }]}
            >
              <MaterialIcons name={t.icon as any} size={14} color={active ? C.accent : C.textMuted} />
              <Text style={{ fontSize: FontSize.xs, color: active ? C.accent : C.textMuted, fontWeight: '700' }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Contenu — onglets gardés montés pour préserver l'état (dossiers dépliés, aperçu, URL) */}
      <View style={{ flex: 1, marginTop: 6 }}>
        <View style={{ flex: 1, display: tab === 'files' ? 'flex' : 'none' }}>
          <FilesTab workspace={workspace} onOpenFull={onOpenDatabase} />
        </View>
        <View style={{ flex: 1, display: tab === 'instructions' ? 'flex' : 'none' }}>
          <InstructionsTab workspace={workspace} onEdit={onOpenSettings} />
        </View>
        <View style={{ flex: 1, display: tab === 'web' ? 'flex' : 'none' }}>
          <SitesTab workspace={workspace} />
        </View>
      </View>
    </View>
  );
}
