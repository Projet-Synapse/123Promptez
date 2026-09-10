// Powered by OnSpace.AI
// Workspace Database — sub-folders + file sorting system
import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useBot } from '@/hooks/useBot';
import { VaultFolderPanel } from '@/components/feature/VaultFolderPanel';
import { RepoPanel } from '@/components/feature/RepoPanel';
import { DragLayer, DropZone, useDnDState, useDragHandlers, type DragItem } from '@/components/feature/dnd';
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
type SortKey = 'name' | 'date' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

// Navigation stack item — les sous-dossiers s'imbriquent à toute profondeur
// (path = chaîne depuis le dossier racine jusqu'au sous-dossier courant)
type NavItem =
  | { kind: 'root' }
  | { kind: 'folder'; folder: DBFolder }
  | { kind: 'subfolder'; folder: DBFolder; path: DBSubFolder[] };

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
  return [...files].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') cmp = a.name.localeCompare(b.name);
    else if (key === 'date') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    else if (key === 'size') cmp = a.size - b.size;
    else if (key === 'type') cmp = a.type.localeCompare(b.type);
    return order === 'asc' ? cmp : -cmp;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function locEquals(a: FileLocation, b: FileLocation): boolean {
  if (a === null && b === null) return true;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (a && b && typeof a === 'object' && typeof b === 'object') return a.folderId === b.folderId && a.subId === b.subId;
  return false;
}

function FileRow({ file, onPress, onRename, onMove, onDelete, selectMode, selected, onToggleSelect, dragItem }: {
  file: DBFile; onPress: () => void; onRename: () => void; onMove: () => void; onDelete: () => void;
  selectMode?: boolean; selected?: boolean; onToggleSelect?: () => void;
  dragItem?: DragItem | null;
}) {
  const C = useThemeColors();
  const info = getFileTypeInfo(file.type);
  const dragHandlers = useDragHandlers(
    () => (selectMode ? null : dragItem ?? null),
    () => (selectMode ? onToggleSelect?.() : onPress()),
  );
  return (
    <View {...dragHandlers}>
      <View
        style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: selected ? C.primary + '18' : C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: selected ? C.primary + '55' : C.border, padding: Spacing.md }]}
      >
        {selectMode ? (
          <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={20} color={selected ? C.primary : C.textMuted} style={{ marginTop: 8 }} />
        ) : null}
        <View style={{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: info.color + '22', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <MaterialIcons name={info.icon as any} size={18} color={info.color} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }} numberOfLines={1}>{file.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View style={{ backgroundColor: info.color + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill }}>
              <Text style={{ fontSize: 10, color: info.color, fontWeight: '700' }}>{info.label}</Text>
            </View>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{formatSize(file.size)}</Text>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{formatDate(file.updatedAt)}</Text>
          </View>
          {file.tags.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' }}>
              {file.tags.slice(0, 3).map(tag => (
                <View key={tag} style={{ backgroundColor: C.bgCard, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.border }}>
                  <Text style={{ fontSize: 10, color: C.textMuted }}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {!selectMode ? (
          <>
            <Pressable onPress={onRename} hitSlop={12} style={{ padding: Spacing.xs, marginTop: 2 }} accessibilityLabel={`Renommer ${file.name}`}>
              <MaterialIcons name="edit" size={18} color={C.textMuted} />
            </Pressable>
            <Pressable onPress={onMove} hitSlop={12} style={{ padding: Spacing.xs, marginTop: 2 }}>
              <MaterialIcons name="drive-file-move" size={18} color={C.textMuted} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={12} style={{ padding: Spacing.xs, marginTop: 2 }}>
              <MaterialIcons name="delete-outline" size={18} color={C.textMuted} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

function FolderCard({ folder, onPress, onRename, onDelete, dragItem, dropProps }: {
  folder: DBFolder | DBSubFolder; onPress: () => void; onRename?: () => void; onDelete: () => void;
  dragItem?: DragItem | null;
  /** Si fourni, la carte devient une zone de dépôt (glisser-déposer) */
  dropProps?: { zoneId: string; accepts: (item: DragItem) => boolean; onDrop: (item: DragItem) => void };
}) {
  const C = useThemeColors();
  const subCount = (folder as DBFolder).subFolders?.length ?? (folder as DBSubFolder).subFolders?.length ?? 0;
  const dragHandlers = useDragHandlers(() => dragItem ?? null, onPress);
  const card = (
    <View {...dragHandlers}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: folder.color + '44', padding: Spacing.md }}>
        <View style={{ width: 46, height: 46, borderRadius: Radius.sm, backgroundColor: folder.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={folder.icon as any} size={26} color={folder.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{folder.name}</Text>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }} numberOfLines={1}>{folder.description || 'Aucune description'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MaterialIcons name="insert-drive-file" size={12} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{folder.files.length} fichier{folder.files.length !== 1 ? 's' : ''}</Text>
            </View>
            {subCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialIcons name="folder" size={12} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{subCount} sous-dossier{subCount !== 1 ? 's' : ''}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: Spacing.xs }}>
          <MaterialIcons name="chevron-right" size={22} color={folder.color} />
          {onRename ? (
            <Pressable onPress={onRename} hitSlop={10} style={{ padding: Spacing.xs }} accessibilityLabel={`Renommer ${folder.name}`}>
              <MaterialIcons name="edit" size={16} color={C.textMuted} />
            </Pressable>
          ) : null}
          <Pressable onPress={onDelete} hitSlop={10} style={{ padding: Spacing.xs }}>
            <MaterialIcons name="delete-outline" size={16} color={C.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
  if (!dropProps) return card;
  return (
    <DropZone
      zoneId={dropProps.zoneId}
      accepts={dropProps.accepts}
      onDrop={dropProps.onDrop}
      style={{ borderRadius: Radius.md, borderWidth: 2, borderColor: 'transparent' }}
      activeStyle={{ borderColor: C.accent, opacity: 0.85 }}
    >
      {card}
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
            {active ? <MaterialIcons name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'} size={11} color={C.accent} /> : null}
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
    addFile, updateFile, removeFile, moveFile,
    syncFolderFromDisk, moveFolderIntoFolder, promoteSubFolder,
  } = useWorkspace();
  const { showAlert } = useAlert();
  const { showToast } = useToast();
  const { bot } = useBot();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const toggleSelectFile = (id: string) => setSelectedFileIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exitSelectMode = () => { setSelectMode(false); setSelectedFileIds(new Set()); };
  const router = useRouter();
  const C = useThemeColors();

  const ws = workspaces.find(w => w.id === wsId);

  // ── Vault racine du projet ───────────────────────────────────────
  // Le premier dossier vault configuré devient la racine : ses dossiers et
  // fichiers sont affichés directement, plus de distinction vault/racine.
  const rootVault = useMemo(() => ws?.database.folders.find(f => f.vault) ?? null, [ws]);
  const [vaultPath, setVaultPath] = useState(rootVault?.vault?.path ?? '');
  useEffect(() => { setVaultPath(rootVault?.vault?.path ?? ''); }, [rootVault?.id, rootVault?.vault?.path]);

  const handleRootVaultSync = async () => {
    if (!rootVault?.vault || !ws) return;
    const wid = ws.id;
    const folder = ws.database.folders.find(f => f.id === rootVault.id);
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
        const token = resolveGitHubToken(bot.connectedApps);
        if (!token) { showAlert('Jeton GitHub manquant', 'Configurez un Personal Access Token dans Builder ▸ Connecteurs.'); return; }
        const result = await importGitHubRepoAsVault(token, {
          id: folder.vault.repoId || 0,
          full_name: folder.vault.repoFullName,
          description: null,
          private: false,
          html_url: folder.vault.path || '',
          default_branch: 'main',
        });
        updateFolder(wid, folder.id, { vault: result.meta });
        syncFolderFromDisk(wid, folder.id, result.files, result.dirs);
        showToast('Vault GitHub resynchronisé', { tone: 'success' });
      }
    } catch (e: any) {
      showAlert('Erreur sync', e?.message ?? 'Échec');
    } finally {
      setBusyVault(false);
    }
  };
  const [busyVault, setBusyVault] = useState(false);

  // Choix du dossier réel du vault (desktop) : enregistre le chemin ABSOLU
  // puis resynchronise immédiatement le contenu.
  const handlePickVaultPath = async () => {
    if (!rootVault) return;
    const picked = await pickLocalVaultFolder();
    if (!picked) return;
    updateFolder(wsId, rootVault.id, { vault: picked.meta });
    syncFolderFromDisk(wsId, rootVault.id, picked.files, picked.dirs);
    showToast('Chemin du vault enregistré', { tone: 'success' });
  };

  // ── Miroir disque (vault / dépôts locaux) ──────────────────────────
  const wsFolders = useMemo(() => ws?.database.folders ?? [], [ws]);
  // Méta du vault/dépôt qui gère une localisation donnée.
  const metaAt = (loc: FileLocation): VaultMeta | null => {
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
  };
  // Chemin disque d'un fichier (relatif au vault/dépôt)
  const relOf = (f: DBFile): string => f.path ?? f.name;
  const baseOf = (name: string): string => name.split('/').pop() ?? name;
  // Chaîne des noms de sous-dossiers jusqu'à subId (récursif)
  const subChainNames = (subs: DBSubFolder[], subId: string, acc: string[] = []): string[] | null => {
    for (const s of subs) {
      const next = [...acc, s.name];
      if (s.id === subId) return next;
      const deep = subChainNames(s.subFolders ?? [], subId, next);
      if (deep) return deep;
    }
    return null;
  };
  // Préfixe disque d'une localisation (chaîne des sous-dossiers du vault/dépôt)
  const prefixOf = (loc: FileLocation): string => {
    if (!loc || typeof loc !== 'object') return '';
    const f = wsFolders.find(x => x.id === loc.folderId);
    const chain = f ? subChainNames(f.subFolders ?? [], loc.subId) : null;
    return chain ? `${chain.join('/')}/` : '';
  };
  // Déplace un fichier (DB + miroir disque si la source/cible est un vault ou dépôt local).
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
  const deleteFileWithMirror = async (file: DBFile) => {
    const loc = fileLocationOf(file);
    const meta = metaAt(loc);
    if (meta && canMirrorToDisk(meta) && file.type !== 'url') {
      const r = await vaultDeletePath(meta, relOf(file), false);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'suppression impossible'}`, { tone: 'error' }); return; }
    }
    removeFile(wsId, loc, file.id);
  };

  // ── Navigation stack ─────────────────────────────────────────────
  const [navStack, setNavStack] = useState<NavItem[]>([{ kind: 'root' }]);
  const currentNav = navStack[navStack.length - 1];

  const pushFolder = (folder: DBFolder) => setNavStack(prev => [...prev, { kind: 'folder', folder }]);
  const pushSub = (folder: DBFolder, path: DBSubFolder[]) => setNavStack(prev => [...prev, { kind: 'subfolder', folder, path }]);
  const goBack = () => {
    if (navStack.length > 1) setNavStack(prev => prev.slice(0, -1));
    else router.back();
  };

  // ── Sorting ──────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const handleSortChange = (k: SortKey, o: SortOrder) => { setSortKey(k); setSortOrder(o); };

  // ── Modal state ──────────────────────────────────────────────────
  const [showInsert, setShowInsert] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddSubFolder, setShowAddSubFolder] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [editingFile, setEditingFile] = useState<DBFile | null>(null);
  const [viewingFile, setViewingFile] = useState<DBFile | null>(null);
  const [movingFile, setMovingFile] = useState<DBFile | null>(null);
  // Renommage rapide (crayon) — fichier, dossier ou sous-dossier imbriqué
  const [renaming, setRenaming] = useState<
    | { kind: 'file'; file: DBFile }
    | { kind: 'folder'; folder: DBFolder }
    | { kind: 'sub'; folderId: string; sub: DBSubFolder; prefix: string }
    | null
  >(null);
  const [renameValue, setRenameValue] = useState('');

  // Folder/sub-folder form
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);
  const [folderIcon, setFolderIcon] = useState(FOLDER_ICONS[0]);

  // File form
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<DBFile['type']>('note');
  const [fileContent, setFileContent] = useState('');
  const [fileTags, setFileTags] = useState('');

  // Link form
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  // Editor
  const [editorName, setEditorName] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorTags, setEditorTags] = useState('');

  // ── Compute current location & displayed content ─────────────────
  // NOTE: these hooks must run on every render (including when `ws` is not
  // yet found) to satisfy the Rules of Hooks, so all of them are null-safe.
  const currentLocation: FileLocation = useMemo(() => {
    if (currentNav.kind === 'root') return null;
    if (currentNav.kind === 'folder') return currentNav.folder.id;
    return { folderId: currentNav.folder.id, subId: currentNav.path[currentNav.path.length - 1].id };
  }, [currentNav]);

  // Localisation réelle d'un fichier affiché à la racine (fusion vault + racine)
  const fileLocationOf = (file: DBFile): FileLocation => {
    if (currentNav.kind !== 'root') return currentLocation;
    if (ws?.database.rootFiles.some(f => f.id === file.id)) return null;
    if (rootVault?.files.some(f => f.id === file.id)) return rootVault.id;
    return null;
  };
  // À la racine avec un vault configuré, les nouveaux fichiers vont dans le vault
  const insertLocation: FileLocation = currentNav.kind === 'root' && rootVault ? rootVault.id : currentLocation;
  const liveFolder = currentNav.kind !== 'root' ? ws?.database.folders.find(f => f.id === (currentNav as any).folder.id) ?? null : null;
  const liveSub = currentNav.kind === 'subfolder' && liveFolder
    ? findSubIn(liveFolder.subFolders ?? [], currentNav.path[currentNav.path.length - 1].id)
    : null;
  // Chemin disque (chaîne des sous-dossiers) de la position courante
  const navPrefix = currentNav.kind === 'subfolder' ? `${currentNav.path.map(s => s.name).join('/')}/` : '';
  const currentSubId = currentNav.kind === 'subfolder' ? currentNav.path[currentNav.path.length - 1].id : null;
  const subNavPath = currentNav.kind === 'subfolder' ? currentNav.path : [];

  const rawFiles: DBFile[] = useMemo(() => {
    if (!ws) return [];
    if (currentNav.kind === 'root') {
      // Vault racine : ses fichiers sont affichés à la racine, mélangés aux fichiers racine
      const vaultFiles = rootVault?.files ?? [];
      return [...ws.database.rootFiles, ...vaultFiles];
    }
    if (currentNav.kind === 'folder') return liveFolder?.files ?? [];
    return liveSub?.files ?? [];
  }, [ws, currentNav, liveFolder, liveSub, rootVault]);

  const displayedFiles = useMemo(() => sortFiles(rawFiles, sortKey, sortOrder), [rawFiles, sortKey, sortOrder]);

  const totalFiles = ws ? ws.database.rootFiles.length + ws.database.folders.reduce((acc, f) => acc + f.files.length + (f.subFolders ?? []).reduce((sa, s) => sa + s.files.length, 0), 0) : 0;


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
        const token = resolveGitHubToken(bot.connectedApps);
        if (!token) { showAlert('Jeton GitHub manquant', 'Configurez un Personal Access Token dans Builder ▸ Connecteurs.'); return; }
        const result = await importGitHubRepoAsVault(token, {
          id: meta.repoId || 0,
          full_name: meta.repoFullName,
          description: null,
          private: false,
          html_url: meta.path || '',
          default_branch: 'main',
        });
        updateFolder(wsId, folder.id, { repo: result.meta });
        syncFolderFromDisk(wsId, folder.id, result.files, result.dirs);
        showToast('Dépôt GitHub resynchronisé', { tone: 'success' });
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

  // ── Glisser-déposer ─────────────────────────────────────────────────
  const dragState = useDnDState();
  const handleFolderDrop = (target: DBFolder, item: DragItem) => {
    if (item.kind === 'file') {
      const { file, fromLoc } = item.data ?? {};
      if (file) void performMove(file, fromLoc ?? fileLocationOf(file), target.id);
      return;
    }
    if (item.kind === 'folder') {
      const src = item.data?.folder as DBFolder | undefined;
      if (!src || src.id === target.id) return;
      if (src.vault || src.repo) {
        showToast('Un vault ou un dépôt ne peut pas être déplacé', { tone: 'warning' });
        return;
      }
      moveFolderIntoFolder(wsId, src.id, target.id);
      // Miroir : un dossier applicatif déposé dans un vault/dépôt local y est écrit
      const tMeta = target.vault ?? target.repo;
      if (tMeta && canMirrorToDisk(tMeta)) {
        for (const f of src.files) {
          if (f.type === 'url') continue;
          const base = f.name.split('/').pop() ?? f.name;
          void vaultWriteFile(tMeta, `${src.name}/${base}`, f.content);
        }
      }
      showToast(`« ${src.name} » déplacé dans « ${target.name} »`, { tone: 'success' });
    }
  };

  const folderDropProps = (folder: DBFolder) => ({
    zoneId: `folder-drop-${folder.id}`,
    accepts: (item: DragItem) => {
      if (item.kind === 'file') return true;
      if (item.kind === 'folder') {
        return item.id !== folder.id
          && item.data?.parentFolderId !== folder.id
          && !(item.data?.folder && (item.data.folder.vault || item.data.folder.repo));
      }
      return false;
    },
    onDrop: (item: DragItem) => handleFolderDrop(folder, item),
  });

  const subDropProps = (folderId: string, sub: DBSubFolder) => ({
    zoneId: `sub-drop-${sub.id}`,
    accepts: (item: DragItem) => item.kind === 'file',
    onDrop: (item: DragItem) => {
      if (item.kind !== 'file') return;
      const { file, fromLoc } = item.data ?? {};
      if (file) void performMove(file, fromLoc ?? fileLocationOf(file), { folderId, subId: sub.id });
    },
  });

  const handleRootDrop = (item: DragItem) => {
    if (item.kind === 'file') {
      const { file, fromLoc } = item.data ?? {};
      if (!file) return;
      void performMove(file, fromLoc ?? fileLocationOf(file), null);
      showToast(`« ${file.name.split('/').pop()} » déplacé à la racine`, { tone: 'success' });
    } else if (item.kind === 'folder') {
      const data = item.data ?? {};
      if (!data.parentFolderId || !data.sub) return;
      const parent = wsFolders.find(f => f.id === data.parentFolderId);
      if (parent && !parent.vault && !parent.repo) {
        promoteSubFolder(wsId, parent.id, data.sub.id);
        showToast(`« ${data.sub.name} » est maintenant un dossier racine`, { tone: 'success' });
      } else {
        showToast('Un sous-dossier de vault/dépôt reste dans sa source', { tone: 'warning' });
      }
    }
  };

  const moveDestinations = useMemo(() => {
    if (!ws) return [] as { label: string; location: FileLocation; icon: string; color: string }[];
    const dests: { label: string; location: FileLocation; icon: string; color: string }[] = [
      { label: 'Racine', location: null, icon: 'home', color: C.accent },
    ];
    for (const folder of ws.database.folders) {
      dests.push({ label: folder.name, location: folder.id, icon: folder.icon || 'folder', color: folder.color });
      const walk = (subs: DBSubFolder[], parentLabel: string) => subs.forEach(s => {
        const label = `${parentLabel} / ${s.name}`;
        dests.push({
          label,
          location: { folderId: folder.id, subId: s.id },
          icon: s.icon || 'folder',
          color: s.color || folder.color,
        });
        walk(s.subFolders ?? [], label);
      });
      walk(folder.subFolders ?? [], folder.name);
    }
    return dests.filter(d => !locEquals(d.location, currentLocation));
  }, [ws, currentLocation, C.accent]);

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

  // ── Folder creation ──────────────────────────────────────────────
  const resetFolderForm = () => { setFolderName(''); setFolderDesc(''); setFolderColor(FOLDER_COLORS[0]); setFolderIcon(FOLDER_ICONS[0]); };

  const handleAddFolder = () => {
    if (!folderName.trim()) return;
    if (currentNav.kind === 'folder' && liveFolder) {
      addSubFolder(ws.id, liveFolder.id, { name: folderName.trim(), description: folderDesc.trim(), color: folderColor, icon: folderIcon });
      // Miroir : le sous-dossier existe réellement sur le disque (vault/dépôt local)
      const meta = liveFolder.vault ?? liveFolder.repo;
      if (meta && canMirrorToDisk(meta)) {
        void vaultMakeDir(meta, folderName.trim()).then(r => {
          if (!r.ok) showToast(`Disque : ${r.error ?? 'création impossible'}`, { tone: 'error' });
        });
      }
    } else if (currentNav.kind === 'subfolder' && liveFolder && currentSubId) {
      // Sous-dossier imbriqué (profondeur > 1)
      addSubFolder(ws.id, liveFolder.id, { name: folderName.trim(), description: folderDesc.trim(), color: folderColor, icon: folderIcon }, currentSubId);
      const meta = liveFolder.vault ?? liveFolder.repo;
      if (meta && canMirrorToDisk(meta)) {
        void vaultMakeDir(meta, `${navPrefix}${folderName.trim()}`).then(r => {
          if (!r.ok) showToast(`Disque : ${r.error ?? 'création impossible'}`, { tone: 'error' });
        });
      }
    } else {
      addFolder(ws.id, { name: folderName.trim(), description: folderDesc.trim(), color: folderColor, icon: folderIcon });
    }
    resetFolderForm(); setShowAddFolder(false); setShowAddSubFolder(false);
  };

  // ── File creation ─────────────────────────────────────────────────
  const resetFileForm = () => { setFileName(''); setFileType('note'); setFileContent(''); setFileTags(''); };

  const handleAddTextFile = () => {
    if (!fileName.trim() || !fileContent.trim()) return;
    const meta = metaAt(insertLocation);
    const mirror = !!meta && canMirrorToDisk(meta) && fileType !== 'url';
    const diskName = ensureVaultExt(fileName.trim(), fileType);
    const diskPath = mirror ? `${prefixOf(insertLocation)}${diskName}` : undefined;
    addFile(ws.id, insertLocation, { name: diskName, ...(diskPath ? { path: diskPath } : {}), type: fileType, content: fileContent.trim(), tags: fileTags.split(',').map(t => t.trim()).filter(Boolean) });
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
    addFile(ws.id, insertLocation, { name, type: 'url', content: linkUrl.trim(), tags: ['lien'] });
    setLinkUrl(''); setLinkName(''); setShowAddLink(false);
    showToast(`Lien « ${name} » ajouté`, { tone: 'success' });
  };

  const handlePickFile = async () => {
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
      const meta = metaAt(insertLocation);
      const mirror = !!meta && canMirrorToDisk(meta);
      const rawName = asset.name ?? 'fichier-importé';
      const diskPath = mirror ? `${prefixOf(insertLocation)}${rawName}` : undefined;
      addFile(ws.id, insertLocation, { name: rawName, ...(diskPath ? { path: diskPath } : {}), type: inferFileType(asset.mimeType, rawName), content, tags: ['importé'] });
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
      addFile(ws.id, insertLocation, { name: imgName, type: 'note', content: `[IMAGE: ${imgName}]\nDimensions: ${asset.width}x${asset.height}px\nURI: ${asset.uri}`, tags: ['image', 'importé'] });
      showToast(`Image « ${imgName} » ajoutée`, { tone: 'success' });
    } catch (error: any) { showAlert('Erreur', `Impossible d'importer: ${error.message ?? 'Erreur inconnue'}`); }
  };

  const handleOpenFileViewer = (file: DBFile) => {
    setViewingFile(file);
  };
  const handleOpenFileEditor = (file: DBFile) => {
    setViewingFile(null);
    setEditingFile(file); setEditorName(file.name); setEditorContent(file.content); setEditorTags(file.tags.join(', '));
  };
  const handleSaveFile = () => {
    if (!editingFile || !editorName.trim()) return;
    const loc = fileLocationOf(editingFile);
    const meta = metaAt(loc);
    const tags = editorTags.split(',').map(t => t.trim()).filter(Boolean);
    if (meta && canMirrorToDisk(meta) && editingFile.type !== 'url') {
      // Miroir : renommage + réécriture sur le disque, puis mise à jour de la base
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
  const handleDeleteFile = (file: DBFile) => {
    showAlert(`Supprimer "${file.name}" ?`, 'Ce fichier sera définitivement supprimé (base + disque si vault local).', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void deleteFileWithMirror(file); } },
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
          if (f) void deleteFileWithMirror(f);
        });
        exitSelectMode();
        showToast(`${n} fichier(s) supprimé(s)`, { tone: 'success' });
      }},
    ]);
  };
  const handleConfirmMove = (to: FileLocation) => {
    if (!movingFile) return;
    if (movingFile.id === '__bulk__' || (selectMode && selectedFileIds.size > 0 && selectedFileIds.has(movingFile.id))) {
      const ids = movingFile.id === '__bulk__' ? selectedFileIds : new Set([movingFile.id, ...selectedFileIds]);
      [...ids].filter(id => id !== '__bulk__').forEach(id => {
        const f = displayedFiles.find(x => x.id === id);
        if (f) void performMove(f, fileLocationOf(f), to);
      });
      const n = [...ids].filter(id => id !== '__bulk__').length;
      setMovingFile(null);
      exitSelectMode();
      showToast(`${n} fichier(s) déplacé(s)`, { tone: 'success' });
      return;
    }
    void performMove(movingFile, fileLocationOf(movingFile), to);
    const name = movingFile.name;
    setMovingFile(null);
    showToast(`« ${name} » déplacé`, { tone: 'success' });
  };
  const handleDeleteSubFolder = (folder: DBFolder, sub: DBSubFolder, prefix = '') => {
    showAlert(`Supprimer "${sub.name}" ?`, `${sub.files.length} fichier(s) seront supprimés (base + disque si vault local).`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => {
        // Miroir : suppression réelle du dossier sur le disque (vault/dépôt local)
        const meta = folder.vault ?? folder.repo;
        if (meta && canMirrorToDisk(meta)) {
          void vaultDeletePath(meta, `${prefix}${sub.name}`, true).then(r => {
            if (!r.ok) showToast(`Disque : ${r.error ?? 'suppression impossible'}`, { tone: 'error' });
          });
        }
        removeSubFolder(ws.id, folder.id, sub.id);
      }},
    ]);
  };

  // ── Renommage rapide (crayon) ──────────────────────────────────────
  const openRenameFile = (file: DBFile) => { setRenaming({ kind: 'file', file }); setRenameValue(baseOf(file.name)); };
  const openRenameFolder = (folder: DBFolder) => { setRenaming({ kind: 'folder', folder }); setRenameValue(folder.name); };
  const openRenameSub = (folderId: string, sub: DBSubFolder, prefix: string) => { setRenaming({ kind: 'sub', folderId, sub, prefix }); setRenameValue(sub.name); };
  const confirmRename = () => {
    if (!renaming || !renameValue.trim()) { setRenaming(null); return; }
    const newName = renameValue.trim();
    if (renaming.kind === 'file') {
      const file = renaming.file;
      const loc = fileLocationOf(file);
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
  const handleDeleteFolder = (folder: DBFolder) => {
    showAlert(`Supprimer "${folder.name}" ?`, `${folder.files.length} fichier(s) et ${folder.subFolders?.length ?? 0} sous-dossier(s) seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeFolder(ws.id, folder.id) },
    ]);
  };

  // ── Breadcrumb (fil d'Ariane, navigation profonde) ───────────────
  const breadcrumb: { label: string; go: () => void }[] = [];
  navStack.forEach((item, i) => {
    const truncate = () => setNavStack(navStack.slice(0, i + 1));
    if (item.kind === 'root') breadcrumb.push({ label: ws.name, go: truncate });
    else if (item.kind === 'folder') breadcrumb.push({ label: item.folder.name, go: truncate });
    else item.path.forEach((s, j) => breadcrumb.push({
      label: s.name,
      go: () => setNavStack([...navStack.slice(0, i), { kind: 'subfolder', folder: item.folder, path: item.path.slice(0, j + 1) }]),
    }));
  });

  // Liste unifiée : dossiers de la vue courante (dossiers racine, sous-dossiers
  // de dossier ou de sous-dossier) puis fichiers, dans le même défilement.
  const rootPlainFolders = currentNav.kind === 'root' ? ws.database.folders.filter(f => !f.vault && !f.repo) : [];
  const currentSubs: DBSubFolder[] =
    currentNav.kind === 'folder' ? (liveFolder?.subFolders ?? [])
    : currentNav.kind === 'subfolder' ? (liveSub?.subFolders ?? [])
    : (rootVault?.subFolders ?? []);
  const foldersInView = currentNav.kind === 'root' ? rootPlainFolders.length + currentSubs.length : currentSubs.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Top Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <IconButton icon="arrow-back" label="Retour" onPress={goBack} bare size={22} color={C.textPrimary} />
        <View style={{ flex: 1 }}>
          {/* Breadcrumb */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              {breadcrumb.map((crumb, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {i > 0 ? <MaterialIcons name="chevron-right" size={14} color={C.textMuted} /> : null}
                  <Pressable onPress={crumb.go}>
                    <Text style={{ fontSize: FontSize.body, color: i === breadcrumb.length - 1 ? C.textPrimary : C.textMuted, fontWeight: '600' }}>{crumb.label}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>
            {currentNav.kind === 'root'
              ? `${totalFiles} fichier(s) · ${ws.database.folders.length} dossier(s)`
              : currentNav.kind === 'folder'
                ? `${liveFolder?.files.length ?? 0} fichier(s) · ${liveFolder?.subFolders?.length ?? 0} sous-dossier(s)`
                : `${liveSub?.files.length ?? 0} fichier(s) · ${liveSub?.subFolders?.length ?? 0} sous-dossier(s)`
            }
          </Text>
        </View>
        {/* Insert toggle — visible à TOUTE profondeur ; popover en overlay plus bas */}
        <IconButton
          icon={showInsert ? 'close' : 'add-circle'}
          label="Insérer"
          onPress={() => setShowInsert(v => !v)}
          color={showInsert ? C.accent : C.primary}
          backgroundColor={showInsert ? C.accent + '18' : undefined}
          borderColor={showInsert ? C.accent + '55' : undefined}
        />

        {/* Add folder button — visible à TOUTE profondeur */}
        <IconButton
          icon="create-new-folder"
          label={currentNav.kind === 'root' ? 'Nouveau dossier' : 'Nouveau sous-dossier'}
          onPress={() => {
            resetFolderForm();
            if (currentNav.kind === 'root') setShowAddFolder(true);
            else setShowAddSubFolder(true);
          }}
          color={C.primary}
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {/* Vault racine du projet : barre compacte avec chemin éditable */}
        {currentNav.kind === 'root' && rootVault ? (
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
        ) : null}

        {/* Configuration du vault (uniquement s'il n'y en a pas encore) */}
        {currentNav.kind === 'root' && !rootVault ? (
          <VaultFolderPanel
            workspaceId={ws.id}
            folders={ws.database.folders}
            onOpenFolder={pushFolder}
            addVaultFolder={addVaultFolder}
            updateFolder={updateFolder}
            removeFolder={removeFolder}
            syncFolderFromDisk={syncFolderFromDisk}
          />
        ) : null}

        {/* Dépôts connectés (dossiers de code / GitHub) — bien séparés du vault */}
        {currentNav.kind === 'root' ? (
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
                onPress={() => pushFolder(folder)}
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
        ) : null}

        {/* Liste unifiée — dossiers puis fichiers dans le même défilement */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
          {/* Bande de dépôt vers la racine, visible pendant un glisser-déposer */}
          {dragState ? (
            <DropZone
              zoneId="strip-root"
              accepts={() => true}
              onDrop={handleRootDrop}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: C.accent + '66', borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, backgroundColor: C.accent + '10' }}
            >
              <MaterialIcons name="home" size={16} color={C.accent} />
              <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Déposer ici → Racine du workspace</Text>
            </DropZone>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap', gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              Contenu{displayedFiles.length + foldersInView > 0 ? ` (${foldersInView + displayedFiles.length})` : ''}
            </Text>
            {displayedFiles.length > 0 ? (
              <Pressable onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: selectMode ? C.accent + '66' : C.border, backgroundColor: selectMode ? C.accent + '18' : C.bgCardAlt }, pressed && { opacity: 0.75 }]}>
                <MaterialIcons name={selectMode ? 'close' : 'checklist'} size={14} color={selectMode ? C.accent : C.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: selectMode ? C.accent : C.textMuted, fontWeight: '700' }}>{selectMode ? 'Annuler' : 'Sélectionner'}</Text>
              </Pressable>
            ) : null}
          </View>
          {selectMode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
              <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textSecondary }}>{selectedFileIds.size} sélectionné(s)</Text>
              <Pressable
                onPress={() => {
                  if (selectedFileIds.size === 1) {
                    const id = [...selectedFileIds][0];
                    const f = displayedFiles.find(x => x.id === id);
                    if (f) setMovingFile(f);
                  } else if (selectedFileIds.size > 1) {
                    // Open move modal using a synthetic marker
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
          {/* Sort bar */}
          {rawFiles.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <SortBar sortKey={sortKey} sortOrder={sortOrder} onChange={handleSortChange} />
            </ScrollView>
          ) : null}

          {/* Dossiers / sous-dossiers de la vue courante */}
          {currentNav.kind === 'root' ? (
            <>
              {rootPlainFolders.map(folder => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  onPress={() => pushFolder(folder)}
                  onRename={() => openRenameFolder(folder)}
                  onDelete={() => handleDeleteFolder(folder)}
                  dragItem={{ kind: 'folder', id: folder.id, label: folder.name, icon: folder.icon, color: folder.color, data: { folder } }}
                  dropProps={folderDropProps(folder)}
                />
              ))}
              {currentSubs.map(sub => rootVault ? (
                <FolderCard
                  key={sub.id}
                  folder={sub}
                  onPress={() => pushSub(rootVault, [sub])}
                  onRename={() => openRenameSub(rootVault.id, sub, '')}
                  onDelete={() => handleDeleteSubFolder(rootVault, sub)}
                  dragItem={{ kind: 'folder', id: sub.id, label: sub.name, icon: sub.icon, color: sub.color, data: { parentFolderId: rootVault.id, sub, chainPrefix: '' } }}
                  dropProps={subDropProps(rootVault.id, sub)}
                />
              ) : null)}
            </>
          ) : null}
          {currentNav.kind === 'folder' && liveFolder ? (liveFolder.subFolders ?? []).map(sub => (
            <FolderCard
              key={sub.id}
              folder={sub}
              onPress={() => pushSub(liveFolder, [sub])}
              onRename={() => openRenameSub(liveFolder.id, sub, '')}
              onDelete={() => handleDeleteSubFolder(liveFolder, sub)}
              dragItem={{ kind: 'folder', id: sub.id, label: sub.name, icon: sub.icon, color: sub.color, data: { parentFolderId: liveFolder.id, sub, chainPrefix: '' } }}
              dropProps={subDropProps(liveFolder.id, sub)}
            />
          )) : null}
          {currentNav.kind === 'subfolder' && liveFolder ? (liveSub?.subFolders ?? []).map(sub => (
            <FolderCard
              key={sub.id}
              folder={sub}
              onPress={() => pushSub(liveFolder, [...subNavPath, sub])}
              onRename={() => openRenameSub(liveFolder.id, sub, navPrefix)}
              onDelete={() => handleDeleteSubFolder(liveFolder, sub, navPrefix)}
              dragItem={{ kind: 'folder', id: sub.id, label: sub.name, icon: sub.icon, color: sub.color, data: { parentFolderId: liveFolder.id, sub, chainPrefix: navPrefix } }}
              dropProps={subDropProps(liveFolder.id, sub)}
            />
          )) : null}

          {/* Fichiers de la vue courante */}
          {displayedFiles.length === 0 && foldersInView === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md }}>
              <MaterialIcons name="folder-open" size={40} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '600' }}>Aucun fichier</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>Créez une note, importez un fichier ou ajoutez un lien</Text>
            </View>
          ) : (
            displayedFiles.map(file => (
              <FileRow
                key={file.id}
                file={file}
                onPress={() => handleOpenFileViewer(file)}
                onRename={() => openRenameFile(file)}
                onMove={() => setMovingFile(file)}
                onDelete={() => handleDeleteFile(file)}
                selectMode={selectMode}
                selected={selectedFileIds.has(file.id)}
                dragItem={{
                  kind: 'file',
                  id: file.id,
                  label: file.name,
                  icon: getFileTypeInfo(file.type).icon,
                  color: getFileTypeInfo(file.type).color,
                  data: { file, fromLoc: fileLocationOf(file) },
                }}
                onToggleSelect={() => {
                  if (!selectMode) setSelectMode(true);
                  toggleSelectFile(file.id);
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ─── Popover « Insérer » : overlay plein écran (au-dessus du contenu scrollé) */}
      {showInsert ? (
        <View style={{ position: 'absolute', inset: 0, zIndex: 300 }} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={() => setShowInsert(false)} />
          <View style={{ position: 'absolute', top: 84, right: Spacing.md, flexDirection: 'row', gap: Spacing.sm, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.sm, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 }}>
            {[
              { icon: 'edit-note', label: 'Texte', color: '#FFB800', onPress: () => { setShowInsert(false); resetFileForm(); setShowAddFile(true); } },
              { icon: 'upload-file', label: 'Fichier', color: '#3D7EFF', onPress: () => { setShowInsert(false); handlePickFile(); } },
              { icon: 'image', label: 'Image', color: '#00CC6A', onPress: () => { setShowInsert(false); handlePickImage(); } },
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

      {/* Fantôme du glisser-déposer */}
      <DragLayer />

      {/* ─── Renommage rapide (fichier / dossier / sous-dossier) ──── */}
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
              style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }}
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
                {moveDestinations.length === 0 ? (
                  <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center', paddingVertical: Spacing.lg }}>
                    Aucune autre destination disponible. Créez un dossier pour déplacer ce fichier.
                  </Text>
                ) : (
                  moveDestinations.map((dest, i) => (
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
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Add Folder / Sub-folder Modal ────────────────────────── */}
      <Modal visible={showAddFolder || showAddSubFolder} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <MaterialIcons name="create-new-folder" size={20} color={C.accent} />
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>
                  {showAddSubFolder ? 'Nouveau sous-dossier' : 'Nouveau dossier'}
                </Text>
              </View>
              <Pressable onPress={() => { setShowAddFolder(false); setShowAddSubFolder(false); }} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={folderName} onChangeText={setFolderName} placeholder="Ex: Références..." placeholderTextColor={C.textMuted} autoFocus />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Description</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={folderDesc} onChangeText={setFolderDesc} placeholder="Contenu..." placeholderTextColor={C.textMuted} />
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
            </ScrollView>
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
            {/* Handle */}
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md }} />
            {/* Header row */}
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
                  onPress={() => viewingFile && handleOpenFileEditor(viewingFile)}
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
            {/* Meta */}
            {viewingFile ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.sm }}>
                <View style={{ backgroundColor: getFileTypeInfo(viewingFile.type).color + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill }}>
                  <Text style={{ fontSize: FontSize.xs, color: getFileTypeInfo(viewingFile.type).color, fontWeight: '700' }}>{getFileTypeInfo(viewingFile.type).label}</Text>
                </View>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{formatSize(viewingFile.size)}</Text>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{formatDate(viewingFile.updatedAt)}</Text>
                {viewingFile.tags.map(tag => (
                  <View key={tag} style={{ backgroundColor: C.bgCardAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 10, color: C.textMuted }}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {/* Content */}
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
