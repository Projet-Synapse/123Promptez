// Theme fix: createStyles(C) pattern — styles are generated inside the component
// using the reactive color object from useThemeColors(), NOT static StyleSheet.create() at module level.
//
// Settings is split into 4 top-level sections (Interface / Compte et données /
// Assistant / À propos), selected via the pill tabs at the top — see
// SETTINGS_SECTIONS below. Keep new settings inside one of these four, or add
// a new section rather than growing the flat list.
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Linking, TextInput, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useBot } from '@/hooks/useBot';
import { ThemedInput, SliderRow } from '@/components';
import { Spacing, Radius, FontSize, FontWeight, normalizeHex } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { LLM_MODELS, WEB_SEARCH_ENGINES, APP_LANGUAGES } from '@/constants/config';
import { useAlert, useAuth } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage, type LangCode } from '@/contexts/LanguageContext';
import { useAppData } from '@/contexts/AppDataContext';
import { checkForUpdate, type UpdateCheckResult } from '@/services/updateService';

type SettingsSection = 'ui' | 'account' | 'assistant' | 'about';

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'ui', label: 'Interface', icon: 'palette' },
  { id: 'account', label: 'Compte', icon: 'account-circle' },
  { id: 'assistant', label: 'Assistant', icon: 'smart-toy' },
  { id: 'about', label: 'À propos', icon: 'info' },
];


function ColorRow({
  label, hint, value, isCustom, onChange,
}: {
  label: string;
  hint: string;
  value: string;
  isCustom: boolean;
  onChange: (hex: string | undefined) => void;
}) {
  const C = useThemeColors();
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = (raw: string) => {
    const next = normalizeHex(raw, value);
    setDraft(next);
    onChange(next);
  };

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1,
      borderColor: isCustom ? C.primary + '66' : C.border, padding: Spacing.sm + 2,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: Radius.sm,
        backgroundColor: normalizeHex(draft, value),
        borderWidth: 1, borderColor: C.border, overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {Platform.OS === 'web'
          ? React.createElement('input', {
              type: 'color',
              value: normalizeHex(draft, '#000000'),
              onChange: (e: any) => commit(e?.target?.value ?? draft),
              style: {
                width: '140%', height: '140%', border: 'none', padding: 0,
                background: 'transparent', cursor: 'pointer',
              },
            })
          : (
            <Pressable
              onPress={() => {
                // Mobile: cycle a small preset if user clears via long hex edit — hex TextInput remains primary
              }}
              style={{ width: '100%', height: '100%' }}
            />
          )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>{hint}</Text>
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => commit(draft)}
        onSubmitEditing={() => commit(draft)}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="#000000"
        placeholderTextColor={C.textMuted}
        style={{
          minWidth: 92, maxWidth: 110, paddingHorizontal: 8, paddingVertical: 6,
          borderRadius: Radius.sm, borderWidth: 1, borderColor: C.border,
          backgroundColor: C.bg, color: C.textMono, fontFamily: 'monospace',
          fontSize: FontSize.sm,
        }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { bot, updateBot, updateLLMConfig, updateAgentToolConfig, resetBot } = useBot();
  const { showAlert } = useAlert();
  const { mode, toggleTheme, setTheme, customPalette, setCustomColor, resetCustomPalette, colors: themeColors } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const { user, logout, updatePassword } = useAuth();
  const { isSyncing, lastSyncAt } = useAppData();
  const C = useThemeColors();
  const router = useRouter();

  const [section, setSection] = useState<SettingsSection>('ui');
  const [showModels, setShowModels] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Persisted on the web_search agent tool config so it survives reloads
  // and cloud sync, instead of living only in local component state.
  const webSearchTool = bot.agentTools.find(tool => tool.id === 'web_search');
  const selectedSearchEngine = webSearchTool?.config?.engine ?? 'google';
  const setSelectedSearchEngine = (engine: string) => updateAgentToolConfig('web_search', { ...webSearchTool?.config, engine });

  const appVersion = Constants.expoConfig?.version ?? '1.1.0';
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const runUpdateCheck = async () => {
    setCheckingUpdate(true);
    const result = await checkForUpdate(appVersion);
    setCheckingUpdate(false);
    setUpdateCheck(result);
  };

  // Silent check on mount — no popup if nothing's new or the check fails
  // (e.g. repo not public yet, offline). The button below is for an
  // explicit, visible check.
  useEffect(() => {
    runUpdateCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedModel = LLM_MODELS.find(m => m.id === bot.llmConfig.model) || LLM_MODELS[0];

  const providerColor: Record<string, string> = {
    OpenAI: '#10A37F',
    Anthropic: '#D97706',
    Google: '#4285F4',
    'Meta / Local': '#3b5998',
    'Mistral AI': '#FF6B35',
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      showAlert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert('Mots de passe différents', 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    setChangingPassword(true);
    const { error } = await updatePassword(newPassword);
    setChangingPassword(false);
    if (error) {
      showAlert('Erreur', error);
      return;
    }
    setNewPassword('');
    setConfirmNewPassword('');
    showAlert('Mot de passe modifié', 'Votre mot de passe a été mis à jour avec succès.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: 2 }}>
        <Text style={{ fontSize: FontSize.xl, color: C.textPrimary, fontWeight: FontWeight.bold }}>{t('settings')}</Text>
        <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginBottom: Spacing.sm }}>LLM, langue, apparence et configuration avancée</Text>
      </View>

      {/* ── Section tabs ─────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs, marginBottom: Spacing.sm }}>
        {SETTINGS_SECTIONS.map(s => (
          <Pressable
            key={s.id}
            onPress={() => setSection(s.id)}
            style={({ pressed }) => [{
              flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm,
              borderRadius: Radius.md, borderWidth: 1,
              borderColor: section === s.id ? C.accent : C.border,
              backgroundColor: section === s.id ? C.accentGlow : C.bgCard,
            }, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name={s.icon as any} size={18} color={section === s.id ? C.accent : C.textMuted} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: section === s.id ? C.accent : C.textMuted, textAlign: 'center' }}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.md, paddingTop: 0, gap: Spacing.lg, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {section === 'ui' ? (
          <>
            {/* ── Theme ──────────────────────────────────────────────── */}
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
                    onPress={() => m !== mode && setTheme(m)}
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

              <View style={{ height: 1, backgroundColor: C.border, marginVertical: Spacing.xs }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                  <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }}>Couleurs personnalisées</Text>
                  <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>
                    Texte, boutons, bordures et fond. Le mode clair/sombre adapte automatiquement le contraste selon la luminance du fond.
                  </Text>
                </View>
                <Pressable
                  onPress={resetCustomPalette}
                  hitSlop={8}
                  style={({ pressed }) => [{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCardAlt }, pressed && { opacity: 0.75 }]}
                >
                  <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600' }}>Réinitialiser</Text>
                </Pressable>
              </View>

              {([
                { key: 'bg' as const, label: 'Fond', hint: 'Arrière-plan principal', live: themeColors.bg },
                { key: 'bgCard' as const, label: 'Surfaces', hint: 'Cartes et panneaux', live: themeColors.bgCard },
                { key: 'textPrimary' as const, label: 'Texte', hint: 'Police principale', live: themeColors.textPrimary },
                { key: 'primary' as const, label: 'Boutons', hint: 'Actions primaires', live: themeColors.primary },
                { key: 'accent' as const, label: 'Accent', hint: 'Badges et toggles', live: themeColors.accent },
                { key: 'border' as const, label: 'Bordures', hint: 'Contours et séparateurs', live: themeColors.border },
              ]).map(row => (
                <ColorRow
                  key={row.key}
                  label={row.label}
                  hint={row.hint}
                  value={customPalette[row.key] ?? row.live}
                  isCustom={Boolean(customPalette[row.key])}
                  onChange={hex => setCustomColor(row.key, hex)}
                />
              ))}
            </View>

            {/* ── Interface Language ─────────────────────────────────── */}
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
          </>
        ) : null}

        {section === 'account' ? (
          <>
            {/* ── Account ────────────────────────────────────────────── */}
            {user ? (
              <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Compte</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: FontSize.lg, color: '#fff', fontWeight: '700' }}>{user.email?.[0]?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{user.username || user.email}</Text>
                    <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>{user.email}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent }} />
                      <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '600' }}>Compte vérifié</Text>
                    </View>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.sm }}>
                  <MaterialIcons name={isSyncing ? 'sync' : 'cloud-done'} size={15} color={isSyncing ? C.warning : C.accent} />
                  <Text style={{ fontSize: FontSize.xs, color: isSyncing ? C.warning : C.textMuted, flex: 1 }}>
                    {isSyncing ? 'Synchronisation en cours...' : lastSyncAt ? `Synchronisé à ${lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Données sauvegardées sur le cloud'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => showAlert('Se déconnecter ?', 'Vos données sont sauvegardées sur le cloud.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Déconnexion', style: 'destructive', onPress: () => logout() }])}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.error + '15', borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, borderWidth: 1, borderColor: C.error + '33' }, pressed && { opacity: 0.8 }]}
                >
                  <MaterialIcons name="logout" size={16} color={C.error} />
                  <Text style={{ fontSize: FontSize.sm, color: C.error, fontWeight: '700' }}>Déconnexion</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Compte</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.primary + '15', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '33' }}>
                  <MaterialIcons name="cloud-off" size={16} color={C.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '600', marginBottom: 3 }}>Données locales uniquement</Text>
                    <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 17 }}>Créez un compte pour sauvegarder vos workspaces, conversations et configuration sur le cloud, et les retrouver sur tous vos appareils.</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/login' as any)}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, borderWidth: 0 }, pressed && { opacity: 0.85 }]}
                >
                  <MaterialIcons name="login" size={18} color={C.bg} />
                  <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Se connecter / Créer un compte</Text>
                </Pressable>
              </View>
            )}

            {/* ── Change password ───────────────────────────────────── */}
            {user ? (
              <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Modifier le mot de passe
                </Text>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nouveau mot de passe</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, minHeight: 50 }}>
                    <MaterialIcons name="lock" size={18} color={C.textMuted} style={{ marginLeft: Spacing.md }} />
                    <ThemedInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Min. 6 caractères"
                      secureTextEntry={!showNewPassword}
                      autoComplete="new-password"
                      style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent' }}
                    />
                    <Pressable onPress={() => setShowNewPassword(v => !v)} hitSlop={8} style={{ padding: Spacing.md }}>
                      <MaterialIcons name={showNewPassword ? 'visibility-off' : 'visibility'} size={18} color={C.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Confirmer le mot de passe</Text>
                  <ThemedInput
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="Répétez le nouveau mot de passe"
                    secureTextEntry={!showNewPassword}
                    autoComplete="new-password"
                  />
                </View>
                <Pressable
                  onPress={handleChangePassword}
                  disabled={changingPassword || !newPassword || !confirmNewPassword}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
                    backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md,
                    opacity: (!newPassword || !confirmNewPassword) ? 0.5 : 1,
                  }, pressed && { opacity: 0.85 }]}
                >
                  <MaterialIcons name="key" size={18} color={C.bg} />
                  <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>
                    {changingPassword ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* ── Danger ─────────────────────────────────────────────── */}
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
                    {
                      text: 'Réinitialiser', style: 'destructive', onPress: () => {
                        resetBot();
                        showAlert('Configuration réinitialisée', 'Le bot a été restauré à ses réglages par défaut.', [{ text: 'OK' }]);
                      },
                    },
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
          </>
        ) : null}

        {section === 'assistant' ? (
          <>
            {/* ── API Key ────────────────────────────────────────────── */}
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

            {/* ── Model Selector ─────────────────────────────────────── */}
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

            {/* ── Generation Params ──────────────────────────────────── */}
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

            {/* ── Web Search Engine ──────────────────────────────────── */}
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

            {/* ── System Prompt ──────────────────────────────────────── */}
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

            {/* ── Bot Color ──────────────────────────────────────────── */}
            <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                Couleur de l’avatar
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
          </>
        ) : null}

        {section === 'about' ? (
          <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              À propos
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FontSize.body, color: C.textPrimary }}>Version installée</Text>
              <Text style={{ fontSize: FontSize.body, color: C.textMuted, fontFamily: 'monospace' }}>{appVersion}</Text>
            </View>

            {updateCheck?.available ? (
              <Pressable
                onPress={() => Linking.openURL(updateCheck.url)}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                  backgroundColor: C.accent + '15', borderRadius: Radius.md,
                  padding: Spacing.md, borderWidth: 1, borderColor: C.accent + '33',
                }, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="system-update" size={18} color={C.accent} />
                <Text style={{ flex: 1, fontSize: FontSize.body, color: C.accent, fontWeight: '600' }}>
                  Nouvelle version disponible · v{updateCheck.latestVersion}
                </Text>
                <MaterialIcons name="chevron-right" size={18} color={C.accent} />
              </Pressable>
            ) : (
              <Pressable
                onPress={runUpdateCheck}
                disabled={checkingUpdate}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                  backgroundColor: C.bgCardAlt, borderRadius: Radius.md,
                  padding: Spacing.md, borderWidth: 1, borderColor: C.border,
                }, pressed && { opacity: 0.75 }]}
              >
                <MaterialIcons name="refresh" size={18} color={C.textSecondary} />
                <Text style={{ fontSize: FontSize.body, color: C.textSecondary }}>
                  {checkingUpdate ? 'Vérification…' : 'Vérifier les mises à jour'}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
