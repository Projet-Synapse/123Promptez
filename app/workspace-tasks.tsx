// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAlert } from '@/template';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import type { WorkspaceTask, TaskFrequency } from '@/contexts/WorkspaceContext';

const TASK_COLORS = ['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455'];
const TASK_ICONS = ['task-alt', 'today', 'event-repeat', 'schedule', 'alarm', 'notifications', 'flag', 'star', 'bolt', 'psychology'];

const FREQUENCIES: { id: TaskFrequency; label: string; icon: string; color: string; desc: string }[] = [
  { id: 'daily', label: 'Quotidien', icon: 'today', color: '#3D7EFF', desc: 'Chaque jour' },
  { id: 'weekly', label: 'Hebdomadaire', icon: 'view-week', color: '#00CC6A', desc: 'Chaque semaine' },
  { id: 'monthly', label: 'Mensuel', icon: 'calendar-month', color: '#FF6B35', desc: 'Chaque mois' },
  { id: 'yearly', label: 'Annuel', icon: 'event', color: '#9B59B6', desc: "Chaque année" },
];

function formatNextDue(date: Date | null, frequency: TaskFrequency): string {
  if (!date) return 'Dès maintenant';
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days <= 0) return 'Maintenant';
  if (days === 1) return 'Demain';
  if (days < 7) return `Dans ${days}j`;
  if (days < 30) return `Dans ${Math.ceil(days / 7)}sem`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function getFrequencyInfo(f: TaskFrequency) {
  return FREQUENCIES.find(x => x.id === f) ?? FREQUENCIES[0];
}

export default function WorkspaceTasksScreen() {
  const insets = useSafeAreaInsets();
  const { wsId } = useLocalSearchParams<{ wsId: string }>();
  const { workspaces, addTask, updateTask, removeTask, toggleTask, completeTask } = useWorkspace();
  const { showAlert } = useAlert();
  const router = useRouter();

  const ws = workspaces.find(w => w.id === wsId);

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkspaceTask | null>(null);

  // Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPrompt, setTaskPrompt] = useState('');
  const [taskFreq, setTaskFreq] = useState<TaskFrequency>('daily');
  const [taskColor, setTaskColor] = useState(TASK_COLORS[0]);
  const [taskIcon, setTaskIcon] = useState(TASK_ICONS[0]);

  if (!ws) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Workspace introuvable</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const resetForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskPrompt('');
    setTaskFreq('daily');
    setTaskColor(TASK_COLORS[0]);
    setTaskIcon(TASK_ICONS[0]);
    setEditingTask(null);
  };

  const openEdit = (task: WorkspaceTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description);
    setTaskPrompt(task.promptInjection);
    setTaskFreq(task.frequency);
    setTaskColor(task.color);
    setTaskIcon(task.icon);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!taskTitle.trim() || !taskPrompt.trim()) return;
    if (editingTask) {
      updateTask(ws.id, editingTask.id, {
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        promptInjection: taskPrompt.trim(),
        frequency: taskFreq,
        color: taskColor,
        icon: taskIcon,
      });
    } else {
      addTask(ws.id, {
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        promptInjection: taskPrompt.trim(),
        frequency: taskFreq,
        color: taskColor,
        icon: taskIcon,
        enabled: true,
      });
    }
    resetForm();
    setShowModal(false);
  };

  const handleDelete = (task: WorkspaceTask) => {
    showAlert(
      `Supprimer "${task.title}" ?`,
      'Cette tâche sera définitivement supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeTask(ws.id, task.id) },
      ]
    );
  };

  const handleComplete = (task: WorkspaceTask) => {
    completeTask(ws.id, task.id);
    showAlert('Tâche accomplie !', `"${task.title}" marquée comme complétée. Prochaine échéance calculée.`);
  };

  const enabledTasks = ws.tasks.filter(t => t.enabled);
  const dueTasks = ws.tasks.filter(t => {
    if (!t.enabled) return false;
    if (!t.nextDue) return true;
    return new Date(t.nextDue) <= new Date();
  });

  const groupedByFreq = FREQUENCIES.map(f => ({
    ...f,
    tasks: ws.tasks.filter(t => t.frequency === f.id),
  })).filter(g => g.tasks.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn2}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={[styles.wsIcon, { backgroundColor: ws.color + '22' }]}>
          <MaterialIcons name={ws.icon as any} size={18} color={ws.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>Tâches planifiées</Text>
          <Text style={styles.topBarSub}>{ws.name} · {ws.tasks.length} tâche{ws.tasks.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          onPress={() => { resetForm(); setShowModal(true); }}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Nouvelle</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Explainer */}
        <View style={styles.explainCard}>
          <MaterialIcons name="schedule" size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.explainTitle}>Tâches automatiques</Text>
            <Text style={styles.explainText}>
              Les tâches planifiées injectent des instructions dans le chat à leur échéance. L'IA les exécute automatiquement selon la fréquence définie.
            </Text>
          </View>
        </View>

        {/* Due now banner */}
        {dueTasks.length > 0 ? (
          <View style={styles.dueBanner}>
            <View style={styles.dueBannerLeft}>
              <MaterialIcons name="alarm-on" size={18} color={Colors.warning} />
              <Text style={styles.dueBannerText}>
                {dueTasks.length} tâche{dueTasks.length !== 1 ? 's' : ''} à accomplir maintenant
              </Text>
            </View>
            <View style={styles.duePills}>
              {dueTasks.slice(0, 3).map(t => (
                <View key={t.id} style={[styles.duePill, { backgroundColor: t.color + '22' }]}>
                  <MaterialIcons name={t.icon as any} size={10} color={t.color} />
                  <Text style={[styles.duePillText, { color: t.color }]} numberOfLines={1}>{t.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Summary stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialIcons name="task-alt" size={20} color={Colors.accent} />
            <Text style={styles.statValue}>{enabledTasks.length}</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="alarm-on" size={20} color={Colors.warning} />
            <Text style={styles.statValue}>{dueTasks.length}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="event-repeat" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{ws.tasks.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Empty state */}
        {ws.tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-repeat" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Aucune tâche planifiée</Text>
            <Text style={styles.emptySub}>
              Créez des tâches récurrentes que l'IA accomplira automatiquement selon votre planning.
            </Text>
            <Pressable
              onPress={() => { resetForm(); setShowModal(true); }}
              style={({ pressed }) => [styles.emptyAddBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="add" size={16} color={Colors.bg} />
              <Text style={styles.emptyAddBtnText}>Créer une tâche</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Tasks grouped by frequency */}
        {groupedByFreq.map(group => (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupIconBadge, { backgroundColor: group.color + '22' }]}>
                <MaterialIcons name={group.icon as any} size={15} color={group.color} />
              </View>
              <Text style={[styles.groupTitle, { color: group.color }]}>{group.label}</Text>
              <View style={[styles.groupCount, { backgroundColor: group.color + '22' }]}>
                <Text style={[styles.groupCountText, { color: group.color }]}>{group.tasks.length}</Text>
              </View>
            </View>

            {group.tasks.map(task => {
              const isDue = task.enabled && (!task.nextDue || new Date(task.nextDue) <= new Date());
              const freqInfo = getFrequencyInfo(task.frequency);
              return (
                <View
                  key={task.id}
                  style={[
                    styles.taskCard,
                    task.enabled ? { borderColor: task.color + '44' } : null,
                    isDue ? { borderColor: Colors.warning + '77', backgroundColor: Colors.warning + '08' } : null,
                  ]}
                >
                  {/* Top row */}
                  <View style={styles.taskTopRow}>
                    <View style={[styles.taskIconWrap, { backgroundColor: task.color + '22' }]}>
                      <MaterialIcons name={task.icon as any} size={20} color={task.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.taskTitleRow}>
                        <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                        {isDue ? (
                          <View style={styles.dueBadge}>
                            <MaterialIcons name="alarm-on" size={11} color={Colors.warning} />
                            <Text style={styles.dueBadgeText}>Dû</Text>
                          </View>
                        ) : null}
                        {!task.enabled ? (
                          <View style={styles.disabledBadge}>
                            <Text style={styles.disabledBadgeText}>Inactif</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>
                    </View>
                    {/* Toggle */}
                    <Pressable
                      onPress={() => toggleTask(ws.id, task.id)}
                      style={({ pressed }) => [
                        styles.toggleTrack,
                        task.enabled ? { backgroundColor: task.color } : null,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={[styles.toggleThumb, task.enabled ? styles.toggleThumbOn : null]} />
                    </Pressable>
                  </View>

                  {/* Meta row */}
                  <View style={styles.taskMeta}>
                    <View style={[styles.freqBadge, { backgroundColor: freqInfo.color + '18' }]}>
                      <MaterialIcons name={freqInfo.icon as any} size={11} color={freqInfo.color} />
                      <Text style={[styles.freqBadgeText, { color: freqInfo.color }]}>{freqInfo.label}</Text>
                    </View>
                    <View style={styles.taskMetaItem}>
                      <MaterialIcons name="schedule" size={12} color={Colors.textMuted} />
                      <Text style={styles.taskMetaText}>
                        Prochain : {formatNextDue(task.nextDue, task.frequency)}
                      </Text>
                    </View>
                    {task.lastCompleted ? (
                      <View style={styles.taskMetaItem}>
                        <MaterialIcons name="check-circle-outline" size={12} color={Colors.accent} />
                        <Text style={[styles.taskMetaText, { color: Colors.accent }]}>
                          Dernier : {new Date(task.lastCompleted).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Prompt preview */}
                  <View style={styles.promptPreview}>
                    <Text style={styles.promptPreviewText} numberOfLines={2}>{task.promptInjection}</Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.taskActions}>
                    {isDue ? (
                      <Pressable
                        onPress={() => handleComplete(task)}
                        style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.8 }]}
                      >
                        <MaterialIcons name="check" size={14} color={Colors.bg} />
                        <Text style={styles.completeBtnText}>Marquer accomplie</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => openEdit(task)} hitSlop={8} style={styles.iconBtn}>
                      <MaterialIcons name="edit" size={16} color={Colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(task)} hitSlop={8} style={styles.iconBtn}>
                      <MaterialIcons name="delete-outline" size={16} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <MaterialIcons name="tips-and-updates" size={16} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipsTitle}>Comment fonctionnent les tâches ?</Text>
            <Text style={styles.tipsText}>
              Quand une tâche est due, son prompt est injecté automatiquement dans la prochaine conversation du workspace. L'IA l'exécute sans que vous ayez à le demander explicitement.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ─── Add/Edit Modal ──────────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}</Text>
              <Pressable onPress={() => { resetForm(); setShowModal(false); }} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
                {/* Title */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Titre</Text>
                  <TextInput
                    style={styles.textInput}
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    placeholder="Ex: Brief quotidien, Revue hebdomadaire..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Description */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={styles.textInput}
                    value={taskDesc}
                    onChangeText={setTaskDesc}
                    placeholder="Ce que cette tâche accomplit..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Frequency */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Fréquence</Text>
                  <View style={styles.freqRow}>
                    {FREQUENCIES.map(f => (
                      <Pressable
                        key={f.id}
                        onPress={() => setTaskFreq(f.id)}
                        style={[
                          styles.freqChip,
                          taskFreq === f.id ? { backgroundColor: f.color + '28', borderColor: f.color } : null,
                        ]}
                      >
                        <MaterialIcons name={f.icon as any} size={16} color={taskFreq === f.id ? f.color : Colors.textMuted} />
                        <Text style={[styles.freqChipText, taskFreq === f.id ? { color: f.color } : null]}>
                          {f.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Color */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Couleur</Text>
                  <View style={styles.colorRow}>
                    {TASK_COLORS.map(c => (
                      <Pressable
                        key={c}
                        onPress={() => setTaskColor(c)}
                        style={[styles.colorDot, { backgroundColor: c }, taskColor === c ? styles.colorSelected : null]}
                      />
                    ))}
                  </View>
                </View>

                {/* Icon */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Icône</Text>
                  <View style={styles.iconRow}>
                    {TASK_ICONS.map(ic => (
                      <Pressable
                        key={ic}
                        onPress={() => setTaskIcon(ic)}
                        style={[
                          styles.iconPickerBtn,
                          taskIcon === ic ? { backgroundColor: taskColor + '33', borderColor: taskColor } : null,
                        ]}
                      >
                        <MaterialIcons name={ic as any} size={20} color={taskIcon === ic ? taskColor : Colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Prompt */}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Instruction pour l'IA</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={taskPrompt}
                    onChangeText={setTaskPrompt}
                    placeholder="Ex: TÂCHE QUOTIDIENNE: Au début de chaque session, propose un brief structuré avec les priorités du jour..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Preview */}
                <View style={[styles.previewCard, { borderColor: taskColor + '44', backgroundColor: taskColor + '0C' }]}>
                  <View style={[styles.previewIcon, { backgroundColor: taskColor + '22' }]}>
                    <MaterialIcons name={taskIcon as any} size={18} color={taskColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewTitle, { color: taskColor }]}>{taskTitle || 'Titre de la tâche'}</Text>
                    <View style={[styles.freqBadge, { backgroundColor: (FREQUENCIES.find(f => f.id === taskFreq)?.color || Colors.primary) + '22', alignSelf: 'flex-start', marginTop: 4 }]}>
                      <Text style={[styles.freqBadgeText, { color: FREQUENCIES.find(f => f.id === taskFreq)?.color || Colors.primary }]}>
                        {FREQUENCIES.find(f => f.id === taskFreq)?.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleSave}
              disabled={!taskTitle.trim() || !taskPrompt.trim()}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!taskTitle.trim() || !taskPrompt.trim()) ? styles.primaryBtnDisabled : null,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name={editingTask ? 'save' : 'add-circle'} size={18} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>{editingTask ? 'Enregistrer' : 'Créer la tâche'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn2: { padding: Spacing.xs },
  wsIcon: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700' },
  topBarSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  addBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '600' },
  content: { padding: Spacing.md, gap: Spacing.md },

  explainCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.primary + '15', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary + '33', padding: Spacing.md,
  },
  explainTitle: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600', marginBottom: 3 },
  explainText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, flex: 1 },

  dueBanner: {
    backgroundColor: Colors.warning + '12', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.warning + '44', padding: Spacing.md, gap: Spacing.sm,
  },
  dueBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dueBannerText: { fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600', flex: 1 },
  duePills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  duePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
  },
  duePillText: { fontSize: FontSize.xs, fontWeight: '600', maxWidth: 80 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
    alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl + 16, gap: Spacing.md },
  emptyTitle: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '600' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.accent, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill, marginTop: Spacing.sm,
  },
  emptyAddBtnText: { fontSize: FontSize.sm, color: Colors.bg, fontWeight: '700' },

  group: { gap: Spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  groupIconBadge: { width: 26, height: 26, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { fontSize: FontSize.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  groupCount: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  groupCountText: { fontSize: FontSize.xs, fontWeight: '700' },

  taskCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  taskTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  taskIconWrap: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap', flex: 1 },
  taskTitle: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700', flex: 1 },
  dueBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.warning + '22', paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.pill,
  },
  dueBadgeText: { fontSize: 10, color: Colors.warning, fontWeight: '700' },
  disabledBadge: {
    backgroundColor: Colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill,
  },
  disabledBadgeText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  taskDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 17, marginTop: 2 },
  toggleTrack: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.textMuted },
  toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },

  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  freqBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  freqBadgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  taskMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },

  promptPreview: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.sm,
    borderLeftWidth: 2, borderLeftColor: Colors.border,
  },
  promptPreviewText: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: 'monospace', lineHeight: 16 },

  taskActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.warning, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill, flex: 1, justifyContent: 'center',
  },
  completeBtnText: { fontSize: FontSize.sm, color: Colors.bg, fontWeight: '700' },
  iconBtn: { padding: Spacing.xs },

  tipsCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.warning + '10', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.warning + '33', padding: Spacing.md,
  },
  tipsTitle: { fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600', marginBottom: 4 },
  tipsText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

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
  field: { gap: Spacing.xs },
  fieldLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.body,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top', paddingTop: Spacing.sm },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  freqChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  freqChipText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorSelected: { borderWidth: 3, borderColor: '#fff' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  iconPickerBtn: {
    width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md,
  },
  previewIcon: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: FontSize.body, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: FontSize.body, color: Colors.bg, fontWeight: '700' },
});
