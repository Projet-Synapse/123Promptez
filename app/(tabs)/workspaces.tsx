// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ThemedInput } from '@/components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAlert } from '@/template';
import { useRouter } from 'expo-router';
import type { Workspace, Conversation } from '@/contexts/WorkspaceContext';

const WORKSPACE_COLORS = ['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455', '#00BFFF', '#FF69B4'];
const WORKSPACE_ICONS = ['home', 'code', 'brush', 'science', 'business', 'school', 'favorite', 'star', 'rocket-launch', 'psychology'];

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

export default function WorkspacesScreen() {
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
    addWorkspace,
    removeWorkspace,
    addConversation,
    removeConversation,
    setActiveConversation,
  } = useWorkspace();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [expandedWsId, setExpandedWsId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newColor, setNewColor] = useState(WORKSPACE_COLORS[0]);
  const [newIcon, setNewIcon] = useState(WORKSPACE_ICONS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    addWorkspace({
      name: newName.trim(),
      description: newDesc.trim(),
      icon: newIcon,
      color: newColor,
      systemPrompt: newPrompt.trim() || "Tu es un assistant IA utile et précis.",
      modes: [],
      database: { rootFiles: [], folders: [] },
    });
    setNewName('');
    setNewDesc('');
    setNewPrompt('');
    setNewColor(WORKSPACE_COLORS[0]);
    setNewIcon(WORKSPACE_ICONS[0]);
    setShowCreate(false);
  };

  const handleDelete = (ws: Workspace) => {
    if (workspaces.length <= 1) {
      showAlert('Impossible', 'Vous devez conserver au moins un workspace.');
      return;
    }
    showAlert(
      `Supprimer "${ws.name}" ?`,
      'Ce workspace et toutes ses conversations seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeWorkspace(ws.id) },
      ]
    );
  };

  const handleSelectAndNavigate = (wsId: string, convId?: string) => {
    setActiveWorkspace(wsId);
    if (convId) setActiveConversation(wsId, convId);
    router.push('/(tabs)/chat');
  };

  const handleAddConversation = (wsId: string) => {
    const newId = addConversation(wsId);
    setExpandedWsId(wsId);
  };

  const handleDeleteConversation = (ws: Workspace, conv: Conversation) => {
    showAlert(
      `Supprimer "${conv.title}" ?`,
      conv.messages.length > 0
        ? `Cette conversation contient ${conv.messages.length} message(s).`
        : 'Cette conversation est vide.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeConversation(ws.id, conv.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Workspaces</Text>
            <Text style={styles.subtitle}>{workspaces.length} espace{workspaces.length > 1 ? 's' : ''} de travail</Text>
          </View>
          <Pressable
            onPress={() => setShowCreate(true)}
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Nouveau</Text>
          </Pressable>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info-outline" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>
            Chaque workspace possède ses propres conversations, modes et base de données. Appuyez sur une conversation pour la rejoindre.
          </Text>
        </View>

        {/* Workspace list */}
        {workspaces.map(ws => {
          const isActive = ws.id === activeWorkspaceId;
          const isExpanded = expandedWsId === ws.id;
          const activeModeCount = ws.modes.filter(m => m.enabled).length;
          const totalMessages = ws.conversations.reduce((acc, c) => acc + c.messages.length, 0);

          return (
            <View key={ws.id} style={[styles.wsBlock, isActive ? { borderColor: ws.color + '55' } : null]}>
              {/* Workspace header row */}
              <Pressable
                onPress={() => setExpandedWsId(isExpanded ? null : ws.id)}
                style={({ pressed }) => [styles.wsHeader, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.wsIcon, { backgroundColor: ws.color + '22' }]}>
                  <MaterialIcons name={ws.icon as any} size={22} color={ws.color} />
                </View>
                <View style={styles.wsInfo}>
                  <View style={styles.wsNameRow}>
                    <Text style={styles.wsName}>{ws.name}</Text>
                    {isActive ? (
                      <View style={[styles.activePill, { backgroundColor: ws.color + '22' }]}>
                        <View style={[styles.activeDot, { backgroundColor: ws.color }]} />
                        <Text style={[styles.activeText, { color: ws.color }]}>Actif</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.wsDesc} numberOfLines={1}>{ws.description || 'Aucune description'}</Text>
                  <View style={styles.wsStats}>
                    <View style={styles.wsStat}>
                      <MaterialIcons name="chat-bubble-outline" size={11} color={Colors.textMuted} />
                      <Text style={styles.wsStatText}>{ws.conversations.length} conv.</Text>
                    </View>
                    <View style={styles.wsStat}>
                      <MaterialIcons name="forum" size={11} color={Colors.textMuted} />
                      <Text style={styles.wsStatText}>{totalMessages} msg</Text>
                    </View>
                    <View style={styles.wsStat}>
                      <MaterialIcons name="widgets" size={11} color={Colors.textMuted} />
                      <Text style={styles.wsStatText}>{ws.modes.length} modes</Text>
                    </View>
                    {activeModeCount > 0 ? (
                      <View style={styles.wsStat}>
                        <MaterialIcons name="bolt" size={11} color={Colors.accent} />
                        <Text style={[styles.wsStatText, { color: Colors.accent }]}>{activeModeCount} actif{activeModeCount !== 1 ? 's' : ''}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.wsActions}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/workspace-settings', params: { wsId: ws.id } })}
                    hitSlop={8}
                    style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                  >
                    <MaterialIcons name="settings" size={17} color={Colors.textSecondary} />
                  </Pressable>
                  {workspaces.length > 1 ? (
                    <Pressable
                      onPress={() => handleDelete(ws)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                    >
                      <MaterialIcons name="delete-outline" size={17} color={Colors.textMuted} />
                    </Pressable>
                  ) : null}
                  <MaterialIcons
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </View>
              </Pressable>

              {/* Conversations list (expanded) */}
              {isExpanded ? (
                <View style={styles.convSection}>
                  <View style={styles.convSectionHeader}>
                    <Text style={styles.convSectionTitle}>Conversations</Text>
                    <Pressable
                      onPress={() => handleAddConversation(ws.id)}
                      style={({ pressed }) => [styles.addConvBtn, pressed && { opacity: 0.8 }]}
                    >
                      <MaterialIcons name="add" size={14} color={ws.color} />
                      <Text style={[styles.addConvBtnText, { color: ws.color }]}>Nouvelle</Text>
                    </Pressable>
                  </View>

                  {[...ws.conversations].reverse().map(conv => {
                    const isActiveConv = conv.id === ws.activeConversationId && ws.id === activeWorkspaceId;
                    const lastMsg = conv.messages[conv.messages.length - 1];
                    return (
                      <Pressable
                        key={conv.id}
                        onPress={() => handleSelectAndNavigate(ws.id, conv.id)}
                        style={({ pressed }) => [
                          styles.convRow,
                          isActiveConv ? { borderColor: ws.color + '66', backgroundColor: ws.color + '0C' } : null,
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <View style={[styles.convIcon, { backgroundColor: isActiveConv ? ws.color + '22' : Colors.bgCard }]}>
                          <MaterialIcons
                            name={conv.messages.length > 0 ? 'chat-bubble' : 'chat-bubble-outline'}
                            size={16}
                            color={isActiveConv ? ws.color : Colors.textMuted}
                          />
                        </View>
                        <View style={styles.convInfo}>
                          <View style={styles.convTitleRow}>
                            <Text style={[styles.convTitle, isActiveConv ? { color: Colors.textPrimary } : null]} numberOfLines={1}>
                              {conv.title}
                            </Text>
                            {isActiveConv ? (
                              <View style={[styles.activeConvPill, { backgroundColor: ws.color + '22' }]}>
                                <View style={[styles.activeDot, { backgroundColor: ws.color }]} />
                                <Text style={[styles.activeText, { color: ws.color }]}>En cours</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.convMeta}>
                            <Text style={styles.convMsgCount}>
                              {conv.messages.length} msg
                            </Text>
                            {conv.messages.length > 0 ? (
                              <Text style={styles.convTime}>{formatRelativeTime(conv.updatedAt)}</Text>
                            ) : null}
                          </View>
                          {lastMsg ? (
                            <Text style={styles.convPreview} numberOfLines={1}>
                              {lastMsg.role === 'user' ? 'Vous: ' : 'IA: '}{lastMsg.content}
                            </Text>
                          ) : (
                            <Text style={styles.convEmpty}>Conversation vide — tapez pour commencer</Text>
                          )}
                        </View>
                        <View style={styles.convActions}>
                          <Pressable
                            onPress={() => handleDeleteConversation(ws, conv)}
                            hitSlop={10}
                            style={styles.convDeleteBtn}
                          >
                            <MaterialIcons name="delete-outline" size={15} color={Colors.textMuted} />
                          </Pressable>
                          <MaterialIcons name="chevron-right" size={18} color={ws.color + '88'} />
                        </View>
                      </Pressable>
                    );
                  })}

                  {/* Quick open button */}
                  <Pressable
                    onPress={() => handleSelectAndNavigate(ws.id)}
                    style={({ pressed }) => [styles.openWsBtn, { borderColor: ws.color + '44' }, pressed && { opacity: 0.8 }]}
                  >
                    <MaterialIcons name={ws.icon as any} size={16} color={ws.color} />
                    <Text style={[styles.openWsBtnText, { color: ws.color }]}>Ouvrir {ws.name}</Text>
                    <MaterialIcons name="arrow-forward" size={14} color={ws.color} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Tip */}
        <View style={styles.tipCard}>
          <MaterialIcons name="tips-and-updates" size={18} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>Conversations multi-contexte</Text>
            <Text style={styles.tipText}>
              Créez plusieurs conversations par workspace pour isoler vos sujets. Chaque conversation conserve son propre historique indépendant.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau workspace</Text>
              <Pressable onPress={() => setShowCreate(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
                <ThemedInput label="Nom" value={newName} onChangeText={setNewName} placeholder="Ex: Recherche, Marketing..." />
                <ThemedInput label="Description" value={newDesc} onChangeText={setNewDesc} placeholder="Contexte d'utilisation..." />

                <View style={{ gap: Spacing.xs }}>
                  <Text style={styles.fieldLabel}>Couleur</Text>
                  <View style={styles.colorRow}>
                    {WORKSPACE_COLORS.map(c => (
                      <Pressable
                        key={c}
                        onPress={() => setNewColor(c)}
                        style={[styles.colorDot, { backgroundColor: c }, newColor === c ? styles.colorSelected : null]}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ gap: Spacing.xs }}>
                  <Text style={styles.fieldLabel}>Icône</Text>
                  <View style={styles.iconRow}>
                    {WORKSPACE_ICONS.map(ic => (
                      <Pressable
                        key={ic}
                        onPress={() => setNewIcon(ic)}
                        style={[styles.iconPickerBtn, newIcon === ic ? { backgroundColor: newColor + '33', borderColor: newColor } : null]}
                      >
                        <MaterialIcons name={ic as any} size={22} color={newIcon === ic ? newColor : Colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                <ThemedInput
                  label="Prompt système"
                  value={newPrompt}
                  onChangeText={setNewPrompt}
                  placeholder="Comportement de l'assistant pour ce workspace..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{ minHeight: 100 }}
                  mono
                />
              </View>
            </ScrollView>

            <View style={[styles.previewCard, { borderColor: newColor + '44', backgroundColor: newColor + '10' }]}>
              <View style={[styles.previewIcon, { backgroundColor: newColor + '22' }]}>
                <MaterialIcons name={newIcon as any} size={20} color={newColor} />
              </View>
              <View>
                <Text style={styles.previewName}>{newName || 'Nom du workspace'}</Text>
                <Text style={styles.previewDesc}>{newDesc || 'Description'}</Text>
              </View>
            </View>

            <Pressable
              onPress={handleCreate}
              style={({ pressed }) => [styles.primaryBtn, !newName.trim() ? styles.primaryBtnDisabled : null, pressed && { opacity: 0.8 }]}
              disabled={!newName.trim()}
            >
              <MaterialIcons name="add-circle" size={18} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>Créer le workspace</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FontSize.xl, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  createBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '600' },
  infoBanner: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primary + '15', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary + '33', padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  // Workspace block
  wsBlock: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  wsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md,
  },
  wsIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  wsInfo: { flex: 1, gap: 3 },
  wsNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  wsName: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700' },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  activeDot: { width: 5, height: 5, borderRadius: 3 },
  activeText: { fontSize: 10, fontWeight: '700' },
  wsDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  wsStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 2 },
  wsStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  wsStatText: { fontSize: FontSize.xs, color: Colors.textMuted },
  wsActions: { flexDirection: 'column', gap: Spacing.xs, alignItems: 'center' },
  iconBtn: { padding: Spacing.xs, borderRadius: Radius.sm },

  // Conversations section
  convSection: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
    padding: Spacing.md, gap: Spacing.sm,
  },
  convSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  convSectionTitle: {
    fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  addConvBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: 'transparent',
    backgroundColor: Colors.bgCard,
  },
  addConvBtnText: { fontSize: FontSize.xs, fontWeight: '600' },
  convRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm + 2,
  },
  convIcon: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  convInfo: { flex: 1, gap: 2 },
  convTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  convTitle: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600', flex: 1 },
  activeConvPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  convMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  convMsgCount: { fontSize: FontSize.xs, color: Colors.textMuted },
  convTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  convPreview: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  convEmpty: { fontSize: FontSize.xs, color: Colors.textMuted + '88', fontStyle: 'italic' },
  convActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  convDeleteBtn: { padding: Spacing.xs },
  openWsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.xs,
  },
  openWsBtnText: { fontSize: FontSize.sm, fontWeight: '600', flex: 1, textAlign: 'center' },

  tipCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.warning + '10', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.warning + '33', padding: Spacing.md,
  },
  tipTitle: { fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600', marginBottom: 4 },
  tipText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  // Modal
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
  colorDot: { width: 32, height: 32, borderRadius: 16 },
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
  previewIcon: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700' },
  previewDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: FontSize.body, color: Colors.bg, fontWeight: '700' },
});
