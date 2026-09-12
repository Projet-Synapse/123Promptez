// Powered by OnSpace.AI
// Chat screen — side drawer history + attachment button + response mode selector
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Dimensions, Linking, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useBot } from '@/hooks/useBot';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProfile } from '@/contexts/ProfileContext';
import { ChatBubble, IconButton } from '@/components';
import { MarkdownView } from '@/components/feature/Markdown';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { sendChatMessage } from '@/services/chatService';
import { useAlert } from '@/template';
import { useLanguage } from '@/contexts/LanguageContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/contexts/ToastContext';
import { useCommandPalette } from '@/contexts/CommandPaletteContext';
import { useAppData } from '@/contexts/AppDataContext';
import { SyncIndicator } from '@/components/feature/SyncIndicator';
import { WorkspaceSidePanel } from '@/components/feature/WorkspaceSidePanel';
import { DragLayer } from '@/components/feature/dnd';
import { ResizeHandle } from '@/components/feature/ResizeHandle';
import { getActiveCapabilities, type AgentCapability } from '@/services/agentCapabilities';
import {
  parseToolCalls, stripToolCalls, executeClientTool, formatToolResults,
  type ClientToolCall, type ToolOutcome,
} from '@/services/agentClientTools';
import { AGENT_TOOLS, CONNECTOR_PRESETS } from '@/constants/config';
import { resolveGitHubToken, vaultWriteFile } from '@/services/vaultService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

/** Ouvre une URL externe sans crasher sur natif (window n'existe pas hors web) */
function openExternal(url?: string) {
  if (!url) return;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

/** Texte de streaming throttlé : le markdown n'est ré-analysé qu'à intervalle
 *  régulier (le parsing à chaque token serait trop coûteux sur mobile). */
function useThrottledText(value: string, ms = 200): string {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);
  latest.current = value;
  const active = value !== '';
  useEffect(() => {
    if (!active) return;
    setShown(latest.current);
    const id = setInterval(() => setShown(latest.current), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return shown;
}

// Libellés conviviaux des outils agent — les capacités affichées dans le
// popover « + » viennent désormais de services/agentCapabilities.ts (source
// de vérité partagée avec le prompt système).

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

// ─── Activity feed (before the answer) ────────────────────────────────────────
export type ActivityStatus = 'running' | 'done';
export interface ChatActivity { key: string; label: string; icon: string; status: ActivityStatus; detail?: string }

// Flux d'activités SANS bulle : liste plate en filigrane sous l'avatar,
// avec une ligne de détail (fichier concerné, taille, extrait de console…).
function ActivityFeed({ activities }: { activities: ChatActivity[] }) {
  const C = useThemeColors();
  if (activities.length === 0) return null;
  return (
    <View style={{ gap: 6, marginBottom: Spacing.sm, paddingLeft: Spacing.xs }}>
      {activities.map(a => (
        <View key={a.key}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            {a.status === 'running'
              ? <ActivityIndicator size="small" color={C.accent} />
              : <MaterialIcons name="check-circle" size={14} color="#00CC6A" />}
            <MaterialIcons name={a.icon as any} size={13} color={a.status === 'running' ? C.accent : C.textMuted} />
            <Text style={{ fontSize: FontSize.xs, color: a.status === 'running' ? C.accent : C.textSecondary, fontWeight: a.status === 'running' ? '600' : '400' }} numberOfLines={1}>
              {a.label}
            </Text>
          </View>
          {a.detail ? (
            <Text style={{ marginLeft: 38, marginTop: 1, fontSize: 10, lineHeight: 14, color: C.textMuted, fontFamily: 'monospace' }} numberOfLines={3}>
              {a.detail}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ─── Plus popover (mini-panel above the + button) ─────────────────────────────
function PlusPopover({
  visible, onClose, onPickFile, onPickImage, responseMode, onChangeMode,
  capabilities, connectedApps, onToggleConnectedApp, agentTools, onToggleAgentTool, bottomInset,
}: {
  visible: boolean;
  onClose: () => void;
  onPickFile: () => void;
  onPickImage: () => void;
  responseMode: ResponseMode;
  onChangeMode: (m: ResponseMode) => void;
  capabilities: AgentCapability[];
  connectedApps: { id: string; presetId?: string; name: string; description: string; enabled: boolean; webhookUrl?: string }[];
  onToggleConnectedApp: (id: string, enabled: boolean) => void;
  agentTools: { id: string; enabled: boolean }[];
  onToggleAgentTool: (id: string) => void;
  bottomInset: number;
}) {
  const C = useThemeColors();
  if (!visible) return null;
  return (
    <View style={{ position: 'absolute', inset: 0, zIndex: 200 }} pointerEvents="box-none">
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={{ position: 'absolute', left: Spacing.sm, bottom: bottomInset + 76,
        width: 320, maxHeight: 560, backgroundColor: C.bgCard, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm,
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}>
        <ScrollView style={{ flexGrow: 0 }} nestedScrollEnabled>
        {/* Joindre + mode de réponse */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {[
            { icon: 'upload-file', label: 'Fichier', color: '#3D7EFF', onPress: () => { onClose(); setTimeout(onPickFile, 250); } },
            { icon: 'image', label: 'Image', color: '#00CC6A', onPress: () => { onClose(); setTimeout(onPickImage, 250); } },
          ].map(b => (
            <Pressable key={b.label} onPress={b.onPress} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: b.color + '44', backgroundColor: b.color + '12' }, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name={b.icon as any} size={18} color={b.color} />
              <Text style={{ fontSize: FontSize.sm, color: b.color, fontWeight: '700' }}>{b.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Mode de réponse — chips compactes */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {RESPONSE_MODES.map(m => {
            const active = responseMode === m.id;
            return (
              <Pressable key={m.id} onPress={() => onChangeMode(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? m.color + '88' : C.border, backgroundColor: active ? m.color + '18' : C.bgCardAlt }}>
                <MaterialIcons name={m.icon as any} size={13} color={active ? m.color : C.textMuted} />
                <Text style={{ fontSize: FontSize.xs, color: active ? m.color : C.textSecondary, fontWeight: '600' }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 1, backgroundColor: C.border }} />

        {/* Capacités RÉELLES de l'agent — source de vérité partagée (agentCapabilities) */}
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Capacités de l’agent</Text>
        <View style={{ gap: 2 }}>
          {capabilities.map(c => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.xs }}>
              <View style={{ width: 26, height: 26, borderRadius: Radius.sm, backgroundColor: C.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={(c.icon as any) || 'check'} size={14} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600' }}>{c.label}</Text>
                <Text style={{ fontSize: 10, color: C.textMuted }} numberOfLines={2}>{c.description}</Text>
              </View>
              <MaterialIcons name="check-circle" size={15} color="#00CC6A" />
            </View>
          ))}
          {capabilities.length === 0 ? (
            <Text style={{ fontSize: FontSize.sm, color: C.textMuted, paddingVertical: 4 }}>
              Aucune capacité active — ajoutez des fichiers, des tâches ou connectez un service.
            </Text>
          ) : null}

          {/* Connecteurs — mêmes presets que le Builder (source de vérité partagée) */}
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.xs }}>Connecteurs</Text>
          <View style={{ gap: 2 }}>
            {CONNECTOR_PRESETS.map(p => {
              const existing = connectedApps.find(a => a.id === p.id || a.presetId === p.id);
              const enabled = existing?.enabled ?? false;
              const ghToken = p.id === 'github' ? resolveGitHubToken(connectedApps) : null;
              const connected = p.id === 'supabase' ? enabled : enabled && !!ghToken;
              return (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.xs }}>
                  <View style={{ width: 26, height: 26, borderRadius: Radius.sm, backgroundColor: connected ? '#00CC6A' + '22' : C.bgCardAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome name={p.icon as any} size={14} color={connected ? '#00CC6A' : C.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.sm, color: enabled ? C.textPrimary : C.textMuted, fontWeight: '600' }}>
                      {p.label}
                      <Text style={{ fontSize: 10, fontWeight: '700', color: connected ? '#00CC6A' : C.warning }}> {connected ? '· Connecté' : enabled ? '· À connecter' : ''}</Text>
                    </Text>
                    <Text style={{ fontSize: 10, color: C.textMuted }} numberOfLines={1}>{p.description}</Text>
                  </View>
                  {p.id === 'github' && enabled && !ghToken ? (
                    <Pressable
                      onPress={() => openExternal((p as any).connectUrl)}
                      style={({ pressed }) => [{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: '#24292F' }, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>Connecter</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => onToggleConnectedApp(p.id, !enabled)}
                      hitSlop={6}
                      style={{ width: 34, height: 19, borderRadius: 10, backgroundColor: enabled ? '#00CC6A' : C.bgCardAlt, borderWidth: 1, borderColor: enabled ? '#00CC6A' : C.border, justifyContent: 'center', paddingHorizontal: 2 }}
                      accessibilityLabel={enabled ? `Désactiver ${p.label}` : `Activer ${p.label}`}
                    >
                      <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: enabled ? '#fff' : C.textMuted, alignSelf: enabled ? 'flex-end' : 'flex-start' }} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {/* Outils IA — bascules synchronisées avec le Builder */}
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.xs }}>Outils IA</Text>
          <View style={{ gap: 2 }}>
            {AGENT_TOOLS.map(t => {
              const state = agentTools.find(x => x.id === t.id);
              const enabled = state?.enabled ?? false;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onToggleAgentTool(t.id)}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm }, pressed && { opacity: 0.7 }]}
                >
                  <View style={{ width: 26, height: 26, borderRadius: Radius.sm, backgroundColor: enabled ? C.accent + '22' : C.bgCardAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={t.icon as any} size={14} color={enabled ? C.accent : C.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.sm, color: enabled ? C.textPrimary : C.textMuted, fontWeight: '600' }}>{t.label}</Text>
                    <Text style={{ fontSize: 10, color: C.textMuted }} numberOfLines={1}>{t.description}</Text>
                  </View>
                  <View style={{ width: 34, height: 19, borderRadius: 10, backgroundColor: enabled ? C.accent : C.bgCardAlt, borderWidth: 1, borderColor: enabled ? C.accent : C.border, justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: enabled ? '#fff' : C.textMuted, alignSelf: enabled ? 'flex-end' : 'flex-start' }} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          </View>
          </ScrollView>
        </View>
      </View>
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
  // Largeur ajustable à la souris (poignée sur le bord droit), persistée
  const [drawerW, setDrawerW] = useState<number>(() => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return DRAWER_WIDTH;
    const v = parseInt(localStorage.getItem('promptez.drawerWidth') ?? '', 10);
    return Number.isFinite(v) ? Math.min(720, Math.max(260, v)) : DRAWER_WIDTH;
  });
  const drawerWRef = useRef(drawerW);
  drawerWRef.current = drawerW;
  // L'offset part de la largeur RÉELLE : sinon (offset -340 vs largeur 500)
  // un bout du tiroir fermé dépasse à l'écran — le « bug » de superposition.
  const slideAnim = useRef(new Animated.Value(-drawerW)).current;
  useEffect(() => {
    if (!open) slideAnim.setValue(-drawerW);
  }, [drawerW]);
  const { showAlert } = useAlert();

  // Renaming
  const [renamingConvKey, setRenamingConvKey] = useState<{ wsId: string; convId: string } | null>(null);
  const [renameVal, setRenameVal] = useState('');

  // Pinned conversation ids
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  // Multi-select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedConvKeys, setSelectedConvKeys] = useState<Set<string>>(new Set());
  const convKey = (wsId: string, convId: string) => `${wsId}::${convId}`;
  const toggleSelectConv = (wsId: string, convId: string) => {
    const k = convKey(wsId, convId);
    setSelectedConvKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedConvKeys(new Set()); };
  const bulkDeleteSelected = () => {
    const n = selectedConvKeys.size;
    if (n === 0) return;
    showAlert(`Supprimer ${n} conversation(s) ?`, 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => {
        selectedConvKeys.forEach(k => {
          const [wsId, convId] = k.split('::');
          removeConversation(wsId, convId);
        });
        exitSelectMode();
      }},
    ]);
  };

  // Expanded workspace sections
  const [expandedWsIds, setExpandedWsIds] = useState<Set<string>>(new Set([activeWorkspace.id]));

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: open ? 0 : -drawerWRef.current,
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
      {/* Backdrop — top/left/right/bottom explicites (« inset » est ignoré en RN) */}
      {open ? (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 900 }}
          onPress={onClose}
        />
      ) : null}

      {/* Drawer panel */}
      <Animated.View style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 0,
        width: drawerW,
        backgroundColor: C.bgCard,
        borderRightWidth: 1,
        borderRightColor: C.border,
        zIndex: 901,
        elevation: 24,
        transform: [{ translateX: slideAnim }],
      }}>
        {/* Poignée de redimensionnement (bord droit du tiroir) */}
        <ResizeHandle
          edge="right"
          width={drawerW}
          onResize={setDrawerW}
          onEnd={w => { if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem('promptez.drawerWidth', String(w)); }}
        />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Drawer header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Conversations</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconButton
                icon={selectMode ? 'close' : 'checklist'}
                label={selectMode ? 'Quitter la sélection' : 'Sélection multiple'}
                onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                bare
                size={20}
                color={selectMode ? C.accent : C.textSecondary}
              />
              <IconButton icon="close" label="Fermer l’historique" onPress={onClose} bare size={20} color={C.textSecondary} />
            </View>
          </View>
          {selectMode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCardAlt }}>
              <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600' }}>
                {selectedConvKeys.size} sélectionnée(s)
              </Text>
              <Pressable
                onPress={bulkDeleteSelected}
                disabled={selectedConvKeys.size === 0}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: C.error + '22', borderWidth: 1, borderColor: C.error + '55', opacity: selectedConvKeys.size === 0 ? 0.4 : 1 }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="delete-outline" size={14} color={C.error} />
                <Text style={{ fontSize: FontSize.xs, color: C.error, fontWeight: '700' }}>Supprimer</Text>
              </Pressable>
            </View>
          ) : null}

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
                            onPress={() => {
                              if (isRenaming) return;
                              if (selectMode) { toggleSelectConv(ws.id, conv.id); return; }
                              onNavigate(ws.id, conv.id); onClose();
                            }}
                            onLongPress={() => {
                              if (isRenaming) return;
                              if (!selectMode) setSelectMode(true);
                              toggleSelectConv(ws.id, conv.id);
                            }}
                            style={({ pressed }) => [{
                              flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                              paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                              paddingLeft: Spacing.lg,
                              backgroundColor: selectedConvKeys.has(convKey(ws.id, conv.id)) ? C.primary + '18' : (isActiveConv ? ws.color + '18' : 'transparent'),
                              borderLeftWidth: 2, borderLeftColor: isPinned ? ws.color + '88' : 'transparent',
                            }, pressed && !isRenaming && { opacity: 0.75 }]}
                          >
                            {selectMode ? (
                              <MaterialIcons
                                name={selectedConvKeys.has(convKey(ws.id, conv.id)) ? 'check-box' : 'check-box-outline-blank'}
                                size={18}
                                color={selectedConvKeys.has(convKey(ws.id, conv.id)) ? C.primary : C.textMuted}
                              />
                            ) : null}
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
                            {!isRenaming && !selectMode ? (
                              <View style={{ flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                                <Pressable onPress={() => togglePin(conv.id)} hitSlop={8} style={{ padding: 3 }} accessibilityLabel={isPinned ? 'Désépingler' : 'Épingler'}>
                                  <MaterialIcons name="push-pin" size={13} color={isPinned ? ws.color : C.textMuted} style={{ transform: [{ rotate: isPinned ? '0deg' : '45deg' }] }} />
                                </Pressable>
                                <Pressable onPress={() => { setRenamingConvKey({ wsId: ws.id, convId: conv.id }); setRenameVal(conv.title); }} hitSlop={8} style={{ padding: 3 }}>
                                  <MaterialIcons name="edit" size={13} color={C.textMuted} />
                                </Pressable>
                                <Pressable onPress={() => showAlert(`Supprimer "${conv.title}" ?`, '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => removeConversation(ws.id, conv.id) }])} hitSlop={8} style={{ padding: 3 }}>
                                  <MaterialIcons name="delete-outline" size={13} color={C.textMuted} />
                                </Pressable>
                              </View>
                            ) : !isRenaming && selectMode ? null : (
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
  const router = useRouter();
  const { bot, toggleAgentTool, updateConnectedApp } = useBot();
  const {
    workspaces, activeWorkspace, toggleMode, addConversation, removeConversation,
    renameConversation, setActiveConversation, setActiveWorkspace,
    addMessageToConversation, clearConversation, truncateMessagesAfter, getActiveConversation,
    getDueTasks, completeTask,
    updateFile, addFile, addSubFolder,
  } = useWorkspace();
  const { profile } = useProfile();
  const { showAlert } = useAlert();
  const { showToast } = useToast();
  const { openPalette } = useCommandPalette();
  const { reloadFromCloud } = useAppData();
  const { t, systemInjection } = useLanguage();
  const C = useThemeColors();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPlusPopover, setShowPlusPopover] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>('auto');

  // Attachment context: appended to the next message
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; content: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMsgRef = useRef<string>('');

  const activeConversation = getActiveConversation(activeWorkspace.id);
  const chatMessages = useMemo(() => activeConversation?.messages ?? [], [activeConversation]);

  // Dernier message utilisateur (éditable) + texte de streaming throttlé
  const lastUserMsgId = [...chatMessages].reverse().find((m: any) => m.role === 'user')?.id;
  const throttledStream = useThrottledText(streamingText);
  const inputRef = useRef<TextInput>(null);

  // Suivi de la position de scroll : l'auto-scroll ne s'applique que si
  // l'utilisateur est déjà en bas de la conversation.
  const isNearBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const handleChatScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 140;
    isNearBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom && chatMessages.length > 2);
  };

  useEffect(() => {
    if (isNearBottomRef.current) scrollRef.current?.scrollToEnd({ animated: true });
  }, [chatMessages, streamingText]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const api = (window as any).electronApp;
    if (!api?.onShortcut) return;
    const unsub = api.onShortcut((action: string) => {
      if (action === 'new-conversation') {
        const id = addConversation(activeWorkspace.id);
        setActiveConversation(activeWorkspace.id, id);
      }
    });
    return typeof unsub === 'function' ? unsub : undefined;
  }, [activeWorkspace.id, addConversation, setActiveConversation]);

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
  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setActivities([]);
    if (streamingText) {
      // Keep partial response if any
      if (activeConversation && streamingText.trim()) {
        addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'assistant', content: streamingText + '\n\n_[Génération interrompue]_' });
      }
      setStreamingText('');
    }
    showToast('Génération arrêtée', { tone: 'warning' });
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
      showToast('Message copié', { tone: 'success' });
    } catch {
      showToast('Impossible de copier', { tone: 'error' });
    }
  };

  // Ajoute une activité au flux défilant affiché pendant que l'IA travaille
  const pushActivity = (key: string, label: string, icon: string, detail?: string) => {
    setActivities(prev => {
      const without = prev.filter(a => a.key !== key);
      return [...without.map(a => ({ ...a, status: 'done' as ActivityStatus })), { key, label, icon, status: 'running' as ActivityStatus, detail }];
    });
  };

  const runGeneration = async (msg: string, history: { role: string; content: string }[], toolRound = 0) => {
    if (!activeConversation) return;
    setIsLoading(true); setStreamingText('');
    lastUserMsgRef.current = msg;

    const modeInfo = RESPONSE_MODES.find(m => m.id === responseMode) ?? RESPONSE_MODES[0];
    const adjustedBot = {
      ...bot,
      llmConfig: {
        ...bot.llmConfig,
        temperature: Math.max(0, Math.min(2, bot.llmConfig.temperature + modeInfo.tempMod)),
        // Le thinking adaptatif puise DANS max_tokens : un plafond trop bas
        // (8192) étouffe la 2e génération (contexte déjà chargé) → réponse vide.
        maxTokens: Math.max(8192, Math.min(32000, bot.llmConfig.maxTokens + modeInfo.tokensMod)),
      },
    };
    const modeInjection = responseMode !== 'auto' && responseMode !== 'normal'
      ? `\n[MODE: ${modeInfo.label.toUpperCase()}] ${modeInfo.desc}.`
      : '';

    // Check-list partagée : l'agent peut cocher les tâches du workspace en
    // écrivant leur marqueur [x:<id>] en fin de réponse (dépouillé à l'affichage).
    const pendingTasks = activeWorkspace.tasks.filter((t: any) => t.enabled);
    const tasksInjection = pendingTasks.length > 0
      ? `\n\n## TÂCHES DU WORKSPACE (check-list partagée avec l'utilisateur)\n${pendingTasks.map((t: any) => `- ${t.title} → marqueur : [x:${t.id}]`).join('\n')}\nSi tu viens réellement d'accomplir l'une de ces tâches durant cet échange, ajoute EXACTEMENT son marqueur (ex. [x:${pendingTasks[0].id}]) sur une ligne séparée à la toute fin de ta réponse. Ne l'ajoute jamais si la tâche n'est pas faite, et n'invente pas d'autre format.`
      : '';

    // Séquence d'activités défilantes avant/durant la réponse
    const wsDbFiles = [
      ...activeWorkspace.database.rootFiles,
      ...activeWorkspace.database.folders.flatMap((f: any) => [
        ...f.files,
        ...(f.subFolders ?? []).flatMap((s: any) => s.files),
      ]),
    ];
    // Activités qui S'ACCUMULENT entre les tours d'outils : les fichiers
    // lus/modifiés restent visibles pendant que l'IA poursuit sa réponse.
    setActivities(prev => [
      ...prev,
      { key: `reason-${toolRound}-${Date.now()}`, label: toolRound > 0 ? `Poursuite de la réponse (outils exécutés ci-dessus)…` : 'Raisonnement…', icon: 'psychology', status: 'running' as ActivityStatus },
    ]);
    const activityTimers: ReturnType<typeof setTimeout>[] = [];
    const scheduleActivity = (delay: number, key: string, label: string, icon: string, cond = true) => {
      if (!cond) return;
      activityTimers.push(setTimeout(() => { if (abortRef.current) pushActivity(key, label, icon); }, delay));
    };
    // Flux d'activités HONNÊTE : uniquement ce qui est réellement fait
    // (le contexte workspace est injecté dans le prompt, rien d'autre ne s'exécute)
    scheduleActivity(500, 'ctx', `Contexte du workspace : ${wsDbFiles.length} fichier(s), ${pendingTasks.length} tâche(s)`, 'folder-open', toolRound === 0 && (wsDbFiles.length > 0 || pendingTasks.length > 0));
    scheduleActivity(1000, 'gen', 'Rédaction de la réponse…', 'chat-bubble');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let full = '';
      await sendChatMessage(
        msg, history as any, adjustedBot, activeWorkspace,
        (token) => {
          full = token; setStreamingText(full);
          pushActivity('gen', 'Rédaction de la réponse…', 'chat-bubble');
        },
        profile,
        getDueTasks(activeWorkspace.id),
        (systemInjection ?? '') + modeInjection + tasksInjection,
        controller.signal,
        {
          // Outils serveur réels : l'IA peut lire les dépôts GitHub connectés
          // et la base Supabase (source de vérité : agentCapabilities).
          githubToken: resolveGitHubToken(bot.connectedApps) ?? undefined,
          supabaseTools: bot.connectedApps.some(a => a.enabled && (a.id === 'supabase' || a.presetId === 'supabase')),
          enabledTools: bot.agentTools.filter((t: any) => t.enabled).map((t: any) => t.id),
          onToolEvent: (label: string) => {
            pushActivity(`outil-${Date.now()}`, label, 'precision-manufacturing');
            // L'IA a écrit dans la bibliothèque côté serveur : on recharge
            // depuis le cloud pour que le changement apparaisse à l'écran.
            if (label.startsWith('Écriture dans la bibliothèque')) void reloadFromCloud();
          },
        },
      );
      setStreamingText('');
      // Réponse vide : on ne crée PAS de bulle vide. En plein milieu d'une
      // boucle d'outils, on l'explique VISIBLEMENT (et pas juste un toast).
      if (!full.trim()) {
        setActivities([]);
        if (toolRound > 0) {
          addMessageToConversation(activeWorkspace.id, activeConversation.id, {
            role: 'assistant',
            content: '_(La suite de la réponse n’a pas abouti — le modèle est reparti sans texte. Relance-moi pour que je continue.)_',
          });
        } else {
          showToast('Réponse vide du modèle — réessaie dans un instant', { tone: 'error' });
        }
        return;
      }
      // Dépouille les marqueurs de tâches cochées par l'agent : [x:task-…]
      const doneIds = [...full.matchAll(/\[x:(task-[a-zA-Z0-9-]+)\]/g)].map(m => m[1]);
      let finalContent = full;
      if (doneIds.length > 0) {
        finalContent = full.replace(/\s*\[x:task-[a-zA-Z0-9-]+\]/g, '').trim();
        doneIds.forEach(id => completeTask(activeWorkspace.id, id));
        showToast(`${doneIds.length} tâche(s) cochée(s)`, { tone: 'success' });
      }

      // ── Boucle d'outils CLIENT : [OUTIL:nom:{json}] → exécution réelle ──
      // L'application exécute les outils (bibliothèque, JS sandbox, GitHub)
      // puis relance l'IA avec les résultats (3 tours maximum).
      const toolCalls = parseToolCalls(finalContent);
      if (toolCalls.length > 0 && toolRound < 3) {
        const cleanContent = stripToolCalls(finalContent, toolCalls);
        if (cleanContent.trim()) {
          addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'assistant', content: cleanContent });
        }
        try {
          const outcomes: { call: ClientToolCall; outcome: ToolOutcome }[] = [];
          for (const call of toolCalls) {
            pushActivity(`outil-${call.name}-${outcomes.length}`, `Outil ${call.name}…`, 'precision-manufacturing');
            if (call.name === 'lire_fichier_github') {
              call.args = { ...call.args, token: resolveGitHubToken(bot.connectedApps) ?? undefined };
            }
            const outcome = await executeClientTool(call, activeWorkspace, {
              updateFile, addFile, addSubFolder,
              // Miroir disque : l'écriture de l'agent est répercutée dans le
              // dossier local relié (vault / dépôt local) si disponible.
              mirrorToDisk: (loc, relPath, content) => {
                const fld = activeWorkspace.database.folders.find((f: any) =>
                  typeof loc === 'string' ? loc === f.id : loc !== null && loc.folderId === f.id);
                const meta = fld?.vault ?? fld?.repo;
                if (meta && meta.sourceKind === 'local') void vaultWriteFile(meta, relPath, content);
              },
            });
            outcomes.push({ call, outcome });
            pushActivity(
              `outil-${call.name}-${outcomes.length - 1}`,
              outcome.summary,
              outcome.ok ? 'check-circle' : 'error-outline',
              outcome.detail.split('\n').slice(0, 3).join('\n').slice(0, 280),
            );
          }
          const resultsText = formatToolResults(outcomes);
          addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'user', content: resultsText });
          activityTimers.forEach(clearTimeout);
          const nextHistory = [
            ...history,
            { role: 'user', content: msg },
            ...(cleanContent.trim() ? [{ role: 'assistant', content: cleanContent }] : []),
          ];
          await runGeneration(resultsText, nextHistory, toolRound + 1);
          return;
        } catch (e: any) {
          // Un échec d'outil ne doit JAMAIS laisser la conversation suspendue
          // sans explication visible.
          setActivities([]);
          addMessageToConversation(activeWorkspace.id, activeConversation.id, {
            role: 'assistant',
            content: `_(Erreur pendant l’exécution des outils : ${e?.message ?? 'inconnue'} — tu peux me relancer.)_`,
          });
          return;
        }
      }
      if (toolCalls.length > 0) {
        // 3 tours déjà atteints : on retire les marqueurs et on conclut
        finalContent = `${stripToolCalls(finalContent, toolCalls)}\n\n_(Limite de 3 tours d'outils consécutifs atteinte — les actions restantes n'ont pas été exécutées.)_`;
      }
      setActivities([]);
      addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'assistant', content: finalContent });
      // NB : seuls les marqueurs [x:task-…] (voir ci-dessus) cochent les tâches.
      // On ne coche PAS toutes les tâches dues automatiquement : une tâche non
      // traitée par l'agent doit rester ouverte jusqu'à être réellement faite.
    } catch (err: any) {
      setStreamingText('');
      setActivities([]);
      if (err?.name === 'AbortError' || String(err?.message || '').includes('interrompue')) {
        // handled by handleStop / abort
      } else {
        showAlert('Erreur', err.message || 'Erreur lors de la génération');
      }
    } finally {
      activityTimers.forEach(clearTimeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleRegenerate = async (assistantMsgId: string) => {
    if (isLoading || !activeConversation) return;
    const msgs = activeConversation.messages;
    const idx = msgs.findIndex((m: any) => m.id === assistantMsgId);
    if (idx < 0) return;
    let userIdx = idx - 1;
    while (userIdx >= 0 && msgs[userIdx].role !== 'user') userIdx--;
    if (userIdx < 0) return;
    const userMsg = msgs[userIdx].content;
    const history = msgs.slice(0, userIdx).map((m: any) => ({ role: m.role, content: m.content }));
    truncateMessagesAfter(activeWorkspace.id, activeConversation.id, assistantMsgId);
    await runGeneration(userMsg, history);
  };

  // Éditer un message utilisateur : retire ce message et tout ce qui suit,
  // puis pré-remplit le champ de saisie (le renvoi est explicite).
  const handleEditUserMessage = (msgId: string, content: string) => {
    if (isLoading || !activeConversation) return;
    truncateMessagesAfter(activeWorkspace.id, activeConversation.id, msgId);
    setInput(content);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleSend = async (override?: string) => {
    // NB : onPress={handleSend} passe l'événement de clic en 1er argument —
    // on n'accepte qu'une vraie chaîne comme override.
    const source = typeof override === 'string' ? override : input;
    let msg = source.trim();
    if ((!msg && !pendingAttachment) || isLoading || !activeConversation) return;

    if (pendingAttachment) {
      msg = msg
        ? `${msg}\n\n[PIÈCE JOINTE: ${pendingAttachment.name}]\n${pendingAttachment.content}`
        : `[PIÈCE JOINTE: ${pendingAttachment.name}]\n${pendingAttachment.content}`;
      setPendingAttachment(null);
    }

    setInput('');
    addMessageToConversation(activeWorkspace.id, activeConversation.id, { role: 'user', content: msg });
    const history = chatMessages.map((m: any) => ({ role: m.role, content: m.content }));
    await runGeneration(msg, history);
  };

  const handleNavigate = (wsId: string, convId?: string) => {
    setActiveWorkspace(wsId);
    if (convId) setActiveConversation(wsId, convId);
  };

  // ── Panneau latéral droit : fichiers / instructions / sites ──────
  const openWorkspaceDatabase = () => {
    setShowSidePanel(false);
    router.push({ pathname: '/workspace-database', params: { wsId: activeWorkspace.id } });
  };

  const openWorkspaceSettings = () => {
    setShowSidePanel(false);
    router.push({ pathname: '/workspace-settings', params: { wsId: activeWorkspace.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
            {/* Drawer toggle */}
            <View style={{ position: 'relative' }}>
              <IconButton icon="menu" label="Historique des conversations" onPress={() => setDrawerOpen(true)} backgroundColor={C.bgCardAlt} boxSize={38} />
              <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: C.primary, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }} pointerEvents="none">
                <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>{activeWorkspace.conversations.length}</Text>
              </View>
            </View>

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

            <SyncIndicator compact />
            <IconButton
              icon="search"
              label="Recherche globale (Ctrl+K)"
              onPress={openPalette}
              boxSize={36}
              backgroundColor={C.bgCardAlt}
              color={C.textMuted}
            />

            {/* Panneau latéral droit : fichiers, instructions, sites web */}
            <IconButton
              icon="space-dashboard"
              label="Panneau workspace (fichiers, instructions, sites)"
              onPress={() => setShowSidePanel(v => !v)}
              boxSize={36}
              backgroundColor={showSidePanel ? C.accentGlow : C.bgCardAlt}
              borderColor={showSidePanel ? C.accent + '55' : C.border}
              color={showSidePanel ? C.accent : C.textMuted}
            />

            <IconButton
              icon="delete-outline"
              label="Effacer la conversation"
              bare
              size={22}
              color={C.textMuted}
              onPress={() => {
                if (!activeConversation) return;
                showAlert(t('clearConversation'), t('clearConversationMsg'), [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('delete'), style: 'destructive', onPress: () => clearConversation(activeWorkspace.id, activeConversation.id) },
                ]);
              }}
            />
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
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.md, gap: 0, paddingBottom: insets.bottom + 80 }}
            showsVerticalScrollIndicator={false}
            onScroll={handleChatScroll}
            scrollEventThrottle={120}
          >
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
                {/* Les outils disponibles sont consultables via le bouton « + » (mini-panneau) */}
                <View style={{ gap: Spacing.sm, width: '100%', paddingHorizontal: Spacing.sm }}>
                  {['Que peux-tu faire pour moi ?', 'Résume ta base de connaissances', 'Comment tu fonctionnes ?'].map(s => (
                    <Pressable key={s} onPress={() => setInput(s)} style={({ pressed }) => [{ backgroundColor: C.bgCard, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: C.border }, pressed && { opacity: 0.7 }]}>
                      <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {chatMessages.map((msg: any, idx: number) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                botName={bot.name}
                botColor={bot.avatarColor}
                onCopy={() => handleCopyMessage(msg.content)}
                onEdit={
                  msg.role === 'user' && msg.id === lastUserMsgId && !isLoading
                    ? () => handleEditUserMessage(msg.id, msg.content)
                    : undefined
                }
                onRegenerate={
                  msg.role === 'assistant' && idx === chatMessages.length - 1 && !isLoading
                    ? () => handleRegenerate(msg.id)
                    : undefined
                }
              />
            ))}

            {streamingText ? (
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end', marginBottom: Spacing.md }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bot.avatarColor, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="smart-toy" size={14} color="#fff" />
                </View>
                <View style={{ flex: 1, gap: Spacing.xs }}>
                  <ActivityFeed activities={activities} />
                  <View style={{ paddingHorizontal: Spacing.xs, flexDirection: 'row' }}>
                    <View style={{ flex: 1 }}>
                      <MarkdownView content={throttledStream} />
                    </View>
                    <View style={{ width: 2, height: 18, backgroundColor: C.accent, marginLeft: 4, alignSelf: 'center' }} />
                  </View>
                </View>
              </View>
            ) : null}

            {isLoading && !streamingText ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.md }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bot.avatarColor, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
                <View style={{ flex: 1, paddingTop: 8 }}>
                  <ActivityFeed activities={activities} />
                </View>
              </View>
            ) : null}

            {/* Suggestions de relance sous la dernière réponse de l'IA */}
            {!isLoading && !streamingText && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md, paddingLeft: 40 }}>
                {['Continue', 'Peux-tu détailler ?', 'Concrètement, je fais quoi ?'].map(s => (
                  <Pressable
                    key={s}
                    onPress={() => handleSend(s)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard }, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name="arrow-upward" size={11} color={C.accent} />
                    <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600' }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {/* Bouton « revenir en bas » (visible quand on a remonté dans l'historique) */}
          {showScrollToBottom ? (
            <Pressable
              onPress={() => {
                isNearBottomRef.current = true;
                setShowScrollToBottom(false);
                scrollRef.current?.scrollToEnd({ animated: true });
              }}
              style={({ pressed }) => [{
                position: 'absolute', right: Spacing.md, bottom: 96,
                width: 40, height: 40, borderRadius: 20,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
                shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 5,
              }, pressed && { opacity: 0.75 }]}
              accessibilityLabel="Revenir en bas de la conversation"
            >
              <MaterialIcons name="keyboard-arrow-down" size={22} color={C.textSecondary} />
            </Pressable>
          ) : null}

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

          {/* Astuce raccourci clavier (web/desktop uniquement) */}
          {Platform.OS === 'web' ? (
            <View style={{ paddingHorizontal: Spacing.md, paddingTop: 2, backgroundColor: C.bg }}>
              <Text style={{ fontSize: 10, color: C.textMuted }}>↵ Envoyer · Maj + ↵ Nouvelle ligne</Text>
            </View>
          ) : null}

          {/* Input bar */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: insets.bottom + Spacing.sm, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border }}>
            {/* Attach + mode + tools popover button */}
            <Pressable
              onPress={() => setShowPlusPopover(v => !v)}
              style={({ pressed }) => [{
                width: 44, height: 44, borderRadius: 22,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: showPlusPopover
                  ? (responseMode !== 'auto' ? currentModeInfo.color + '33' : C.accentGlow)
                  : responseMode !== 'auto' ? currentModeInfo.color + '22' : C.bgCard,
                borderWidth: 1,
                borderColor: showPlusPopover
                  ? (responseMode !== 'auto' ? currentModeInfo.color + '88' : C.accent + '66')
                  : responseMode !== 'auto' ? currentModeInfo.color + '66' : C.border,
              }, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons
                name={showPlusPopover ? 'close' : (responseMode !== 'auto' ? currentModeInfo.icon as any : 'add')}
                size={20}
                color={showPlusPopover ? C.textPrimary : (responseMode !== 'auto' ? currentModeInfo.color : C.textSecondary)}
              />
            </Pressable>

            <TextInput
              ref={inputRef}
              style={{ flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: C.textPrimary, fontSize: FontSize.body }}
              value={input} onChangeText={setInput}
              placeholder={pendingAttachment ? `Message + "${pendingAttachment.name}"` : t('typeMessage')}
              placeholderTextColor={C.textMuted}
              multiline maxLength={4000}
              onKeyPress={Platform.OS === 'web' ? (e: any) => {
                // Entrée envoie le message, Maj+Entrée insère un saut de ligne (évite un clic à chaque message)
                const composing = e?.nativeEvent?.isComposing ?? e?.isComposing;
                if (e?.key === 'Enter' && !e?.shiftKey && !composing) {
                  e.preventDefault?.();
                  handleSend();
                }
              } : undefined}
            />

            {isLoading ? (
              <IconButton
                icon="stop"
                label="Arrêter la génération"
                onPress={handleStop}
                boxSize={44}
                backgroundColor={C.error}
                borderColor="transparent"
                color="#fff"
                style={{ borderRadius: 22 }}
              />
            ) : (
              <IconButton
                icon="send"
                label="Envoyer"
                onPress={() => handleSend()}
                disabled={!input.trim() && !pendingAttachment}
                boxSize={44}
                backgroundColor={(input.trim() || pendingAttachment) ? C.accent : C.bgCardAlt}
                borderColor="transparent"
                color={(input.trim() || pendingAttachment) ? C.bg : C.textMuted}
                style={{ borderRadius: 22 }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Mini-panneau « + » : pièces jointes, mode de réponse, outils */}
      <PlusPopover
        visible={showPlusPopover}
        onClose={() => setShowPlusPopover(false)}
        onPickFile={handlePickFile}
        onPickImage={handlePickImage}
        responseMode={responseMode}
        onChangeMode={setResponseMode}
        capabilities={getActiveCapabilities(activeWorkspace, bot)}
        connectedApps={bot.connectedApps}
        onToggleConnectedApp={(id, enabled) => updateConnectedApp(id, { enabled })}
        agentTools={bot.agentTools}
        onToggleAgentTool={toggleAgentTool}
        bottomInset={insets.bottom}
      />

      {/* Panneau latéral droit (façon Grok) : fichiers, instructions, sites web / sandbox */}
      <WorkspaceSidePanel
        visible={showSidePanel}
        onClose={() => setShowSidePanel(false)}
        workspace={activeWorkspace}
        onOpenDatabase={openWorkspaceDatabase}
        onOpenSettings={openWorkspaceSettings}
      />

      {/* Fantôme du glisser-déposer (fichiers du panneau latéral) */}
      <DragLayer />

      {/* Side Drawer — en DERNIER enfant + zIndex élevé : garantit qu'il
          recouvre l'en-tête (sinon l'historique s'affiche dessous, bugué) */}
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
    </View>
  );
}
