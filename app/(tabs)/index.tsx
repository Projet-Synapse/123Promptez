// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Modal, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useBot } from '@/hooks/useBot';
import { KBSourceCard, AgentToolRow, ThemedInput } from '@/components';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { AGENT_TOOLS, KB_SOURCE_TYPES } from '@/constants/config';

type ActiveSection = 'kb' | 'agents' | 'apps';

export default function BuilderScreen() {
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const { bot, updateBot, addKBSource, removeKBSource, addFAQItem, toggleAgentTool, addConnectedApp, removeConnectedApp } = useBot();
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
    setKBLabel('');
    setKBContent('');
    setKBType('text');
    setShowAddKB(false);
  };

  const handleAddApp = () => {
    if (!appName.trim() || !appWebhook.trim()) return;
    addConnectedApp({ name: appName, description: appDesc, webhookUrl: appWebhook, enabled: true });
    setAppName('');
    setAppDesc('');
    setAppWebhook('');
    setShowAddApp(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>LLM Builder</Text>
            <Text style={styles.subtitle}>Configurez votre assistant IA</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: Colors.accentGlow }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Actif</Text>
          </View>
        </View>

        {/* Bot Identity Card */}
        <View style={styles.identityCard}>
          <View style={[styles.botAvatar, { backgroundColor: bot.avatarColor }]}>
            <MaterialIcons name="smart-toy" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedInput
              value={bot.name}
              onChangeText={v => updateBot({ name: v })}
              placeholder="Nom de votre assistant"
              style={styles.nameInput}
            />
            <ThemedInput
              value={bot.description}
              onChangeText={v => updateBot({ description: v })}
              placeholder="Description courte"
              style={styles.descInput}
            />
          </View>
        </View>

        {/* Hero image */}
        {heroVisible ? (
          <Pressable onPress={() => setHeroVisible(false)} style={styles.heroWrap}>
            <Image
              source={require('@/assets/images/hero-llm.png')}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>Architecture agentique</Text>
              <Text style={styles.heroSub}>Modèle · Base de connaissances · Outils · Apps</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { icon: 'library-books', label: 'Sources KB', value: bot.kbSources.length },
            { icon: 'bolt', label: 'Outils actifs', value: enabledToolsCount },
            { icon: 'apps', label: 'Apps', value: enabledAppsCount },
            { icon: 'question-answer', label: 'FAQ', value: bot.faqItems.length },
          ].map(stat => (
            <View key={stat.label} style={styles.statCard}>
              <MaterialIcons name={stat.icon as any} size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Section tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabsScroll}>
          <View style={styles.sectionTabs}>
            {sections.map(s => (
              <Pressable
                key={s.id}
                onPress={() => setActiveSection(s.id)}
                style={[styles.sectionTab, activeSection === s.id ? styles.sectionTabActive : null]}
              >
                <Text style={[styles.sectionTabText, activeSection === s.id ? styles.sectionTabTextActive : null]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* KB Section */}
        {activeSection === 'kb' ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Base de connaissances</Text>
              <Pressable
                onPress={() => setShowAddKB(true)}
                style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
              >
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Ajouter</Text>
              </Pressable>
            </View>
            {bot.kbSources.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="library-books" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Aucune source de connaissances</Text>
                <Text style={styles.emptySubText}>Ajoutez du texte, des fichiers, des URLs ou des FAQ</Text>
              </View>
            ) : (
              bot.kbSources.map(src => (
                <KBSourceCard key={src.id} source={src} onRemove={removeKBSource} />
              ))
            )}
          </View>
        ) : null}

        {/* Agents Section */}
        {activeSection === 'agents' ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Outils agentiques</Text>
              <View style={[styles.badge, { backgroundColor: Colors.accent + '22' }]}>
                <Text style={[styles.badgeText, { color: Colors.accent }]}>{enabledToolsCount} actifs</Text>
              </View>
            </View>
            {AGENT_TOOLS.map(tool => {
              const state = bot.agentTools.find(t => t.id === tool.id);
              return (
                <AgentToolRow
                  key={tool.id}
                  id={tool.id}
                  label={tool.label}
                  icon={tool.icon}
                  description={tool.description}
                  enabled={state?.enabled ?? false}
                  onToggle={() => toggleAgentTool(tool.id)}
                />
              );
            })}
          </View>
        ) : null}

        {/* Apps Section */}
        {activeSection === 'apps' ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Applications connectées</Text>
              <Pressable
                onPress={() => setShowAddApp(true)}
                style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
              >
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Connecter</Text>
              </Pressable>
            </View>
            {bot.connectedApps.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="apps" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Aucune application connectée</Text>
                <Text style={styles.emptySubText}>Connectez vos propres apps via webhooks</Text>
              </View>
            ) : (
              bot.connectedApps.map(app => (
                <View key={app.id} style={styles.appCard}>
                  <MaterialIcons name="api" size={22} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appName}>{app.name}</Text>
                    <Text style={styles.appDesc}>{app.description || app.webhookUrl}</Text>
                  </View>
                  <Pressable onPress={() => removeConnectedApp(app.id)} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Add KB Modal */}
      <Modal visible={showAddKB} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter une source</Text>
              <Pressable onPress={() => setShowAddKB(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Type selector */}
            <View style={styles.typeRow}>
              {KB_SOURCE_TYPES.map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setKBType(t.id)}
                  style={[styles.typeChip, kbType === t.id ? styles.typeChipActive : null]}
                >
                  <MaterialIcons name={t.icon as any} size={14} color={kbType === t.id ? '#fff' : Colors.textSecondary} />
                  <Text style={[styles.typeChipText, kbType === t.id ? styles.typeChipTextActive : null]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <ThemedInput label="Nom / Label" value={kbLabel} onChangeText={setKBLabel} placeholder="Ex: Politique de confidentialité" />
            <View style={{ height: Spacing.md }} />
            <ThemedInput
              label="Contenu"
              value={kbContent}
              onChangeText={setKBContent}
              placeholder="Collez votre texte, URL ou schéma ici..."
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={{ minHeight: 100 }}
              mono={kbType === 'schema' || kbType === 'url'}
            />
            <Pressable
              onPress={handleAddKB}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.primaryBtnText}>Ajouter la source</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add App Modal */}
      <Modal visible={showAddApp} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Connecter une application</Text>
              <Pressable onPress={() => setShowAddApp(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ThemedInput label="Nom de l'app" value={appName} onChangeText={setAppName} placeholder="Mon App Personnalisée" />
            <View style={{ height: Spacing.md }} />
            <ThemedInput label="Description" value={appDesc} onChangeText={setAppDesc} placeholder="Ce que fait cette app..." />
            <View style={{ height: Spacing.md }} />
            <ThemedInput label="URL Webhook" value={appWebhook} onChangeText={setAppWebhook} placeholder="https://mon-app.com/webhook" mono />
            <Pressable
              onPress={handleAddApp}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.primaryBtnText}>Connecter l'application</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FontSize.xl, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  statusText: { fontSize: FontSize.sm, color: Colors.accent, fontWeight: '600' },
  identityCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  botAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  nameInput: { marginBottom: Spacing.sm, fontSize: FontSize.md, fontWeight: '600' },
  descInput: { fontSize: FontSize.sm },
  heroWrap: { borderRadius: Radius.lg, overflow: 'hidden', height: 160 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10,12,16,0.72)', padding: Spacing.md,
  },
  heroTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
    alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: FontSize.lg, color: Colors.textPrimary, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  sectionTabsScroll: { marginHorizontal: -Spacing.md },
  sectionTabs: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  sectionTab: {
    paddingHorizontal: Spacing.md, height: 36, borderRadius: Radius.pill,
    justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCardAlt,
  },
  sectionTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },
  sectionTabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  sectionTabTextActive: { color: '#fff' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  addBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '500' },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  appCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  appName: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '600' },
  appDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCardAlt,
  },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },
  typeChipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  typeChipTextActive: { color: '#fff' },
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md,
    alignItems: 'center', marginTop: Spacing.sm,
  },
  primaryBtnText: { fontSize: FontSize.body, color: Colors.bg, fontWeight: '700' },
});
