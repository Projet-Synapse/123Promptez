// Powered by OnSpace.AI
// Builder screen — KB, Agents tools, Custom AI Agents, Connecteurs
import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Modal, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useBot } from '@/hooks/useBot';
import { KBSourceCard, AgentToolRow, ThemedInput, IconButton , Toggle } from '@/components';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { AGENT_TOOLS, KB_SOURCE_TYPES, CONNECTOR_PRESETS } from '@/constants/config';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '@/template';
import type { CustomAgent } from '@/contexts/BotContext';

type ActiveSection = 'kb' | 'agents' | 'custom_agents' | 'apps';

// ── Complexity badge ──────────────────────────────────────────────────────────
const COMPLEXITY_LABELS: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: 'Simple', color: '#00CC6A', icon: 'filter-1' },
  2: { label: 'Modéré', color: '#FFB800', icon: 'filter-2' },
  3: { label: 'Complexe', color: '#FF6B35', icon: 'filter-3' },
};

const AGENT_COLORS = ['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455', '#00BFFF', '#FF69B4'];
const AGENT_ICONS = ['psychology', 'smart-toy', 'science', 'code', 'search', 'analytics', 'language', 'memory', 'lightbulb', 'calculate'];
const AGENT_MODELS = [
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (rapide)', provider: 'Google' },
  { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro (puissant)', provider: 'Google' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini (équilibré)', provider: 'OpenAI' },
  { id: 'openai/gpt-5.1', label: 'GPT-5.1 (flagship)', provider: 'OpenAI' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (eco)', provider: 'Google' },
];

// ── Custom Agent Card ─────────────────────────────────────────────────────────
function CustomAgentCard({ agent, onToggle, onEdit, onDelete }: { agent: CustomAgent; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const C = useThemeColors();
  const cx = COMPLEXITY_LABELS[agent.complexity];
  return (
    <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: agent.enabled ? agent.color + '55' : C.border, padding: Spacing.md, gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={{ width: 46, height: 46, borderRadius: Radius.sm, backgroundColor: agent.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={agent.icon as any} size={24} color={agent.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{agent.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: cx.color + '20' }}>
              <MaterialIcons name={cx.icon as any} size={11} color={cx.color} />
              <Text style={{ fontSize: 10, color: cx.color, fontWeight: '700' }}>{cx.label}</Text>
            </View>
          </View>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }} numberOfLines={1}>{agent.role}</Text>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }} numberOfLines={1}>{AGENT_MODELS.find(m => m.id === agent.model)?.label ?? agent.model}</Text>
        </View>
        <View style={{ alignItems: 'center', gap: Spacing.xs }}>
          <Pressable onPress={onToggle} style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: agent.enabled ? agent.color : C.bgCard, borderWidth: 1, borderColor: agent.enabled ? agent.color : C.border, justifyContent: 'center', paddingHorizontal: 3 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: agent.enabled ? '#fff' : C.textMuted, alignSelf: agent.enabled ? 'flex-end' : 'flex-start' }} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
            <Pressable onPress={onEdit} hitSlop={8} style={{ padding: 3 }}>
              <MaterialIcons name="edit" size={15} color={C.textSecondary} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={8} style={{ padding: 3 }}>
              <MaterialIcons name="delete-outline" size={15} color={C.textMuted} />
            </Pressable>
          </View>
        </View>
      </View>
      {agent.description ? (
        <Text style={{ fontSize: FontSize.sm, color: C.textMuted, lineHeight: 18 }} numberOfLines={2}>{agent.description}</Text>
      ) : null}
      {agent.promptPrefix ? (
        <View style={{ backgroundColor: C.bg, borderRadius: Radius.sm, padding: Spacing.sm, borderLeftWidth: 2, borderLeftColor: agent.color }}>
          <Text style={{ fontSize: 11, color: C.textMono, fontFamily: 'monospace' }} numberOfLines={2}>{agent.promptPrefix}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function BuilderScreen() {
  const insets = useSafeAreaInsets();
  const C = useThemeColors();
  const { bot, updateBot, addKBSource, removeKBSource, addFAQItem, toggleAgentTool, addConnectedApp, removeConnectedApp,
    setPresetConnectorEnabled, toggleConnectedApp, addCustomAgent, updateCustomAgent, removeCustomAgent, toggleCustomAgent, updateConnectedApp } = useBot();
  const { showAlert } = useAlert();
  const [activeSection, setActiveSection] = useState<ActiveSection>('kb');
  const [showAddKB, setShowAddKB] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);
  const [kbType, setKBType] = useState('text');
  const [kbLabel, setKBLabel] = useState('');
  const [kbContent, setKBContent] = useState('');
  const [appName, setAppName] = useState('');
  const [appDesc, setAppDesc] = useState('');
  const [appWebhook, setAppWebhook] = useState('');
  const [heroVisible, setHeroVisible] = useState(true);

  // Custom agent form
  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState('');
  const [agentDesc, setAgentDesc] = useState('');
  const [agentModel, setAgentModel] = useState(AGENT_MODELS[0].id);
  const [agentComplexity, setAgentComplexity] = useState<1 | 2 | 3>(1);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentColor, setAgentColor] = useState(AGENT_COLORS[0]);
  const [agentIcon, setAgentIcon] = useState(AGENT_ICONS[0]);

  const sections: { id: ActiveSection; label: string; badge?: number }[] = [
    { id: 'kb', label: 'Knowledge Base' },
    { id: 'agents', label: 'Outils IA' },
    { id: 'custom_agents', label: 'Agents IA', badge: (bot.customAgents ?? []).length },
    { id: 'apps', label: 'Connecteurs' },
  ];

  const enabledToolsCount = bot.agentTools.filter(t => t.enabled).length;
  const enabledAppsCount = bot.connectedApps.filter(a => a.enabled).length;
  const enabledAgentsCount = (bot.customAgents ?? []).filter(a => a.enabled).length;

  const resetAgentForm = () => {
    setAgentName(''); setAgentRole(''); setAgentDesc('');
    setAgentModel(AGENT_MODELS[0].id); setAgentComplexity(1);
    setAgentPrompt(''); setAgentColor(AGENT_COLORS[0]); setAgentIcon(AGENT_ICONS[0]);
    setEditingAgent(null);
  };

  const openEditAgent = (agent: CustomAgent) => {
    setEditingAgent(agent);
    setAgentName(agent.name); setAgentRole(agent.role); setAgentDesc(agent.description);
    setAgentModel(agent.model); setAgentComplexity(agent.complexity);
    setAgentPrompt(agent.promptPrefix); setAgentColor(agent.color); setAgentIcon(agent.icon);
    setShowAgentModal(true);
  };

  const handleSaveAgent = () => {
    if (!agentName.trim() || !agentRole.trim()) return;
    const data: Omit<CustomAgent, 'id'> = {
      name: agentName.trim(), role: agentRole.trim(), description: agentDesc.trim(),
      model: agentModel, complexity: agentComplexity, promptPrefix: agentPrompt.trim(),
      color: agentColor, icon: agentIcon, enabled: true,
    };
    if (editingAgent) {
      updateCustomAgent(editingAgent.id, data);
    } else {
      addCustomAgent(data);
    }
    resetAgentForm();
    setShowAgentModal(false);
  };

  const handleAddKB = () => {
    if (!kbLabel.trim() || !kbContent.trim()) return;
    addKBSource({ type: kbType as any, label: kbLabel, content: kbContent });
    setKBLabel(''); setKBContent(''); setKBType('text'); setShowAddKB(false);
  };

  const handleAddApp = () => {
    if (!appName.trim() || !appWebhook.trim()) return;
    addConnectedApp({ name: appName, description: appDesc, webhookUrl: appWebhook, enabled: true });
    setAppName(''); setAppDesc(''); setAppWebhook(''); setShowAddApp(false);
  };

  const handlePickKBFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'application/json', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      let content = '';
      try {
        const response = await fetch(asset.uri);
        content = await response.text();
        if (content.length > 50000) content = content.slice(0, 50000) + '\n\n[... Tronqué]';
      } catch { content = `[Fichier importé: ${asset.name}]`; }
      addKBSource({ type: 'file', label: asset.name ?? 'Fichier importé', content });
      showAlert('Fichier ajouté', `"${asset.name}" ajouté à la base de connaissances.`);
    } catch (e: any) { showAlert('Erreur', e.message ?? 'Impossible d\'importer'); }
  };

  const handlePickKBImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission requise', "L'accès à la galerie photo est nécessaire."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() ?? 'image.jpg';
      addKBSource({ type: 'file', label: name, content: `[IMAGE: ${name}]\nDimensions: ${asset.width}x${asset.height}px\nURI: ${asset.uri}` });
      showAlert('Image ajoutée', `"${name}" ajoutée à la base de connaissances.`);
    } catch (e: any) { showAlert('Erreur', e.message ?? 'Impossible d\'importer'); }
  };

  const handleAddLink = () => { setKBType('url'); setKBLabel(''); setKBContent(''); setShowAddKB(true); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: FontSize.xl, color: C.textPrimary, fontWeight: FontWeight.bold }}>LLM Builder</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }}>Configurez votre assistant IA</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: C.accentGlow }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent }} />
            <Text style={{ fontSize: FontSize.sm, color: C.accent, fontWeight: '600' }}>Actif</Text>
          </View>
        </View>

        {/* Bot Identity */}
        <View style={{ flexDirection: 'row', gap: Spacing.md, backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: bot.avatarColor, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="smart-toy" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedInput value={bot.name} onChangeText={v => updateBot({ name: v })} placeholder="Nom de votre assistant" style={{ marginBottom: Spacing.sm, fontSize: FontSize.md, fontWeight: '600' }} />
            <ThemedInput value={bot.description} onChangeText={v => updateBot({ description: v })} placeholder="Description courte" style={{ fontSize: FontSize.sm }} />
          </View>
        </View>

        {/* Hero */}
        {heroVisible ? (
          <Pressable onPress={() => setHeroVisible(false)} style={{ borderRadius: Radius.lg, overflow: 'hidden', height: 160 }}>
            <Image source={require('@/assets/images/hero-llm.png')} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={300} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,12,16,0.72)', padding: Spacing.md }}>
              <Text style={{ fontSize: FontSize.md, color: '#F0F4FF', fontWeight: '700' }}>Architecture agentique</Text>
              <Text style={{ fontSize: FontSize.sm, color: '#8899BB', marginTop: 2 }}>Modèle · KB · Outils · Agents IA · Connecteurs</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {[
            { icon: 'library-books', label: 'Sources KB', value: bot.kbSources.length },
            { icon: 'bolt', label: 'Outils actifs', value: enabledToolsCount },
            { icon: 'psychology', label: 'Agents IA', value: enabledAgentsCount },
            { icon: 'hub', label: 'Connecteurs', value: enabledAppsCount },
          ].map(stat => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.sm, alignItems: 'center', gap: 4 }}>
              <MaterialIcons name={stat.icon as any} size={18} color={C.primary} />
              <Text style={{ fontSize: FontSize.lg, color: C.textPrimary, fontWeight: '700' }}>{stat.value}</Text>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, textAlign: 'center' }}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Section tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.md }}>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 4 }}>
            {sections.map(s => (
              <Pressable key={s.id} onPress={() => setActiveSection(s.id)} style={{ paddingHorizontal: Spacing.md, height: 36, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: activeSection === s.id ? C.primaryLight : C.border, backgroundColor: activeSection === s.id ? C.primary : C.bgCardAlt, flexDirection: 'row', gap: 6 }}>
                <Text style={{ fontSize: FontSize.sm, color: activeSection === s.id ? '#fff' : C.textSecondary, fontWeight: '600' }}>{s.label}</Text>
                {s.badge !== undefined && s.badge > 0 ? (
                  <View style={{ backgroundColor: activeSection === s.id ? 'rgba(255,255,255,0.3)' : C.primary, borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{s.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* ── KB Section ─────────────────────────────────────────────── */}
        {activeSection === 'kb' ? (
          <View style={{ gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Base de connaissances</Text>
              <Pressable onPress={() => { setKBType('text'); setKBLabel(''); setKBContent(''); setShowAddKB(true); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill }, pressed && { opacity: 0.75 }]}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>Ajouter</Text>
              </Pressable>
            </View>
            <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Insérer</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {[
                  { icon: 'edit-note', label: 'Texte', color: '#FFB800', onPress: () => { setKBType('text'); setKBLabel(''); setKBContent(''); setShowAddKB(true); } },
                  { icon: 'upload-file', label: 'Fichier', color: '#3D7EFF', onPress: handlePickKBFile },
                  { icon: 'image', label: 'Image', color: '#00CC6A', onPress: handlePickKBImage },
                  { icon: 'link', label: 'Lien', color: '#9B59B6', onPress: handleAddLink },
                ].map(b => (
                  <Pressable key={b.label} onPress={b.onPress} style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: b.color + '44', backgroundColor: b.color + '12' }, pressed && { opacity: 0.75 }]}>
                    <MaterialIcons name={b.icon as any} size={20} color={b.color} />
                    <Text style={{ fontSize: 11, color: b.color, fontWeight: '700' }}>{b.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {bot.kbSources.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm }}>
                <MaterialIcons name="library-books" size={36} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '500' }}>Aucune source de connaissances</Text>
              </View>
            ) : (
              bot.kbSources.map(src => <KBSourceCard key={src.id} source={src} onRemove={removeKBSource} />)
            )}
          </View>
        ) : null}

        {/* ── Agents Tools Section ──────────────────────────────────── */}
        {activeSection === 'agents' ? (
          <View style={{ gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Outils agentiques</Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: C.accent + '22' }}>
                <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: C.accent }}>{enabledToolsCount} actifs</Text>
              </View>
            </View>
            <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.sm, gap: Spacing.xs }}>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Ces outils sont injectés dans le prompt système et activés lors de la conversation.
              </Text>
            </View>
            {AGENT_TOOLS.map(tool => {
              const state = bot.agentTools.find(t => t.id === tool.id);
              return (
                <AgentToolRow key={tool.id} id={tool.id} label={tool.label} icon={tool.icon} description={tool.description} enabled={state?.enabled ?? false} onToggle={() => toggleAgentTool(tool.id)} />
              );
            })}
          </View>
        ) : null}

        {/* ── Custom Agents Section ─────────────────────────────────── */}
        {activeSection === 'custom_agents' ? (
          <View style={{ gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Agents IA personnalisés</Text>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>Chaque agent a un rôle, un modèle et un niveau de complexité</Text>
              </View>
              <Pressable onPress={() => { resetAgentForm(); setShowAgentModal(true); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill }, pressed && { opacity: 0.75 }]}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>Créer</Text>
              </Pressable>
            </View>

            {/* Complexity legend */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => (
                <View key={k} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: v.color + '12', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: v.color + '33' }}>
                  <MaterialIcons name={v.icon as any} size={14} color={v.color} />
                  <Text style={{ fontSize: FontSize.xs, color: v.color, fontWeight: '600' }}>{v.label}</Text>
                </View>
              ))}
            </View>

            {(bot.customAgents ?? []).length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm }}>
                <MaterialIcons name="psychology" size={40} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '600' }}>Aucun agent personnalisé</Text>
                <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center', maxWidth: 260, lineHeight: 19 }}>
                  Créez des agents spécialisés (rédacteur, analyste, traducteur…) qui s’activent automatiquement selon la complexité de la tâche.
                </Text>
                <Pressable onPress={() => { resetAgentForm(); setShowAgentModal(true); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.pill }, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="add" size={18} color="#fff" />
                  <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>Créer mon premier agent</Text>
                </Pressable>
              </View>
            ) : (
              (bot.customAgents ?? []).map(agent => (
                <CustomAgentCard
                  key={agent.id}
                  agent={agent}
                  onToggle={() => toggleCustomAgent(agent.id)}
                  onEdit={() => openEditAgent(agent)}
                  onDelete={() => showAlert(`Supprimer "${agent.name}" ?`, '', [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: () => removeCustomAgent(agent.id) },
                  ])}
                />
              ))
            )}
          </View>
        ) : null}

        {/* ── Connecteurs Section ──────────────────────────────────────── */}
        {activeSection === 'apps' ? (
          <View style={{ gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Connecteurs</Text>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>
                  Activez des intégrations prêtes à l’emploi. L’OAuth complet arrive bientôt.
                </Text>
              </View>
              <Pressable onPress={() => setShowAddApp(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill }, pressed && { opacity: 0.75 }]}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>Webhook</Text>
              </Pressable>
            </View>

            <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.sm, gap: Spacing.xs }}>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Catalogue
              </Text>
            </View>

            {CONNECTOR_PRESETS.map(preset => {
              const existing = bot.connectedApps.find(a => a.id === preset.id || a.presetId === preset.id);
              const enabled = existing?.enabled ?? false;
              return (
              <React.Fragment key={preset.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.md,
                    backgroundColor: enabled ? C.accentGlow : C.bgCard,
                    borderRadius: Radius.md,
                    borderWidth: 1,
                    borderColor: enabled ? C.accent + '44' : C.border,
                    padding: Spacing.md,
                  }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: Radius.sm,
                    backgroundColor: (preset.color || C.primary) + '22',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MaterialIcons name={preset.icon as any} size={22} color={preset.color || C.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{preset.label}</Text>
                      {preset.comingSoon ? (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: C.warning + '22', borderWidth: 1, borderColor: C.warning + '55' }}>
                          <Text style={{ fontSize: 10, color: C.warning, fontWeight: '700' }}>bientôt</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: FontSize.sm, color: C.textMuted, lineHeight: 18 }}>{preset.description}</Text>
                  </View>
                  <Toggle
                    value={enabled}
                    onToggle={() => setPresetConnectorEnabled({
                      id: preset.id,
                      name: preset.label,
                      description: preset.description,
                      webhookUrl: existing?.webhookUrl || '',
                      icon: preset.icon,
                      color: preset.color,
                      presetId: preset.id,
                      comingSoon: preset.comingSoon,
                    }, !enabled)}
                  />
                </View>
                {preset.id === 'github' && enabled && existing ? (
                  <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm, marginTop: -Spacing.sm }}>
                    <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Personal Access Token GitHub
                    </Text>
                    <Text style={{ fontSize: FontSize.xs, color: C.textMuted, lineHeight: 17 }}>
                      Requis pour rechercher vos dépôts comme source vault. Collez un PAT (scope repo). Stocké avec vos connecteurs synchronisés.
                    </Text>
                    <ThemedInput
                      value={existing.webhookUrl?.startsWith('http') ? '' : (existing.webhookUrl || '')}
                      onChangeText={v => updateConnectedApp(existing.id, { webhookUrl: v.trim() })}
                      placeholder="ghp_…"
                      secureTextEntry
                      mono
                    />
                  </View>
                ) : null}
              </React.Fragment>
              );
            })}

            {/* Legacy / custom webhook connectors */}
            {bot.connectedApps.filter(a => !a.presetId && !CONNECTOR_PRESETS.some(p => p.id === a.id)).length > 0 ? (
              <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Webhooks personnalisés
                </Text>
                {bot.connectedApps.filter(a => !a.presetId && !CONNECTOR_PRESETS.some(p => p.id === a.id)).map(app => (
                  <View key={app.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
                    <MaterialIcons name={(app.icon as any) || 'api'} size={22} color={C.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }}>{app.name}</Text>
                      <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }}>{app.description || app.webhookUrl}</Text>
                    </View>
                    <Toggle value={app.enabled} onToggle={() => toggleConnectedApp(app.id)} />
                    <IconButton icon="close" label="Retirer le connecteur" onPress={() => removeConnectedApp(app.id)} bare size={18} color={C.textMuted} />
                  </View>
                ))}
              </View>
            ) : null}

            {bot.connectedApps.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>
                  Aucun connecteur activé pour l’instant — activez un preset ci-dessus.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ─── Add KB Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAddKB} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Ajouter une source</Text>
              <Pressable onPress={() => setShowAddKB(false)} hitSlop={8}><MaterialIcons name="close" size={22} color={C.textSecondary} /></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                {KB_SOURCE_TYPES.map(t => (
                  <Pressable key={t.id} onPress={() => setKBType(t.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: kbType === t.id ? C.primaryLight : C.border, backgroundColor: kbType === t.id ? C.primary : C.bgCardAlt }}>
                    <MaterialIcons name={t.icon as any} size={14} color={kbType === t.id ? '#fff' : C.textSecondary} />
                    <Text style={{ fontSize: FontSize.xs, color: kbType === t.id ? '#fff' : C.textSecondary, fontWeight: '600' }}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <ThemedInput label="Nom / Label" value={kbLabel} onChangeText={setKBLabel} placeholder={kbType === 'url' ? 'https://...' : 'Nom de la source'} />
            <ThemedInput label="Contenu" value={kbContent} onChangeText={setKBContent} placeholder={kbType === 'url' ? 'https://docs.example.com/...' : 'Collez votre texte ici...'} multiline numberOfLines={5} textAlignVertical="top" style={{ minHeight: 100 }} mono={kbType === 'schema' || kbType === 'url'} />
            <Pressable onPress={handleAddKB} disabled={!kbLabel.trim() || !kbContent.trim()} style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', opacity: (!kbLabel.trim() || !kbContent.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Ajouter la source</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Add App Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAddApp} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Connecter un webhook</Text>
              <Pressable onPress={() => setShowAddApp(false)} hitSlop={8}><MaterialIcons name="close" size={22} color={C.textSecondary} /></Pressable>
            </View>
            <ThemedInput label="Nom du connecteur" value={appName} onChangeText={setAppName} placeholder="Mon connecteur personnalisé" />
            <ThemedInput label="Description" value={appDesc} onChangeText={setAppDesc} placeholder="Ce que fait cette app..." />
            <ThemedInput label="URL Webhook" value={appWebhook} onChangeText={setAppWebhook} placeholder="https://mon-app.com/webhook" mono />
            <Pressable onPress={handleAddApp} disabled={!appName.trim() || !appWebhook.trim()} style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm, opacity: (!appName.trim() || !appWebhook.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Ajouter le connecteur</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Custom Agent Modal ──────────────────────────────────────── */}
      <Modal visible={showAgentModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, maxHeight: '95%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: agentColor + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={agentIcon as any} size={18} color={agentColor} />
                </View>
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>{editingAgent ? 'Modifier l\'agent' : 'Nouvel agent IA'}</Text>
              </View>
              <Pressable onPress={() => { setShowAgentModal(false); resetAgentForm(); }} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
              <View style={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
                {/* Name + Role */}
                <ThemedInput label="Nom de l'agent *" value={agentName} onChangeText={setAgentName} placeholder="Ex: Analyste financier, Rédacteur SEO..." />
                <ThemedInput label="Rôle / Spécialité *" value={agentRole} onChangeText={setAgentRole} placeholder="Ex: Spécialiste en analyse de données financières" />
                <ThemedInput label="Description" value={agentDesc} onChangeText={setAgentDesc} placeholder="Ce que fait cet agent..." />

                {/* Complexity */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Niveau de complexité</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {([1, 2, 3] as const).map(c => {
                      const cx = COMPLEXITY_LABELS[c];
                      const active = agentComplexity === c;
                      return (
                        <Pressable key={c} onPress={() => setAgentComplexity(c)} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: active ? cx.color : C.border, backgroundColor: active ? cx.color + '18' : C.bgCardAlt }}>
                          <MaterialIcons name={cx.icon as any} size={18} color={active ? cx.color : C.textMuted} />
                          <Text style={{ fontSize: FontSize.xs, color: active ? cx.color : C.textMuted, fontWeight: '700' }}>{cx.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ fontSize: FontSize.xs, color: C.textMuted, lineHeight: 17 }}>
                    {agentComplexity === 1 ? 'Activé pour les requêtes simples (résumé, traduction, reformulation)' :
                     agentComplexity === 2 ? 'Activé pour les tâches modérées (analyse, comparaison, création)' :
                     'Activé pour les tâches complexes (recherche, raisonnement multi-étapes, code)'}
                  </Text>
                </View>

                {/* Model */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Modèle IA</Text>
                  {AGENT_MODELS.map(m => {
                    const active = agentModel === m.id;
                    return (
                      <Pressable key={m.id} onPress={() => setAgentModel(m.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: active ? C.primaryLight : C.border, backgroundColor: active ? C.accentGlow : C.bgCardAlt }, pressed && { opacity: 0.75 }]}>
                        <MaterialIcons name="smart-toy" size={16} color={active ? C.accent : C.textMuted} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: FontSize.sm, color: active ? C.accent : C.textPrimary, fontWeight: '600' }}>{m.label}</Text>
                          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{m.provider}</Text>
                        </View>
                        {active ? <MaterialIcons name="check" size={16} color={C.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Prompt prefix */}
                <ThemedInput
                  label="Instructions système (prompt prefix)"
                  value={agentPrompt}
                  onChangeText={setAgentPrompt}
                  placeholder="Tu es un expert en... Réponds toujours en..."
                  multiline numberOfLines={4}
                  textAlignVertical="top"
                  style={{ minHeight: 90 }}
                  mono
                />

                {/* Color + Icon */}
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Couleur</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {AGENT_COLORS.map(c => <Pressable key={c} onPress={() => setAgentColor(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: agentColor === c ? 3 : 0, borderColor: '#fff' }} />)}
                  </View>
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Icône</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                    {AGENT_ICONS.map(ic => (
                      <Pressable key={ic} onPress={() => setAgentIcon(ic)} style={{ width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: agentIcon === ic ? agentColor + '33' : C.bgCardAlt, borderWidth: 1, borderColor: agentIcon === ic ? agentColor : C.border }}>
                        <MaterialIcons name={ic as any} size={22} color={agentIcon === ic ? agentColor : C.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>

            <Pressable onPress={handleSaveAgent} disabled={!agentName.trim() || !agentRole.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: (!agentName.trim() || !agentRole.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name={editingAgent ? 'save' : 'add-circle'} size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>{editingAgent ? 'Enregistrer les modifications' : 'Créer l\'agent'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
