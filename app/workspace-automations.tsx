// Powered by OnSpace.AI
// Workspace Automations — trigger-action rules that fire automatically in chat
import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useAlert } from '@/template';
import type { WorkspaceAutomation, AutomationTrigger, AutomationAction, TaskFrequency } from '@/contexts/WorkspaceContext';

const AUTO_COLORS = ['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455', '#00BFFF', '#FF69B4'];
const AUTO_ICONS = ['bolt', 'auto-fix-high', 'settings-suggest', 'smart-toy', 'psychology', 'flash-on', 'notifications', 'sync', 'sensors', 'radar'];

const TRIGGERS: { id: AutomationTrigger; label: string; icon: string; color: string; desc: string; hasKeyword?: boolean; hasFrequency?: boolean }[] = [
  { id: 'message_received', label: 'Message reçu', icon: 'chat-bubble', color: '#3D7EFF', desc: 'Chaque fois que l\'utilisateur envoie un message' },
  { id: 'conversation_start', label: 'Démarrage conversation', icon: 'play-circle', color: '#00CC6A', desc: 'Quand une nouvelle conversation commence' },
  { id: 'keyword', label: 'Mot-clé détecté', icon: 'search', color: '#FFB800', desc: 'Quand un mot-clé est trouvé dans le message', hasKeyword: true },
  { id: 'scheduled', label: 'Planifié', icon: 'schedule', color: '#9B59B6', desc: 'Déclenché selon une fréquence', hasFrequency: true },
  { id: 'file_added', label: 'Fichier ajouté', icon: 'upload-file', color: '#FF6B35', desc: 'Quand un fichier est ajouté à la base de données' },
  { id: 'mode_activated', label: 'Mode activé', icon: 'bolt', color: '#FF4455', desc: 'Quand un mode est activé dans ce workspace' },
];

const ACTIONS: { id: AutomationAction; label: string; icon: string; color: string; desc: string; placeholder: string }[] = [
  { id: 'inject_prompt', label: 'Injecter prompt', icon: 'code', color: '#3D7EFF', desc: 'Ajoute des instructions dans le contexte IA', placeholder: 'Instructions à injecter dans le contexte...' },
  { id: 'send_message', label: 'Envoyer message', icon: 'send', color: '#00CC6A', desc: 'Envoie automatiquement un message au chatbot', placeholder: 'Message à envoyer automatiquement...' },
  { id: 'notify', label: 'Notification', icon: 'notifications', color: '#FFB800', desc: 'Affiche une bannière de notification dans le chat', placeholder: 'Texte de la notification...' },
  { id: 'change_model', label: 'Changer de modèle', icon: 'smart-toy', color: '#9B59B6', desc: 'Bascule automatiquement vers un autre modèle IA', placeholder: 'Ex: google/gemini-3-flash-preview' },
  { id: 'set_mode', label: 'Activer un mode', icon: 'bolt', color: '#FF6B35', desc: 'Active un mode prédéfini du workspace', placeholder: 'ID du mode à activer...' },
];

const FREQUENCIES: { id: TaskFrequency; label: string; icon: string; color: string }[] = [
  { id: 'daily', label: 'Quotidien', icon: 'today', color: '#3D7EFF' },
  { id: 'weekly', label: 'Hebdomadaire', icon: 'view-week', color: '#00CC6A' },
  { id: 'monthly', label: 'Mensuel', icon: 'calendar-month', color: '#FF6B35' },
  { id: 'yearly', label: 'Annuel', icon: 'event', color: '#9B59B6' },
];

function getTriggerInfo(id: AutomationTrigger) { return TRIGGERS.find(t => t.id === id) ?? TRIGGERS[0]; }
function getActionInfo(id: AutomationAction) { return ACTIONS.find(a => a.id === id) ?? ACTIONS[0]; }

function AutoCard({
  auto, ws, onToggle, onEdit, onDelete,
}: {
  auto: WorkspaceAutomation;
  ws: any;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const C = useThemeColors();
  const trigger = getTriggerInfo(auto.trigger);
  const action = getActionInfo(auto.action);
  return (
    <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: auto.enabled ? auto.color + '55' : C.border, padding: Spacing.md, gap: Spacing.sm }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
        <View style={{ width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: auto.color + '22', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <MaterialIcons name={auto.icon as any} size={22} color={auto.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700', flex: 1 }} numberOfLines={1}>{auto.name}</Text>
            {!auto.enabled ? (
              <View style={{ backgroundColor: C.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill }}>
                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '600' }}>Inactif</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: auto.color + '22', paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: auto.color }} />
                <Text style={{ fontSize: 10, color: auto.color, fontWeight: '700' }}>Actif</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 17 }} numberOfLines={2}>{auto.description || 'Aucune description'}</Text>
        </View>
        {/* Toggle */}
        <Pressable onPress={onToggle} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: auto.enabled ? auto.color : C.bgCardAlt, borderWidth: 1, borderColor: auto.enabled ? auto.color : C.border, justifyContent: 'center', paddingHorizontal: 3, marginTop: 4 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: auto.enabled ? '#fff' : C.textMuted, alignSelf: auto.enabled ? 'flex-end' : 'flex-start' }} />
        </Pressable>
      </View>

      {/* Trigger → Action flow */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: trigger.color + '12', borderRadius: Radius.sm, padding: Spacing.xs + 2, borderWidth: 1, borderColor: trigger.color + '33' }}>
          <MaterialIcons name={trigger.icon as any} size={13} color={trigger.color} />
          <Text style={{ fontSize: FontSize.xs, color: trigger.color, fontWeight: '600', flex: 1 }} numberOfLines={1}>{trigger.label}</Text>
        </View>
        <MaterialIcons name="arrow-forward" size={14} color={C.textMuted} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: action.color + '12', borderRadius: Radius.sm, padding: Spacing.xs + 2, borderWidth: 1, borderColor: action.color + '33' }}>
          <MaterialIcons name={action.icon as any} size={13} color={action.color} />
          <Text style={{ fontSize: FontSize.xs, color: action.color, fontWeight: '600', flex: 1 }} numberOfLines={1}>{action.label}</Text>
        </View>
      </View>

      {/* Keyword / payload preview */}
      {auto.triggerKeyword ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.xs + 2 }}>
          <MaterialIcons name="search" size={12} color={C.textMuted} />
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontFamily: 'monospace' }} numberOfLines={1}>Mots-clés: {auto.triggerKeyword}</Text>
        </View>
      ) : null}
      {auto.actionPayload ? (
        <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.sm, borderLeftWidth: 2, borderLeftColor: auto.color }}>
          <Text style={{ fontSize: 11, color: C.textMuted, lineHeight: 16 }} numberOfLines={2}>{auto.actionPayload}</Text>
        </View>
      ) : null}

      {/* Stats + Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
          <MaterialIcons name="play-arrow" size={13} color={C.textMuted} />
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{auto.runCount} exécution{auto.runCount !== 1 ? 's' : ''}</Text>
          {auto.lastRun ? (
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>· {new Date(auto.lastRun).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</Text>
          ) : null}
        </View>
        <Pressable onPress={onEdit} hitSlop={8} style={{ padding: Spacing.xs }}>
          <MaterialIcons name="edit" size={16} color={C.textSecondary} />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={{ padding: Spacing.xs }}>
          <MaterialIcons name="delete-outline" size={16} color={C.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export default function WorkspaceAutomationsScreen() {
  const insets = useSafeAreaInsets();
  const { wsId } = useLocalSearchParams<{ wsId: string }>();
  const { workspaces, addAutomation, updateAutomation, removeAutomation, toggleAutomation } = useWorkspace();
  const { showAlert } = useAlert();
  const router = useRouter();
  const C = useThemeColors();

  const ws = workspaces.find(w => w.id === wsId);

  const [showModal, setShowModal] = useState(false);
  const [editingAuto, setEditingAuto] = useState<WorkspaceAutomation | null>(null);

  // Form state
  const [autoName, setAutoName] = useState('');
  const [autoDesc, setAutoDesc] = useState('');
  const [autoIcon, setAutoIcon] = useState(AUTO_ICONS[0]);
  const [autoColor, setAutoColor] = useState(AUTO_COLORS[0]);
  const [autoTrigger, setAutoTrigger] = useState<AutomationTrigger>('conversation_start');
  const [autoKeyword, setAutoKeyword] = useState('');
  const [autoFreq, setAutoFreq] = useState<TaskFrequency>('daily');
  const [autoAction, setAutoAction] = useState<AutomationAction>('inject_prompt');
  const [autoPayload, setAutoPayload] = useState('');

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

  const automations = ws.automations ?? [];
  const activeCount = automations.filter(a => a.enabled).length;

  const resetForm = () => {
    setAutoName(''); setAutoDesc(''); setAutoIcon(AUTO_ICONS[0]); setAutoColor(AUTO_COLORS[0]);
    setAutoTrigger('conversation_start'); setAutoKeyword(''); setAutoFreq('daily');
    setAutoAction('inject_prompt'); setAutoPayload(''); setEditingAuto(null);
  };

  const openEdit = (auto: WorkspaceAutomation) => {
    setEditingAuto(auto);
    setAutoName(auto.name); setAutoDesc(auto.description);
    setAutoIcon(auto.icon); setAutoColor(auto.color);
    setAutoTrigger(auto.trigger); setAutoKeyword(auto.triggerKeyword ?? '');
    setAutoFreq(auto.triggerFrequency ?? 'daily');
    setAutoAction(auto.action); setAutoPayload(auto.actionPayload);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!autoName.trim() || !autoPayload.trim()) return;
    const trigger = TRIGGERS.find(t => t.id === autoTrigger);
    const data: Omit<WorkspaceAutomation, 'id' | 'createdAt' | 'runCount' | 'lastRun'> = {
      name: autoName.trim(),
      description: autoDesc.trim(),
      icon: autoIcon,
      color: autoColor,
      enabled: true,
      trigger: autoTrigger,
      triggerKeyword: trigger?.hasKeyword ? autoKeyword.trim() || undefined : undefined,
      triggerFrequency: trigger?.hasFrequency ? autoFreq : undefined,
      action: autoAction,
      actionPayload: autoPayload.trim(),
    };
    if (editingAuto) {
      updateAutomation(ws.id, editingAuto.id, data);
    } else {
      addAutomation(ws.id, data);
    }
    resetForm();
    setShowModal(false);
  };

  const handleDelete = (auto: WorkspaceAutomation) => {
    showAlert(`Supprimer "${auto.name}" ?`, 'Cette automatisation sera définitivement supprimée.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeAutomation(ws.id, auto.id) },
    ]);
  };

  const currentTriggerInfo = TRIGGERS.find(t => t.id === autoTrigger)!;
  const currentActionInfo = ACTIONS.find(a => a.id === autoAction)!;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: Spacing.xs }}>
          <MaterialIcons name="arrow-back" size={22} color={C.textPrimary} />
        </Pressable>
        <View style={{ width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: ws.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={ws.icon as any} size={18} color={ws.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>Automatisations</Text>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{ws.name} · {automations.length} règle{automations.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          onPress={() => { resetForm(); setShowModal(true); }}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill }, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>Nouvelle</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {/* Explainer */}
        <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.primary + '12', borderRadius: Radius.md, borderWidth: 1, borderColor: C.primary + '30', padding: Spacing.md }}>
          <MaterialIcons name="bolt" size={20} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '600', marginBottom: 4 }}>Automatisations intelligentes</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 18 }}>
              Créez des règles Déclencheur → Action qui s’exécutent automatiquement dans vos conversations. Injectez du contexte, changez de mode, envoyez des messages ou affichez des notifications selon des événements précis.
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {[
            { icon: 'bolt', label: 'Actives', value: activeCount, color: C.accent },
            { icon: 'settings-suggest', label: 'Total', value: automations.length, color: C.primary },
            { icon: 'play-arrow', label: 'Exécutions', value: automations.reduce((s, a) => s + a.runCount, 0), color: '#00CC6A' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.sm, alignItems: 'center', gap: 4 }}>
              <MaterialIcons name={s.icon as any} size={18} color={s.color} />
              <Text style={{ fontSize: FontSize.lg, color: C.textPrimary, fontWeight: '700' }}>{s.value}</Text>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Empty state */}
        {automations.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: Spacing.md }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="bolt" size={36} color={C.primary} />
            </View>
            <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '600' }}>Aucune automatisation</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
              Créez des règles pour que l’IA agisse automatiquement selon les événements de vos conversations.
            </Text>
            <Pressable onPress={() => { resetForm(); setShowModal(true); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="add" size={18} color="#fff" />
              <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>Créer une automatisation</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Automation cards */}
        {automations.map(auto => (
          <AutoCard
            key={auto.id}
            auto={auto}
            ws={ws}
            onToggle={() => toggleAutomation(ws.id, auto.id)}
            onEdit={() => openEdit(auto)}
            onDelete={() => handleDelete(auto)}
          />
        ))}

        {/* How it works */}
        {automations.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
            <MaterialIcons name="tips-and-updates" size={16} color={'#FFB800'} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: '#FFB800', fontWeight: '600', marginBottom: 4 }}>Comment fonctionnent les automatisations ?</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 18 }}>
                Les automatisations actives sont évaluées à chaque message. Quand un déclencheur correspond, l’action est exécutée automatiquement sans intervention de votre part.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ─── Add/Edit Modal ──────────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg, maxHeight: '95%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: autoColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={autoIcon as any} size={18} color={autoColor} />
                </View>
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>{editingAuto ? 'Modifier' : 'Nouvelle automatisation'}</Text>
              </View>
              <Pressable onPress={() => { resetForm(); setShowModal(false); }} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 580 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                {/* Name & Description */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom *</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={autoName} onChangeText={setAutoName} placeholder="Ex: Accueil personnalisé, Debug auto..." placeholderTextColor={C.textMuted} autoFocus />
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Description</Text>
                  <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={autoDesc} onChangeText={setAutoDesc} placeholder="Ce que fait cette automatisation..." placeholderTextColor={C.textMuted} />
                </View>

                {/* Color & Icon */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Couleur</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {AUTO_COLORS.map(c => <Pressable key={c} onPress={() => setAutoColor(c)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: autoColor === c ? 3 : 0, borderColor: '#fff' }} />)}
                  </View>
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Icône</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {AUTO_ICONS.map(ic => (
                      <Pressable key={ic} onPress={() => setAutoIcon(ic)} style={{ width: 42, height: 42, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: autoIcon === ic ? autoColor + '33' : C.bgCardAlt, borderWidth: 1, borderColor: autoIcon === ic ? autoColor : C.border }}>
                        <MaterialIcons name={ic as any} size={20} color={autoIcon === ic ? autoColor : C.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Trigger */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Déclencheur</Text>
                  <View style={{ gap: Spacing.xs }}>
                    {TRIGGERS.map(t => {
                      const active = autoTrigger === t.id;
                      return (
                        <Pressable key={t.id} onPress={() => setAutoTrigger(t.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: active ? t.color + '88' : C.border, backgroundColor: active ? t.color + '12' : C.bgCardAlt }, pressed && { opacity: 0.75 }]}>
                          <View style={{ width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: t.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name={t.icon as any} size={18} color={t.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: FontSize.sm, color: active ? t.color : C.textPrimary, fontWeight: '600' }}>{t.label}</Text>
                            <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{t.desc}</Text>
                          </View>
                          {active ? <MaterialIcons name="check-circle" size={18} color={t.color} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Keyword input (if keyword trigger) */}
                {currentTriggerInfo?.hasKeyword ? (
                  <View style={{ gap: Spacing.xs }}>
                    <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Mots-clés à détecter</Text>
                    <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44, fontFamily: 'monospace' }} value={autoKeyword} onChangeText={setAutoKeyword} placeholder="bug|error|erreur|crash" placeholderTextColor={C.textMuted} autoCapitalize="none" />
                    <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>Séparez les mots-clés avec | (pipe). Insensible à la casse.</Text>
                  </View>
                ) : null}

                {/* Frequency selector (if scheduled trigger) */}
                {currentTriggerInfo?.hasFrequency ? (
                  <View style={{ gap: Spacing.xs }}>
                    <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Fréquence</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                      {FREQUENCIES.map(f => {
                        const active = autoFreq === f.id;
                        return (
                          <Pressable key={f.id} onPress={() => setAutoFreq(f.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? f.color : C.border, backgroundColor: active ? f.color + '20' : C.bgCardAlt }}>
                            <MaterialIcons name={f.icon as any} size={14} color={active ? f.color : C.textMuted} />
                            <Text style={{ fontSize: FontSize.xs, color: active ? f.color : C.textMuted, fontWeight: '600' }}>{f.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Action */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Action</Text>
                  <View style={{ gap: Spacing.xs }}>
                    {ACTIONS.map(a => {
                      const active = autoAction === a.id;
                      return (
                        <Pressable key={a.id} onPress={() => setAutoAction(a.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: active ? a.color + '88' : C.border, backgroundColor: active ? a.color + '12' : C.bgCardAlt }, pressed && { opacity: 0.75 }]}>
                          <View style={{ width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: a.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name={a.icon as any} size={18} color={a.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: FontSize.sm, color: active ? a.color : C.textPrimary, fontWeight: '600' }}>{a.label}</Text>
                            <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{a.desc}</Text>
                          </View>
                          {active ? <MaterialIcons name="check-circle" size={18} color={a.color} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Payload */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Contenu de l’action *</Text>
                  <TextInput
                    style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 110, textAlignVertical: 'top', paddingTop: Spacing.sm, fontFamily: autoAction === 'inject_prompt' || autoAction === 'change_model' ? 'monospace' : undefined }}
                    value={autoPayload}
                    onChangeText={setAutoPayload}
                    placeholder={currentActionInfo?.placeholder ?? 'Contenu...'}
                    placeholderTextColor={C.textMuted}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Flow preview */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: currentTriggerInfo.color + '18', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: currentTriggerInfo.color + '44' }}>
                    <MaterialIcons name={currentTriggerInfo.icon as any} size={14} color={currentTriggerInfo.color} />
                    <Text style={{ fontSize: FontSize.xs, color: currentTriggerInfo.color, fontWeight: '700' }}>{currentTriggerInfo.label}</Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={16} color={C.textMuted} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: currentActionInfo.color + '18', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: currentActionInfo.color + '44' }}>
                    <MaterialIcons name={currentActionInfo.icon as any} size={14} color={currentActionInfo.color} />
                    <Text style={{ fontSize: FontSize.xs, color: currentActionInfo.color, fontWeight: '700' }}>{currentActionInfo.label}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <Pressable onPress={handleSave} disabled={!autoName.trim() || !autoPayload.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: (!autoName.trim() || !autoPayload.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name={editingAuto ? 'save' : 'bolt'} size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>{editingAuto ? 'Enregistrer' : 'Créer l\'automatisation'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
