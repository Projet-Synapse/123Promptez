// Powered by OnSpace.AI
// Workspaces screen — adds workspace rename functionality + conversation rename
import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ThemedInput } from '@/components';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Workspace } from '@/contexts/WorkspaceContext';

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
  const C = useThemeColors();
  const { t } = useLanguage();
  const {
    workspaces, activeWorkspaceId, setActiveWorkspace, addWorkspace,
    updateWorkspace, removeWorkspace, addConversation, removeConversation,
    renameConversation, setActiveConversation,
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

  // Workspace rename state
  const [renamingWsId, setRenamingWsId] = useState<string | null>(null);
  const [wsRenameValue, setWsRenameValue] = useState('');

  // Conversation rename state
  const [renamingConvKey, setRenamingConvKey] = useState<{ wsId: string; convId: string } | null>(null);
  const [convRenameValue, setConvRenameValue] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    addWorkspace({ name: newName.trim(), description: newDesc.trim(), icon: newIcon, color: newColor, systemPrompt: newPrompt.trim() || "Tu es un assistant IA utile et précis.", modes: [], database: { rootFiles: [], folders: [] } });
    setNewName(''); setNewDesc(''); setNewPrompt(''); setNewColor(WORKSPACE_COLORS[0]); setNewIcon(WORKSPACE_ICONS[0]);
    setShowCreate(false);
  };

  const handleDelete = (ws: Workspace) => {
    if (workspaces.length <= 1) { showAlert('Impossible', 'Vous devez conserver au moins un workspace.'); return; }
    showAlert(`${t('deleteWorkspace')}`, t('deleteWorkspaceMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => removeWorkspace(ws.id) },
    ]);
  };

  const handleSelectAndNavigate = (wsId: string, convId?: string) => {
    setActiveWorkspace(wsId);
    if (convId) setActiveConversation(wsId, convId);
    router.push('/(tabs)/chat');
  };

  // Workspace rename
  const startRenameWs = (ws: Workspace) => {
    setRenamingWsId(ws.id);
    setWsRenameValue(ws.name);
  };
  const confirmRenameWs = () => {
    if (renamingWsId && wsRenameValue.trim()) {
      updateWorkspace(renamingWsId, { name: wsRenameValue.trim() });
    }
    setRenamingWsId(null);
    setWsRenameValue('');
  };

  // Conversation rename
  const startRenameConv = (wsId: string, convId: string, title: string) => {
    setRenamingConvKey({ wsId, convId });
    setConvRenameValue(title);
  };
  const confirmRenameConv = () => {
    if (renamingConvKey && convRenameValue.trim()) {
      renameConversation(renamingConvKey.wsId, renamingConvKey.convId, convRenameValue.trim());
    }
    setRenamingConvKey(null);
    setConvRenameValue('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: FontSize.xl, color: C.textPrimary, fontWeight: FontWeight.bold }}>{t('workspaces')}</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }}>{workspaces.length} espace{workspaces.length > 1 ? 's' : ''} de travail</Text>
          </View>
          <Pressable onPress={() => setShowCreate(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill }, pressed && { opacity: 0.8 }]}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>{t('new')}</Text>
          </Pressable>
        </View>

        {/* Info Banner */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: C.primary + '15', borderRadius: Radius.md, borderWidth: 1, borderColor: C.primary + '33', padding: Spacing.md }}>
          <MaterialIcons name="info-outline" size={16} color={C.primary} />
          <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 19 }}>
            Chaque workspace possède ses propres conversations, compétences et base de données.
          </Text>
        </View>

        {/* Workspace list */}
        {workspaces.map(ws => {
          const isActive = ws.id === activeWorkspaceId;
          const isExpanded = expandedWsId === ws.id;
          const isRenamingThis = renamingWsId === ws.id;
          const activeModeCount = ws.modes.filter(m => m.enabled).length;
          const totalMessages = ws.conversations.reduce((acc, c) => acc + c.messages.length, 0);

          return (
            <View key={ws.id} style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: isActive ? ws.color + '55' : C.border, overflow: 'hidden' }}>
              <Pressable onPress={() => !isRenamingThis && setExpandedWsId(isExpanded ? null : ws.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md }, pressed && !isRenamingThis && { opacity: 0.85 }]}>
                <View style={{ width: 48, height: 48, borderRadius: Radius.md, backgroundColor: ws.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={ws.icon as any} size={22} color={ws.color} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
                    {isRenamingThis ? (
                      <TextInput
                        style={{ flex: 1, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: ws.color, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.sm, paddingVertical: 4, fontWeight: '700', minWidth: 120 }}
                        value={wsRenameValue}
                        onChangeText={setWsRenameValue}
                        onBlur={confirmRenameWs}
                        onSubmitEditing={confirmRenameWs}
                        autoFocus
                        selectTextOnFocus
                      />
                    ) : (
                      <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{ws.name}</Text>
                    )}
                    {isActive && !isRenamingThis ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: ws.color + '22' }}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ws.color }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: ws.color }}>{t('activeWorkspace')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {!isRenamingThis ? (
                    <>
                      <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }} numberOfLines={1}>{ws.description || 'Aucune description'}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 2 }}>
                        {[
                          { icon: 'chat-bubble-outline', text: `${ws.conversations.length} conv.` },
                          { icon: 'forum', text: `${totalMessages} msg` },
                          { icon: 'widgets', text: `${ws.modes.length} compétences` },
                        ].map(s => (
                          <View key={s.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <MaterialIcons name={s.icon as any} size={11} color={C.textMuted} />
                            <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{s.text}</Text>
                          </View>
                        ))}
                        {activeModeCount > 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <MaterialIcons name="bolt" size={11} color={C.accent} />
                            <Text style={{ fontSize: FontSize.xs, color: C.accent }}>{activeModeCount} actif{activeModeCount !== 1 ? 's' : ''}</Text>
                          </View>
                        ) : null}
                      </View>
                    </>
                  ) : null}
                </View>
                {!isRenamingThis ? (
                  <View style={{ flexDirection: 'column', gap: Spacing.xs, alignItems: 'center' }}>
                    <Pressable onPress={() => startRenameWs(ws)} hitSlop={8} style={({ pressed }) => [{ padding: Spacing.xs, borderRadius: Radius.sm }, pressed && { opacity: 0.6 }]}>
                      <MaterialIcons name="edit" size={17} color={C.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => router.push({ pathname: '/workspace-settings', params: { wsId: ws.id } })} hitSlop={8} style={({ pressed }) => [{ padding: Spacing.xs, borderRadius: Radius.sm }, pressed && { opacity: 0.6 }]}>
                      <MaterialIcons name="settings" size={17} color={C.textSecondary} />
                    </Pressable>
                    {workspaces.length > 1 ? (
                      <Pressable onPress={() => handleDelete(ws)} hitSlop={8} style={({ pressed }) => [{ padding: Spacing.xs, borderRadius: Radius.sm }, pressed && { opacity: 0.6 }]}>
                        <MaterialIcons name="delete-outline" size={17} color={C.textMuted} />
                      </Pressable>
                    ) : null}
                    <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color={C.textMuted} />
                  </View>
                ) : (
                  <Pressable onPress={confirmRenameWs} style={{ padding: Spacing.sm, backgroundColor: ws.color + '22', borderRadius: Radius.sm }}>
                    <MaterialIcons name="check" size={18} color={ws.color} />
                  </Pressable>
                )}
              </Pressable>

              {/* Conversations */}
              {isExpanded && !isRenamingThis ? (
                <View style={{ borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgCardAlt, padding: Spacing.md, gap: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs }}>
                    <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>{t('conversations')}</Text>
                    <Pressable onPress={() => addConversation(ws.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: C.bgCard }, pressed && { opacity: 0.8 }]}>
                      <MaterialIcons name="add" size={14} color={ws.color} />
                      <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: ws.color }}>{t('new')}</Text>
                    </Pressable>
                  </View>
                  {[...ws.conversations].reverse().map(conv => {
                    const isActiveConv = conv.id === ws.activeConversationId && ws.id === activeWorkspaceId;
                    const lastMsg = conv.messages[conv.messages.length - 1];
                    const isRenamingConv = renamingConvKey?.wsId === ws.id && renamingConvKey?.convId === conv.id;
                    return (
                      <Pressable
                        key={conv.id}
                        onPress={() => !isRenamingConv && handleSelectAndNavigate(ws.id, conv.id)}
                        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: isActiveConv ? ws.color + '66' : C.border, padding: Spacing.sm + 2, backgroundColor: isActiveConv ? ws.color + '0C' : C.bgCard }, pressed && !isRenamingConv && { opacity: 0.75 }]}
                      >
                        <View style={{ width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: isActiveConv ? ws.color + '22' : C.bgCardAlt, alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name={conv.messages.length > 0 ? 'chat-bubble' : 'chat-bubble-outline'} size={16} color={isActiveConv ? ws.color : C.textMuted} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          {isRenamingConv ? (
                            <TextInput
                              style={{ backgroundColor: C.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: ws.color, color: C.textPrimary, fontSize: FontSize.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, fontWeight: '600' }}
                              value={convRenameValue}
                              onChangeText={setConvRenameValue}
                              onBlur={confirmRenameConv}
                              onSubmitEditing={confirmRenameConv}
                              autoFocus
                              selectTextOnFocus
                            />
                          ) : (
                            <Text style={{ fontSize: FontSize.sm, color: isActiveConv ? C.textPrimary : C.textSecondary, fontWeight: '600' }} numberOfLines={1}>{conv.title}</Text>
                          )}
                          {!isRenamingConv ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                              <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{conv.messages.length} msg</Text>
                              {conv.messages.length > 0 ? <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{formatRelativeTime(conv.updatedAt)}</Text> : null}
                            </View>
                          ) : null}
                          {lastMsg && !isRenamingConv ? <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontStyle: 'italic' }} numberOfLines={1}>{lastMsg.role === 'user' ? 'Vous: ' : 'IA: '}{lastMsg.content}</Text> : null}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {isRenamingConv ? (
                            <Pressable onPress={confirmRenameConv} style={{ padding: Spacing.xs, backgroundColor: ws.color + '22', borderRadius: Radius.sm }}>
                              <MaterialIcons name="check" size={14} color={ws.color} />
                            </Pressable>
                          ) : (
                            <>
                              <Pressable onPress={() => startRenameConv(ws.id, conv.id, conv.title)} hitSlop={10} style={{ padding: Spacing.xs }}>
                                <MaterialIcons name="edit" size={14} color={C.textMuted} />
                              </Pressable>
                              <Pressable onPress={() => removeConversation(ws.id, conv.id)} hitSlop={10} style={{ padding: Spacing.xs }}>
                                <MaterialIcons name="delete-outline" size={15} color={C.textMuted} />
                              </Pressable>
                              <MaterialIcons name="chevron-right" size={18} color={ws.color + '88'} />
                            </>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={() => handleSelectAndNavigate(ws.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: ws.color + '44', borderRadius: Radius.md, paddingVertical: Spacing.sm, marginTop: Spacing.xs }, pressed && { opacity: 0.8 }]}>
                    <MaterialIcons name={ws.icon as any} size={16} color={ws.color} />
                    <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: ws.color, flex: 1, textAlign: 'center' }}>Ouvrir {ws.name}</Text>
                    <MaterialIcons name="arrow-forward" size={14} color={ws.color} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Tip */}
        <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.warning + '10', borderRadius: Radius.md, borderWidth: 1, borderColor: C.warning + '33', padding: Spacing.md }}>
          <MaterialIcons name="tips-and-updates" size={18} color={C.warning} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FontSize.sm, color: C.warning, fontWeight: '600', marginBottom: 4 }}>Conversations multi-contexte</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 18 }}>Créez plusieurs conversations par workspace pour isoler vos sujets. Appuyez sur ✏️ pour renommer.</Text>
          </View>
        </View>
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>{t('newWorkspace')}</Text>
              <Pressable onPress={() => setShowCreate(false)} hitSlop={8}><MaterialIcons name="close" size={22} color={C.textSecondary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
                <ThemedInput label="Nom" value={newName} onChangeText={setNewName} placeholder="Ex: Recherche, Marketing..." />
                <ThemedInput label="Description" value={newDesc} onChangeText={setNewDesc} placeholder="Contexte d'utilisation..." />
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 }}>Couleur</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {WORKSPACE_COLORS.map(c => (
                      <Pressable key={c} onPress={() => setNewColor(c)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: newColor === c ? 3 : 0, borderColor: '#fff' }} />
                    ))}
                  </View>
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.8 }}>Icône</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {WORKSPACE_ICONS.map(ic => (
                      <Pressable key={ic} onPress={() => setNewIcon(ic)} style={{ width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: newIcon === ic ? newColor + '33' : C.bgCardAlt, borderWidth: 1, borderColor: newIcon === ic ? newColor : C.border }}>
                        <MaterialIcons name={ic as any} size={22} color={newIcon === ic ? newColor : C.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>
                <ThemedInput label="Prompt système" value={newPrompt} onChangeText={setNewPrompt} placeholder="Comportement de l'assistant..." multiline numberOfLines={4} textAlignVertical="top" style={{ minHeight: 100 }} mono />
              </View>
            </ScrollView>
            {/* Preview */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: newColor + '44', backgroundColor: newColor + '10', padding: Spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: newColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={newIcon as any} size={20} color={newColor} />
              </View>
              <View>
                <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{newName || 'Nom du workspace'}</Text>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>{newDesc || 'Description'}</Text>
              </View>
            </View>
            <Pressable onPress={handleCreate} disabled={!newName.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: !newName.trim() ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="add-circle" size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>{t('create')} le workspace</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
