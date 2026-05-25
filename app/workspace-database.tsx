// Powered by OnSpace.AI
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useAlert } from '@/template';
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

// ─── File Row Component ───────────────────────────────────────────────────────
function FileRow({
  file,
  onPress,
  onDelete,
}: {
  file: DBFile;
  onPress: () => void;
  onDelete: () => void;
}) {
  const info = getFileTypeInfo(file.type);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fileRow, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.fileIcon, { backgroundColor: info.color + '22' }]}>
        <MaterialIcons name={info.icon as any} size={18} color={info.color} />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
        <View style={styles.fileMeta}>
          <View style={[styles.fileTypeBadge, { backgroundColor: info.color + '18' }]}>
            <Text style={[styles.fileTypeText, { color: info.color }]}>{info.label}</Text>
          </View>
          <Text style={styles.fileSize}>{formatSize(file.size)}</Text>
          <Text style={styles.fileDate}>{formatDate(file.updatedAt)}</Text>
        </View>
        {file.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {file.tags.slice(0, 3).map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Pressable onPress={onDelete} hitSlop={12} style={styles.deleteBtn}>
        <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
      </Pressable>
    </Pressable>
  );
}

// ─── Folder Card Component ────────────────────────────────────────────────────
function FolderCard({
  folder,
  onPress,
  onDelete,
}: {
  folder: DBFolder;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.folderCard, { borderColor: folder.color + '44' }, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.folderIcon, { backgroundColor: folder.color + '22' }]}>
        <MaterialIcons name={folder.icon as any} size={26} color={folder.color} />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.folderDesc} numberOfLines={1}>{folder.description || 'Aucune description'}</Text>
        <View style={styles.folderMeta}>
          <MaterialIcons name="insert-drive-file" size={12} color={Colors.textMuted} />
          <Text style={styles.folderMetaText}>{folder.files.length} fichier{folder.files.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      <View style={styles.folderActions}>
        <MaterialIcons name="chevron-right" size={22} color={folder.color} />
        <Pressable onPress={onDelete} hitSlop={10} style={styles.folderDeleteBtn}>
          <MaterialIcons name="delete-outline" size={16} color={Colors.textMuted} />
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

  const ws = workspaces.find(w => w.id === wsId);

  // Navigation state: null = root, string = folderId
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Modal states
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Workspace introuvable</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentFolder = currentFolderId
    ? ws.database.folders.find(f => f.id === currentFolderId) ?? null
    : null;

  const displayedFiles = currentFolderId
    ? (currentFolder?.files ?? [])
    : ws.database.rootFiles;

  const totalFiles =
    ws.database.rootFiles.length + ws.database.folders.reduce((acc, f) => acc + f.files.length, 0);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const resetFolderForm = () => {
    setFolderName('');
    setFolderDesc('');
    setFolderColor(FOLDER_COLORS[0]);
    setFolderIcon(FOLDER_ICONS[0]);
  };

  const handleAddFolder = () => {
    if (!folderName.trim()) return;
    addFolder(ws.id, {
      name: folderName.trim(),
      description: folderDesc.trim(),
      color: folderColor,
      icon: folderIcon,
    });
    resetFolderForm();
    setShowAddFolder(false);
  };

  const handleDeleteFolder = (folder: DBFolder) => {
    showAlert(
      `Supprimer "${folder.name}" ?`,
      `Ce dossier et ses ${folder.files.length} fichier(s) seront supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeFolder(ws.id, folder.id) },
      ]
    );
  };

  const resetFileForm = () => {
    setFileName('');
    setFileType('note');
    setFileContent('');
    setFileTags('');
  };

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
    showAlert(
      `Supprimer "${file.name}" ?`,
      'Ce fichier sera définitivement supprimé.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeFile(ws.id, currentFolderId, file.id) },
      ]
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (currentFolderId) {
              setCurrentFolderId(null);
            } else {
              router.back();
            }
          }}
          hitSlop={8}
          style={styles.backIconBtn}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>

        <View style={{ flex: 1 }}>
          {/* Breadcrumb */}
          <View style={styles.breadcrumb}>
            <Pressable onPress={() => setCurrentFolderId(null)}>
              <Text style={[styles.breadcrumbItem, !currentFolderId && styles.breadcrumbActive]}>
                {ws.name}
              </Text>
            </Pressable>
            {currentFolder ? (
              <>
                <MaterialIcons name="chevron-right" size={14} color={Colors.textMuted} />
                <Text style={[styles.breadcrumbItem, styles.breadcrumbActive]}>{currentFolder.name}</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.topBarSub}>
            {currentFolder
              ? `${currentFolder.files.length} fichier${currentFolder.files.length !== 1 ? 's' : ''}`
              : `${totalFiles} fichier${totalFiles !== 1 ? 's' : ''} · ${ws.database.folders.length} dossier${ws.database.folders.length !== 1 ? 's' : ''}`
            }
          </Text>
        </View>

        {/* Add buttons */}
        <View style={styles.topBarActions}>
          {currentFolderId === null ? (
            <Pressable
              onPress={() => { resetFolderForm(); setShowAddFolder(true); }}
              style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="create-new-folder" size={20} color={Colors.primary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => { resetFileForm(); setShowAddFile(true); }}
            style={({ pressed }) => [styles.topBarBtn, styles.topBarBtnAccent, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="add" size={20} color={Colors.bg} />
            <Text style={styles.topBarBtnText}>Fichier</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats banner (root only) */}
        {currentFolderId === null ? (
          <View style={[styles.statsBanner, { borderColor: ws.color + '33', backgroundColor: ws.color + '0A' }]}>
            <View style={[styles.wsIconSm, { backgroundColor: ws.color + '22' }]}>
              <MaterialIcons name={ws.icon as any} size={18} color={ws.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statsBannerTitle}>Base de données — {ws.name}</Text>
              <Text style={styles.statsBannerSub}>
                {ws.database.folders.length} dossier{ws.database.folders.length !== 1 ? 's' : ''} · {totalFiles} fichier{totalFiles !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Folders (root only) */}
        {currentFolderId === null && ws.database.folders.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              <MaterialIcons name="folder-open" size={13} color={Colors.primary} /> Dossiers
            </Text>
            {ws.database.folders.map(folder => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onPress={() => setCurrentFolderId(folder.id)}
                onDelete={() => handleDeleteFolder(folder)}
              />
            ))}
          </View>
        ) : null}

        {/* Files */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="insert-drive-file" size={13} color={Colors.textSecondary} />
            {' '}{currentFolderId ? 'Fichiers du dossier' : 'Fichiers racine'}
          </Text>

          {displayedFiles.length === 0 ? (
            <View style={styles.emptyFiles}>
              <MaterialIcons name="folder-open" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucun fichier</Text>
              <Text style={styles.emptySub}>Ajoutez des notes, textes, URLs ou du code</Text>
              <Pressable
                onPress={() => { resetFileForm(); setShowAddFile(true); }}
                style={({ pressed }) => [styles.emptyAddBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="add" size={16} color={Colors.bg} />
                <Text style={styles.emptyAddBtnText}>Nouveau fichier</Text>
              </Pressable>
            </View>
          ) : (
            displayedFiles.map(file => (
              <FileRow
                key={file.id}
                file={file}
                onPress={() => handleOpenFileEditor(file)}
                onDelete={() => handleDeleteFile(file)}
              />
            ))
          )}
        </View>

        {/* File type legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Types de fichiers</Text>
          <View style={styles.legendRow}>
            {FILE_TYPES.map(t => (
              <View key={t.id} style={styles.legendItem}>
                <MaterialIcons name={t.icon as any} size={14} color={t.color} />
                <Text style={styles.legendText}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ─── Add Folder Modal ─────────────────────────────────────────── */}
      <Modal visible={showAddFolder} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau dossier</Text>
              <Pressable onPress={() => setShowAddFolder(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                {/* Name */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nom du dossier</Text>
                  <TextInput
                    style={styles.textInput}
                    value={folderName}
                    onChangeText={setFolderName}
                    placeholder="Ex: Références, Projets..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                {/* Description */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Description (optionnel)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={folderDesc}
                    onChangeText={setFolderDesc}
                    placeholder="Contenu de ce dossier..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                {/* Color */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Couleur</Text>
                  <View style={styles.colorRow}>
                    {FOLDER_COLORS.map(c => (
                      <Pressable
                        key={c}
                        onPress={() => setFolderColor(c)}
                        style={[styles.colorDot, { backgroundColor: c }, folderColor === c && styles.colorSelected]}
                      />
                    ))}
                  </View>
                </View>
                {/* Icon */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Icône</Text>
                  <View style={styles.iconPickerRow}>
                    {FOLDER_ICONS.map(ic => (
                      <Pressable
                        key={ic}
                        onPress={() => setFolderIcon(ic)}
                        style={[
                          styles.iconPickerBtn,
                          folderIcon === ic && { backgroundColor: folderColor + '33', borderColor: folderColor },
                        ]}
                      >
                        <MaterialIcons name={ic as any} size={22} color={folderIcon === ic ? folderColor : Colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Preview */}
                <View style={[styles.folderPreview, { borderColor: folderColor + '44', backgroundColor: folderColor + '0C' }]}>
                  <View style={[styles.folderIcon, { backgroundColor: folderColor + '22' }]}>
                    <MaterialIcons name={folderIcon as any} size={24} color={folderColor} />
                  </View>
                  <View>
                    <Text style={styles.folderName}>{folderName || 'Nom du dossier'}</Text>
                    <Text style={styles.folderDesc}>{folderDesc || 'Description'}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleAddFolder}
              disabled={!folderName.trim()}
              style={({ pressed }) => [
                styles.primaryBtn,
                !folderName.trim() && styles.primaryBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name="create-new-folder" size={18} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>Créer le dossier</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Add File Modal ───────────────────────────────────────────── */}
      <Modal visible={showAddFile} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Nouveau fichier{currentFolder ? ` — ${currentFolder.name}` : ''}
              </Text>
              <Pressable onPress={() => setShowAddFile(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                {/* File type */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.typeRow}>
                      {FILE_TYPES.map(t => (
                        <Pressable
                          key={t.id}
                          onPress={() => setFileType(t.id)}
                          style={[
                            styles.typeChip,
                            fileType === t.id && { backgroundColor: t.color + '28', borderColor: t.color },
                          ]}
                        >
                          <MaterialIcons name={t.icon as any} size={14} color={fileType === t.id ? t.color : Colors.textMuted} />
                          <Text style={[styles.typeChipText, fileType === t.id && { color: t.color }]}>{t.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Name */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nom du fichier</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fileName}
                    onChangeText={setFileName}
                    placeholder={fileType === 'url' ? 'https://...' : fileType === 'code' ? 'utils.ts' : 'Mon fichier...'}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Tags */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Tags (séparés par virgule)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fileTags}
                    onChangeText={setFileTags}
                    placeholder="api, référence, important..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Content */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Contenu</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.textArea,
                      (fileType === 'code' || fileType === 'json') && styles.monoInput,
                    ]}
                    value={fileContent}
                    onChangeText={setFileContent}
                    placeholder={
                      fileType === 'url' ? 'https://docs.example.com/...' :
                      fileType === 'json' ? '{\n  "key": "value"\n}' :
                      fileType === 'code' ? '// Code ici...' :
                      fileType === 'markdown' ? '# Titre\n\nContenu...' :
                      'Écrivez votre contenu ici...'
                    }
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleAddFile}
              disabled={!fileName.trim() || !fileContent.trim()}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!fileName.trim() || !fileContent.trim()) && styles.primaryBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name="add-circle" size={18} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>Ajouter le fichier</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── File Editor Modal ────────────────────────────────────────── */}
      <Modal visible={showFileEditor} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg, maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.editorTitleRow}>
                {editingFile ? (
                  <View style={[styles.fileIcon, { backgroundColor: getFileTypeInfo(editingFile.type).color + '22' }]}>
                    <MaterialIcons name={getFileTypeInfo(editingFile.type).icon as any} size={16} color={getFileTypeInfo(editingFile.type).color} />
                  </View>
                ) : null}
                <Text style={styles.modalTitle}>Éditeur de fichier</Text>
              </View>
              <Pressable onPress={() => setShowFileEditor(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                {/* Name */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nom</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editorName}
                    onChangeText={setEditorName}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Tags */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Tags</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editorTags}
                    onChangeText={setEditorTags}
                    placeholder="tag1, tag2..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Content editor */}
                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>Contenu</Text>
                    <Text style={styles.charCount}>{editorContent.length} caractères</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.textAreaLg,
                      editingFile && (editingFile.type === 'code' || editingFile.type === 'json') && styles.monoInput,
                    ]}
                    value={editorContent}
                    onChangeText={setEditorContent}
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleSaveFile}
              disabled={!editorName.trim()}
              style={({ pressed }) => [
                styles.primaryBtn,
                !editorName.trim() && styles.primaryBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name="save" size={18} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>Enregistrer</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backIconBtn: { padding: Spacing.xs },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breadcrumbItem: { fontSize: FontSize.body, color: Colors.textMuted, fontWeight: '600' },
  breadcrumbActive: { color: Colors.textPrimary },
  topBarSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  topBarBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarBtnAccent: {
    width: 'auto', paddingHorizontal: Spacing.sm,
    flexDirection: 'row', gap: 4,
    backgroundColor: Colors.accent, borderColor: Colors.accent,
  },
  topBarBtnText: { fontSize: FontSize.sm, color: Colors.bg, fontWeight: '700' },

  // Stats banner
  statsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md,
  },
  wsIconSm: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  statsBannerTitle: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700' },
  statsBannerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  // Section
  section: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
  },

  // Folder card
  folderCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  folderIcon: { width: 46, height: 46, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  folderInfo: { flex: 1 },
  folderName: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700' },
  folderDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  folderMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  folderMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  folderActions: { alignItems: 'center', gap: Spacing.xs },
  folderDeleteBtn: { padding: Spacing.xs },

  // File row
  fileRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  fileIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  fileInfo: { flex: 1, gap: 4 },
  fileName: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '600' },
  fileMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fileTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  fileTypeText: { fontSize: 10, fontWeight: '700' },
  fileSize: { fontSize: FontSize.xs, color: Colors.textMuted },
  fileDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  tagRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  tag: { backgroundColor: Colors.bgCard, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  tagText: { fontSize: 10, color: Colors.textMuted },
  deleteBtn: { padding: Spacing.xs, marginTop: 2 },

  // Empty
  emptyFiles: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '600' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm,
    backgroundColor: Colors.accent, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  emptyAddBtnText: { fontSize: FontSize.sm, color: Colors.bg, fontWeight: '700' },

  // Legend
  legend: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  legendTitle: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Not found
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  notFoundText: { fontSize: FontSize.body, color: Colors.textSecondary },
  backBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill },
  backBtnText: { color: '#fff', fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  editorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  // Form
  field: { gap: Spacing.xs },
  fieldLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: FontSize.xs, color: Colors.textMuted },
  textInput: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.body,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top', paddingTop: Spacing.sm },
  textAreaLg: { minHeight: 220, textAlignVertical: 'top', paddingTop: Spacing.sm },
  monoInput: { fontFamily: 'monospace', fontSize: FontSize.sm, color: Colors.textMono },

  // Type selector
  typeRow: { flexDirection: 'row', gap: Spacing.xs },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  typeChipText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },

  // Color / icon pickers
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorSelected: { borderWidth: 3, borderColor: '#fff' },
  iconPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconPickerBtn: {
    width: 44, height: 44, borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  folderPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md,
  },

  // Primary button
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: FontSize.body, color: Colors.bg, fontWeight: '700' },
});
