// Powered by OnSpace.AI
// Workspace Database — sub-folders + file sorting system
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { VaultFolderPanel } from '@/components/feature/VaultFolderPanel';
import { IconButton } from '@/components/ui/IconButton';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useAlert } from '@/template';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { DBFile, DBFolder, DBSubFolder, FileLocation } from '@/contexts/WorkspaceContext';

// ─── Types ───────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'date' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

// Navigation stack item
type NavItem =
  | { kind: 'root' }
  | { kind: 'folder'; folder: DBFolder }
  | { kind: 'subfolder'; folder: DBFolder; sub: DBSubFolder };

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
function FileRow({ file, onPress, onDelete }: { file: DBFile; onPress: () => void; onDelete: () => void }) {
  const C = useThemeColors();
  const info = getFileTypeInfo(file.type);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }, pressed && { opacity: 0.75 }]}>
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
      <Pressable onPress={onDelete} hitSlop={12} style={{ padding: Spacing.xs, marginTop: 2 }}>
        <MaterialIcons name="delete-outline" size={18} color={C.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function FolderCard({ folder, onPress, onDelete }: { folder: DBFolder | DBSubFolder; onPress: () => void; onDelete: () => void }) {
  const C = useThemeColors();
  const subCount = (folder as DBFolder).subFolders?.length ?? 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: folder.color + '44', padding: Spacing.md }, pressed && { opacity: 0.8 }]}>
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
        <Pressable onPress={onDelete} hitSlop={10} style={{ padding: Spacing.xs }}>
          <MaterialIcons name="delete-outline" size={16} color={C.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function InsertBar({ onText, onFile, onImage, onLink }: { onText: () => void; onFile: () => void; onImage: () => void; onLink: () => void }) {
  const btns = [
    { icon: 'edit-note' as const, label: 'Texte', onPress: onText, color: '#FFB800' },
    { icon: 'upload-file' as const, label: 'Fichier', onPress: onFile, color: '#3D7EFF' },
    { icon: 'image' as const, label: 'Image', onPress: onImage, color: '#00CC6A' },
    { icon: 'link' as const, label: 'Lien', onPress: onLink, color: '#9B59B6' },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.sm, justifyContent: 'space-between' }}>
      {btns.map(b => (
        <View key={b.label} style={{ flex: 1, alignItems: 'center' }}>
          <IconButton
            icon={b.icon}
            label={b.label}
            onPress={b.onPress}
            color={b.color}
            backgroundColor={b.color + '12'}
            borderColor={b.color + '44'}
            boxSize={44}
            size={22}
          />
        </View>
      ))}
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
    addSubFolder, removeSubFolder,
    addFile, updateFile, removeFile,
  } = useWorkspace();
  const { showAlert } = useAlert();
  const router = useRouter();
  const C = useThemeColors();

  const ws = workspaces.find(w => w.id === wsId);

  // ── Navigation stack ─────────────────────────────────────────────
  const [navStack, setNavStack] = useState<NavItem[]>([{ kind: 'root' }]);
  const currentNav = navStack[navStack.length - 1];

  const pushFolder = (folder: DBFolder) => setNavStack(prev => [...prev, { kind: 'folder', folder }]);
  const pushSubFolder = (folder: DBFolder, sub: DBSubFolder) => setNavStack(prev => [...prev, { kind: 'subfolder', folder, sub }]);
  const goBack = () => {
    if (navStack.length > 1) setNavStack(prev => prev.slice(0, -1));
    else router.back();
  };

  // ── Sorting ──────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const handleSortChange = (k: SortKey, o: SortOrder) => { setSortKey(k); setSortOrder(o); };

  // ── Modal state ──────────────────────────────────────────────────
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddSubFolder, setShowAddSubFolder] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [editingFile, setEditingFile] = useState<DBFile | null>(null);
  const [viewingFile, setViewingFile] = useState<DBFile | null>(null);

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
    return { folderId: currentNav.folder.id, subId: currentNav.sub.id };
  }, [currentNav]);

  // Keep folder/subfolder references fresh from ws state
  const liveFolder = currentNav.kind !== 'root' ? ws?.database.folders.find(f => f.id === (currentNav as any).folder.id) ?? null : null;
  const liveSub = currentNav.kind === 'subfolder' && liveFolder ? liveFolder.subFolders?.find(s => s.id === (currentNav as any).sub.id) ?? null : null;

  const rawFiles: DBFile[] = useMemo(() => {
    if (!ws) return [];
    if (currentNav.kind === 'root') return ws.database.rootFiles;
    if (currentNav.kind === 'folder') return liveFolder?.files ?? [];
    return liveSub?.files ?? [];
  }, [ws, currentNav, liveFolder, liveSub]);

  const displayedFiles = useMemo(() => sortFiles(rawFiles, sortKey, sortOrder), [rawFiles, sortKey, sortOrder]);

  const totalFiles = ws ? ws.database.rootFiles.length + ws.database.folders.reduce((acc, f) => acc + f.files.length + (f.subFolders ?? []).reduce((sa, s) => sa + s.files.length, 0), 0) : 0;


  const replaceFolderFiles = (workspaceId: string, folderId: string, files: { name: string; type: any; content: string; tags: string[] }[]) => {
    const targetWs = workspaces.find(w => w.id === workspaceId);
    if (!targetWs) return;
    let fid = folderId;
    if (folderId === '__latest_vault__') {
      const vaults = targetWs.database.folders.filter(f => f.vault);
      const latest = vaults[vaults.length - 1];
      if (!latest) return;
      fid = latest.id;
    }
    // Clear then re-add — removeFile/addFile via updateFolder files array
    updateFolder(workspaceId, fid, {
      files: files.map((f, i) => ({
        id: `file-vault-${Date.now()}-${i}`,
        name: f.name,
        type: f.type,
        content: f.content,
        tags: f.tags,
        size: f.content.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    } as any);
  };

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
    } else {
      addFolder(ws.id, { name: folderName.trim(), description: folderDesc.trim(), color: folderColor, icon: folderIcon });
    }
    resetFolderForm(); setShowAddFolder(false); setShowAddSubFolder(false);
  };

  // ── File creation ─────────────────────────────────────────────────
  const resetFileForm = () => { setFileName(''); setFileType('note'); setFileContent(''); setFileTags(''); };

  const handleAddTextFile = () => {
    if (!fileName.trim() || !fileContent.trim()) return;
    addFile(ws.id, currentLocation, { name: fileName.trim(), type: fileType, content: fileContent.trim(), tags: fileTags.split(',').map(t => t.trim()).filter(Boolean) });
    resetFileForm(); setShowAddFile(false);
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    const name = linkName.trim() || linkUrl.trim();
    addFile(ws.id, currentLocation, { name, type: 'url', content: linkUrl.trim(), tags: ['lien'] });
    setLinkUrl(''); setLinkName(''); setShowAddLink(false);
    showAlert('Lien ajouté', `"${name}" a été ajouté à votre base de données.`);
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
      addFile(ws.id, currentLocation, { name: asset.name ?? 'fichier-importé', type: inferFileType(asset.mimeType, asset.name ?? ''), content, tags: ['importé'] });
      showAlert('Fichier importé', `"${asset.name}" a été ajouté.`);
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
      addFile(ws.id, currentLocation, { name: imgName, type: 'note', content: `[IMAGE: ${imgName}]\nDimensions: ${asset.width}x${asset.height}px\nURI: ${asset.uri}`, tags: ['image', 'importé'] });
      showAlert('Image ajoutée', `"${imgName}" a été ajoutée.`);
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
    updateFile(ws.id, currentLocation, editingFile.id, { name: editorName.trim(), content: editorContent, tags: editorTags.split(',').map(t => t.trim()).filter(Boolean) });
    setEditingFile(null);
  };
  const handleDeleteFile = (file: DBFile) => {
    showAlert(`Supprimer "${file.name}" ?`, 'Ce fichier sera définitivement supprimé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeFile(ws.id, currentLocation, file.id) },
    ]);
  };
  const handleDeleteFolder = (folder: DBFolder) => {
    showAlert(`Supprimer "${folder.name}" ?`, `${folder.files.length} fichier(s) et ${folder.subFolders?.length ?? 0} sous-dossier(s) seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeFolder(ws.id, folder.id) },
    ]);
  };
  const handleDeleteSubFolder = (folder: DBFolder, sub: DBSubFolder) => {
    showAlert(`Supprimer "${sub.name}" ?`, `${sub.files.length} fichier(s) seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeSubFolder(ws.id, folder.id, sub.id) },
    ]);
  };

  // ── Breadcrumb label ─────────────────────────────────────────────
  const breadcrumb = navStack.map((item, i) => {
    if (item.kind === 'root') return ws.name;
    if (item.kind === 'folder') return item.folder.name;
    return item.sub.name;
  });

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
                  <Pressable onPress={() => setNavStack(navStack.slice(0, i + 1))}>
                    <Text style={{ fontSize: FontSize.body, color: i === breadcrumb.length - 1 ? C.textPrimary : C.textMuted, fontWeight: '600' }}>{crumb}</Text>
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
                : `${liveSub?.files.length ?? 0} fichier(s)`
            }
          </Text>
        </View>
        {/* Add folder button */}
        {currentNav.kind !== 'subfolder' ? (
          <IconButton
            icon="create-new-folder"
            label={currentNav.kind === 'folder' ? 'Nouveau sous-dossier' : 'Nouveau dossier'}
            onPress={() => {
              resetFolderForm();
              if (currentNav.kind === 'folder') setShowAddSubFolder(true);
              else setShowAddFolder(true);
            }}
            color={C.primary}
          />
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {/* Stats (root only) */}
        {currentNav.kind === 'root' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: ws.color + '33', backgroundColor: ws.color + '0A', padding: Spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: ws.color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name={ws.icon as any} size={18} color={ws.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>Base de données — {ws.name}</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }}>{ws.database.folders.length} dossier(s) · {totalFiles} fichier(s)</Text>
            </View>
          </View>
        ) : null}

        {/* Insert Bar */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Insérer</Text>
          <InsertBar
            onText={() => { resetFileForm(); setShowAddFile(true); }}
            onFile={handlePickFile}
            onImage={handlePickImage}
            onLink={() => { setLinkUrl(''); setLinkName(''); setShowAddLink(true); }}
          />
        </View>

        {/* Vault folders */}
        {currentNav.kind === 'root' ? (
          <VaultFolderPanel
            workspaceId={ws.id}
            folders={ws.database.folders}
            onOpenFolder={pushFolder}
            addVaultFolder={addVaultFolder}
            updateFolder={updateFolder}
            removeFolder={removeFolder}
            replaceFolderFiles={replaceFolderFiles}
          />
        ) : null}

        {/* Folders (root level) — non-vault */}
        {currentNav.kind === 'root' && ws.database.folders.filter(f => !f.vault).length > 0 ? (
          <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Dossiers</Text>
            {ws.database.folders.filter(f => !f.vault).map(folder => (
              <FolderCard key={folder.id} folder={folder} onPress={() => pushFolder(folder)} onDelete={() => handleDeleteFolder(folder)} />
            ))}
          </View>
        ) : null}

        {/* Sub-folders (inside a folder) */}
        {currentNav.kind === 'folder' && liveFolder && (liveFolder.subFolders?.length ?? 0) > 0 ? (
          <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 }}>
              <MaterialIcons name="account-tree" size={14} color={C.textSecondary} />
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Sous-dossiers</Text>
            </View>
            {(liveFolder.subFolders ?? []).map(sub => (
              <FolderCard key={sub.id} folder={sub} onPress={() => pushSubFolder(liveFolder, sub)} onDelete={() => handleDeleteSubFolder(liveFolder, sub)} />
            ))}
          </View>
        ) : null}

        {/* Files with sort bar */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap', gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              {currentNav.kind === 'root' ? 'Fichiers racine' : 'Fichiers'}
              {displayedFiles.length > 0 ? ` (${displayedFiles.length})` : ''}
            </Text>
          </View>
          {/* Sort bar */}
          {rawFiles.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <SortBar sortKey={sortKey} sortOrder={sortOrder} onChange={handleSortChange} />
            </ScrollView>
          ) : null}
          {displayedFiles.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md }}>
              <MaterialIcons name="folder-open" size={40} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '600' }}>Aucun fichier</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>Créez une note, importez un fichier ou ajoutez un lien</Text>
            </View>
          ) : (
            displayedFiles.map(file => (
              <FileRow key={file.id} file={file} onPress={() => handleOpenFileViewer(file)} onDelete={() => handleDeleteFile(file)} />
            ))
          )}
        </View>
      </ScrollView>

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
