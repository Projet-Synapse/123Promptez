// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ThemedInput } from '@/components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useAlert } from '@/template';
import type { WorkspaceMode } from '@/contexts/WorkspaceContext';

const MODE_COLORS = ['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455'];
const MODE_ICONS = [
  'bolt', 'compress', 'school', 'translate', 'bug-report', 'rate-review',
  'description', 'lightbulb', 'auto-stories', 'thumbs-up-down', 'auto-fix-high', 'psychology',
];

export default function WorkspaceSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { wsId } = useLocalSearchParams<{ wsId: string }>();
  const { workspaces, updateWorkspace, addMode, updateMode, removeMode, toggleMode } = useWorkspace();
  const { showAlert } = useAlert();
  const router = useRouter();

  const ws = workspaces.find(w => w.id === wsId);

  const [showAddMode, setShowAddMode] = useState(false);
  const [editingMode, setEditingMode] = useState<WorkspaceMode | null>(null);

  // Form fields
  const [modeLabel, setModeLabel] = useState('');
  const [modeDesc, setModeDesc] = useState('');
  const [modePrompt, setModePrompt] = useState('');
  const [modeShortcut, setModeShortcut] = useState('');
  const [modeColor, setModeColor] = useState(MODE_COLORS[0]);
  const [modeIcon, setModeIcon] = useState(MODE_ICONS[0]);

  if (!ws) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.notFound}>
          <MaterialIcons name="error-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.notFoundText}>Workspace introuvable</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const resetModeForm = () => {
    setModeLabel('');
    setModeDesc('');
    setModePrompt('');
    setModeShortcut('');
    setModeColor(MODE_COLORS[0]);
    setModeIcon(MODE_ICONS[0]);
    setEditingMode(null);
  };

  const openEditMode = (mode: WorkspaceMode) => {
    setEditingMode(mode);
    setModeLabel(mode.label);
    setModeDesc(mode.description);
    setModePrompt(mode.promptInjection);
    setModeShortcut(mode.shortcut || '');
    setModeColor(mode.color);
    setModeIcon(mode.icon);
    setShowAddMode(true);
  };

  const handleSaveMode = () => {
    if (!modeLabel.trim() || !modePrompt.trim()) return;
    if (editingMode) {
      updateMode(ws.id, editingMode.id, {
        label: modeLabel.trim(),
        description: modeDesc.trim(),
        promptInjection: modePrompt.trim(),
        shortcut: modeShortcut.trim() || undefined,
        color: modeColor,
        icon: modeIcon,
      });
    } else {
      addMode(ws.id, {
        label: modeLabel.trim(),
        description: modeDesc.trim(),
        promptInjection: modePrompt.trim(),
        shortcut: modeShortcut.trim() || undefined,
        color: modeColor,
        icon: modeIcon,
        enabled: false,
      });
    }
    resetModeForm();
    setShowAddMode(false);
  };

  const handleDeleteMode = (mode: WorkspaceMode) => {
    showAlert(
      `Supprimer "${mode.label}" ?`,
      'Ce mode sera définitivement supprimé.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeMode(ws.id, mode.id) },
      ]
    );
  };

  const activeModes = ws.modes.filter(m => m.enabled);
  const totalFiles = ws.database.rootFiles.length + ws.database.folders.reduce((acc, f) => acc + f.files.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backIconBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={[styles.wsIconSmall, { backgroundColor: ws.color + '22' }]}>
          <MaterialIcons name={ws.icon as any} size={18} color={ws.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>{ws.name}</Text>
          <Text style={styles.topBarSub}>Paramètres du workspace</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="edit" size={13} color={Colors.primary} /> Identité
          </Text>
          <ThemedInput
            label="Nom"
            value={ws.name}
            onChangeText={v => updateWorkspace(ws.id, { name: v })}
            placeholder="Nom du workspace"
          />
          <ThemedInput
            label="Description"
            value={ws.description}
            onChangeText={v => updateWorkspace(ws.id, { description: v })}
            placeholder="Contexte et usage..."
          />
        </View>

        {/* System Prompt */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>
              <MaterialIcons name="code" size={13} color={Colors.textMono} /> Prompt système du workspace
            </Text>
          </View>
          <ThemedInput
            value={ws.systemPrompt}
            onChangeText={v => updateWorkspace(ws.id, { systemPrompt: v })}
            placeholder="Définissez le comportement de base de l'assistant pour ce workspace..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{ minHeight: 140, lineHeight: 20 }}
            mono
          />
          <Text style={styles.promptHint}>
            {ws.systemPrompt.length} caractères · Ce prompt remplace le prompt global quand ce workspace est actif
          </Text>
        </View>

        {/* Database */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>
              <MaterialIcons name="storage" size={13} color={Colors.primary} /> Base de données
            </Text>
          </View>
          <View style={styles.dbSummary}>
            <View style={styles.dbStat}>
              <MaterialIcons name="folder" size={20} color={Colors.primary} />
              <Text style={styles.dbStatValue}>{ws.database.folders.length}</Text>
              <Text style={styles.dbStatLabel}>Dossier{ws.database.folders.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.dbDivider} />
            <View style={styles.dbStat}>
              <MaterialIcons name="insert-drive-file" size={20} color={Colors.textSecondary} />
              <Text style={styles.dbStatValue}>{totalFiles}</Text>
              <Text style={styles.dbStatLabel}>Fichier{totalFiles !== 1 ? 's' : ''}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/workspace-database', params: { wsId: ws.id } })}
            style={({ pressed }) => [styles.dbOpenBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="storage" size={18} color="#fff" />
            <Text style={styles.dbOpenBtnText}>Ouvrir la base de données</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        </View>

        {/* Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>
              <MaterialIcons name="event-repeat" size={13} color={Colors.warning} /> Tâches planifiées
            </Text>
          </View>
          <View style={styles.dbSummary}>
            <View style={styles.dbStat}>
              <MaterialIcons name="task-alt" size={20} color={Colors.accent} />
              <Text style={styles.dbStatValue}>{ws.tasks.filter(t => t.enabled).length}</Text>
              <Text style={styles.dbStatLabel}>Actives</Text>
            </View>
            <View style={styles.dbDivider} />
            <View style={styles.dbStat}>
              <MaterialIcons name="event-repeat" size={20} color={Colors.warning} />
              <Text style={styles.dbStatValue}>{ws.tasks.length}</Text>
              <Text style={styles.dbStatLabel}>Total</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/workspace-tasks', params: { wsId: ws.id } })}
            style={({ pressed }) => [styles.dbOpenBtn, { backgroundColor: Colors.warning }, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="event-repeat" size={18} color="#fff" />
            <Text style={styles.dbOpenBtnText}>Gérer les tâches planifiées</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        </View>

        {/* Modes */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionLabel}>
              <MaterialIcons name="bolt" size={13} color={Colors.accent} /> Modes d'interaction
            </Text>
            <Pressable
              onPress={() => { resetModeForm(); setShowAddMode(true); }}
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </Pressable>
          </View>

          {/* Active modes summary */}
          {activeModes.length > 0 ? (
            <View style={styles.activeModesBanner}>
              <MaterialIcons name="bolt" size={14} color={Colors.accent} />
              <Text style={styles.activeModesText}>
                {activeModes.length} mode{activeModes.length !== 1 ? 's' : ''} actif{activeModes.length !== 1 ? 's' : ''} : {activeModes.map(m => m.label).join(', ')}
              </Text>
            </View>
          ) : null}

          {/* Mode explanation */}
          <View style={styles.modeExplain}>
            <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.modeExplainText}>
              Les modes injectent automatiquement des instructions dans le prompt lors des conversations. Activez/désactivez-les depuis le chat.
            </Text>
          </View>

          {ws.modes.length === 0 ? (
            <View style={styles.emptyModes}>
              <MaterialIcons name="widgets" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyModesText}>Aucun mode configuré</Text>
              <Text style={styles.emptyModesSub}>Créez des comportements automatiques activables en conversation</Text>
            </View>
          ) : null}

          {ws.modes.map(mode => (
            <View
              key={mode.id}
              style={[
                styles.modeCard,
                mode.enabled ? { borderColor: mode.color + '66', backgroundColor: mode.color + '08' } : null,
              ]}
            >
              <View style={[styles.modeIcon, { backgroundColor: mode.color + '22' }]}>
                <MaterialIcons name={mode.icon as any} size={20} color={mode.color} />
              </View>
              <View style={styles.modeInfo}>
                <View style={styles.modeTitleRow}>
                  <Text style={styles.modeLabel}>{mode.label}</Text>
                  {mode.shortcut ? (
                    <View style={styles.shortcutBadge}>
                      <Text style={styles.shortcutText}>{mode.shortcut}</Text>
                    </View>
                  ) : null}
                  {mode.enabled ? (
                    <View style={[styles.enabledBadge, { backgroundColor: mode.color + '22' }]}>
                      <View style={[styles.enabledDot, { backgroundColor: mode.color }]} />
                      <Text style={[styles.enabledText, { color: mode.color }]}>ON</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.modeDesc} numberOfLines={2}>{mode.description}</Text>
                <Text style={styles.modePromptPreview} numberOfLines={2}>{mode.promptInjection}</Text>
              </View>
              <View style={styles.modeActions}>
                <Pressable
                  onPress={() => toggleMode(ws.id, mode.id)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.toggleBtn,
                    mode.enabled ? [styles.toggleBtnOn, { backgroundColor: mode.color }] : styles.toggleBtnOff,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <MaterialIcons
                    name={mode.enabled ? 'toggle-on' : 'toggle-off'}
                    size={22}
                    color={mode.enabled ? '#fff' : Colors.textMuted}
                  />
                </Pressable>
                <Pressable onPress={() => openEditMode(mode)} hitSlop={8} style={styles.iconBtn}>
                  <MaterialIcons name="edit" size={16} color={Colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => handleDeleteMode(mode)} hitSlop={8} style={styles.iconBtn}>
                  <MaterialIcons name="delete-outline" size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add/Edit Mode Modal */}
      <Modal visible={showAddMode} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingMode ? 'Modifier le mode' : 'Nouveau mode'}</Text>
              <Pressable onPress={() => { resetModeForm(); setShowAddMode(false); }} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
                <ThemedInput label="Nom du mode" value={modeLabel} onChangeText={setModeLabel} placeholder="Ex: Mode Concis, Code Review..." />
                <ThemedInput label="Description" value={modeDesc} onChangeText={setModeDesc} placeholder="Ce que fait ce mode..." />
                <ThemedInput
                  label="Raccourci (optionnel)"
                  value={modeShortcut}
                  onChangeText={setModeShortcut}
                  placeholder="/court, /debug, /traduis..."
                  mono
                />

                {/* Color */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={styles.fieldLabel}>Couleur</Text>
                  <View style={styles.colorRow}>
                    {MODE_COLORS.map(c => (
                      <Pressable
                        key={c}
                        onPress={() => setModeColor(c)}
                        style={[styles.colorDot, { backgroundColor: c }, modeColor === c ? styles.colorSelected : null]}
                      />
                    ))}
                  </View>
                </View>

                {/* Icon */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={styles.fieldLabel}>Icône</Text>
                  <View style={styles.iconRow}>
                    {MODE_ICONS.map(ic => (
                      <Pressable
                        key={ic}
                        onPress={() => setModeIcon(ic)}
                        style={[styles.iconPickerBtn, modeIcon === ic ? { backgroundColor: modeColor + '33', borderColor: modeColor } : null]}
                      >
                        <MaterialIcons name={ic as any} size={20} color={modeIcon === ic ? modeColor : Colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <ThemedInput
                  label="Injection de prompt"
                  value={modePrompt}
                  onChangeText={setModePrompt}
                  placeholder="Instructions injectées automatiquement dans le prompt quand ce mode est actif..."
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  style={{ minHeight: 110 }}
                  mono
                />

                {/* Preview */}
                <View style={[styles.modePreview, { borderColor: modeColor + '44', backgroundColor: modeColor + '0A' }]}>
                  <View style={[styles.modeIcon, { backgroundColor: modeColor + '22' }]}>
                    <MaterialIcons name={modeIcon as any} size={18} color={modeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeLabel, { color: modeColor }]}>{modeLabel || 'Nom du mode'}</Text>
                    {modeShortcut ? (
                      <View style={styles.shortcutBadge}>
                        <Text style={styles.shortcutText}>{modeShortcut}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleSaveMode}
              disabled={!modeLabel.trim() || !modePrompt.trim()}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!modeLabel.trim() || !modePrompt.trim()) ? styles.primaryBtnDisabled : null,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name={editingMode ? 'save' : 'add-circle'} size={18} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>{editingMode ? 'Enregistrer' : 'Créer le mode'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backIconBtn: { padding: Spacing.xs },
  wsIconSmall: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700' },
  topBarSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  content: { padding: Spacing.md, gap: Spacing.lg },
  section: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  promptHint: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  addBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '600' },
  activeModesBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.accentGlow, borderRadius: Radius.sm, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.accent + '33',
  },
  activeModesText: { fontSize: FontSize.sm, color: Colors.accent, flex: 1 },
  modeExplain: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start',
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.sm,
  },
  modeExplainText: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1, lineHeight: 17 },
  emptyModes: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyModesText: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '500' },
  emptyModesSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', maxWidth: 260 },
  modeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  modeIcon: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  modeInfo: { flex: 1, gap: 3 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  modeLabel: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '600' },
  shortcutBadge: {
    backgroundColor: Colors.bgCard, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  shortcutText: { fontSize: FontSize.xs, color: Colors.textMono, fontFamily: 'monospace' },
  enabledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  enabledDot: { width: 5, height: 5, borderRadius: 3 },
  enabledText: { fontSize: FontSize.xs, fontWeight: '700' },
  modeDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 17 },
  modePromptPreview: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: 'monospace', lineHeight: 16 },
  modeActions: { flexDirection: 'column', alignItems: 'center', gap: Spacing.xs },
  toggleBtn: { padding: Spacing.xs, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  toggleBtnOn: {},
  toggleBtnOff: { backgroundColor: Colors.bgCard },
  iconBtn: { padding: Spacing.xs },
  dbSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md, padding: Spacing.md,
    gap: Spacing.lg,
  },
  dbStat: { alignItems: 'center', gap: 4 },
  dbStatValue: { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: '700' },
  dbStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  dbDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  dbOpenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2,
  },
  dbOpenBtnText: { fontSize: FontSize.body, color: '#fff', fontWeight: '700', flex: 1, textAlign: 'center' },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  notFoundText: { fontSize: FontSize.body, color: Colors.textSecondary },
  backBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill },
  backBtnText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  fieldLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorSelected: { borderWidth: 3, borderColor: '#fff' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconPickerBtn: {
    width: 42, height: 42, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  modePreview: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: FontSize.body, color: Colors.bg, fontWeight: '700' },
});
