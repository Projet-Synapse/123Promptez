// Powered by OnSpace.AI
// Chat screen — OnSpace AI integration + language injection + conversation rename
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBot } from '@/hooks/useBot';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProfile } from '@/contexts/ProfileContext';
import { ChatBubble } from '@/components';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { sendChatMessage } from '@/services/chatService';
import { useAlert } from '@/template';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { activeWorkspace, toggleMode, addConversation, removeConversation, renameConversation, setActiveConversation, addMessageToConversation, clearConversation, getActiveConversation, getDueTasks, completeTask } = useWorkspace();
  const { profile } = useProfile();
  const { showAlert } = useAlert();
  const { t, systemInjection } = useLanguage();
  const C = useThemeColors();

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

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [chatMessages, streamingText]);

  const activeModes = activeWorkspace.modes.filter(m => m.enabled);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || isLoading || !activeConversation) return;
    setInput(''); setIsLoading(true); setStreamingText('');
    addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'user', content: msg });
    const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
    try {
      let full = '';
      await sendChatMessage(
        msg, history, bot, activeWorkspace,
        (token) => { full = token; setStreamingText(full); },
        profile,
        getDueTasks(activeWorkspace.id),
        systemInjection
      );
      setStreamingText('');
      addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'assistant', content: full });
      getDueTasks(activeWorkspace.id).forEach(t => completeTask(activeWorkspace.id, t.id));
    } catch (err: any) {
      setStreamingText('');
      showAlert('Erreur', err.message || 'Erreur lors de la génération');
    } finally { setIsLoading(false); }
  };

  const startRename = (convId: string, currentTitle: string) => { setRenamingConvId(convId); setRenameValue(currentTitle); };
  const confirmRename = () => {
    if (renamingConvId && renameValue.trim()) renameConversation(activeWorkspace.id, renamingConvId, renameValue.trim());
    setRenamingConvId(null); setRenameValue('');
  };

  const enabledTools = bot.agentTools.filter(t => t.enabled);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Pressable onPress={() => setShowHistoryPanel(true)} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: C.bgCardAlt, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="history" size={20} color={C.textSecondary} />
            <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: C.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
              <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>{activeWorkspace.conversations.length}</Text>
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700', maxWidth: 140 }} numberOfLines={1}>{activeConversation?.title || t('newConversation')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: activeWorkspace.color + '22' }}>
                <MaterialIcons name={activeWorkspace.icon as any} size={11} color={activeWorkspace.color} />
                <Text style={{ fontSize: 10, fontWeight: '600', color: activeWorkspace.color }}>{activeWorkspace.name}</Text>
              </View>
            </View>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 1, fontFamily: 'monospace' }}>{bot.name} · OnSpace AI</Text>
          </View>
          <Pressable onPress={() => setShowModesPanel(true)} style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: activeModes.length > 0 ? C.accentGlow : C.bgCardAlt, borderWidth: 1, borderColor: activeModes.length > 0 ? C.accent + '55' : C.border, flexDirection: 'row', gap: 2 }, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="bolt" size={16} color={activeModes.length > 0 ? C.accent : C.textMuted} />
            {activeModes.length > 0 ? <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>{activeModes.length}</Text> : null}
          </Pressable>
          <Pressable onPress={() => {
            if (!activeConversation) return;
            showAlert(t('clearConversation'), t('clearConversationMsg'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('delete'), style: 'destructive', onPress: () => clearConversation(activeWorkspace.id, activeConversation.id) },
            ]);
          }} hitSlop={8}>
            <MaterialIcons name="delete-outline" size={22} color={C.textMuted} />
          </Pressable>
        </View>

        {/* Active modes bar */}
        {activeModes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs }}>
              {activeModes.map(mode => (
                <Pressable key={mode.id} onPress={() => toggleMode(activeWorkspace.id, mode.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, backgroundColor: mode.color + '20', borderColor: mode.color + '55' }}>
                  <MaterialIcons name={mode.icon as any} size={12} color={mode.color} />
                  <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: mode.color }}>{mode.label}</Text>
                  <MaterialIcons name="close" size={11} color={mode.color} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {/* Messages */}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: 0, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
          {chatMessages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: bot.avatarColor, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm }}>
                <MaterialIcons name="smart-toy" size={32} color="#fff" />
              </View>
              <Text style={{ fontSize: FontSize.lg, color: C.textPrimary, fontWeight: '700' }}>{t('newConversation')}</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
                {t('workspace')} <Text style={{ color: activeWorkspace.color, fontWeight: '600' }}>{activeWorkspace.name}</Text> · {bot.name}
              </Text>
              {activeWorkspace.modes.filter(m => m.shortcut).length > 0 ? (
                <View style={{ alignItems: 'center', gap: Spacing.xs, width: '100%' }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' }}>
                    {activeWorkspace.modes.filter(m => m.shortcut).map(m => (
                      <Pressable key={m.id} onPress={() => setInput(m.shortcut || '')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bgCardAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: m.color + '55' }}>
                        <MaterialIcons name={m.icon as any} size={12} color={m.color} />
                        <Text style={{ fontSize: FontSize.xs, fontWeight: '600', fontFamily: 'monospace', color: m.color }}>{m.shortcut}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {enabledTools.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' }}>
                  {enabledTools.map(tool => (
                    <View key={tool.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accentGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.accent + '33' }}>
                      <MaterialIcons name="bolt" size={12} color={C.accent} />
                      <Text style={{ fontSize: FontSize.xs, color: C.accent, fontFamily: 'monospace' }}>{tool.id}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ gap: Spacing.sm, width: '100%', paddingHorizontal: Spacing.sm }}>
                {['Que peux-tu faire pour moi ?', 'Résume ta base de connaissances', 'Comment tu fonctionnes ?'].map(s => (
                  <Pressable key={s} onPress={() => setInput(s)} style={({ pressed }) => [{ backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: C.border }, pressed && { opacity: 0.7 }]}>
                    <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {chatMessages.map(msg => (
            <ChatBubble key={msg.id} message={msg} botName={bot.name} botColor={bot.avatarColor} />
          ))}

          {streamingText ? (
            <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', marginBottom: Spacing.md }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bot.avatarColor, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="smart-toy" size={14} color="#fff" />
              </View>
              <View style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, flexDirection: 'row' }}>
                <Text style={{ flex: 1, color: C.textPrimary, fontSize: FontSize.body, lineHeight: 22 }}>{streamingText}</Text>
                <View style={{ width: 2, height: 18, backgroundColor: C.accent, marginLeft: 4, alignSelf: 'center' }} />
              </View>
            </View>
          ) : null}

          {isLoading && !streamingText ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm }}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={{ fontSize: FontSize.sm, color: C.textMuted }}>{t('generating')}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Input */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: insets.bottom + Spacing.sm, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border }}>
          <TextInput
            style={{ flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: C.textPrimary, fontSize: FontSize.body }}
            value={input} onChangeText={setInput}
            placeholder={t('typeMessage')} placeholderTextColor={C.textMuted}
            multiline maxLength={4000} onSubmitEditing={handleSend}
          />
          <Pressable onPress={handleSend} disabled={isLoading || !input.trim()} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() && !isLoading ? C.accent : C.bgCardAlt, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.8 }]}>
            <MaterialIcons name="send" size={20} color={input.trim() && !isLoading ? C.bg : C.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ─── History Panel ────────────────────────────────── */}
      <Modal visible={showHistoryPanel} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setShowHistoryPanel(false)}>
          <Pressable style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg, maxHeight: '85%' }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center' }} />
            <View style={{ gap: Spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, alignSelf: 'flex-start', backgroundColor: activeWorkspace.color + '22' }}>
                <MaterialIcons name={activeWorkspace.icon as any} size={15} color={activeWorkspace.color} />
                <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: activeWorkspace.color }}>{activeWorkspace.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>{t('conversationHistory')}</Text>
                <Pressable onPress={() => { addConversation(activeWorkspace.id); setShowHistoryPanel(false); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill }, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="add" size={16} color="#fff" />
                  <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>{t('new')}</Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>{activeWorkspace.conversations.length} {t('conversations').toLowerCase()}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {[...activeWorkspace.conversations].reverse().map(conv => {
                const isActive = conv.id === activeWorkspace.activeConversationId;
                const lastMsg = conv.messages[conv.messages.length - 1];
                const isRenaming = renamingConvId === conv.id;
                return (
                  <Pressable key={conv.id} onPress={() => { if (!isRenaming) { setActiveConversation(activeWorkspace.id, conv.id); setShowHistoryPanel(false); } }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: isActive ? activeWorkspace.color + '10' : C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: isActive ? activeWorkspace.color + '66' : C.border, padding: Spacing.md, marginBottom: Spacing.sm }, pressed && !isRenaming && { opacity: 0.75 }]}>
                    <View style={{ width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: isActive ? activeWorkspace.color + '22' : C.bgCard, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={isActive ? 'chat-bubble' : 'chat-bubble-outline'} size={18} color={isActive ? activeWorkspace.color : C.textMuted} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      {isRenaming ? (
                        <TextInput style={{ backgroundColor: C.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.primary, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.sm, paddingVertical: 4, fontWeight: '600' }} value={renameValue} onChangeText={setRenameValue} onBlur={confirmRename} onSubmitEditing={confirmRename} autoFocus selectTextOnFocus />
                      ) : (
                        <Text style={{ fontSize: FontSize.body, color: isActive ? C.textPrimary : C.textSecondary, fontWeight: '600' }} numberOfLines={1}>{conv.title}</Text>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{conv.messages.length} msg</Text>
                        {conv.messages.length > 0 ? <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{formatRelativeTime(conv.updatedAt)}</Text> : null}
                      </View>
                      {lastMsg && !isRenaming ? <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontStyle: 'italic' }} numberOfLines={1}>{lastMsg.role === 'user' ? 'Vous: ' : 'IA: '}{lastMsg.content}</Text> : null}
                    </View>
                    <View style={{ flexDirection: 'column', gap: Spacing.xs }}>
                      <Pressable onPress={() => startRename(conv.id, conv.title)} hitSlop={8} style={{ padding: Spacing.xs }}><MaterialIcons name="edit" size={15} color={C.textMuted} /></Pressable>
                      <Pressable onPress={() => showAlert(`Supprimer "${conv.title}" ?`, '', [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => removeConversation(activeWorkspace.id, conv.id) }])} hitSlop={8} style={{ padding: Spacing.xs }}><MaterialIcons name="delete-outline" size={15} color={C.textMuted} /></Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Modes Panel ──────────────────────────────────── */}
      <Modal visible={showModesPanel} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setShowModesPanel(false)}>
          <Pressable style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg, maxHeight: '80%' }} onPress={() => {}}>
            <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center' }} />
            <View style={{ gap: Spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, alignSelf: 'flex-start', backgroundColor: activeWorkspace.color + '22' }}>
                <MaterialIcons name={activeWorkspace.icon as any} size={16} color={activeWorkspace.color} />
                <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: activeWorkspace.color }}>{activeWorkspace.name}</Text>
              </View>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>{t('modes')}</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>Activez des comportements automatiques pour ce workspace</Text>
            </View>
            {activeWorkspace.modes.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
                <MaterialIcons name="widgets" size={32} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.body, color: C.textSecondary }}>Aucun mode configuré</Text>
              </View>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeWorkspace.modes.map(mode => (
                <Pressable key={mode.id} onPress={() => toggleMode(activeWorkspace.id, mode.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: mode.enabled ? mode.color + '10' : C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: mode.enabled ? mode.color + '66' : C.border, padding: Spacing.md, marginBottom: Spacing.sm }, pressed && { opacity: 0.75 }]}>
                  <View style={{ width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: mode.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={mode.icon as any} size={22} color={mode.color} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                      <Text style={{ fontSize: FontSize.body, color: mode.enabled ? C.textPrimary : C.textSecondary, fontWeight: '600' }}>{mode.label}</Text>
                      {mode.shortcut ? <View style={{ backgroundColor: C.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.border }}><Text style={{ fontSize: FontSize.xs, color: C.textMono, fontFamily: 'monospace' }}>{mode.shortcut}</Text></View> : null}
                    </View>
                    <Text style={{ fontSize: FontSize.sm, color: C.textMuted, lineHeight: 17 }}>{mode.description}</Text>
                  </View>
                  <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: mode.enabled ? mode.color : C.bgCard, borderWidth: 1, borderColor: mode.enabled ? mode.color : C.border, justifyContent: 'center', paddingHorizontal: 3 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: mode.enabled ? '#fff' : C.textMuted, alignSelf: mode.enabled ? 'flex-end' : 'flex-start' }} />
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
