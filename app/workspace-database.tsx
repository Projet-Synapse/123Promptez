// Powered by OnSpace.AI
// Workspace Database — arbre dépliable (dossiers + fichiers dans un seul
// défilement), sous-dossiers imbriqués à toute profondeur, glisser-déposer
// (déposer dans un dossier / réordonner), clic droit contextuel, miroir
// disque bidirectionnel pour les vaults et dépôts locaux.
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, Linking, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useBot } from '@/hooks/useBot';
import { VaultFolderPanel } from '@/components/feature/VaultFolderPanel';
import { RepoPanel } from '@/components/feature/RepoPanel';
import { DragLayer, DropZone, Draggable, useDnDState, type DragItem } from '@/components/feature/dnd';
import {
  resyncLocalVault, canMirrorToDisk, ensureVaultExt, getElectronVault,
  vaultWriteFile, vaultMakeDir, vaultDeletePath, vaultMovePath, vaultOpenPath,
  pickLocalVaultFolder, type VaultMeta,
} from '@/services/vaultService';
import { IconButton } from '@/components/ui/IconButton';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useAlert } from '@/template';
import { useToast } from '@/contexts/ToastContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { DBFile, DBFolder, DBSubFolder, FileLocation } from '@/contexts/WorkspaceContext';
import { findSubIn } from '@/contexts/WorkspaceContext';

// ─── Types ───────────────────────────────────────────────────────────────────
type SortKey = 'custom' | 'name' | 'date' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

type MenuItem = { label: string; icon: string; danger?: boolean; onPress: () => void };
type MenuState = { x: number; y: number; items: MenuItem[] } | null;

// ─── Constants ───────────────────────────────────────────────────────────────
const FILE_TYPES: { id: DBFile['type']; label: string; icon: string; color: string }[] = [
  { id: 'note', label: 'Note', icon: 'sticky-note-2', color: '#FFB800' },
  { id: 'markdown', label: 'Markdown', icon: 'article', color: '#3D7EFF' },
  { id: 'text', label: 'Texte brut', icon: 'text-snippet', color: '#8899BB' },
  { id: 'url', label: 'URL', icon: 'link', color: '#00CC6A' },
  { id: 'json', label: 'JSON', icon: 'data-object', color: '#FF6B35' },
  { id: 'code', label: 'Code', icon: 'code', color: '#9B59B6' },
];

const FOLDER_COLORS = ['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455', '#00BFFF', '#FF69B4'];
const FOLDER_ICONS = ['folder', 'folder-special', 'source', 'book', 'bookmark', 'archive', 'description', 'storage', 'science', 'insights'];

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'custom', label: 'Manuel', icon: 'swap-vert' },
  { key: 'name', label: 'Nom', icon: 'sort-by-alpha' },
  { key: 'date', label: 'Date', icon: 'schedule' },
  { key: 'size', label: 'Taille', icon: 'data-usage' },
  { key: 'type', label: 'Type', icon: 'category' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getFileTypeInfo(type: DBFile['type']) { return FILE_TYPES.find(t => t.id === type) ?? FILE_TYPES[0]; }
function formatSize(size: number): string { return size < 1000 ? `${size} c` : `${(size / 1000).toFixed(1)} Ko`; }
function formatDate(date: Date): string { return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
function inferFileType(mimeType: string | undefined, name: string): DBFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'json') return 'json';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'swift', 'kt', 'go', 'rs', 'cpp', 'c', 'cs'].includes(ext)) return 'code';
  if (mimeType?.startsWith('text/')) return 'text';
  return 'text';
}
function sortFiles(files: DBFile[], key: SortKey, order: SortOrder): DBFile[] {
  if (key === 'custom') return files; // ordre manuel : tel que rangé
  return [...files].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') cmp = a.name.localeCompare(b.name);
    else if (key === 'date') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    else if (key === 'size') cmp = a.size - b.size;
    else if (key === 'type') cmp = a.type.localeCompare(b.type);
    return order === 'asc' ? cmp : -cmp;
  });
}
function locEquals(a: FileLocation, b: FileLocation): boolean {
  if (a === null && b === null) return true;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (a && b && typeof a === 'object' && typeof b === 'object') return a.folderId === b.folderId && a.subId === b.subId;
  return false;
}

// ─── File Row (compacte, draggable + cible de réordonnancement) ─────────────
function FileRow({ file, loc, depth, onPress, onContextMenu, selectMode, selected, onToggleSelect, onReorderDrop }: {
  file: DBFile;
  loc: FileLocation;
  depth: number;
  onPress: () => void;
  onContextMenu: (pos?: { x: number; y: number }) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onReorderDrop: (item: DragItem) => void;
}) {
  const C = useThemeColors();
  const info = getFileTypeInfo(file.type);
  return (
    <DropZone
      zoneId={`file-drop-${file.id}`}
      accepts={(item: DragItem) => item.kind === 'file' && item.id !== file.id}
      onDrop={onReorderDrop}
      style={{ borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent', marginLeft: depth * Spacing.lg }}
      activeStyle={{ borderColor: C.accent, opacity: 0.8 }}
    >
      <Draggable
        getItem={() => (selectMode ? null : { kind: 'file', id: file.id, label: file.name, icon: info.icon, color: info.color, data: { file, fromLoc: loc } })}
        onTap={() => (selectMode ? onToggleSelect?.() : onPress())}
        onContextMenu={onContextMenu}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: selected ? C.primary + '18' : 'transparent', borderRadius: Radius.sm, paddingVertical: 7, paddingHorizontal: Spacing.sm }}>
          {selectMode ? (
            <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={18} color={selected ? C.primary : C.textMuted} />
          ) : (
            <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: info.color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name={info.icon as any} size={15} color={info.color} />
            </View>
          )}
          <Text style={{ flex: 1, fontSize: FontSize.sm, color: selected ? C.primary : C.textPrimary, fontWeight: '600' }} numberOfLines={1}>{file.name}</Text>
          <View style={{ backgroundColor: info.color + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill }}>
            <Text style={{ fontSize: 9, color: info.color, fontWeight: '700' }}>{info.label}</Text>
          </View>
          <Text style={{ fontSize: 10, color: C.textMuted }}>{formatSize(file.size)}</Text>
          <Text style={{ fontSize: 10, color: C.textMuted }}>{formatDate(file.updatedAt)}</Text>
        </View>
      </Draggable>
    </DropZone>
  );
}

// ─── Repo Card (dépôt connecté, séparé du vault) ─────────────────────────────
function RepoCard({ folder, onPress, onRename, onSync, onOpenExternal, onDelete, busy }: {
  folder: DBFolder; onPress: () => void; onRename?: () => void; onSync: () => void; onOpenExternal: () => void; onDelete: () => void; busy?: boolean;
}) {
  const C = useThemeColors();
  const meta = folder.repo!;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: (folder.color || '#00BFFF') + '44', padding: Spacing.sm + 2 }}>
      <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
        <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: (folder.color || '#00BFFF') + '22', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={(folder.icon as any) || 'code'} size={22} color={folder.color || '#00BFFF'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{folder.name}</Text>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }} numberOfLines={1}>
            {meta.sourceKind === 'github' ? `GitHub · ${meta.repoFullName}` : `Local · ${meta.path}`}
            {meta.lastSyncedAt ? ` · sync ${formatDate(new Date(meta.lastSyncedAt))}` : ''}
          </Text>
        </View>
      </Pressable>
      {busy ? <ActivityIndicator size="small" color={C.accent} /> : null}
      <IconButton icon="sync" label="Resynchroniser le dépôt" onPress={onSync} size={18} bare color={C.accent} />
      <IconButton
        icon={meta.sourceKind === 'github' ? 'open-in-new' : 'folder-open'}
        label={meta.sourceKind === 'github' ? 'Ouvrir sur GitHub' : 'Ouvrir le dossier'}
        onPress={onOpenExternal}
        size={18}
        bare
        color={C.textSecondary}
      />
      {onRename ? (
        <IconButton icon="edit" label={`Renommer ${folder.name}`} onPress={onRename} size={18} bare color={C.textMuted} />
      ) : null}
      <IconButton icon="delete-outline" label="Déconnecter le dépôt" onPress={onDelete} size={18} bare color={C.textMuted} />
    </View>
  );
}

// ─── Sort Bar ─────────────────────────────────────────────────────────────────
function SortBar({ sortKey, sortOrder, onChange }: { sortKey: SortKey; sortOrder: SortOrder; onChange: (k: SortKey, o: SortOrder) => void }) {
  const C = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
      <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginRight: 2 }}>Trier :</Text>
      {SORT_OPTIONS.map(opt => {
        const active = sortKey === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key, active ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc')}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1,
              backgroundColor: active ? C.accent + '18' : C.bgCardAlt,
              borderColor: active ? C.accent + '55' : C.border,
            }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name={opt.icon as any} size={12} color={active ? C.accent : C.textMuted} />
            <Text style={{ fontSize: 11, color: active ? C.accent : C.textMuted, fontWeight: active ? '700' : '500' }}>{opt.label}</Text>
            {active && opt.key !== 'custom' ? <MaterialIcons name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} size={11} color={C.accent} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WorkspaceDatabaseScreen() {
  const insets = useSafeAreaInsets();
  const { wsId } = useLocalSearchParams<{ wsId: string }>();
  const {
    workspaces, addFolder, addVaultFolder, updateFolder, removeFolder,
    addSubFolder, updateSubFolder, removeSubFolder,
    moveFileToIndex, moveSubToIndex,
    addFile, updateFile, removeFile, moveFile,
    syncFolderFromDisk, promoteSubFolder,
  } = useWorkspace();
  const { showAlert } = useAlert();
  const { showToast } = useToast();
  const { bot } = useBot();
  const router = useRouter();
  const C = useThemeColors();
  const windowDims = Dimensions.get('window');

  const ws = workspaces.find(w => w.id === wsId);
  const wsFolders = useMemo(() => ws?.database.folders ?? [], [ws]);

  // ── Vault racine du projet ───────────────────────────────────────
  const rootVault = useMemo(() => wsFolders.find(f => f.vault) ?? null, [wsFolders]);
  const [vaultPath, setVaultPath] = useState(rootVault?.vault?.path ?? '');
  useEffect(() => { setVaultPath(rootVault?.vault?.path ?? ''); }, [rootVault?.id, rootVault?.vault?.path]);

  const handleRootVaultSync = async () => {
    if (!rootVault?.vault || !ws) return;
    const wid = ws.id;
    const folder = wsFolders.find(f => f.id === rootVault.id);
    if (!folder?.vault) return;
    setBusyVault(true);
    try {
      if (folder.vault.sourceKind === 'local') {
        const result = await resyncLocalVault(folder.vault);
        if (result) {
          updateFolder(wid, folder.id, { vault: result.meta });
          syncFolderFromDisk(wid, folder.id, result.files, result.dirs);
          showToast(result.meta.syncMessage || 'Vault resynchronisé', { tone: 'success' });
        }
      } else if (folder.vault.sourceKind === 'github' && folder.vault.repoFullName) {
        const { resolveGitHubToken, importGitHubRepoAsVault } = await import('@/services/vaultService');
        // Jeton optionnel : les dépôts publics s'importent anonymement
        const token = resolveGitHubToken(bot.connectedApps) ?? '';
        const result = await importGitHubRepoAsVault(token, {
          id: folder.vault.repoId || 0,
          full_name: folder.vault.repoFullName,
          description: null,
          private: false,
          html_url: folder.vault.path || '',
          default_branch: folder.vault.defaultBranch || 'main',
        });
        updateFolder(wid, folder.id, { vault: result.meta });
        // Import échoué : on NE touche PAS aux fichiers existants
        if (!result.error) {
          syncFolderFromDisk(wid, folder.id, result.files, result.dirs);
          showToast(result.meta.syncMessage || 'Vault GitHub resynchronisé', { tone: 'success' });
        } else {
          showToast(result.meta.syncMessage || 'Resynchronisation impossible', { tone: 'error' });
        }
      }
    } catch (e: any) {
      showAlert('Erreur sync', e?.message ?? 'Échec');
    } finally {
      setBusyVault(false);
    }
  };
  const [busyVault, setBusyVault] = useState(false);

  const handlePickVaultPath = async () => {
    if (!rootVault) return;
    const picked = await pickLocalVaultFolder();
    if (!picked) return;
    updateFolder(wsId, rootVault.id, { vault: picked.meta });
    syncFolderFromDisk(wsId, rootVault.id, picked.files, picked.dirs);
    showToast('Chemin du vault enregistré', { tone: 'success' });
  };

  // ── Miroir disque (vault / dépôts locaux) ──────────────────────────
  const metaAt = useCallback((loc: FileLocation): VaultMeta | null => {
    const folderOf = (fid: string) => wsFolders.find(f => f.id === fid);
    if (typeof loc === 'string') {
      const f = folderOf(loc);
      return f?.vault ?? f?.repo ?? null;
    }
    if (loc && typeof loc === 'object') {
      const f = folderOf(loc.folderId);
      return f?.vault ?? f?.repo ?? null;
    }
    return null;
  }, [wsFolders]);
  const relOf = (f: DBFile): string => f.path ?? f.name;
  const baseOf = (name: string): string => name.split('/').pop() ?? name;
  const subChainNames = (subs: DBSubFolder[], subId: string, acc: string[] = []): string[] | null => {
    for (const s of subs) {
      const next = [...acc, s.name];
      if (s.id === subId) return next;
      const deep = subChainNames(s.subFolders ?? [], subId, next);
      if (deep) return deep;
    }
    return null;
  };
  const prefixOf = useCallback((loc: FileLocation): string => {
    if (!loc || typeof loc !== 'object') return '';
    const f = wsFolders.find(x => x.id === loc.folderId);
    const chain = f ? subChainNames(f.subFolders ?? [], loc.subId) : null;
    return chain ? `${chain.join('/')}/` : '';
  }, [wsFolders]);
  // Nom affiché d'une localisation (chip « Ajouts dans : … »)
  const locLabel = useCallback((loc: FileLocation): string => {
    if (loc === null) return 'racine du workspace';
    if (typeof loc === 'string') return wsFolders.find(f => f.id === loc)?.name ?? '?';
    const folder = wsFolders.find(f => f.id === loc.folderId);
    const sub = folder ? findSubIn(folder.subFolders ?? [], loc.subId) : null;
    return sub?.name ?? '?';
  }, [wsFolders]);

  const performMove = async (file: DBFile, fromLoc: FileLocation, toLoc: FileLocation) => {
    if (locEquals(fromLoc, toLoc)) return;
    const fromMeta = metaAt(fromLoc);
    const toMeta = metaAt(toLoc);
    const fromMirror = canMirrorToDisk(fromMeta);
    const toMirror = canMirrorToDisk(toMeta);
    const base = baseOf(file.name);
    if (file.type !== 'url' && fromMirror && toMirror && fromMeta!.path === toMeta!.path) {
      const toRel = `${prefixOf(toLoc)}${base}`;
      const r = await vaultMovePath(fromMeta, relOf(file), toRel);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'déplacement impossible'}`, { tone: 'error' }); return; }
      moveFile(wsId, file.id, fromLoc, toLoc);
      updateFile(wsId, toLoc, file.id, { name: base, path: toRel });
      return;
    }
    if (file.type !== 'url' && fromMirror && !toMirror) {
      const r = await vaultDeletePath(fromMeta, relOf(file), false);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'suppression impossible'}`, { tone: 'error' }); return; }
      moveFile(wsId, file.id, fromLoc, toLoc);
      updateFile(wsId, toLoc, file.id, { name: base, path: undefined });
      showToast('Fichier retiré du disque (conservé dans la base)', { tone: 'success' });
      return;
    }
    if (file.type !== 'url' && !fromMirror && toMirror) {
      const toRel = `${prefixOf(toLoc)}${base}`;
      const r = await vaultWriteFile(toMeta, toRel, file.content);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'écriture impossible'}`, { tone: 'error' }); return; }
      moveFile(wsId, file.id, fromLoc, toLoc);
      updateFile(wsId, toLoc, file.id, { name: base, path: toRel });
      return;
    }
    moveFile(wsId, file.id, fromLoc, toLoc);
  };
  const deleteFileWithMirror = useCallback((file: DBFile, loc: FileLocation) => {
    const meta = metaAt(loc);
    if (meta && canMirrorToDisk(meta) && file.type !== 'url') {
      void vaultDeletePath(meta, file.path ?? file.name, false).then(r => {
        if (!r.ok) { showToast(`Disque : ${r.error ?? 'suppression impossible'}`, { tone: 'error' }); return; }
        removeFile(wsId, loc, file.id);
      });
    } else {
      removeFile(wsId, loc, file.id);
    }
  }, [metaAt, removeFile, showToast, wsId]);

  // ── Dépôts connectés (séparés du vault) ────────────────────────────
  const repoFolders = useMemo(() => wsFolders.filter(f => f.repo), [wsFolders]);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [busyRepoId, setBusyRepoId] = useState<string | null>(null);

  const handleRepoSync = async (folder: DBFolder) => {
    const meta = folder.repo;
    if (!meta) return;
    setBusyRepoId(folder.id);
    try {
      if (meta.sourceKind === 'local') {
        const result = await resyncLocalVault(meta);
        if (result) {
          updateFolder(wsId, folder.id, { repo: result.meta });
          syncFolderFromDisk(wsId, folder.id, result.files, result.dirs);
          showToast(result.meta.syncMessage || 'Dépôt resynchronisé', { tone: 'success' });
        }
      } else if (meta.sourceKind === 'github' && meta.repoFullName) {
        const { resolveGitHubToken, importGitHubRepoAsVault } = await import('@/services/vaultService');
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
        updateFolder(wsId, folder.id, { repo: result.meta });
        // Import échoué : on NE touche PAS aux fichiers existants
        if (!result.error) {
          syncFolderFromDisk(wsId, folder.id, result.files, result.dirs);
          showToast(result.meta.syncMessage || 'Dépôt GitHub resynchronisé', { tone: 'success' });
        } else {
          showToast(result.meta.syncMessage || 'Resynchronisation impossible', { tone: 'error' });
        }
      }
    } catch (e: any) {
      showAlert('Erreur sync', e?.message ?? 'Échec');
    } finally {
      setBusyRepoId(null);
    }
  };

  const handleRepoOpenExternal = async (folder: DBFolder) => {
    const meta = folder.repo;
    if (!meta) return;
    if (meta.sourceKind === 'github') {
      void Linking.openURL(meta.path || `https://github.com/${meta.repoFullName}`);
    } else if (meta.path) {
      const r = await vaultOpenPath(meta.path);
      if (!r.ok) showToast(r.error ?? 'Ouverture impossible', { tone: 'error' });
    }
  };

  // ── États d'interface ────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const toggleSelectFile = (id: string) => setSelectedFileIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exitSelectMode = () => { setSelectMode(false); setSelectedFileIds(new Set()); };

  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  // Cible d'insertion : racine (null), dossier (id) ou sous-dossier ({folderId, subId})
  const [insertTarget, setInsertTarget] = useState<FileLocation>(null);
  useEffect(() => { setInsertTarget(rootVault ? rootVault.id : null); }, [rootVault?.id]);
  const toggleFolderOpen = (loc: FileLocation, folderId: string) => {
    const id = typeof loc === 'string' ? folderId : (loc as any).subId;
    setOpenFolderIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setInsertTarget(loc);
  };
  const dragState = useDnDState();

  const [showInsert, setShowInsert] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [folderCreateTarget, setFolderCreateTarget] = useState<{ folderId: string; parentSubId: string | null } | null>(null);
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [editingFile, setEditingFile] = useState<DBFile | null>(null);
  const [editingLoc, setEditingLoc] = useState<FileLocation>(null);
  const [viewingFile, setViewingFile] = useState<DBFile | null>(null);
  const [movingFile, setMovingFile] = useState<DBFile | null>(null);
  // Renommage rapide (crayon / menu contextuel)
  const [renaming, setRenaming] = useState<
    | { kind: 'file'; file: DBFile; loc: FileLocation }
    | { kind: 'folder'; folder: DBFolder }
    | { kind: 'sub'; folderId: string; sub: DBSubFolder; prefix: string }
    | null
  >(null);
  const [renameValue, setRenameValue] = useState('');
  const [menu, setMenu] = useState<MenuState>(null);

  // ── Formulaires ──────────────────────────────────────────────────────
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);
  const [folderIcon, setFolderIcon] = useState(FOLDER_ICONS[0]);

  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<DBFile['type']>('note');
  const [fileContent, setFileContent] = useState('');
  const [fileTags, setFileTags] = useState('');

  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  const [editorName, setEditorName] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorTags, setEditorTags] = useState('');

  // ── Tri (Manuel par défaut, respecte le glisser-déposer) ────────────
  const [sortKey, setSortKey] = useState<SortKey>('custom');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const handleSortChange = (k: SortKey, o: SortOrder) => { setSortKey(k); setSortOrder(o); };

  const totalFiles = ws
    ? ws.database.rootFiles.length + wsFolders.reduce((acc, f) => acc + f.files.length + (f.subFolders ?? []).reduce((sa, s) => sa + s.files.length, 0), 0)
    : 0;
  const totalFolders = ws ? wsFolders.length : 0;

  // ── Contenu racine affiché (fusion vault + fichiers racine) ─────────
  const rootFilesRaw = useMemo(() => [...(ws?.database.rootFiles ?? []), ...(rootVault?.files ?? [])], [ws?.database.rootFiles, rootVault?.files]);
  const displayedFiles = useMemo(() => sortFiles(rootFilesRaw, sortKey, sortOrder), [rootFilesRaw, sortKey, sortOrder]);

  const fileLocationOf = useCallback((file: DBFile): FileLocation => {
    if (!ws) return null;
    if (ws.database.rootFiles.some(f => f.id === file.id)) return null;
    if (rootVault?.files.some(f => f.id === file.id)) return rootVault.id;
    return null;
  }, [ws, rootVault]);

  // ── Move modal destinations (arbre complet, récursif) ───────────────
  const moveDestinations = useMemo(() => {
    const dests: { label: string; location: FileLocation; icon: string; color: string }[] = [
      { label: 'Racine', location: null, icon: 'home', color: C.accent },
    ];
    for (const folder of wsFolders) {
      dests.push({ label: folder.name, location: folder.id, icon: folder.icon || 'folder', color: folder.color });
      const walk = (subs: DBSubFolder[], parentLabel: string) => subs.forEach(s => {
        const label = `${parentLabel} / ${s.name}`;
        dests.push({ label, location: { folderId: folder.id, subId: s.id }, icon: s.icon || 'folder', color: s.color || folder.color });
        walk(s.subFolders ?? [], label);
      });
      walk(folder.subFolders ?? [], folder.name);
    }
    return dests;
  }, [wsFolders, C.accent]);

  if (!ws) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.body, color: C.textSecondary }}>Workspace introuvable</Text>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: C.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Création ─────────────────────────────────────────────────────────
  const resetFolderForm = () => { setFolderName(''); setFolderColor(FOLDER_COLORS[0]); setFolderIcon(FOLDER_ICONS[0]); };
  const resetFileForm = () => { setFileName(''); setFileType('note'); setFileContent(''); setFileTags(''); };

  // « Nouveau dossier » : à la racine ou dans la cible (dossier / sous-dossier)
  const handleAddFolder = () => {
    if (!folderName.trim()) return;
    const target = folderCreateTarget;
    if (!target && insertTarget === null) {
      addFolder(ws.id, { name: folderName.trim(), description: '', color: folderColor, icon: folderIcon });
    } else {
      const folderId = target ? target.folderId : typeof insertTarget === 'string' ? insertTarget : (insertTarget as any).folderId;
      const parentSubId = target ? target.parentSubId : typeof insertTarget === 'object' && insertTarget ? insertTarget.subId : null;
      const prefix = parentSubId ? chainPrefixOf(folderId, parentSubId) : '';
      addSubFolder(ws.id, folderId, { name: folderName.trim(), description: '', color: folderColor, icon: folderIcon }, parentSubId ?? undefined);
      const folderObj = wsFolders.find(x => x.id === folderId);
      const fMeta = folderObj?.vault ?? folderObj?.repo;
      if (fMeta && canMirrorToDisk(fMeta)) {
        void vaultMakeDir(fMeta, `${prefix}${folderName.trim()}`).then(r => {
          if (!r.ok) showToast(`Disque : ${r.error ?? 'création impossible'}`, { tone: 'error' });
        });
      }
    }
    resetFolderForm(); setShowAddFolder(false); setFolderCreateTarget(null);
  };

  const handleAddTextFile = () => {
    if (!fileName.trim() || !fileContent.trim()) return;
    const meta = metaAt(insertTarget);
    const mirror = !!meta && canMirrorToDisk(meta) && fileType !== 'url';
    const diskName = ensureVaultExt(fileName.trim(), fileType);
    const diskPath = mirror ? `${prefixOf(insertTarget)}${diskName}` : undefined;
    addFile(ws.id, insertTarget, { name: diskName, ...(diskPath ? { path: diskPath } : {}), type: fileType, content: fileContent.trim(), tags: fileTags.split(',').map(t => t.trim()).filter(Boolean) });
    if (diskPath && meta) {
      void vaultWriteFile(meta, diskPath, fileContent.trim()).then(r => {
        if (!r.ok) showToast(`Disque : ${r.error ?? 'écriture impossible'}`, { tone: 'error' });
      });
    }
    resetFileForm(); setShowAddFile(false);
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    const name = linkName.trim() || linkUrl.trim();
    addFile(ws.id, insertTarget, { name, type: 'url', content: linkUrl.trim(), tags: ['lien'] });
    setLinkUrl(''); setLinkName(''); setShowAddLink(false);
    showToast(`Lien « ${name} » ajouté`, { tone: 'success' });
  };

  const handlePickFile = async (targetLoc?: FileLocation) => {
    const loc = targetLoc ?? insertTarget;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'application/json', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      let content = '';
      try {
        const response = await fetch(asset.uri);
        content = await response.text();
        if (content.length > 50000) content = content.slice(0, 50000) + '\n\n[... Fichier tronqué]';
      } catch { content = `[Fichier importé: ${asset.name}]`; }
      const meta = metaAt(loc);
      const mirror = !!meta && canMirrorToDisk(meta);
      const rawName = asset.name ?? 'fichier-importé';
      const diskPath = mirror ? `${prefixOf(loc)}${rawName}` : undefined;
      addFile(ws.id, loc, { name: rawName, ...(diskPath ? { path: diskPath } : {}), type: inferFileType(asset.mimeType, rawName), content, tags: ['importé'] });
      if (diskPath && meta) {
        void vaultWriteFile(meta, diskPath, content).then(r => {
          if (!r.ok) showToast(`Disque : ${r.error ?? 'écriture impossible'}`, { tone: 'error' });
        });
      }
      showToast(`Fichier « ${rawName} » importé`, { tone: 'success' });
    } catch (error: any) { showAlert('Erreur', `Impossible d'importer: ${error.message ?? 'Erreur inconnue'}`); }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission requise', "L'accès à la galerie est nécessaire."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const imgName = asset.uri.split('/').pop() ?? 'image.jpg';
      addFile(ws.id, insertTarget, { name: imgName, type: 'note', content: `[IMAGE: ${imgName}]\nDimensions: ${asset.width}x${asset.height}px\nURI: ${asset.uri}`, tags: ['image', 'importé'] });
      showToast(`Image « ${imgName} » ajoutée`, { tone: 'success' });
    } catch (error: any) { showAlert('Erreur', `Impossible d'importer: ${error.message ?? 'Erreur inconnue'}`); }
  };

  // ── Édition / suppression ────────────────────────────────────────────
  const handleOpenFileViewer = (file: DBFile) => { setViewingFile(file); };
  const handleOpenFileEditor = (file: DBFile, loc: FileLocation) => {
    setViewingFile(null);
    setEditingFile(file); setEditingLoc(loc);
    setEditorName(file.name); setEditorContent(file.content); setEditorTags(file.tags.join(', '));
  };
  const handleSaveFile = () => {
    if (!editingFile || !editorName.trim()) return;
    const loc = editingLoc;
    const meta = metaAt(loc);
    const tags = editorTags.split(',').map(t => t.trim()).filter(Boolean);
    if (meta && canMirrorToDisk(meta) && editingFile.type !== 'url') {
      const oldRel = editingFile.path ?? editingFile.name;
      const dir = oldRel.includes('/') ? oldRel.slice(0, oldRel.lastIndexOf('/') + 1) : '';
      const newRel = `${dir}${ensureVaultExt(editorName.trim(), editingFile.type)}`;
      const newBase = newRel.split('/').pop() ?? newRel;
      void (async () => {
        if (newRel !== oldRel) {
          const mv = await vaultMovePath(meta, oldRel, newRel);
          if (!mv.ok) { showToast(`Disque : ${mv.error ?? 'renommage impossible'}`, { tone: 'error' }); return; }
        }
        if (editorContent !== editingFile.content) {
          const wr = await vaultWriteFile(meta, newRel, editorContent);
          if (!wr.ok) { showToast(`Disque : ${wr.error ?? 'écriture impossible'}`, { tone: 'error' }); return; }
        }
        updateFile(ws.id, loc, editingFile.id, { name: newBase, path: newRel, content: editorContent, tags });
      })();
    } else {
      updateFile(ws.id, loc, editingFile.id, { name: editorName.trim(), content: editorContent, tags });
    }
    setEditingFile(null);
  };
  const handleDeleteFile = (file: DBFile, loc: FileLocation) => {
    showAlert(`Supprimer "${file.name}" ?`, 'Ce fichier sera définitivement supprimé (base + disque si vault local).', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteFileWithMirror(file, loc) },
    ]);
  };
  const bulkDeleteSelectedFiles = () => {
    const n = selectedFileIds.size;
    if (n === 0) return;
    showAlert(`Supprimer ${n} fichier(s) ?`, 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => {
        selectedFileIds.forEach(id => {
          const f = displayedFiles.find(x => x.id === id);
          if (f) deleteFileWithMirror(f, fileLocationOf(f));
        });
        exitSelectMode();
        showToast(`${n} fichier(s) supprimé(s)`, { tone: 'success' });
      }},
    ]);
  };
  const handleConfirmMove = (to: FileLocation) => {
    if (!movingFile) return;
    if (movingFile.id === '__bulk__') {
      selectedFileIds.forEach(id => {
        const f = displayedFiles.find(x => x.id === id);
        if (f) void performMove(f, fileLocationOf(f), to);
      });
      const n = selectedFileIds.size;
      setMovingFile(null);
      exitSelectMode();
      showToast(`${n} fichier(s) déplacé(s)`, { tone: 'success' });
      return;
    }
    const loc = fileLocationOf(movingFile);
    void performMove(movingFile, loc, to);
    const name = movingFile.name;
    setMovingFile(null);
    showToast(`« ${name} » déplacé`, { tone: 'success' });
  };
  const handleDeleteFolder = (folder: DBFolder) => {
    const count = folder.files.length + (folder.subFolders ?? []).reduce((a, s) => a + s.files.length, 0);
    showAlert(`Supprimer "${folder.name}" ?`, `${count} fichier(s) et sous-dossiers seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeFolder(ws.id, folder.id) },
    ]);
  };
  const handleDeleteSub = (folderId: string, sub: DBSubFolder, prefix = '') => {
    showAlert(`Supprimer "${sub.name}" ?`, `${sub.files.length} fichier(s) seront supprimés (base + disque si vault local).`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => {
        const folder = wsFolders.find(f => f.id === folderId);
        const meta = folder?.vault ?? folder?.repo;
        if (meta && canMirrorToDisk(meta)) {
          void vaultDeletePath(meta, `${prefix}${sub.name}`, true).then(r => {
            if (!r.ok) showToast(`Disque : ${r.error ?? 'suppression impossible'}`, { tone: 'error' });
          });
        }
        removeSubFolder(ws.id, folderId, sub.id);
      }},
    ]);
  };

  // ── Renommage ────────────────────────────────────────────────────────
  const openRenameFile = (file: DBFile, loc: FileLocation) => { setRenaming({ kind: 'file', file, loc }); setRenameValue(baseOf(file.name)); };
  const openRenameFolder = (folder: DBFolder) => { setRenaming({ kind: 'folder', folder }); setRenameValue(folder.name); };
  const openRenameSub = (folderId: string, sub: DBSubFolder, prefix: string) => { setRenaming({ kind: 'sub', folderId, sub, prefix }); setRenameValue(sub.name); };
  const confirmRename = () => {
    if (!renaming || !renameValue.trim()) { setRenaming(null); return; }
    const newName = renameValue.trim();
    if (renaming.kind === 'file') {
      const { file, loc } = renaming;
      const meta = metaAt(loc);
      if (meta && canMirrorToDisk(meta) && file.type !== 'url') {
        const oldRel = file.path ?? file.name;
        const dir = oldRel.includes('/') ? oldRel.slice(0, oldRel.lastIndexOf('/') + 1) : '';
        const newRel = `${dir}${ensureVaultExt(newName, file.type)}`;
        const newBase = newRel.split('/').pop() ?? newRel;
        if (newRel !== oldRel) {
          void vaultMovePath(meta, oldRel, newRel).then(r => {
            if (!r.ok) { showToast(`Disque : ${r.error ?? 'renommage impossible'}`, { tone: 'error' }); return; }
            updateFile(ws.id, loc, file.id, { name: newBase, path: newRel });
          });
        } else {
          updateFile(ws.id, loc, file.id, { name: newBase });
        }
      } else {
        updateFile(ws.id, loc, file.id, { name: newName });
      }
    } else if (renaming.kind === 'folder') {
      updateFolder(ws.id, renaming.folder.id, { name: newName });
    } else {
      const folder = wsFolders.find(f => f.id === renaming.folderId);
      const meta = folder?.vault ?? folder?.repo;
      if (meta && canMirrorToDisk(meta)) {
        void vaultMovePath(meta, `${renaming.prefix}${renaming.sub.name}`, `${renaming.prefix}${newName}`).then(r => {
          if (!r.ok) showToast(`Disque : ${r.error ?? 'renommage impossible'}`, { tone: 'error' });
        });
      }
      updateSubFolder(ws.id, renaming.folderId, renaming.sub.id, { name: newName });
    }
    setRenaming(null);
  };

  // ── Duplication ──────────────────────────────────────────────────────
  const duplicateFile = (file: DBFile, loc: FileLocation) => {
    const base = baseOf(file.name);
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot) : '';
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const copyName = `${stem} (copie)${ext}`;
    const meta = metaAt(loc);
    const mirror = !!meta && canMirrorToDisk(meta) && file.type !== 'url';
    const diskPath = mirror ? `${prefixOf(loc)}${copyName}` : undefined;
    addFile(ws.id, loc, { name: copyName, ...(diskPath ? { path: diskPath } : {}), type: file.type, content: file.content, tags: file.tags });
    if (diskPath && meta) {
      void vaultWriteFile(meta, diskPath, file.content).then(r => {
        if (!r.ok) showToast(`Disque : ${r.error ?? 'écriture impossible'}`, { tone: 'error' });
      });
    }
    showToast(`« ${copyName} » créé`, { tone: 'success' });
  };
  const cloneSubTree = (sub: DBSubFolder): DBSubFolder => ({
    ...sub,
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    files: sub.files.map((f, i) => ({ ...f, id: `file-${Date.now()}-dup${i}-${Math.random().toString(36).slice(2, 5)}`, createdAt: new Date(), updatedAt: new Date() })),
    subFolders: (sub.subFolders ?? []).map(cloneSubTree),
  });
  const duplicateSub = (folderId: string, parentSubId: string | null, sub: DBSubFolder, prefix = '') => {
    const copy = cloneSubTree(sub);
    copy.name = `${sub.name} (copie)`;
    const copyId = addSubFolder(ws.id, folderId, { name: copy.name, description: copy.description, color: copy.color, icon: copy.icon }, parentSubId ?? undefined);
    updateSubFolder(ws.id, folderId, copyId, { files: copy.files, subFolders: copy.subFolders });
    // écrit le contenu copié sur le disque si la source est un vault/dépôt local
    const folder = wsFolders.find(f => f.id === folderId);
    const meta = folder?.vault ?? folder?.repo;
    if (meta && canMirrorToDisk(meta)) {
      const writeTree = (s: DBSubFolder, p: string) => {
        void vaultMakeDir(meta, `${p}${s.name}`);
        s.files.forEach(f => { if (f.type !== 'url') void vaultWriteFile(meta, `${p}${s.name}/${f.name}`, f.content); });
        (s.subFolders ?? []).forEach(child => writeTree(child, `${p}${s.name}/`));
      };
      writeTree(copy, prefix);
    }
    showToast(`« ${copy.name} » créé`, { tone: 'success' });
  };
  const duplicateRootFolder = (folder: DBFolder) => {
    const id = addVaultFolder(ws.id, {
      name: `${folder.name} (copie)`,
      icon: folder.icon,
      color: folder.color,
      description: '',
    }, folder.files.map(f => ({ name: f.name, type: f.type, content: f.content, tags: f.tags })));
    updateFolder(ws.id, id, { subFolders: (folder.subFolders ?? []).map(cloneSubTree) });
    showToast(`« ${folder.name} (copie) » créé`, { tone: 'success' });
  };

  // ── Glisser-déposer : sémantique ─────────────────────────────────────
  // Fichier lâché sur un dossier → déplacé dedans ; lâché sur un fichier →
  // réordonné à sa place ; dossier lâché sur un dossier → échange de place.
  const handleFileReorderDrop = (item: DragItem, target: DBFile, targetLoc: FileLocation) => {
    const { file, fromLoc } = item.data ?? {};
    if (!file || file.id === target.id) return;
    if (locEquals(fromLoc ?? null, targetLoc)) {
      moveFileToIndex(wsId, file.id, fromLoc ?? null, targetLoc, target.id);
      showToast('Ordre mis à jour', { tone: 'success' });
    } else {
      void performMove(file, fromLoc ?? null, targetLoc).then(() => {
        moveFileToIndex(wsId, file.id, targetLoc, targetLoc, target.id);
        showToast(`« ${baseOf(file.name)} » déplacé`, { tone: 'success' });
      });
    }
  };
  const handleStripDrop = (item: DragItem) => {
    if (item.kind === 'file') {
      const { file, fromLoc } = item.data ?? {};
      if (!file) return;
      void performMove(file, fromLoc ?? null, null);
      showToast(`« ${file.name} » déplacé à la racine`, { tone: 'success' });
    } else {
      const data = item.data ?? {};
      if (data.folder && !data.folder.vault && !data.folder.repo) {
        // dossier racine → déjà à la racine : rien ; sous-dossier → promu
        if (data.parentSubId) promoteSubFolder(wsId, data.folderId, data.sub.id);
        else showToast('Ce dossier est déjà à la racine', { tone: 'warning' });
      } else {
        showToast('Un vault ou un dépôt reste à sa place', { tone: 'warning' });
      }
    }
  };

  // ── Menus contextuels ────────────────────────────────────────────────
  const openMenu = (pos: { x: number; y: number } | undefined, items: MenuItem[]) => {
    const x = pos ? Math.min(pos.x + 4, windowDims.width - 230) : windowDims.width / 2 - 110;
    const y = pos ? Math.min(pos.y + 4, windowDims.height - 40 - items.length * 42) : windowDims.height / 2 - 100;
    setMenu({ x: Math.max(8, x), y: Math.max(8, y), items });
  };
  const fileMenu = (file: DBFile, loc: FileLocation): MenuItem[] => [
    { label: 'Renommer', icon: 'edit', onPress: () => openRenameFile(file, loc) },
    { label: 'Dupliquer', icon: 'content-copy', onPress: () => duplicateFile(file, loc) },
    { label: 'Déplacer…', icon: 'drive-file-move', onPress: () => setMovingFile(file) },
    { label: 'Supprimer', icon: 'delete-outline', danger: true, onPress: () => handleDeleteFile(file, loc) },
  ];
  const folderMenu = (folder: DBFolder, parentSubId: string | null): MenuItem[] => [
    { label: 'Renommer', icon: 'edit', onPress: () => openRenameFolder(folder) },
    { label: 'Dupliquer', icon: 'content-copy', onPress: () => duplicateRootFolder(folder) },
    { label: 'Nouveau sous-dossier', icon: 'create-new-folder', onPress: () => { setFolderCreateTarget({ folderId: folder.id, parentSubId }); setShowAddFolder(true); resetFolderForm(); } },
    { label: 'Insérer un fichier ici', icon: 'add-circle', onPress: () => { setInsertTarget(folder.id); setShowAddFile(true); resetFileForm(); } },
    { label: 'Supprimer', icon: 'delete-outline', danger: true, onPress: () => handleDeleteFolder(folder) },
  ];
  const subMenu = (folderId: string, parentSubId: string | null, sub: DBSubFolder, prefix: string): MenuItem[] => [
    { label: 'Renommer', icon: 'edit', onPress: () => openRenameSub(folderId, sub, prefix) },
    { label: 'Dupliquer', icon: 'content-copy', onPress: () => duplicateSub(folderId, parentSubId, sub, prefix) },
    { label: 'Nouveau sous-dossier', icon: 'create-new-folder', onPress: () => { setFolderCreateTarget({ folderId, parentSubId: sub.id }); setShowAddFolder(true); resetFolderForm(); } },
    { label: 'Insérer un fichier ici', icon: 'add-circle', onPress: () => { setInsertTarget({ folderId, subId: sub.id }); setShowAddFile(true); resetFileForm(); } },
    { label: 'Supprimer', icon: 'delete-outline', danger: true, onPress: () => handleDeleteSub(folderId, sub, prefix) },
  ];

  // ── Rendu récursif de l'arbre ────────────────────────────────────────
  const chainPrefixOf = (folderId: string, subId: string): string => {
    const f = wsFolders.find(x => x.id === folderId);
    const chain = f ? subChainNames(f.subFolders ?? [], subId) : null;
    return chain ? `${chain.join('/')}/` : '';
  };

  const renderSubFolder = (folderId: string, parentSubId: string | null, sub: DBSubFolder, depth: number, chainPrefix: string) => {
    const open = openFolderIds.has(sub.id);
    const subCount = (sub.subFolders ?? []).length;
    const loc: FileLocation = { folderId, subId: sub.id };
    const isTarget = locEquals(insertTarget, loc);
    return (
      <View key={sub.id}>
        <DropZone
          zoneId={`fld-${sub.id}`}
          accepts={(item: DragItem) => item.kind === 'file' || (item.kind === 'folder' && item.id !== sub.id)}
          onDrop={item => {
            if (item.kind === 'file') {
              const { file, fromLoc } = item.data ?? {};
              if (file) void performMove(file, fromLoc ?? null, loc);
            } else {
              moveSubToIndex(wsId, folderId, parentSubId, item.id, sub.id);
              showToast('Ordre des dossiers mis à jour', { tone: 'success' });
            }
          }}
          style={{ borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent' }}
          activeStyle={{ borderColor: C.accent, opacity: 0.85 }}
        >
          <Draggable
            getItem={() => ({ kind: 'folder', id: sub.id, label: sub.name, icon: sub.icon, color: sub.color, data: { folder: sub, folderId, parentSubId, chainPrefix } })}
            onTap={() => toggleFolderOpen(loc, folderId)}
            onContextMenu={pos => openMenu(pos, subMenu(folderId, parentSubId, sub, chainPrefix))}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.sm, marginLeft: depth * Spacing.lg, borderRadius: Radius.sm, backgroundColor: isTarget ? C.accent + '14' : 'transparent', borderWidth: 1, borderColor: isTarget ? C.accent + '55' : 'transparent' }}>
              <Pressable onPress={(e: any) => { e?.stopPropagation?.(); toggleFolderOpen(loc, folderId); }} hitSlop={6}>
                <MaterialIcons name={open ? 'expand-more' : 'chevron-right'} size={18} color={C.textMuted} />
              </Pressable>
              <MaterialIcons name={(sub.icon as any) || 'folder'} size={17} color={sub.color} />
              <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600' }} numberOfLines={1}>{sub.name}</Text>
              <Text style={{ fontSize: 10, color: C.textMuted }}>{sub.files.length}</Text>
            </View>
          </Draggable>
        </DropZone>
        {open ? (
          <View>
            {(sub.subFolders ?? []).map(child => renderSubFolder(folderId, sub.id, child, depth + 1, `${chainPrefix}${sub.name}/`))}
            {sortFiles(sub.files, sortKey, sortOrder).map(f => (
              <FileRow
                key={f.id}
                file={f}
                loc={loc}
                depth={depth + 1}
                onPress={() => handleOpenFileViewer(f)}
                onContextMenu={pos => openMenu(pos, fileMenu(f, loc))}
                onReorderDrop={item => handleFileReorderDrop(item, f, loc)}
              />
            ))}
            {sub.files.length === 0 && subCount === 0 ? (
              <Text style={{ fontSize: 11, color: C.textMuted, marginLeft: depth * Spacing.lg + 30, paddingVertical: 4 }}>Dossier vide</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderRootFolder = (folder: DBFolder) => {
    const open = openFolderIds.has(folder.id);
    const isTarget = insertTarget === folder.id;
    return (
      <View key={folder.id}>
        <DropZone
          zoneId={`fld-${folder.id}`}
          accepts={(item: DragItem) => item.kind === 'file' || (item.kind === 'folder' && item.id !== folder.id)}
          onDrop={item => {
            if (item.kind === 'file') {
              const { file, fromLoc } = item.data ?? {};
              if (file) void performMove(file, fromLoc ?? null, folder.id);
            } else {
              moveSubToIndex(wsId, folder.id, null, item.id, folder.id);
              showToast('Ordre des dossiers mis à jour', { tone: 'success' });
            }
          }}
          style={{ borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent' }}
          activeStyle={{ borderColor: C.accent, opacity: 0.85 }}
        >
          <Draggable
            getItem={() => ({ kind: 'folder', id: folder.id, label: folder.name, icon: folder.icon, color: folder.color, data: { folder } })}
            onTap={() => toggleFolderOpen(folder.id, folder.id)}
            onContextMenu={pos => openMenu(pos, folderMenu(folder, null))}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: isTarget ? C.accent + '14' : C.bgCardAlt, borderWidth: 1, borderColor: isTarget ? C.accent + '55' : (folder.color || C.border) + '44' }}>
              <Pressable onPress={(e: any) => { e?.stopPropagation?.(); toggleFolderOpen(folder.id, folder.id); }} hitSlop={6}>
                <MaterialIcons name={open ? 'expand-more' : 'chevron-right'} size={18} color={C.textMuted} />
              </Pressable>
              <View style={{ width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: folder.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={(folder.icon as any) || 'folder'} size={17} color={folder.color} />
              </View>
              <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{folder.name}</Text>
              {folder.vault ? (
                <View style={{ backgroundColor: (folder.color || '#9B59B6') + '22', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 9, color: folder.color || '#9B59B6', fontWeight: '700' }}>vault</Text>
                </View>
              ) : null}
              {folder.repo ? (
                <View style={{ backgroundColor: (folder.color || '#00BFFF') + '22', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 9, color: folder.color || '#00BFFF', fontWeight: '700' }}>dépôt</Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 10, color: C.textMuted }}>{folder.files.length}</Text>
            </View>
          </Draggable>
        </DropZone>
        {open ? (
          <View style={{ borderLeftWidth: 1, borderLeftColor: C.border, marginLeft: 14 }}>
            {(folder.subFolders ?? []).map(sub => renderSubFolder(folder.id, null, sub, 1, ''))}
            {sortFiles(folder.files, sortKey, sortOrder).map(f => (
              <FileRow
                key={f.id}
                file={f}
                loc={folder.id}
                depth={1}
                onPress={() => handleOpenFileViewer(f)}
                onContextMenu={pos => openMenu(pos, fileMenu(f, folder.id))}
                onReorderDrop={item => handleFileReorderDrop(item, f, folder.id)}
              />
            ))}
            {folder.files.length === 0 && (folder.subFolders ?? []).length === 0 ? (
              <Text style={{ fontSize: 11, color: C.textMuted, marginLeft: 30, paddingVertical: 4 }}>Dossier vide</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  // ── Vault racine du projet : barre compacte avec chemin éditable ─────
  const vaultBar = rootVault ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: (rootVault.color || '#9B59B6') + '44', padding: Spacing.sm, flexWrap: 'wrap' }}>
      <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: (rootVault.color || '#9B59B6') + '22', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name={(rootVault.icon as any) || 'lock'} size={16} color={rootVault.color || '#9B59B6'} />
      </View>
      <View style={{ flex: 1, minWidth: 150, gap: 3 }}>
        <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }}>
          Vault racine — {rootVault.name}
          {rootVault.vault?.sourceKind === 'github' ? ' (GitHub)' : ''}
        </Text>
        <TextInput
          style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.border, color: C.textSecondary, fontSize: FontSize.xs, paddingHorizontal: Spacing.sm, paddingVertical: 4, fontFamily: 'monospace' }}
          value={vaultPath}
          onChangeText={setVaultPath}
          placeholder="Chemin complet du vault (ex: C:\Users\moi\Documents\mon-vault)"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          onEndEditing={() => {
            if (rootVault.vault && vaultPath.trim() !== (rootVault.vault.path ?? '')) {
              updateFolder(ws.id, rootVault.id, { vault: { ...rootVault.vault, path: vaultPath.trim() } });
              showToast('Chemin du vault enregistré', { tone: 'success' });
            }
          }}
        />
        {rootVault.vault?.syncMessage ? (
          <Text style={{ fontSize: 10, color: C.textMuted }} numberOfLines={1}>
            {rootVault.vault.syncMessage}
            {rootVault.vault.lastSyncedAt ? ` · ${new Date(rootVault.vault.lastSyncedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Text>
        ) : null}
      </View>
      {busyVault ? <ActivityIndicator size="small" color={C.accent} /> : null}
      {getElectronVault() ? (
        <IconButton icon="folder-open" label="Choisir le dossier du vault sur le disque (chemin absolu)" bare size={18} color={C.textSecondary} onPress={() => void handlePickVaultPath()} />
      ) : null}
      <IconButton icon="sync" label="Resynchroniser le vault" bare size={18} color={C.accent} onPress={() => handleRootVaultSync()} />
      <IconButton
        icon="link-off"
        label="Détacher le vault racine"
        bare
        size={18}
        color={C.textMuted}
        onPress={() => showAlert(`Détacher « ${rootVault.name} » ?`, 'Le dossier vault et ses fichiers seront retirés de ce workspace.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Détacher', style: 'destructive', onPress: () => removeFolder(ws.id, rootVault.id) },
        ])}
      />
    </View>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Top Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <IconButton icon="arrow-back" label="Retour" onPress={() => router.back()} bare size={22} color={C.textPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{ws.name}</Text>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 1 }} numberOfLines={1}>
            {totalFiles} fichier(s) · {totalFolders} dossier(s) · Ajouts dans : {locLabel(insertTarget)}
          </Text>
        </View>
        {/* Insérer — cible = insertTarget (racine ou dossier déplié) */}
        <IconButton
          icon={showInsert ? 'close' : 'add-circle'}
          label="Insérer"
          onPress={() => setShowInsert(v => !v)}
          color={showInsert ? C.accent : C.primary}
          backgroundColor={showInsert ? C.accent + '18' : undefined}
          borderColor={showInsert ? C.accent + '55' : undefined}
        />
        {/* Nouveau dossier — cible = insertTarget */}
        <IconButton
          icon="create-new-folder"
          label="Nouveau dossier"
          onPress={() => {
            resetFolderForm();
            if (insertTarget === null) setFolderCreateTarget(null);
            else if (typeof insertTarget === 'string') setFolderCreateTarget({ folderId: insertTarget, parentSubId: null });
            else setFolderCreateTarget({ folderId: (insertTarget as any).folderId, parentSubId: (insertTarget as any).subId });
            setShowAddFolder(true);
          }}
          color={C.primary}
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {vaultBar}
        {/* Configuration du vault (uniquement s'il n'y en a pas encore) */}
        {!rootVault ? (
          <VaultFolderPanel
            workspaceId={ws.id}
            folders={wsFolders}
            onOpenFolder={folder => { setOpenFolderIds(prev => new Set(prev).add(folder.id)); setInsertTarget(folder.id); }}
            addVaultFolder={addVaultFolder}
            updateFolder={updateFolder}
            removeFolder={removeFolder}
            syncFolderFromDisk={syncFolderFromDisk}
          />
        ) : null}

        {/* Dépôts connectés (dossiers de code / GitHub) — bien séparés du vault */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name="source" size={14} color={C.textSecondary} />
            <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              Dépôts{repoFolders.length > 0 ? ` (${repoFolders.length})` : ''}
            </Text>
            <Pressable
              onPress={() => setShowAddRepo(v => !v)}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.accent + '55', backgroundColor: C.accent + '18' }, pressed && { opacity: 0.75 }]}
            >
              <MaterialIcons name={showAddRepo ? 'close' : 'add-link'} size={13} color={C.accent} />
              <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>{showAddRepo ? 'Fermer' : 'Connecter'}</Text>
            </Pressable>
          </View>
          {showAddRepo ? <RepoPanel workspaceId={ws.id} onClose={() => setShowAddRepo(false)} /> : null}
          {repoFolders.map(folder => (
            <RepoCard
              key={folder.id}
              folder={folder}
              busy={busyRepoId === folder.id}
              onPress={() => { setOpenFolderIds(prev => new Set(prev).add(folder.id)); setInsertTarget(folder.id); }}
              onRename={() => openRenameFolder(folder)}
              onSync={() => void handleRepoSync(folder)}
              onOpenExternal={() => void handleRepoOpenExternal(folder)}
              onDelete={() => showAlert(`Déconnecter « ${folder.name} » ?`, 'Les fichiers du dépôt seront retirés de la base (le disque et GitHub ne sont pas touchés).', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnecter', style: 'destructive', onPress: () => removeFolder(ws.id, folder.id) },
              ])}
            />
          ))}
          {repoFolders.length === 0 && !showAddRepo ? (
            <Text style={{ fontSize: FontSize.sm, color: C.textMuted, lineHeight: 18 }}>
              Aucun dépôt connecté. Connectez un dossier de code local ou un dépôt GitHub : ses fichiers apparaîtront ici et dans l’onglet Sites du chat, séparés du vault.
            </Text>
          ) : null}
        </View>

        {/* Arbre unique — dossiers et fichiers dans le même défilement */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: 2 }}>
          {/* Bande de dépôt vers la racine, visible pendant un glisser-déposer */}
          {dragState ? (
            <DropZone
              zoneId="strip-root"
              accepts={() => true}
              onDrop={handleStripDrop}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: C.accent + '66', borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, backgroundColor: C.accent + '10', marginBottom: Spacing.xs }}
            >
              <MaterialIcons name="home" size={16} color={C.accent} />
              <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Déposer ici → Racine du workspace</Text>
            </DropZone>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              Contenu
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <SortBar sortKey={sortKey} sortOrder={sortOrder} onChange={handleSortChange} />
              </ScrollView>
              {displayedFiles.length > 0 ? (
                <Pressable onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: selectMode ? C.accent + '66' : C.border, backgroundColor: selectMode ? C.accent + '18' : C.bgCardAlt }, pressed && { opacity: 0.75 }]}>
                  <MaterialIcons name={selectMode ? 'close' : 'checklist'} size={14} color={selectMode ? C.accent : C.textMuted} />
                  <Text style={{ fontSize: FontSize.xs, color: selectMode ? C.accent : C.textMuted, fontWeight: '700' }}>{selectMode ? 'Annuler' : 'Sélectionner'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {selectMode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.xs }}>
              <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textSecondary }}>{selectedFileIds.size} sélectionné(s)</Text>
              <Pressable
                onPress={() => {
                  if (selectedFileIds.size === 1) {
                    const id = [...selectedFileIds][0];
                    const f = displayedFiles.find(x => x.id === id);
                    if (f) setMovingFile(f);
                  } else if (selectedFileIds.size > 1) {
                    setMovingFile({ id: '__bulk__', name: `${selectedFileIds.size} fichiers`, type: 'note', content: '', tags: [], size: 0, createdAt: new Date(), updatedAt: new Date() } as DBFile);
                  }
                }}
                disabled={selectedFileIds.size === 0}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.border, opacity: selectedFileIds.size === 0 ? 0.4 : 1 }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="drive-file-move" size={14} color={C.textSecondary} />
                <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '700' }}>Déplacer</Text>
              </Pressable>
              <Pressable onPress={bulkDeleteSelectedFiles} disabled={selectedFileIds.size === 0} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: C.error + '18', borderWidth: 1, borderColor: C.error + '55', opacity: selectedFileIds.size === 0 ? 0.4 : 1 }, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name="delete-outline" size={14} color={C.error} />
                <Text style={{ fontSize: FontSize.xs, color: C.error, fontWeight: '700' }}>Supprimer</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Fichiers racine (dont vault racine) */}
          {displayedFiles.map(file => (
            <FileRow
              key={file.id}
              file={file}
              loc={fileLocationOf(file)}
              depth={0}
              onPress={() => handleOpenFileViewer(file)}
              onContextMenu={pos => openMenu(pos, fileMenu(file, fileLocationOf(file)))}
              selectMode={selectMode}
              selected={selectedFileIds.has(file.id)}
              onToggleSelect={() => { if (!selectMode) setSelectMode(true); toggleSelectFile(file.id); }}
              onReorderDrop={item => handleFileReorderDrop(item, file, fileLocationOf(file))}
            />
          ))}

          {/* Dossiers (vault inclus, dépôts, dossiers applicatifs) */}
          {wsFolders.map(folder => renderRootFolder(folder))}

          {totalFiles === 0 && wsFolders.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md }}>
              <MaterialIcons name="folder-open" size={40} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '600' }}>Aucun fichier</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>Créez une note, importez un fichier ou ajoutez un lien</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ─── Popover « Insérer » : overlay plein écran ────────────── */}
      {showInsert ? (
        <View style={{ position: 'absolute', inset: 0, zIndex: 300 }} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={() => setShowInsert(false)} />
          <View style={{ position: 'absolute', top: 84, right: Spacing.md, flexDirection: 'row', gap: Spacing.sm, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.sm, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 }}>
            {[
              { icon: 'edit-note', label: 'Texte', color: '#FFB800', onPress: () => { setShowInsert(false); resetFileForm(); setShowAddFile(true); } },
              { icon: 'upload-file', label: 'Fichier', color: '#3D7EFF', onPress: () => { setShowInsert(false); void handlePickFile(); } },
              { icon: 'image', label: 'Image', color: '#00CC6A', onPress: () => { setShowInsert(false); void handlePickImage(); } },
              { icon: 'link', label: 'Lien', color: '#9B59B6', onPress: () => { setShowInsert(false); setLinkUrl(''); setLinkName(''); setShowAddLink(true); } },
            ].map(b => (
              <Pressable key={b.label} onPress={b.onPress} style={({ pressed }) => [{ alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: b.color + '44', backgroundColor: b.color + '12' }, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name={b.icon as any} size={20} color={b.color} />
                <Text style={{ fontSize: FontSize.xs, color: b.color, fontWeight: '700' }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* ─── Menu contextuel (clic droit) ─────────────────────────── */}
      {menu ? (
        <View style={{ position: 'absolute', inset: 0, zIndex: 400 }} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={() => setMenu(null)} />
          <View style={{ position: 'absolute', left: menu.x, top: menu.y, width: 220, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}>
            {menu.items.map(it => (
              <Pressable
                key={it.label}
                onPress={() => { setMenu(null); it.onPress(); }}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 9, paddingHorizontal: Spacing.md }, pressed && { backgroundColor: C.bgCardAlt }]}
              >
                <MaterialIcons name={it.icon as any} size={16} color={it.danger ? C.error : C.textSecondary} />
                <Text style={{ flex: 1, fontSize: FontSize.sm, color: it.danger ? C.error : C.textPrimary, fontWeight: '600' }}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Fantôme du glisser-déposer (natif uniquement) */}
      <DragLayer />

      {/* ─── Renommage rapide ─────────────────────────────────────── */}
      <Modal visible={renaming !== null} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }}>
          <View style={{ width: '100%', maxWidth: 420, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: C.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="edit" size={16} color={C.accent} />
              </View>
              <Text style={{ flex: 1, fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>
                {renaming?.kind === 'folder' ? 'Renommer le dossier' : renaming?.kind === 'sub' ? 'Renommer le sous-dossier' : 'Renommer le fichier'}
              </Text>
              <Pressable onPress={() => setRenaming(null)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44, color: C.textPrimary }}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              selectTextOnFocus
              onSubmitEditing={confirmRename}
              placeholderTextColor={C.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setRenaming(null)} style={({ pressed }) => [{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border }, pressed && { opacity: 0.7 }]}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600' }}>Annuler</Text>
              </Pressable>
              <Pressable onPress={confirmRename} disabled={!renameValue.trim()} style={({ pressed }) => [{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: C.accent, opacity: !renameValue.trim() ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
                <Text style={{ fontSize: FontSize.sm, color: C.bg, fontWeight: '700' }}>Renommer</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Move file modal ─────────────────────────────────────── */}
      <Modal visible={!!movingFile} transparent animationType="slide" onRequestClose={() => setMovingFile(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
                <MaterialIcons name="drive-file-move" size={20} color={C.accent} />
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                  Déplacer vers…{movingFile ? ` — ${movingFile.name}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setMovingFile(null)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={{ gap: Spacing.sm, paddingBottom: Spacing.sm }}>
                {moveDestinations.map((dest, i) => (
                  <Pressable
                    key={`${i}-${dest.label}`}
                    onPress={() => handleConfirmMove(dest.location)}
                    style={({ pressed }) => [{
                      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                      backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1,
                      borderColor: C.border, padding: Spacing.md,
                    }, pressed && { opacity: 0.8 }]}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: dest.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={dest.icon as any} size={18} color={dest.color} />
                    </View>
                    <Text style={{ flex: 1, fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }} numberOfLines={2}>{dest.label}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={C.textMuted} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Add Folder Modal (sans description) ──────────────────── */}
      <Modal visible={showAddFolder} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <MaterialIcons name="create-new-folder" size={20} color={C.accent} />
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Nouveau dossier</Text>
              </View>
              <Pressable onPress={() => { setShowAddFolder(false); setFolderCreateTarget(null); }} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <View style={{ gap: Spacing.md }}>
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom</Text>
                <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={folderName} onChangeText={setFolderName} placeholder="Ex: Références..." placeholderTextColor={C.textMuted} autoFocus />
              </View>
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Couleur</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  {FOLDER_COLORS.map(c => <Pressable key={c} onPress={() => setFolderColor(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: folderColor === c ? 3 : 0, borderColor: '#fff' }} />)}
                </View>
              </View>
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Icône</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  {FOLDER_ICONS.map(ic => (
                    <Pressable key={ic} onPress={() => setFolderIcon(ic)} style={{ width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: folderIcon === ic ? folderColor + '33' : C.bgCardAlt, borderWidth: 1, borderColor: folderIcon === ic ? folderColor : C.border }}>
                      <MaterialIcons name={ic as any} size={22} color={folderIcon === ic ? folderColor : C.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <Pressable onPress={handleAddFolder} disabled={!folderName.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: !folderName.trim() ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="create-new-folder" size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Créer</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Add Text/Note File Modal ───────────────────────────────── */}
      <Modal visible={showAddFile} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Nouveau fichier texte</Text>
              <Pressable onPress={() => setShowAddFile(false)} hitSlop={8}><MaterialIcons name="close" size={22} color={C.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                      {FILE_TYPES.map(t => (
                        <Pressable key={t.id} onPress={() => setFileType(t.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: fileType === t.id ? t.color : C.border, backgroundColor: fileType === t.id ? t.color + '28' : C.bgCardAlt }}>
                          <MaterialIcons name={t.icon as any} size={14} color={fileType === t.id ? t.color : C.textMuted} />
                          <Text style={{ fontSize: FontSize.sm, color: fileType === t.id ? t.color : C.textMuted, fontWeight: '600' }}>{t.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={fileName} onChangeText={setFileName} placeholder="Mon fichier..." placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Tags</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={fileTags} onChangeText={setFileTags} placeholder="api, référence..." placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Contenu</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 120, textAlignVertical: 'top', paddingTop: Spacing.sm }} value={fileContent} onChangeText={setFileContent} placeholder="Écrivez votre contenu ici..." placeholderTextColor={C.textMuted} multiline textAlignVertical="top" />
                </View>
              </View>
            </ScrollView>
            <Pressable onPress={handleAddTextFile} disabled={!fileName.trim() || !fileContent.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: (!fileName.trim() || !fileContent.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="add-circle" size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Ajouter le fichier</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Add Link Modal ─────────────────────────────────────────── */}
      <Modal visible={showAddLink} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: '#9B59B6' + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="link" size={18} color="#9B59B6" />
                </View>
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Insérer un lien</Text>
              </View>
              <Pressable onPress={() => setShowAddLink(false)} hitSlop={8}><MaterialIcons name="close" size={22} color={C.textSecondary} /></Pressable>
            </View>
            <View style={{ gap: Spacing.xs }}>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>URL *</Text>
              <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44, fontFamily: 'monospace' }} value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." placeholderTextColor={C.textMuted} keyboardType="url" autoCapitalize="none" />
            </View>
            <View style={{ gap: Spacing.xs }}>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom (optionnel)</Text>
              <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={linkName} onChangeText={setLinkName} placeholder="Documentation officielle..." placeholderTextColor={C.textMuted} />
            </View>
            <Pressable onPress={handleAddLink} disabled={!linkUrl.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#9B59B6', borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: !linkUrl.trim() ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="link" size={18} color="#fff" />
              <Text style={{ fontSize: FontSize.body, color: '#fff', fontWeight: '700' }}>Ajouter le lien</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── File Viewer Modal (read-only) ─────────────────────────── */}
      <Modal visible={viewingFile !== null} transparent animationType="slide" onRequestClose={() => setViewingFile(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing.lg, height: '85%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
                {viewingFile ? (
                  <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: getFileTypeInfo(viewingFile.type).color + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MaterialIcons name={getFileTypeInfo(viewingFile.type).icon as any} size={16} color={getFileTypeInfo(viewingFile.type).color} />
                  </View>
                ) : null}
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700', flex: 1 }} numberOfLines={1}>{viewingFile?.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 0 }}>
                <Pressable
                  onPress={() => viewingFile && handleOpenFileEditor(viewingFile, fileLocationOf(viewingFile))}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary + '22', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.primary + '55' }, pressed && { opacity: 0.7 }]}
                >
                  <MaterialIcons name="edit" size={14} color={C.primary} />
                  <Text style={{ fontSize: FontSize.xs, color: C.primary, fontWeight: '600' }}>Modifier</Text>
                </Pressable>
                <Pressable onPress={() => setViewingFile(null)} hitSlop={8}>
                  <MaterialIcons name="close" size={22} color={C.textSecondary} />
                </Pressable>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: Spacing.md }}>
              <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
                <Text style={{ fontSize: FontSize.body, color: C.textPrimary, lineHeight: 24, fontFamily: viewingFile?.type === 'code' || viewingFile?.type === 'json' ? 'monospace' : undefined }}>
                  {viewingFile?.content || '(Contenu vide)'}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── File Editor Modal ──────────────────────────────────────── */}
      <Modal visible={editingFile !== null} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                {editingFile ? (
                  <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: getFileTypeInfo(editingFile.type).color + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={getFileTypeInfo(editingFile.type).icon as any} size={16} color={getFileTypeInfo(editingFile.type).color} />
                  </View>
                ) : null}
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Éditeur de fichier</Text>
              </View>
              <Pressable onPress={() => setEditingFile(null)} hitSlop={8}><MaterialIcons name="close" size={22} color={C.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={editorName} onChangeText={setEditorName} placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Tags</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={editorTags} onChangeText={setEditorTags} placeholder="tag1, tag2..." placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Contenu</Text>
                    <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{editorContent.length} c</Text>
                  </View>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 220, textAlignVertical: 'top', paddingTop: Spacing.sm }} value={editorContent} onChangeText={setEditorContent} multiline textAlignVertical="top" placeholderTextColor={C.textMuted} />
                </View>
              </View>
            </ScrollView>
            <Pressable onPress={handleSaveFile} disabled={!editorName.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: !editorName.trim() ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="save" size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Enregistrer</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
