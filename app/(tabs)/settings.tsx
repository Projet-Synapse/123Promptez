// Powered by OnSpace.AI
// Theme fix: createStyles(C) pattern — styles are generated inside the component
// using the reactive color object from useThemeColors(), NOT static StyleSheet.create() at module level.
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBot } from '@/hooks/useBot';
import { ThemedInput, SliderRow } from '@/components';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LLM_MODELS, WEB_SEARCH_ENGINES, APP_LANGUAGES } from '@/constants/config';
import { useAlert } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage, type LangCode } from '@/contexts/LanguageContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { bot, updateBot, updateLLMConfig } = useBot();
  const { showAlert } = useAlert();
  const { mode, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const C = useThemeColors();
  const [showModels, setShowModels] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [selectedSearchEngine, setSelectedSearchEngine] = useState('google');

  const selectedModel = LLM_MODELS.find(m => m.id === bot.llmConfig.model) || LLM_MODELS[0];

  const providerColor: Record<string, string> = {
    OpenAI: '#10A37F',
    Anthropic: '#D97706',
    Google: '#4285F4',
    'Meta / Local': '#3b5998',
    'Mistral AI': '#FF6B35',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: FontSize.xl, color: C.textPrimary, fontWeight: FontWeight.bold }}>{t('settings')}</Text>
        <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginTop: 2 }}>LLM, langue, apparence et configuration avancée</Text>

        {/* ── Theme ──────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('appearance')}
          </Text>

          <Pressable
            onPress={toggleTheme}
            style={({ pressed }) => [{
              flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.md,
              backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1,
              borderColor: C.border, padding: Spacing.md,
            }, pressed && { opacity: 0.8 }]}
          >
            <View style={{ width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: mode === 'dark' ? '#1E2535' : '#E8ECF8', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name={mode === 'dark' ? 'dark-mode' : 'light-mode'} size={22} color={mode === 'dark' ? '#A0CFFF' : '#D97706'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }}>{mode === 'dark' ? 'Thème sombre' : 'Thème clair'}</Text>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>Appuyez pour basculer vers le thème {mode === 'dark' ? 'clair' : 'sombre'}</Text>
            </View>
            <View style={{
              width: 52, height: 28, borderRadius: 14,
              backgroundColor: mode === 'dark' ? '#1E2535' : '#D97706',
              borderWidth: 1, borderColor: C.border, justifyContent: 'center', paddingHorizontal: 3,
            }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: mode === 'dark' ? '#A0CFFF' : '#fff',
                alignItems: 'center', justifyContent: 'center',
                alignSelf: mode === 'dark' ? 'flex-start' : 'flex-end',
              }}>
                <MaterialIcons name={mode === 'dark' ? 'dark-mode' : 'light-mode'} size={12} color={mode === 'dark' ? '#0A0C10' : '#D97706'} />
              </View>
            </View>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {([['dark', '#0A0C10', '#3D7EFF', 'Sombre'], ['light', '#F4F6FB', '#2563EB', 'Clair']] as const).map(([m, bg, acc, label]) => (
              <Pressable
                key={m}
                onPress={() => m !== mode && toggleTheme()}
                style={[{
                  flex: 1, borderRadius: Radius.md, padding: Spacing.md, gap: 6,
                  flexDirection: 'row' as const, alignItems: 'center' as const,
                  backgroundColor: bg,
                  borderWidth: 2, borderColor: mode === m ? acc : 'transparent',
                }]}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: acc }} />
                <Text style={{ fontSize: FontSize.sm, fontWeight: '600', flex: 1, color: m === 'dark' ? '#F0F4FF' : '#111827' }}>{label}</Text>
                {mode === m ? <MaterialIcons name="check-circle" size={14} color={acc} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Interface Language ──────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('interfaceLanguage')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {APP_LANGUAGES.map(l => (
                <Pressable
                  key={l.code}
                  onPress={() => setLang(l.code as LangCode)}
                  style={{
                    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                    borderRadius: Radius.pill, borderWidth: 1,
                    borderColor: lang === l.code ? C.primaryLight : C.border,
                    backgroundColor: lang === l.code ? C.primary : C.bgCardAlt,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{l.flag}</Text>
                  <Text style={{ fontSize: FontSize.sm, color: lang === l.code ? '#fff' : C.textSecondary, fontWeight: '600' }}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── Web Search Engine ──────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Moteur de recherche web
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {WEB_SEARCH_ENGINES.map(engine => (
              <Pressable
                key={engine.id}
                onPress={() => setSelectedSearchEngine(engine.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                  borderRadius: Radius.md, borderWidth: 1,
                  borderColor: selectedSearchEngine === engine.id ? engine.color : C.border,
                  backgroundColor: selectedSearchEngine === engine.id ? engine.color + '18' : C.bgCardAlt,
                  flex: 1, minWidth: '45%',
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: engine.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={engine.icon as any} size={16} color={engine.color} />
                </View>
                <Text style={{ fontSize: FontSize.sm, color: selectedSearchEngine === engine.id ? engine.color : C.textSecondary, fontWeight: '600', flex: 1 }}>
                  {engine.label}
                </Text>
                {selectedSearchEngine === engine.id ? <MaterialIcons name="check" size={16} color={engine.color} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── API Key ─────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Clé API
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <ThemedInput
              value={bot.apiKey}
              onChangeText={v => updateBot({ apiKey: v })}
              placeholder="sk-... (OpenAI, Anthropic, etc.)"
              secureTextEntry={!apiKeyVisible}
              mono
              style={{ flex: 1 }}
            />
            <Pressable onPress={() => setApiKeyVisible(v => !v)} hitSlop={8} style={{ padding: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm }}>
              <MaterialIcons name={apiKeyVisible ? 'visibility-off' : 'visibility'} size={20} color={C.textSecondary} />
            </Pressable>
          </View>
          {!bot.apiKey ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: C.warning + '15', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: C.warning + '33' }}>
              <MaterialIcons name="info-outline" size={14} color={C.warning} />
              <Text style={{ fontSize: FontSize.xs, color: C.warning, flex: 1 }}>Mode démo actif · Ajoutez une clé API pour un vrai LLM</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: C.accentGlow, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: C.accent + '33' }}>
              <MaterialIcons name="check-circle" size={14} color={C.accent} />
              <Text style={{ fontSize: FontSize.xs, color: C.accent, flex: 1 }}>Clé API configurée</Text>
            </View>
          )}
        </View>

        {/* ── Model Selector ──────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Modèle LLM
          </Text>
          <Pressable
            onPress={() => setShowModels(v => !v)}
            style={({ pressed }) => [{
              flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.md,
              backgroundColor: C.bgCardAlt, borderRadius: Radius.md,
              borderWidth: 1, borderColor: C.border, padding: Spacing.md,
            }, pressed && { opacity: 0.8 }]}
          >
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: (providerColor[selectedModel.provider] || C.primary) + '22' }}>
              <Text style={{ fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5, color: providerColor[selectedModel.provider] || C.primary }}>
                {selectedModel.provider}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }}>{selectedModel.label}</Text>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2, fontFamily: 'monospace' }}>{selectedModel.tokens.toLocaleString('fr-FR')} tokens max</Text>
            </View>
            <MaterialIcons name={showModels ? 'expand-less' : 'expand-more'} size={22} color={C.textSecondary} />
          </Pressable>

          {showModels ? (
            <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              {LLM_MODELS.map(model => (
                <Pressable
                  key={model.id}
                  onPress={() => { updateLLMConfig({ model: model.id }); setShowModels(false); }}
                  style={({ pressed }) => [{
                    flexDirection: 'row' as const, alignItems: 'center' as const, padding: Spacing.md,
                    borderBottomWidth: 1, borderBottomColor: C.border,
                    backgroundColor: model.id === bot.llmConfig.model ? C.accentGlow : 'transparent',
                  }, pressed && { opacity: 0.75 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.body, color: model.id === bot.llmConfig.model ? C.accent : C.textPrimary, fontWeight: '500' }}>
                      {model.label}
                    </Text>
                    <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>{model.provider}</Text>
                  </View>
                  {model.id === bot.llmConfig.model ? <MaterialIcons name="check" size={18} color={C.accent} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Generation Params ───────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Paramètres de génération
          </Text>

          <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.xs }}>
            <SliderRow label="Température" value={bot.llmConfig.temperature} min={0} max={2} step={0.05}
              onChange={v => updateLLMConfig({ temperature: Math.round(v * 20) / 20 })} />
            <View style={{ backgroundColor: C.bg, borderRadius: Radius.sm, padding: Spacing.sm }}>
              <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 18 }}>
                {bot.llmConfig.temperature < 0.4 ? '❄️ Déterministe · Réponses précises et répétables' :
                  bot.llmConfig.temperature < 0.9 ? '⚖️ Équilibré · Bon compromis créativité/précision' :
                    '🔥 Créatif · Réponses variées et imprévisibles'}
              </Text>
            </View>
          </View>

          <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
            <SliderRow label="Max Tokens" value={bot.llmConfig.maxTokens} min={256} max={8192} step={256}
              onChange={v => updateLLMConfig({ maxTokens: Math.round(v / 256) * 256 })}
              format={v => `${Math.round(v).toLocaleString('fr-FR')}`} />
          </View>

          <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
            <SliderRow label="Top P (Nucleus Sampling)" value={bot.llmConfig.topP} min={0.1} max={1} step={0.05}
              onChange={v => updateLLMConfig({ topP: Math.round(v * 20) / 20 })} />
          </View>
        </View>

        {/* ── System Prompt ───────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Prompt système
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
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontFamily: 'monospace' }}>
            {bot.llmConfig.systemPrompt.length} caractères · Votre base de connaissances sera injectée automatiquement
          </Text>
        </View>

        {/* ── Bot Color ───────────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Couleur de l'avatar
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }}>
            {['#3D7EFF', '#00CC6A', '#FF6B35', '#9B59B6', '#FFB800', '#FF4455'].map(c => (
              <Pressable
                key={c}
                onPress={() => updateBot({ avatarColor: c })}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: bot.avatarColor === c ? 3 : 0, borderColor: '#fff' }}
              />
            ))}
          </View>
        </View>

        {/* ── Danger ──────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.error + '33', padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.error, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Zone de danger
          </Text>
          <Pressable
            onPress={() => showAlert(
              'Réinitialiser le bot ?',
              'Toutes vos sources, paramètres et applications connectées seront supprimés.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Réinitialiser', style: 'destructive', onPress: () => {} },
              ]
            )}
            style={({ pressed }) => [{
              flexDirection: 'row' as const, alignItems: 'center' as const, gap: Spacing.sm,
              backgroundColor: C.error + '15', borderRadius: Radius.md,
              padding: Spacing.md, borderWidth: 1, borderColor: C.error + '33',
            }, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="delete-forever" size={18} color={C.error} />
            <Text style={{ fontSize: FontSize.body, color: C.error, fontWeight: '600' }}>Réinitialiser la configuration</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
