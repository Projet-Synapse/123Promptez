// Powered by OnSpace.AI
// Chat screen — side drawer history + attachment button + response mode selector
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
  Animated, Dimensions,
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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

// ─── Response Modes ───────────────────────────────────────────────────────────
type ResponseMode = 'auto' | 'normal' | 'quick' | 'deep';
const RESPONSE_MODES: { id: ResponseMode; label: string; icon: string; desc: string; color: string; tempMod: number; tokensMod: number }[] = [
  { id: 'auto',   label: 'Auto',       icon: 'auto-awesome',   desc: 'Adapte la longueur au contexte',    color: '#3D7EFF', tempMod: 0,     tokensMod: 0 },
  { id: 'normal', label: 'Normal',     icon: 'chat-bubble',    desc: 'Réponse équilibrée',                color: '#00CC6A', tempMod: 0,     tokensMod: 0 },
  { id: 'quick',  label: 'Rapide',     icon: 'flash-on',       desc: 'Réponse courte et directe',         color: '#FFB800', tempMod: -0.2,  tokensMod: -1024 },
  { id: 'deep',   label: 'Réfléchie',  icon: 'psychology',     desc: 'Analyse approfondie et détaillée',  color: '#9B59B6', tempMod: +0.15, tokensMod: +2048 },
];

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

// ─── Attachment action sheet ──────────────────────────────────────────────────
function AttachSheet({
  visible, onClose, onPickFile, onPickImage, responseMode, onChangeMode,
}: {
  visible: boolean;
  onClose: () => void;
  onPickFile: () => void;
  onPickImage: () => void;
  responseMode: ResponseMode;
  onChangeMode: (m: ResponseMode) => void;
}) {
  const C = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
          <View style={{ width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.xs }} />

          {/* Attachments */}
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Joindre</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {[
              { icon: 'upload-file', label: 'Fichier', color: '#3D7EFF', onPress: () => { onClose(); setTimeout(onPickFile, 300); } },
              { icon: 'image', label: 'Image', color: '#00CC6A', onPress: () => { onClose(); setTimeout(onPickImage, 300); } },
            ].map(b => (
              <Pressable key={b.label} onPress={b.onPress} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: b.color + '44', backgroundColor: b.color + '12' }, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name={b.icon as any} size={24} color={b.color} />
                <Text style={{ fontSize: FontSize.sm, color: b.color, fontWeight: '700' }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Response mode */}
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.xs }}>Mode de réponse</Text>
          <View style={{ gap: Spacing.xs }}>
            {RESPONSE_MODES.map(m => {
              const active = responseMode === m.id;
              return (
                <Pressable key={m.id} onPress={() => { onChangeMode(m.id); onClose(); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: active ? m.color + '88' : C.border, backgroundColor: active ? m.color + '12' : C.bgCardAlt }, pressed && { opacity: 0.75 }]}>
                  <View style={{ width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: m.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={m.icon as any} size={20} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.body, color: active ? m.color : C.textPrimary, fontWeight: '600' }}>{m.label}</Text>
                    <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>{m.desc}</Text>
                  </View>
                  {active ? <MaterialIcons name="check-circle" size={20} color={m.color} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Side Drawer ──────────────────────────────────────────────────────────────
function SideDrawer({
  open,
  onClose,
  activeWorkspace,
  workspaces,
  setActiveWorkspace,
  setActiveConversation,
  addConversation,
  removeConversation,
  renameConversation,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  activeWorkspace: any;
  workspaces: any[];
  setActiveWorkspace: (id: string) => void;
  setActiveConversation: (wsId: string, convId: string) => void;
  addConversation: (wsId: string) => void;
  removeConversation: (wsId: string, convId: string) => void;
  renameConversation: (wsId: string, convId: string, name: string) => void;
  onNavigate: (wsId: string, convId?: string) => void;
}) {
  const C = useThemeColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const { showAlert } = useAlert();

  // Renaming
  const [renamingConvKey, setRenamingConvKey] = useState<{ wsId: string; convId: string } | null>(null);
  const [renameVal, setRenameVal] = useState('');

  // Pinned conversation ids
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Expanded workspace sections
  const [expandedWsIds, setExpandedWsIds] = useState<Set<string>>(new Set([activeWorkspace.id]));

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: open ? 0 : -DRAWER_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [open]);

  const togglePin = (convId: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  const toggleExpandWs = (wsId: string) => {
    setExpandedWsIds(prev => {
      const next = new Set(prev);
      if (next.has(wsId)) next.delete(wsId);
      else next.add(wsId);
      return next;
    });
  };

  const confirmRename = () => {
    if (renamingConvKey && renameVal.trim()) {
      renameConversation(renamingConvKey.wsId, renamingConvKey.convId, renameVal.trim());
    }
    setRenamingConvKey(null);
    setRenameVal('');
  };

  return (
    <>
      {/* Backdrop */}
      {open ? (
        <Pressable
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}
          onPress={onClose}
        />
      ) : null}

      {/* Drawer panel */}
      <Animated.View style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 0,
        width: DRAWER_WIDTH,
        backgroundColor: C.bgCard,
        borderRightWidth: 1,
        borderRightColor: C.border,
        zIndex: 101,
        transform: [{ translateX: slideAnim }],
      }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Drawer header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Conversations</Text>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: Spacing.xs }}>
              <MaterialIcons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
            {workspaces.map(ws => {
              const isCurrentWs = ws.id === activeWorkspace.id;
              const isExpanded = expandedWsIds.has(ws.id);
              const pinned = ws.conversations.filter((c: any) => pinnedIds.has(c.id));
              const unpinned = ws.conversations.filter((c: any) => !pinnedIds.has(c.id));
              const sortedConvs = [...pinned, ...unpinned].reverse();

              return (
                <View key={ws.id}>
                  {/* Workspace header row */}
                  <Pressable
                    onPress={() => toggleExpandWs(ws.id)}
                    style={({ pressed }) => [{
                      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
                      backgroundColor: isCurrentWs ? ws.color + '10' : 'transparent',
                      borderLeftWidth: 3, borderLeftColor: isCurrentWs ? ws.color : 'transparent',
                    }, pressed && { opacity: 0.8 }]}
                  >
                    <View style={{ width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: ws.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={ws.icon as any} size={16} color={ws.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.sm, color: isCurrentWs ? ws.color : C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{ws.name}</Text>
                      <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{ws.conversations.length} conversation{ws.conversations.length !== 1 ? 's' : ''}</Text>
                    </View>
                    <Pressable
                      onPress={() => { setActiveWorkspace(ws.id); addConversation(ws.id); onClose(); }}
                      hitSlop={6}
                      style={{ padding: 4, borderRadius: Radius.sm, backgroundColor: ws.color + '22' }}
                    >
                      <MaterialIcons name="add" size={16} color={ws.color} />
                    </Pressable>
                    <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={C.textMuted} />
                  </Pressable>

                  {/* Conversations */}
                  {isExpanded ? (
                    <View style={{ backgroundColor: C.bgCardAlt }}>
                      {sortedConvs.length === 0 ? (
                        <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }}>
                          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontStyle: 'italic' }}>Aucune conversation</Text>
                        </View>
                      ) : null}
                      {sortedConvs.map((conv: any) => {
                        const isActiveConv = conv.id === ws.activeConversationId && isCurrentWs;
                        const isPinned = pinnedIds.has(conv.id);
                        const isRenaming = renamingConvKey?.wsId === ws.id && renamingConvKey?.convId === conv.id;
                        const lastMsg = conv.messages[conv.messages.length - 1];
                        return (
                          <Pressable
                            key={conv.id}
                            onPress={() => { if (!isRenaming) { onNavigate(ws.id, conv.id); onClose(); } }}
                            style={({ pressed }) => [{
                              flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                              paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                              paddingLeft: Spacing.lg,
                              backgroundColor: isActiveConv ? ws.color + '18' : 'transparent',
                              borderLeftWidth: 2, borderLeftColor: isPinned ? ws.color + '88' : 'transparent',
                            }, pressed && !isRenaming && { opacity: 0.75 }]}
                          >
                            <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: isActiveConv ? ws.color + '22' : C.bgCard, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isPinned
                                ? <MaterialIcons name="push-pin" size={13} color={ws.color} />
                                : <MaterialIcons name={conv.messages.length > 0 ? 'chat-bubble' : 'chat-bubble-outline'} size={13} color={isActiveConv ? ws.color : C.textMuted} />
                              }
                            </View>
                            <View style={{ flex: 1, gap: 1 }}>
                              {isRenaming ? (
                                <TextInput
                                  style={{ backgroundColor: C.bg, borderRadius: 4, borderWidth: 1, borderColor: ws.color, color: C.textPrimary, fontSize: FontSize.sm, paddingHorizontal: Spacing.xs, paddingVertical: 2, fontWeight: '600' }}
                                  value={renameVal}
                                  onChangeText={setRenameVal}
                                  onBlur={confirmRename}
                                  onSubmitEditing={confirmRename}
                                  autoFocus
                                  selectTextOnFocus
                                />
                              ) : (
                                <Text style={{ fontSize: FontSize.sm, color: isActiveConv ? C.textPrimary : C.textSecondary, fontWeight: isActiveConv ? '700' : '500' }} numberOfLines={1}>{conv.title}</Text>
                              )}
                              {!isRenaming && lastMsg ? (
                                <Text style={{ fontSize: 10, color: C.textMuted, fontStyle: 'italic' }} numberOfLines={1}>
                                  {lastMsg.role === 'user' ? 'Vous: ' : 'IA: '}{lastMsg.content}
                                </Text>
                              ) : null}
                              {!isRenaming ? (
                                <Text style={{ fontSize: 10, color: C.textMuted }}>{conv.messages.length} msg{conv.messages.length !== 1 ? 's' : ''}{conv.messages.length > 0 ? ` · ${formatRelativeTime(conv.updatedAt)}` : ''}</Text>
                              ) : null}
                            </View>
                            {/* Actions */}
                            {!isRenaming ? (
                              <View style={{ flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                                <Pressable onPress={() => togglePin(conv.id)} hitSlop={8} style={{ padding: 3 }}>
                                  <MaterialIcons name={isPinned ? 'push-pin' : 'push-pin'} size={13} color={isPinned ? ws.color : C.textMuted} />
                                </Pressable>
                                <Pressable onPress={() => { setRenamingConvKey({ wsId: ws.id, convId: conv.id }); setRenameVal(conv.title); }} hitSlop={8} style={{ padding: 3 }}>
                                  <MaterialIcons name="edit" size={13} color={C.textMuted} />
                                </Pressable>
                                <Pressable onPress={() => showAlert(`Supprimer "${conv.title}" ?`, '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => removeConversation(ws.id, conv.id) }])} hitSlop={8} style={{ padding: 3 }}>
                                  <MaterialIcons name="delete-outline" size={13} color={C.textMuted} />
                                </Pressable>
                              </View>
                            ) : (
                              <Pressable onPress={confirmRename} style={{ padding: 4, backgroundColor: ws.color + '22', borderRadius: 4 }}>
                                <MaterialIcons name="check" size={14} color={ws.color} />
                              </Pressable>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </>
  );
}

// ─── Main Chat Screen ─────────────────────────────────────────────────────────
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { bot } = useBot();
  const {
    workspaces, activeWorkspace, toggleMode, addConversation, removeConversation,
    renameConversation, setActiveConversation, setActiveWorkspace,
    addMessageToConversation, clearConversation, getActiveConversation,
    getDueTasks, completeTask,
  } = useWorkspace();
  const { profile } = useProfile();
  const { showAlert } = useAlert();
  const { t, systemInjection } = useLanguage();
  const C = useThemeColors();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showModesPanel, setShowModesPanel] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>('auto');

  // Attachment context: appended to the next message
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; content: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const activeConversation = getActiveConversation(activeWorkspace.id);
  const chatMessages = activeConversation?.messages ?? [];

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [chatMessages, streamingText]);

  const activeModes = activeWorkspace.modes.filter((m: any) => m.enabled);
  const currentModeInfo = RESPONSE_MODES.find(m => m.id === responseMode) ?? RESPONSE_MODES[0];

  // ── Attachment handlers ──────────────────────────────────────────
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'application/json', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      let content = '';
      try {
        const r = await fetch(asset.uri);
        content = await r.text();
        if (content.length > 20000) content = content.slice(0, 20000) + '\n[... Tronqué]';
      } catch { content = `[Fichier: ${asset.name}]`; }
      setPendingAttachment({ name: asset.name ?? 'fichier', content });
    } catch (e: any) { showAlert('Erreur', e.message ?? 'Impossible d\'importer'); }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission requise', "L'accès à la galerie est nécessaire."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() ?? 'image.jpg';
      setPendingAttachment({ name, content: `[IMAGE JOINTE: ${name} — ${asset.width}x${asset.height}px]\nURI: ${asset.uri}` });
    } catch (e: any) { showAlert('Erreur', e.message ?? 'Impossible d\'importer'); }
  };

  // ── Send ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    let msg = input.trim();
    if ((!msg && !pendingAttachment) || isLoading || !activeConversation) return;

    // Append attachment content to message
    if (pendingAttachment) {
      msg = msg
        ? `${msg}\n\n[PIÈCE JOINTE: ${pendingAttachment.name}]\n${pendingAttachment.content}`
        : `[PIÈCE JOINTE: ${pendingAttachment.name}]\n${pendingAttachment.content}`;
      setPendingAttachment(null);
    }

    setInput(''); setIsLoading(true); setStreamingText('');
    addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'user', content: msg });
    const history = chatMessages.map((m: any) => ({ role: m.role, content: m.content }));

    // Adjust bot params for response mode
    const modeInfo = RESPONSE_MODES.find(m => m.id === responseMode) ?? RESPONSE_MODES[0];
    const adjustedBot = {
      ...bot,
      llmConfig: {
        ...bot.llmConfig,
        temperature: Math.max(0, Math.min(2, bot.llmConfig.temperature + modeInfo.tempMod)),
        maxTokens: Math.max(256, bot.llmConfig.maxTokens + modeInfo.tokensMod),
      },
    };

    // Build lang injection with mode context
    const modeInjection = responseMode !== 'auto' && responseMode !== 'normal'
      ? `\n[MODE: ${modeInfo.label.toUpperCase()}] ${modeInfo.desc}.`
      : '';

    try {
      let full = '';
      await sendChatMessage(
        msg, history, adjustedBot, activeWorkspace,
        (token) => { full = token; setStreamingText(full); },
        profile,
        getDueTasks(activeWorkspace.id),
        (systemInjection ?? '') + modeInjection
      );
      setStreamingText('');
      addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'assistant', content: full });
      getDueTasks(activeWorkspace.id).forEach((task: any) => completeTask(activeWorkspace.id, task.id));
    } catch (err: any) {
      setStreamingText('');
      showAlert('Erreur', err.message || 'Erreur lors de la génération');
    } finally { setIsLoading(false); }
  };

  const handleNavigate = (wsId: string, convId?: string) => {
    setActiveWorkspace(wsId);
    if (convId) setActiveConversation(wsId, convId);
  };

  const enabledTools = bot.agentTools.filter((tool: any) => tool.enabled);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Side Drawer */}
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeWorkspace={activeWorkspace}
        workspaces={workspaces}
        setActiveWorkspace={setActiveWorkspace}
        setActiveConversation={setActiveConversation}
        addConversation={addConversation}
        removeConversation={removeConversation}
        renameConversation={renameConversation}
        onNavigate={handleNavigate}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
            {/* Drawer toggle */}
            <Pressable onPress={() => setDrawerOpen(true)} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: C.bgCardAlt, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="menu" size={20} color={C.textSecondary} />
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
                {activeModes.map((mode: any) => (
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
                {activeWorkspace.modes.filter((m: any) => m.shortcut).length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' }}>
                    {activeWorkspace.modes.filter((m: any) => m.shortcut).map((m: any) => (
                      <Pressable key={m.id} onPress={() => setInput(m.shortcut || '')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bgCardAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: m.color + '55' }}>
                        <MaterialIcons name={m.icon as any} size={12} color={m.color} />
                        <Text style={{ fontSize: FontSize.xs, fontWeight: '600', fontFamily: 'monospace', color: m.color }}>{m.shortcut}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {enabledTools.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' }}>
                    {enabledTools.map((tool: any) => (
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

            {chatMessages.map((msg: any) => (
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

          {/* Pending attachment badge */}
          {pendingAttachment ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, backgroundColor: C.primary + '18', borderTopWidth: 1, borderTopColor: C.primary + '33' }}>
              <MaterialIcons name="attach-file" size={16} color={C.primary} />
              <Text style={{ flex: 1, fontSize: FontSize.xs, color: C.primary, fontWeight: '600' }} numberOfLines={1}>{pendingAttachment.name}</Text>
              <Pressable onPress={() => setPendingAttachment(null)} hitSlop={8}>
                <MaterialIcons name="close" size={16} color={C.primary} />
              </Pressable>
            </View>
          ) : null}

          {/* Input bar */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: insets.bottom + Spacing.sm, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border }}>
            {/* Attach + mode button */}
            <Pressable
              onPress={() => setShowAttachSheet(true)}
              style={({ pressed }) => [{
                width: 44, height: 44, borderRadius: 22,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: responseMode !== 'auto' ? currentModeInfo.color + '22' : C.bgCard,
                borderWidth: 1,
                borderColor: responseMode !== 'auto' ? currentModeInfo.color + '66' : C.border,
              }, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons
                name={responseMode !== 'auto' ? currentModeInfo.icon as any : 'add'}
                size={20}
                color={responseMode !== 'auto' ? currentModeInfo.color : C.textSecondary}
              />
            </Pressable>

            <TextInput
              style={{ flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: C.textPrimary, fontSize: FontSize.body }}
              value={input} onChangeText={setInput}
              placeholder={pendingAttachment ? `Message + "${pendingAttachment.name}"` : t('typeMessage')}
              placeholderTextColor={C.textMuted}
              multiline maxLength={4000}
            />

            <Pressable onPress={handleSend} disabled={isLoading || (!input.trim() && !pendingAttachment)} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: (input.trim() || pendingAttachment) && !isLoading ? C.accent : C.bgCardAlt, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="send" size={20} color={(input.trim() || pendingAttachment) && !isLoading ? C.bg : C.textMuted} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Attach + Mode sheet */}
      <AttachSheet
        visible={showAttachSheet}
        onClose={() => setShowAttachSheet(false)}
        onPickFile={handlePickFile}
        onPickImage={handlePickImage}
        responseMode={responseMode}
        onChangeMode={setResponseMode}
      />

      {/* Modes Panel */}
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
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>Activez des comportements automatiques</Text>
            </View>
            {activeWorkspace.modes.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
                <MaterialIcons name="widgets" size={32} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.body, color: C.textSecondary }}>Aucun mode configuré</Text>
              </View>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeWorkspace.modes.map((mode: any) => (
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
    </View>
  );
}
