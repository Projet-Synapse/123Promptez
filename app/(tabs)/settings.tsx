// Powered by OnSpace.AI
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBot } from '@/hooks/useBot';
import { ThemedInput, SliderRow } from '@/components';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LLM_MODELS } from '@/constants/config';
import { useAlert } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { bot, updateBot, updateLLMConfig } = useBot();
  const { showAlert } = useAlert();
  const { mode, toggleTheme } = useTheme();
  const Colors = useThemeColors();
  const [showModels, setShowModels] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const selectedModel = LLM_MODELS.find(m => m.id === bot.llmConfig.model) || LLM_MODELS[0];

  const providerColor: Record<string, string> = {
    OpenAI: '#10A37F',
    Anthropic: '#D97706',
    Google: '#4285F4',
    'Meta / Local': '#3b5998',
    'Mistral AI': '#FF6B35',
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Paramètres</Text>
        <Text style={styles.screenSub}>LLM, apparence et configuration avancée</Text>

        {/* Theme Switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="palette" size={14} color={Colors.primary} /> Apparence
          </Text>
          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [styles.themeRow, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.themeIconWrap, { backgroundColor: mode === 'dark' ? '#1E2535' : '#E8ECF8' }]}>
              <MaterialIcons
                name={mode === 'dark' ? 'dark-mode' : 'light-mode'}
                size={22}
                color={mode === 'dark' ? '#A0CFFF' : '#D97706'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.themeLabel}>{mode === 'dark' ? 'Thème sombre' : 'Thème clair'}</Text>
              <Text style={styles.themeSub}>Appuyez pour basculer vers le thème {mode === 'dark' ? 'clair' : 'sombre'}</Text>
            </View>
            <View style={styles.themeToggleWrap}>
              <View style={[styles.themeToggle, mode === 'light' ? styles.themeToggleLight : null]}>
                <View style={[styles.themeThumb, mode === 'light' ? styles.themeThumbLight : null]}>
                  <MaterialIcons
                    name={mode === 'dark' ? 'dark-mode' : 'light-mode'}
                    size={12}
                    color={mode === 'dark' ? '#0A0C10' : '#fff'}
                  />
                </View>
              </View>
            </View>
          </Pressable>

          <View style={styles.themePreviewRow}>
            {([['dark', '#0A0C10', '#3D7EFF', 'Sombre'], ['light', '#F4F6FB', '#2563EB', 'Clair']] as const).map(([m, bg, acc, label]) => (
              <Pressable
                key={m}
                onPress={() => m !== mode && toggleTheme()}
                style={[styles.themePreviewCard, { backgroundColor: bg }, mode === m ? styles.themePreviewCardActive : null]}
              >
                <View style={[styles.themePreviewDot, { backgroundColor: acc }]} />
                <Text style={[styles.themePreviewLabel, { color: m === 'dark' ? '#F0F4FF' : '#111827' }]}>{label}</Text>
                {mode === m ? <MaterialIcons name="check-circle" size={14} color={acc} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {/* API Key */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="vpn-key" size={14} color={Colors.warning} /> Clé API
          </Text>
          <View style={styles.apiKeyRow}>
            <ThemedInput
              value={bot.apiKey}
              onChangeText={v => updateBot({ apiKey: v })}
              placeholder="sk-... (OpenAI, Anthropic, etc.)"
              secureTextEntry={!apiKeyVisible}
              mono
              style={{ flex: 1 }}
            />
            <Pressable onPress={() => setApiKeyVisible(v => !v)} hitSlop={8} style={styles.eyeBtn}>
              <MaterialIcons name={apiKeyVisible ? 'visibility-off' : 'visibility'} size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
          {!bot.apiKey ? (
            <View style={styles.apiWarning}>
              <MaterialIcons name="info-outline" size={14} color={Colors.warning} />
              <Text style={styles.apiWarningText}>Mode démo actif · Ajoutez une clé API pour un vrai LLM</Text>
            </View>
          ) : (
            <View style={[styles.apiWarning, { backgroundColor: Colors.accentGlow }]}>
              <MaterialIcons name="check-circle" size={14} color={Colors.accent} />
              <Text style={[styles.apiWarningText, { color: Colors.accent }]}>Clé API configurée</Text>
            </View>
          )}
        </View>

        {/* Model Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="memory" size={14} color={Colors.primary} /> Modèle LLM
          </Text>
          <Pressable
            onPress={() => setShowModels(v => !v)}
            style={({ pressed }) => [styles.modelSelector, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.providerBadge, { backgroundColor: (providerColor[selectedModel.provider] || Colors.primary) + '22' }]}>
              <Text style={[styles.providerText, { color: providerColor[selectedModel.provider] || Colors.primary }]}>
                {selectedModel.provider}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modelName}>{selectedModel.label}</Text>
              <Text style={styles.modelTokens}>{selectedModel.tokens.toLocaleString('fr-FR')} tokens max</Text>
            </View>
            <MaterialIcons name={showModels ? 'expand-less' : 'expand-more'} size={22} color={Colors.textSecondary} />
          </Pressable>

          {showModels ? (
            <View style={styles.modelList}>
              {LLM_MODELS.map(model => (
                <Pressable
                  key={model.id}
                  onPress={() => { updateLLMConfig({ model: model.id }); setShowModels(false); }}
                  style={({ pressed }) => [
                    styles.modelRow,
                    model.id === bot.llmConfig.model ? styles.modelRowSelected : null,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelRowName, model.id === bot.llmConfig.model ? { color: Colors.accent } : null]}>
                      {model.label}
                    </Text>
                    <Text style={styles.modelRowProvider}>{model.provider}</Text>
                  </View>
                  {model.id === bot.llmConfig.model ? (
                    <MaterialIcons name="check" size={18} color={Colors.accent} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Sliders */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="tune" size={14} color={Colors.accent} /> Paramètres de génération
          </Text>

          <View style={styles.sliderCard}>
            <SliderRow
              label="Température"
              value={bot.llmConfig.temperature}
              min={0}
              max={2}
              step={0.05}
              onChange={v => updateLLMConfig({ temperature: Math.round(v * 20) / 20 })}
            />
            <View style={styles.hint}>
              <Text style={styles.hintText}>
                {bot.llmConfig.temperature < 0.4 ? '❄️ Déterministe · Réponses précises et répétables' :
                  bot.llmConfig.temperature < 0.9 ? '⚖️ Équilibré · Bon compromis créativité/précision' :
                    '🔥 Créatif · Réponses variées et imprévisibles'}
              </Text>
            </View>
          </View>

          <View style={[styles.sliderCard, { marginTop: Spacing.md }]}>
            <SliderRow
              label="Max Tokens"
              value={bot.llmConfig.maxTokens}
              min={256}
              max={8192}
              step={256}
              onChange={v => updateLLMConfig({ maxTokens: Math.round(v / 256) * 256 })}
              format={v => `${Math.round(v).toLocaleString('fr-FR')}`}
            />
          </View>

          <View style={[styles.sliderCard, { marginTop: Spacing.md }]}>
            <SliderRow
              label="Top P (Nucleus Sampling)"
              value={bot.llmConfig.topP}
              min={0.1}
              max={1}
              step={0.05}
              onChange={v => updateLLMConfig({ topP: Math.round(v * 20) / 20 })}
            />
          </View>
        </View>

        {/* System Prompt */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="code" size={14} color={Colors.textMono} /> Prompt système
          </Text>
          <ThemedInput
            value={bot.llmConfig.systemPrompt}
            onChangeText={v => updateLLMConfig({ systemPrompt: v })}
            placeholder="Définissez le comportement et la personnalité de votre assistant..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{ minHeight: 140, lineHeight: 20 }}
            mono
          />
          <Text style={styles.promptHint}>
            {bot.llmConfig.systemPrompt.length} caractères · Votre base de connaissances sera injectée automatiquement
          </Text>
        </View>

        {/* Bot Color */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="palette" size={14} color={Colors.primary} /> Couleur de l'avatar
          </Text>
          <View style={styles.colorRow}>
            {['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455'].map(c => (
              <Pressable
                key={c}
                onPress={() => updateBot({ avatarColor: c })}
                style={[styles.colorDot, { backgroundColor: c }, bot.avatarColor === c ? styles.colorDotSelected : null]}
              />
            ))}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={[styles.section, styles.dangerSection]}>
          <Text style={[styles.sectionLabel, { color: Colors.error }]}>
            <MaterialIcons name="warning" size={14} color={Colors.error} /> Zone de danger
          </Text>
          <Pressable
            onPress={() => showAlert(
              'Réinitialiser le bot ?',
              'Toutes vos sources, paramètres et applications connectées seront supprimés.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Réinitialiser', style: 'destructive', onPress: () => { /* Reset handled via context */ } },
              ]
            )}
            style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="delete-forever" size={18} color={Colors.error} />
            <Text style={styles.dangerBtnText}>Réinitialiser la configuration</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg },
  screenTitle: { fontSize: FontSize.xl, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  screenSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  section: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  eyeBtn: { padding: Spacing.sm, backgroundColor: Colors.bgCardAlt, borderRadius: Radius.sm },
  apiWarning: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.warning + '15', borderRadius: Radius.sm,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.warning + '33',
  },
  apiWarningText: { fontSize: FontSize.xs, color: Colors.warning, flex: 1 },
  modelSelector: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  providerBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  providerText: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
  modelName: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '600' },
  modelTokens: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, fontFamily: 'monospace' },
  modelList: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  modelRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modelRowSelected: { backgroundColor: Colors.accentGlow },
  modelRowName: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '500' },
  modelRowProvider: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  sliderCard: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs,
  },
  hint: { backgroundColor: Colors.bg, borderRadius: Radius.sm, padding: Spacing.sm },
  hintText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  promptHint: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  colorRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff' },
  dangerSection: { borderColor: Colors.error + '33' },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.error + '15', borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.error + '33',
  },
  dangerBtnText: { fontSize: FontSize.body, color: Colors.error, fontWeight: '600' },
  // Theme
  themeRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  themeIconWrap: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  themeLabel: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '600' },
  themeSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  themeToggleWrap: {},
  themeToggle: {
    width: 52, height: 28, borderRadius: 14,
    backgroundColor: '#1E2535', borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  themeToggleLight: { backgroundColor: '#D97706' },
  themeThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#A0CFFF', alignItems: 'center', justifyContent: 'center',
  },
  themeThumbLight: { backgroundColor: '#fff', alignSelf: 'flex-end' },
  themePreviewRow: { flexDirection: 'row', gap: Spacing.sm },
  themePreviewCard: {
    flex: 1, borderRadius: Radius.md, padding: Spacing.md, gap: 6,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  themePreviewCardActive: { borderColor: Colors.primary },
  themePreviewDot: { width: 10, height: 10, borderRadius: 5 },
  themePreviewLabel: { fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
});
