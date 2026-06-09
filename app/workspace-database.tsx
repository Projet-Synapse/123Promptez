// Powered by OnSpace.AI
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useAlert } from '@/template';
import * as DocumentPicker from 'expo-document-picker';
import type { DBFile, DBFolder } from '@/contexts/WorkspaceContext';

// ─── Constants ────────────────────────────────────────────────────────────────
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

function getFileTypeInfo(type: DBFile['type']) {
  return FILE_TYPES.find(t => t.id === type) ?? FILE_TYPES[0];
}

function formatSize(size: number): string {
  if (size < 1000) return `${size} c`;
  return `${(size / 1000).toFixed(1)} Ko`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function inferFileType(mimeType: string | undefined, name: string): DBFile['type'] {
  if (!mimeType && !name) return 'text';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'json') return 'json';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'swift', 'kt', 'go', 'rs', 'cpp', 'c', 'cs'].includes(ext)) return 'code';
  if (mimeType?.startsWith('text/')) return 'text';
  return 'text';
}

// ─── File Row Component ───────────────────────────────────────────────────────
function FileRow({ file, onPress, onDelete }: { file: DBFile; onPress: () => void; onDelete: () => void }) {
  const C = useThemeColors();
  const info = getFileTypeInfo(file.type);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }, pressed && { opacity: 0.75 }]}
    >
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

// ─── Folder Card Component ────────────────────────────────────────────────────
function FolderCard({ folder, onPress, onDelete }: { folder: DBFolder; onPress: () => void; onDelete: () => void }) {
  const C = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: folder.color + '44', padding: Spacing.md }, pressed && { opacity: 0.8 }]}
    >
      <View style={{ width: 46, height: 46, borderRadius: Radius.sm, backgroundColor: folder.color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name={folder.icon as any} size={26} color={folder.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{folder.name}</Text>
        <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }} numberOfLines={1}>{folder.description || 'Aucune description'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <MaterialIcons name="insert-drive-file" size={12} color={C.textMuted} />
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{folder.files.length} fichier{folder.files.length !== 1 ? 's' : ''}</Text>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WorkspaceDatabaseScreen() {
  const insets = useSafeAreaInsets();
  const { wsId } = useLocalSearchParams<{ wsId: string }>();
  const { workspaces, addFolder, updateFolder, removeFolder, addFile, updateFile, removeFile } = useWorkspace();
  const { showAlert } = useAlert();
  const router = useRouter();
  const C = useThemeColors();

  const ws = workspaces.find(w => w.id === wsId);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [editingFile, setEditingFile] = useState<DBFile | null>(null);
  const [showFileEditor, setShowFileEditor] = useState(false);

  // New folder form
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);
  const [folderIcon, setFolderIcon] = useState(FOLDER_ICONS[0]);

  // New file form
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<DBFile['type']>('note');
  const [fileContent, setFileContent] = useState('');
  const [fileTags, setFileTags] = useState('');

  // File editor
  const [editorName, setEditorName] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorTags, setEditorTags] = useState('');

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

  const currentFolder = currentFolderId ? ws.database.folders.find(f => f.id === currentFolderId) ?? null : null;
  const displayedFiles = currentFolderId ? (currentFolder?.files ?? []) : ws.database.rootFiles;
  const totalFiles = ws.database.rootFiles.length + ws.database.folders.reduce((acc, f) => acc + f.files.length, 0);

  const resetFolderForm = () => { setFolderName(''); setFolderDesc(''); setFolderColor(FOLDER_COLORS[0]); setFolderIcon(FOLDER_ICONS[0]); };
  const handleAddFolder = () => {
    if (!folderName.trim()) return;
    addFolder(ws.id, { name: folderName.trim(), description: folderDesc.trim(), color: folderColor, icon: folderIcon });
    resetFolderForm();
    setShowAddFolder(false);
  };

  const handleDeleteFolder = (folder: DBFolder) => {
    showAlert(`Supprimer "${folder.name}" ?`, `Ce dossier et ses ${folder.files.length} fichier(s) seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeFolder(ws.id, folder.id) },
    ]);
  };

  const resetFileForm = () => { setFileName(''); setFileType('note'); setFileContent(''); setFileTags(''); };

  const handleAddFile = () => {
    if (!fileName.trim() || !fileContent.trim()) return;
    addFile(ws.id, currentFolderId, {
      name: fileName.trim(),
      type: fileType,
      content: fileContent.trim(),
      tags: fileTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    resetFileForm();
    setShowAddFile(false);
  };

  // ─── File Picker ────────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/json', 'application/javascript', 'application/typescript', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const pickedName = asset.name ?? 'fichier-importé';
      const mimeType = asset.mimeType;

      // Read file content — works for text files via fetch
      let content = '';
      try {
        const response = await fetch(asset.uri);
        content = await response.text();
        // Truncate very large files
        if (content.length > 50000) {
          content = content.slice(0, 50000) + '\n\n[... Fichier tronqué à 50 000 caractères]';
        }
      } catch {
        content = `[Fichier importé: ${pickedName}]\n(Contenu binaire non lisible directement)`;
      }

      const inferredType = inferFileType(mimeType, pickedName);

      addFile(ws.id, currentFolderId, {
        name: pickedName,
        type: inferredType,
        content,
        tags: ['importé'],
      });

      showAlert('Fichier importé', `"${pickedName}" a été ajouté à votre base de données.`);
    } catch (error: any) {
      showAlert('Erreur', `Impossible d'importer le fichier : ${error.message ?? 'Erreur inconnue'}`);
    }
  };

  const handleOpenFileEditor = (file: DBFile) => {
    setEditingFile(file);
    setEditorName(file.name);
    setEditorContent(file.content);
    setEditorTags(file.tags.join(', '));
    setShowFileEditor(true);
  };

  const handleSaveFile = () => {
    if (!editingFile || !editorName.trim()) return;
    updateFile(ws.id, currentFolderId, editingFile.id, {
      name: editorName.trim(),
      content: editorContent,
      tags: editorTags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setShowFileEditor(false);
    setEditingFile(null);
  };

  const handleDeleteFile = (file: DBFile) => {
    showAlert(`Supprimer "${file.name}" ?`, 'Ce fichier sera définitivement supprimé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeFile(ws.id, currentFolderId, file.id) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Top Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Pressable onPress={() => { if (currentFolderId) { setCurrentFolderId(null); } else { router.back(); } }} hitSlop={8} style={{ padding: Spacing.xs }}>
          <MaterialIcons name="arrow-back" size={22} color={C.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable onPress={() => setCurrentFolderId(null)}>
              <Text style={{ fontSize: FontSize.body, color: currentFolderId ? C.textMuted : C.textPrimary, fontWeight: '600' }}>{ws.name}</Text>
            </Pressable>
            {currentFolder ? (
              <>
                <MaterialIcons name="chevron-right" size={14} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }}>{currentFolder.name}</Text>
              </>
            ) : null}
          </View>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>
            {currentFolder
              ? `${currentFolder.files.length} fichier${currentFolder.files.length !== 1 ? 's' : ''}`
              : `${totalFiles} fichier${totalFiles !== 1 ? 's' : ''} · ${ws.database.folders.length} dossier${ws.database.folders.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
          {currentFolderId === null ? (
            <Pressable onPress={() => { resetFolderForm(); setShowAddFolder(true); }} style={({ pressed }) => [{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="create-new-folder" size={20} color={C.primary} />
            </Pressable>
          ) : null}
          {/* Import from storage button */}
          <Pressable onPress={handlePickFile} style={({ pressed }) => [{ height: 36, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="upload-file" size={18} color={C.primary} />
            <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '600' }}>Importer</Text>
          </Pressable>
          <Pressable onPress={() => { resetFileForm(); setShowAddFile(true); }} style={({ pressed }) => [{ height: 36, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: C.accent, borderWidth: 1, borderColor: C.accent, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="add" size={18} color={C.bg} />
            <Text style={{ fontSize: FontSize.sm, color: C.bg, fontWeight: '700' }}>Fichier</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats banner */}
        {currentFolderId === null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: ws.color + '33', backgroundColor: ws.color + '0A', padding: Spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: ws.color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name={ws.icon as any} size={18} color={ws.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>Base de données — {ws.name}</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }}>
                {ws.database.folders.length} dossier{ws.database.folders.length !== 1 ? 's' : ''} · {totalFiles} fichier{totalFiles !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Folders */}
        {currentFolderId === null && ws.database.folders.length > 0 ? (
          <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
              Dossiers
            </Text>
            {ws.database.folders.map(folder => (
              <FolderCard key={folder.id} folder={folder} onPress={() => setCurrentFolderId(folder.id)} onDelete={() => handleDeleteFolder(folder)} />
            ))}
          </View>
        ) : null}

        {/* Files */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
            {currentFolderId ? 'Fichiers du dossier' : 'Fichiers racine'}
          </Text>
          {displayedFiles.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md }}>
              <MaterialIcons name="folder-open" size={40} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '600' }}>Aucun fichier</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>Créez une note, importez un fichier ou ajoutez une URL</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Pressable onPress={handlePickFile} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary + '22', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.primary + '44' }, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="upload-file" size={15} color={C.primary} />
                  <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '700' }}>Importer</Text>
                </Pressable>
                <Pressable onPress={() => { resetFileForm(); setShowAddFile(true); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accent, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill }, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="add" size={15} color={C.bg} />
                  <Text style={{ fontSize: FontSize.sm, color: C.bg, fontWeight: '700' }}>Nouveau fichier</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            displayedFiles.map(file => (
              <FileRow key={file.id} file={file} onPress={() => handleOpenFileEditor(file)} onDelete={() => handleDeleteFile(file)} />
            ))
          )}
        </View>

        {/* File type legend */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Types de fichiers</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {FILE_TYPES.map(t => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialIcons name={t.icon as any} size={14} color={t.color} />
                <Text style={{ fontSize: FontSize.xs, color: C.textSecondary }}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ─── Add Folder Modal ─────────────────────────────────────────── */}
      <Modal visible={showAddFolder} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Nouveau dossier</Text>
              <Pressable onPress={() => setShowAddFolder(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom du dossier</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={folderName} onChangeText={setFolderName} placeholder="Ex: Références, Projets..." placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Description (optionnel)</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={folderDesc} onChangeText={setFolderDesc} placeholder="Contenu de ce dossier..." placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Couleur</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {FOLDER_COLORS.map(c => (
                      <Pressable key={c} onPress={() => setFolderColor(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: folderColor === c ? 3 : 0, borderColor: '#fff' }} />
                    ))}
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
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Créer le dossier</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Add File Modal ───────────────────────────────────────────── */}
      <Modal visible={showAddFile} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Nouveau fichier{currentFolder ? ` — ${currentFolder.name}` : ''}</Text>
              <Pressable onPress={() => setShowAddFile(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
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
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom du fichier</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={fileName} onChangeText={setFileName} placeholder={fileType === 'url' ? 'https://...' : fileType === 'code' ? 'utils.ts' : 'Mon fichier...'} placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Tags (séparés par virgule)</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={fileTags} onChangeText={setFileTags} placeholder="api, référence, important..." placeholderTextColor={C.textMuted} />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Contenu</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: (fileType === 'code' || fileType === 'json') ? C.textMono : C.textPrimary, fontSize: (fileType === 'code' || fileType === 'json') ? FontSize.sm : FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 120, textAlignVertical: 'top', paddingTop: Spacing.sm, fontFamily: (fileType === 'code' || fileType === 'json') ? 'monospace' : undefined }} value={fileContent} onChangeText={setFileContent} placeholder={fileType === 'url' ? 'https://docs.example.com/...' : fileType === 'json' ? '{\n  "key": "value"\n}' : fileType === 'code' ? '// Code ici...' : fileType === 'markdown' ? '# Titre\n\nContenu...' : 'Écrivez votre contenu ici...'} placeholderTextColor={C.textMuted} multiline textAlignVertical="top" />
                </View>
                {/* Import from storage shortcut */}
                <Pressable onPress={() => { setShowAddFile(false); setTimeout(handlePickFile, 300); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.primary + '15', borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, borderWidth: 1, borderColor: C.primary + '33' }, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="upload-file" size={16} color={C.primary} />
                  <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '600' }}>Ou importer depuis le stockage</Text>
                </Pressable>
              </View>
            </ScrollView>
            <Pressable onPress={handleAddFile} disabled={!fileName.trim() || !fileContent.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: (!fileName.trim() || !fileContent.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="add-circle" size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Ajouter le fichier</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── File Editor Modal ────────────────────────────────────────── */}
      <Modal visible={showFileEditor} transparent animationType="slide">
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
              <Pressable onPress={() => setShowFileEditor(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
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
                    <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{editorContent.length} caractères</Text>
                  </View>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: editingFile && (editingFile.type === 'code' || editingFile.type === 'json') ? C.textMono : C.textPrimary, fontSize: editingFile && (editingFile.type === 'code' || editingFile.type === 'json') ? FontSize.sm : FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 220, textAlignVertical: 'top', paddingTop: Spacing.sm, fontFamily: editingFile && (editingFile.type === 'code' || editingFile.type === 'json') ? 'monospace' : undefined }} value={editorContent} onChangeText={setEditorContent} multiline textAlignVertical="top" placeholderTextColor={C.textMuted} />
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
