// Powered by OnSpace.AI
// Theme fix: inline styles with C from useThemeColors() + KB image/file/link insert buttons
import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useBot } from '@/hooks/useBot';
import { KBSourceCard, AgentToolRow, ThemedInput } from '@/components';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { AGENT_TOOLS, KB_SOURCE_TYPES } from '@/constants/config';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '@/template';

type ActiveSection = 'kb' | 'agents' | 'apps';

export default function BuilderScreen() {
  const insets = useSafeAreaInsets();
  const C = useThemeColors();
  const { bot, updateBot, addKBSource, removeKBSource, addFAQItem, toggleAgentTool, addConnectedApp, removeConnectedApp } = useBot();
  const { showAlert } = useAlert();
  const [activeSection, setActiveSection] = useState<ActiveSection>('kb');
  const [showAddKB, setShowAddKB] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);
  const [kbType, setKBType] = useState('text');
  const [kbLabel, setKBLabel] = useState('');
  const [kbContent, setKBContent] = useState('');
  const [appName, setAppName] = useState('');
  const [appDesc, setAppDesc] = useState('');
  const [appWebhook, setAppWebhook] = useState('');
  const [heroVisible, setHeroVisible] = useState(true);

  const sections: { id: ActiveSection; label: string }[] = [
    { id: 'kb', label: 'Knowledge Base' },
    { id: 'agents', label: 'Outils agentiques' },
    { id: 'apps', label: 'Apps connectées' },
  ];

  const enabledToolsCount = bot.agentTools.filter(t => t.enabled).length;
  const enabledAppsCount = bot.connectedApps.filter(a => a.enabled).length;

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

  // ─── File picker for KB ──────────────────────────────────────────
  const handlePickKBFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/*', 'application/json', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      let content = '';
      try {
        const response = await fetch(asset.uri);
        content = await response.text();
        if (content.length > 50000) content = content.slice(0, 50000) + '\n\n[... Tronqué à 50 000 caractères]';
      } catch { content = `[Fichier importé: ${asset.name}]`; }
      addKBSource({ type: 'file', label: asset.name ?? 'Fichier importé', content });
      showAlert('Fichier ajouté', `"${asset.name}" a été ajouté à votre base de connaissances.`);
    } catch (e: any) { showAlert('Erreur', e.message ?? 'Impossible d\'importer'); }
  };

  // ─── Image picker for KB ─────────────────────────────────────────
  const handlePickKBImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showAlert('Permission requise', "L'accès à la galerie photo est nécessaire."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8 });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const name = asset.uri.split('/').pop() ?? 'image.jpg';
      addKBSource({ type: 'file', label: name, content: `[IMAGE: ${name}]\nDimensions: ${asset.width}x${asset.height}px\nURI: ${asset.uri}` });
      showAlert('Image ajoutée', `"${name}" a été ajoutée à votre base de connaissances.`);
    } catch (e: any) { showAlert('Erreur', e.message ?? 'Impossible d\'importer'); }
  };

  // ─── Quick link insert ───────────────────────────────────────────
  const handleAddLink = () => {
    setKBType('url');
    setKBLabel('');
    setKBContent('');
    setShowAddKB(true);
  };

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
              <Text style={{ fontSize: FontSize.sm, color: '#8899BB', marginTop: 2 }}>Modèle · Base de connaissances · Outils · Apps</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {[
            { icon: 'library-books', label: 'Sources KB', value: bot.kbSources.length },
            { icon: 'bolt', label: 'Outils actifs', value: enabledToolsCount },
            { icon: 'apps', label: 'Apps', value: enabledAppsCount },
            { icon: 'question-answer', label: 'FAQ', value: bot.faqItems.length },
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
              <Pressable key={s.id} onPress={() => setActiveSection(s.id)} style={{ paddingHorizontal: Spacing.md, height: 36, borderRadius: Radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: activeSection === s.id ? C.primaryLight : C.border, backgroundColor: activeSection === s.id ? C.primary : C.bgCardAlt }}>
                <Text style={{ fontSize: FontSize.sm, color: activeSection === s.id ? '#fff' : C.textSecondary, fontWeight: '600' }}>{s.label}</Text>
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

            {/* Insert options */}
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
                <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>Ajoutez du texte, des fichiers, des images ou des liens</Text>
              </View>
            ) : (
              bot.kbSources.map(src => <KBSourceCard key={src.id} source={src} onRemove={removeKBSource} />)
            )}
          </View>
        ) : null}

        {/* ── Agents Section ──────────────────────────────────────────── */}
        {activeSection === 'agents' ? (
          <View style={{ gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Outils agentiques</Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: C.accent + '22' }}>
                <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: C.accent }}>{enabledToolsCount} actifs</Text>
              </View>
            </View>
            {AGENT_TOOLS.map(tool => {
              const state = bot.agentTools.find(t => t.id === tool.id);
              return (
                <AgentToolRow key={tool.id} id={tool.id} label={tool.label} icon={tool.icon} description={tool.description} enabled={state?.enabled ?? false} onToggle={() => toggleAgentTool(tool.id)} />
              );
            })}
          </View>
        ) : null}

        {/* ── Apps Section ────────────────────────────────────────────── */}
        {activeSection === 'apps' ? (
          <View style={{ gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Applications connectées</Text>
              <Pressable onPress={() => setShowAddApp(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill }, pressed && { opacity: 0.75 }]}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={{ fontSize: FontSize.sm, color: '#fff', fontWeight: '600' }}>Connecter</Text>
              </Pressable>
            </View>
            {bot.connectedApps.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm }}>
                <MaterialIcons name="apps" size={36} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '500' }}>Aucune application connectée</Text>
                <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>Connectez vos propres apps via webhooks</Text>
              </View>
            ) : (
              bot.connectedApps.map(app => (
                <View key={app.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md, marginBottom: Spacing.sm }}>
                  <MaterialIcons name="api" size={22} color={C.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }}>{app.name}</Text>
                    <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }}>{app.description || app.webhookUrl}</Text>
                  </View>
                  <Pressable onPress={() => removeConnectedApp(app.id)} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color={C.textMuted} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Add KB Modal */}
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
            <ThemedInput
              label="Contenu"
              value={kbContent}
              onChangeText={setKBContent}
              placeholder={kbType === 'url' ? 'https://docs.example.com/...' : kbType === 'faq' ? 'Q: Question\nA: Réponse' : 'Collez votre texte ici...'}
              multiline numberOfLines={5} textAlignVertical="top"
              style={{ minHeight: 100 }}
              mono={kbType === 'schema' || kbType === 'url'}
            />
            <Pressable onPress={handleAddKB} disabled={!kbLabel.trim() || !kbContent.trim()} style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', opacity: (!kbLabel.trim() || !kbContent.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Ajouter la source</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add App Modal */}
      <Modal visible={showAddApp} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Connecter une application</Text>
              <Pressable onPress={() => setShowAddApp(false)} hitSlop={8}><MaterialIcons name="close" size={22} color={C.textSecondary} /></Pressable>
            </View>
            <ThemedInput label="Nom de l'app" value={appName} onChangeText={setAppName} placeholder="Mon App Personnalisée" />
            <ThemedInput label="Description" value={appDesc} onChangeText={setAppDesc} placeholder="Ce que fait cette app..." />
            <ThemedInput label="URL Webhook" value={appWebhook} onChangeText={setAppWebhook} placeholder="https://mon-app.com/webhook" mono />
            <Pressable onPress={handleAddApp} disabled={!appName.trim() || !appWebhook.trim()} style={({ pressed }) => [{ backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm, opacity: (!appName.trim() || !appWebhook.trim()) ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Connecter l'application</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
