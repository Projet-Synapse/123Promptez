// Powered by OnSpace.AI
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBot } from '@/hooks/useBot';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ChatBubble } from '@/components';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { sendChatMessage } from '@/services/chatService';
import { useAlert } from '@/template';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { bot } = useBot();
  const {
    activeWorkspace,
    toggleMode,
    addConversation,
    removeConversation,
    renameConversation,
    setActiveConversation,
    addMessageToConversation,
    clearConversation,
    getActiveConversation,
  } = useWorkspace();
  const { showAlert } = useAlert();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showModesPanel, setShowModesPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const activeConversation = getActiveConversation(activeWorkspace.id);
  const chatMessages = activeConversation?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [chatMessages, streamingText]);

  const activeModes = activeWorkspace.modes.filter(m => m.enabled);

  const processInputShortcuts = (text: string): string => {
    for (const mode of activeWorkspace.modes) {
      if (mode.shortcut && text.trim().toLowerCase() === mode.shortcut.toLowerCase()) {
        if (!mode.enabled) toggleMode(activeWorkspace.id, mode.id);
        return '';
      }
    }
    return text;
  };

  const handleSend = async () => {
    let msg = input.trim();
    if (!msg || isLoading || !activeConversation) return;

    const processed = processInputShortcuts(msg);
    if (processed === '' && msg.startsWith('/')) {
      setInput('');
      return;
    }

    setInput('');
    setIsLoading(true);
    setStreamingText('');

    addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'user', content: msg });

    const history = chatMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      let full = '';
      await sendChatMessage(msg, history, bot, activeWorkspace, (token) => {
        full += token;
        setStreamingText(full);
      });
      setStreamingText('');
      addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'assistant', content: full });
    } catch (err: any) {
      setStreamingText('');
      showAlert('Erreur', err.message || 'Erreur lors de la génération');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    addConversation(activeWorkspace.id);
    setShowHistoryPanel(false);
  };

  const handleDeleteConversation = (convId: string, convTitle: string) => {
    showAlert(
      `Supprimer "${convTitle}" ?`,
      'Cette conversation sera définitivement supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeConversation(activeWorkspace.id, convId) },
      ]
    );
  };

  const handleClearConversation = () => {
    if (!activeConversation) return;
    showAlert(
      'Effacer la conversation ?',
      'Tous les messages seront supprimés mais la conversation sera conservée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Effacer', style: 'destructive', onPress: () => clearConversation(activeWorkspace.id, activeConversation.id) },
      ]
    );
  };

  const startRename = (convId: string, currentTitle: string) => {
    setRenamingConvId(convId);
    setRenameValue(currentTitle);
  };

  const confirmRename = () => {
    if (renamingConvId && renameValue.trim()) {
      renameConversation(activeWorkspace.id, renamingConvId, renameValue.trim());
    }
    setRenamingConvId(null);
    setRenameValue('');
  };

  const enabledTools = bot.agentTools.filter(t => t.enabled);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* History button */}
          <Pressable
            onPress={() => setShowHistoryPanel(true)}
            style={({ pressed }) => [styles.historyBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="history" size={20} color={Colors.textSecondary} />
            <View style={styles.convCountBadge}>
              <Text style={styles.convCountText}>{activeWorkspace.conversations.length}</Text>
            </View>
          </Pressable>

          <View style={{ flex: 1 }}>
            <View style={styles.headerNameRow}>
              <Text style={styles.convTitle} numberOfLines={1}>
                {activeConversation?.title || 'Conversation'}
              </Text>
              <View style={[styles.wsBadge, { backgroundColor: activeWorkspace.color + '22' }]}>
                <MaterialIcons name={activeWorkspace.icon as any} size={11} color={activeWorkspace.color} />
                <Text style={[styles.wsBadgeText, { color: activeWorkspace.color }]}>{activeWorkspace.name}</Text>
              </View>
            </View>
            <Text style={styles.botModel}>{bot.name} · {bot.llmConfig.model}</Text>
          </View>

          {/* Modes toggle */}
          <Pressable
            onPress={() => setShowModesPanel(true)}
            style={({ pressed }) => [
              styles.modesBtn,
              activeModes.length > 0 ? styles.modesBtnActive : null,
              pressed && { opacity: 0.7 },
            ]}
          >
            <MaterialIcons name="bolt" size={16} color={activeModes.length > 0 ? Colors.accent : Colors.textMuted} />
            {activeModes.length > 0 ? (
              <Text style={styles.modesBtnText}>{activeModes.length}</Text>
            ) : null}
          </Pressable>

          <Pressable onPress={handleClearConversation} hitSlop={8}>
            <MaterialIcons name="delete-outline" size={22} color={Colors.textMuted} />
          </Pressable>
        </View>

        {/* Active modes bar */}
        {activeModes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeModesBar}>
            <View style={styles.activeModesContent}>
              {activeModes.map(mode => (
                <Pressable
                  key={mode.id}
                  onPress={() => toggleMode(activeWorkspace.id, mode.id)}
                  style={[styles.activeModeChip, { backgroundColor: mode.color + '20', borderColor: mode.color + '55' }]}
                >
                  <MaterialIcons name={mode.icon as any} size={12} color={mode.color} />
                  <Text style={[styles.activeModeChipText, { color: mode.color }]}>{mode.label}</Text>
                  <MaterialIcons name="close" size={11} color={mode.color} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={[styles.messagesContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {chatMessages.length === 0 ? (
            <View style={styles.emptyChat}>
              <View style={[styles.emptyAvatar, { backgroundColor: bot.avatarColor }]}>
                <MaterialIcons name="smart-toy" size={32} color="#fff" />
              </View>
              <Text style={styles.emptyTitle}>Nouvelle conversation</Text>
              <Text style={styles.emptySub}>
                Workspace <Text style={{ color: activeWorkspace.color, fontWeight: '600' }}>{activeWorkspace.name}</Text> · {bot.name}
              </Text>

              {activeWorkspace.modes.filter(m => m.shortcut).length > 0 ? (
                <View style={styles.shortcutsHint}>
                  <Text style={styles.shortcutsTitle}>Raccourcis disponibles :</Text>
                  <View style={styles.shortcutsRow}>
                    {activeWorkspace.modes.filter(m => m.shortcut).map(m => (
                      <Pressable
                        key={m.id}
                        onPress={() => setInput(m.shortcut || '')}
                        style={[styles.shortcutChip, { borderColor: m.color + '55' }]}
                      >
                        <MaterialIcons name={m.icon as any} size={12} color={m.color} />
                        <Text style={[styles.shortcutChipText, { color: m.color }]}>{m.shortcut}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {enabledTools.length > 0 ? (
                <View style={styles.toolsPreview}>
                  {enabledTools.map(t => (
                    <View key={t.id} style={styles.toolChip}>
                      <MaterialIcons name="bolt" size={12} color={Colors.accent} />
                      <Text style={styles.toolChipText}>{t.id}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.suggestionGrid}>
                {[
                  'Que peux-tu faire pour moi ?',
                  'Résume ta base de connaissances',
                  'Comment tu fonctionnes ?',
                ].map(s => (
                  <Pressable
                    key={s}
                    onPress={() => setInput(s)}
                    style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {chatMessages.map(msg => (
            <ChatBubble key={msg.id} message={msg} botName={bot.name} botColor={bot.avatarColor} />
          ))}

          {streamingText ? (
            <View style={styles.streamingBubble}>
              <View style={[styles.botAvatarSmall, { backgroundColor: bot.avatarColor }]}>
                <MaterialIcons name="smart-toy" size={14} color="#fff" />
              </View>
              <View style={styles.streamingContent}>
                <Text style={styles.streamingText}>{streamingText}</Text>
                <View style={styles.cursor} />
              </View>
            </View>
          ) : null}

          {isLoading && !streamingText ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.loadingText}>Génération en cours...</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message ou /raccourci..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={4000}
            onSubmitEditing={handleSend}
          />
          <Pressable
            onPress={handleSend}
            disabled={isLoading || !input.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || isLoading) ? styles.sendBtnDisabled : null,
              pressed && { opacity: 0.8 },
            ]}
          >
            <MaterialIcons name="send" size={20} color={input.trim() && !isLoading ? Colors.bg : Colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ─── History Panel ─────────────────────────────────────────── */}
      <Modal visible={showHistoryPanel} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowHistoryPanel(false)}>
          <Pressable style={[styles.historyPanel, { paddingBottom: insets.bottom + Spacing.lg }]} onPress={() => {}}>
            <View style={styles.panelHandle} />

            <View style={styles.historyPanelHeader}>
              <View style={[styles.wsBadgeLg, { backgroundColor: activeWorkspace.color + '22' }]}>
                <MaterialIcons name={activeWorkspace.icon as any} size={15} color={activeWorkspace.color} />
                <Text style={[styles.wsBadgeLgText, { color: activeWorkspace.color }]}>{activeWorkspace.name}</Text>
              </View>
              <View style={styles.historyPanelTitleRow}>
                <Text style={styles.panelTitle}>Historique des conversations</Text>
                <Pressable
                  onPress={handleNewConversation}
                  style={({ pressed }) => [styles.newConvBtn, pressed && { opacity: 0.8 }]}
                >
                  <MaterialIcons name="add" size={16} color="#fff" />
                  <Text style={styles.newConvBtnText}>Nouvelle</Text>
                </Pressable>
              </View>
              <Text style={styles.panelSub}>
                {activeWorkspace.conversations.length} conversation{activeWorkspace.conversations.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {[...activeWorkspace.conversations].reverse().map(conv => {
                const isActive = conv.id === activeWorkspace.activeConversationId;
                const lastMsg = conv.messages[conv.messages.length - 1];
                const isRenaming = renamingConvId === conv.id;

                return (
                  <Pressable
                    key={conv.id}
                    onPress={() => {
                      if (!isRenaming) {
                        setActiveConversation(activeWorkspace.id, conv.id);
                        setShowHistoryPanel(false);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.convRow,
                      isActive ? { borderColor: activeWorkspace.color + '66', backgroundColor: activeWorkspace.color + '10' } : null,
                      pressed && !isRenaming && { opacity: 0.75 },
                    ]}
                  >
                    <View style={[styles.convRowIcon, { backgroundColor: isActive ? activeWorkspace.color + '22' : Colors.bgCard }]}>
                      <MaterialIcons
                        name={isActive ? 'chat-bubble' : 'chat-bubble-outline'}
                        size={18}
                        color={isActive ? activeWorkspace.color : Colors.textMuted}
                      />
                    </View>
                    <View style={styles.convRowInfo}>
                      {isRenaming ? (
                        <TextInput
                          style={styles.renameInput}
                          value={renameValue}
                          onChangeText={setRenameValue}
                          onBlur={confirmRename}
                          onSubmitEditing={confirmRename}
                          autoFocus
                          selectTextOnFocus
                        />
                      ) : (
                        <Text style={[styles.convRowTitle, isActive ? { color: Colors.textPrimary } : null]} numberOfLines={1}>
                          {conv.title}
                        </Text>
                      )}
                      <View style={styles.convRowMeta}>
                        <Text style={styles.convRowCount}>
                          {conv.messages.length} message{conv.messages.length !== 1 ? 's' : ''}
                        </Text>
                        {conv.messages.length > 0 ? (
                          <Text style={styles.convRowTime}>{formatRelativeTime(conv.updatedAt)}</Text>
                        ) : null}
                      </View>
                      {lastMsg && !isRenaming ? (
                        <Text style={styles.convRowPreview} numberOfLines={1}>
                          {lastMsg.role === 'user' ? 'Vous: ' : 'IA: '}{lastMsg.content}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.convRowActions}>
                      <Pressable onPress={() => startRename(conv.id, conv.title)} hitSlop={8} style={styles.convActionBtn}>
                        <MaterialIcons name="edit" size={15} color={Colors.textMuted} />
                      </Pressable>
                      <Pressable onPress={() => handleDeleteConversation(conv.id, conv.title)} hitSlop={8} style={styles.convActionBtn}>
                        <MaterialIcons name="delete-outline" size={15} color={Colors.textMuted} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Modes Panel ───────────────────────────────────────────── */}
      <Modal visible={showModesPanel} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowModesPanel(false)}>
          <Pressable style={[styles.modesPanel, { paddingBottom: insets.bottom + Spacing.lg }]} onPress={() => {}}>
            <View style={styles.panelHandle} />
            <View style={styles.modesPanelHeader}>
              <View style={[styles.wsBadgeLg, { backgroundColor: activeWorkspace.color + '22' }]}>
                <MaterialIcons name={activeWorkspace.icon as any} size={16} color={activeWorkspace.color} />
                <Text style={[styles.wsBadgeLgText, { color: activeWorkspace.color }]}>{activeWorkspace.name}</Text>
              </View>
              <Text style={styles.panelTitle}>Modes d'interaction</Text>
              <Text style={styles.panelSub}>Activez des comportements automatiques pour ce workspace</Text>
            </View>

            {activeWorkspace.modes.length === 0 ? (
              <View style={styles.emptyModes}>
                <MaterialIcons name="widgets" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyModesText}>Aucun mode configuré</Text>
                <Text style={styles.emptyModesSub}>Configurez des modes dans les Paramètres du workspace</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              {activeWorkspace.modes.map(mode => (
                <Pressable
                  key={mode.id}
                  onPress={() => toggleMode(activeWorkspace.id, mode.id)}
                  style={({ pressed }) => [
                    styles.modePanelRow,
                    mode.enabled ? { borderColor: mode.color + '66', backgroundColor: mode.color + '10' } : null,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={[styles.modePanelIcon, { backgroundColor: mode.color + '22' }]}>
                    <MaterialIcons name={mode.icon as any} size={22} color={mode.color} />
                  </View>
                  <View style={styles.modePanelInfo}>
                    <View style={styles.modePanelTitleRow}>
                      <Text style={[styles.modePanelLabel, mode.enabled ? { color: Colors.textPrimary } : null]}>
                        {mode.label}
                      </Text>
                      {mode.shortcut ? (
                        <View style={styles.shortcutBadge}>
                          <Text style={styles.shortcutBadgeText}>{mode.shortcut}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.modePanelDesc}>{mode.description}</Text>
                  </View>
                  <View style={[styles.modeToggleTrack, mode.enabled ? { backgroundColor: mode.color } : null]}>
                    <View style={[styles.modeToggleThumb, mode.enabled ? styles.modeToggleThumbOn : null]} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  historyBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  convCountBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  convCountText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  convTitle: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '700', maxWidth: 140 },
  wsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.pill },
  wsBadgeText: { fontSize: 10, fontWeight: '600' },
  botModel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1, fontFamily: 'monospace' },
  modesBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCardAlt, borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', gap: 2,
  },
  modesBtnActive: { backgroundColor: Colors.accentGlow, borderColor: Colors.accent + '55' },
  modesBtnText: { fontSize: FontSize.xs, color: Colors.accent, fontWeight: '700' },
  activeModesBar: { backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  activeModesContent: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  activeModeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1,
  },
  activeModeChipText: { fontSize: FontSize.xs, fontWeight: '600' },
  messages: { flex: 1 },
  messagesContent: { padding: Spacing.md, gap: 0 },
  emptyChat: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  emptyAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: '700' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  shortcutsHint: { alignItems: 'center', gap: Spacing.xs, width: '100%' },
  shortcutsTitle: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  shortcutsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' },
  shortcutChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bgCardAlt, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  shortcutChipText: { fontSize: FontSize.xs, fontWeight: '600', fontFamily: 'monospace' },
  toolsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' },
  toolChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accentGlow, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.accent + '33',
  },
  toolChipText: { fontSize: FontSize.xs, color: Colors.accent, fontFamily: 'monospace' },
  suggestionGrid: { gap: Spacing.sm, width: '100%', paddingHorizontal: Spacing.sm },
  suggestionChip: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  suggestionText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  streamingBubble: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', marginBottom: Spacing.md },
  botAvatarSmall: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  streamingContent: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, flexDirection: 'row',
  },
  streamingText: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.body, lineHeight: 22 },
  cursor: { width: 2, height: 18, backgroundColor: Colors.accent, marginLeft: 4, alignSelf: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: FontSize.body,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.bgCardAlt },

  // Shared panel styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  panelHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center' },
  panelTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  panelSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  wsBadgeLg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  wsBadgeLgText: { fontSize: FontSize.sm, fontWeight: '600' },

  // History panel
  historyPanel: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md, maxHeight: '85%',
  },
  historyPanelHeader: { gap: Spacing.xs },
  historyPanelTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newConvBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  newConvBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '600' },
  convRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  convRowIcon: { width: 38, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  convRowInfo: { flex: 1, gap: 2 },
  convRowTitle: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '600' },
  convRowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  convRowCount: { fontSize: FontSize.xs, color: Colors.textMuted },
  convRowTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  convRowPreview: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  convRowActions: { flexDirection: 'column', gap: Spacing.xs },
  convActionBtn: { padding: Spacing.xs },
  renameInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary,
    color: Colors.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    fontWeight: '600',
  },

  // Modes panel
  modesPanel: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md, maxHeight: '80%',
  },
  modesPanelHeader: { gap: Spacing.xs },
  emptyModes: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyModesText: { fontSize: FontSize.body, color: Colors.textSecondary },
  emptyModesSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  modePanelRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  modePanelIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  modePanelInfo: { flex: 1, gap: 3 },
  modePanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  modePanelLabel: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '600' },
  shortcutBadge: {
    backgroundColor: Colors.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  shortcutBadgeText: { fontSize: FontSize.xs, color: Colors.textMono, fontFamily: 'monospace' },
  modePanelDesc: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 17 },
  modeToggleTrack: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  modeToggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.textMuted },
  modeToggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },
});
