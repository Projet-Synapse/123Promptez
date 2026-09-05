// Powered by OnSpace.AI
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

type Step = 'form' | 'otp';
type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, sendOTP, verifyOTPAndLogin, signInWithPassword, signUpWithPassword, requestPasswordReset, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const C = useThemeColors();

  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [forgotHint, setForgotHint] = useState<string | null>(null);

  // AuthRouter only wraps `/`, not `/login`. After password or Google OAuth
  // (onAuthStateChange), navigate into the app explicitly.
  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user, router]);

  // Surface OAuth failures returned in the URL (redirect mismatch, etc.).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search.replace(/^\?/, ''));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const description = query.get('error_description') ?? hash.get('error_description');
    const code = query.get('error') ?? hash.get('error');
    if (!description && !code) return;
    const message = description || code;
    setOauthError(message);
    showAlert('Connexion Google', message!);
    window.history.replaceState({}, '', window.location.pathname);
  }, [showAlert]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Champs requis', 'Veuillez entrer votre email et mot de passe.');
      return;
    }
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) showAlert('Erreur de connexion', error);
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setForgotHint('Entrez votre adresse email ci-dessus, puis réessayez.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setForgotHint('Adresse email invalide.');
      return;
    }
    setForgotHint(null);
    const { error } = await requestPasswordReset(trimmed);
    if (error) { showAlert('Erreur', error); return; }
    showAlert(
      'Email envoyé',
      `Si un compte existe pour ${trimmed}, un lien de réinitialisation vient d’être envoyé. Cliquez dessus, puis rendez-vous dans Profil pour choisir un nouveau mot de passe.`
    );
  };

  const handleRegisterSendOTP = async () => {
    if (!email.trim()) { showAlert('Email requis', 'Veuillez entrer votre adresse email.'); return; }
    if (!password.trim() || password.length < 6) { showAlert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirmPassword) { showAlert('Mots de passe différents', 'Les mots de passe ne correspondent pas.'); return; }
    const { error } = await sendOTP(email.trim());
    if (error) { showAlert('Erreur', error); return; }
    setStep('otp');
    showAlert('Code envoyé', `Un code de vérification a été envoyé à ${email.trim()}`);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) { showAlert('Code requis', 'Veuillez entrer le code de vérification.'); return; }
    const { error } = await verifyOTPAndLogin(email.trim(), otp.trim(), { password });
    if (error) showAlert('Code invalide', error);
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) showAlert('Erreur Google', error);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, flexGrow: 1, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.accentGlow, borderWidth: 2, borderColor: C.accent + '44', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="psychology" size={40} color={C.accent} />
            </View>
            <Text style={{ fontSize: FontSize.xxl, color: C.textPrimary, fontWeight: '800', letterSpacing: -0.5 }}>LLM Builder</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center' }}>Construisez votre assistant IA personnalisé</Text>
          </View>

          {oauthError ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.error, padding: Spacing.md }}>
              <MaterialIcons name="error-outline" size={20} color={C.error} />
              <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, lineHeight: 18 }}>
                {oauthError.includes('redirect') || oauthError.includes('not allowed') || oauthError.includes('URL')
                  ? `Adresse de retour Google non autorisée. Vérifiez les Redirect URLs Supabase (ex. …/123Promptez). Détail : ${oauthError}`
                  : `Connexion Google refusée : ${oauthError}`}
              </Text>
            </View>
          ) : null}

          {/* Mode tabs */}
          {step === 'form' ? (
            <View style={{ flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: 4 }}>
              {(['login', 'register'] as AuthMode[]).map(m => (
                <Pressable key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm, backgroundColor: mode === m ? C.primary : 'transparent' }}>
                  <Text style={{ fontSize: FontSize.body, color: mode === m ? '#fff' : C.textMuted, fontWeight: '600' }}>
                    {m === 'login' ? 'Connexion' : 'Inscription'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* OTP step */}
          {step === 'otp' ? (
            <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md }}>
              <View style={{ alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.accentGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.accent + '44' }}>
                  <MaterialIcons name="mark-email-read" size={32} color={C.accent} />
                </View>
                <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Vérification email</Text>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                  Un code à 6 chiffres a été envoyé à{'\n'}
                  <Text style={{ color: C.accent, fontWeight: '600' }}>{email}</Text>
                </Text>
              </View>
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Code de vérification</Text>
                <TextInput
                  style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.accent, fontSize: 28, fontWeight: '800', letterSpacing: 6, textAlign: 'center', minHeight: 70, paddingHorizontal: Spacing.md }}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="000000"
                  placeholderTextColor={C.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>
              <Pressable
                onPress={handleVerifyOTP}
                disabled={operationLoading}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md + 2 }, pressed && { opacity: 0.85 }]}
              >
                {operationLoading ? <ActivityIndicator size="small" color={C.bg} /> : (
                  <>
                    <MaterialIcons name="verified" size={18} color={C.bg} />
                    <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Vérifier et créer le compte</Text>
                  </>
                )}
              </Pressable>
              <Pressable onPress={() => setStep('form')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center' }}>
                <MaterialIcons name="arrow-back" size={15} color={C.textMuted} />
                <Text style={{ fontSize: FontSize.sm, color: C.textMuted }}>Modifier l’email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md }}>
              {/* Email */}
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Adresse email</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, minHeight: 50 }}>
                  <MaterialIcons name="email" size={18} color={C.textMuted} style={{ marginLeft: Spacing.md }} />
                  <TextInput
                    style={{ flex: 1, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm }}
                    value={email}
                    onChangeText={(v) => { setEmail(v); if (forgotHint) setForgotHint(null); }}
                    placeholder="votre@email.com"
                    placeholderTextColor={C.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
                {forgotHint ? (
                  <Text style={{ fontSize: FontSize.xs, color: C.error, marginTop: 2 }}>{forgotHint}</Text>
                ) : null}
              </View>

              {/* Password */}
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Mot de passe</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, minHeight: 50 }}>
                  <MaterialIcons name="lock" size={18} color={C.textMuted} style={{ marginLeft: Spacing.md }} />
                  <TextInput
                    style={{ flex: 1, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm }}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min. 6 caractères"
                    placeholderTextColor={C.textMuted}
                    secureTextEntry={!showPassword}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8} style={{ padding: Spacing.md }}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={18} color={C.textMuted} />
                  </Pressable>
                </View>
                {mode === 'login' ? (
                  <Pressable onPress={handleForgotPassword} hitSlop={8} disabled={operationLoading} style={{ alignSelf: 'flex-end' }}>
                    <Text style={{ fontSize: FontSize.sm, color: C.accent, fontWeight: '600' }}>Mot de passe oublié ?</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Confirm password */}
              {mode === 'register' ? (
                <View style={{ gap: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Confirmer le mot de passe</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, minHeight: 50 }}>
                    <MaterialIcons name="lock-outline" size={18} color={C.textMuted} style={{ marginLeft: Spacing.md }} />
                    <TextInput
                      style={{ flex: 1, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm }}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Répétez votre mot de passe"
                      placeholderTextColor={C.textMuted}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                </View>
              ) : null}

              {/* Main action */}
              <Pressable
                onPress={mode === 'login' ? handleLogin : handleRegisterSendOTP}
                disabled={operationLoading}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md + 2 }, pressed && { opacity: 0.85 }]}
              >
                {operationLoading ? <ActivityIndicator size="small" color={C.bg} /> : mode === 'login' ? (
                  <>
                    <MaterialIcons name="login" size={18} color={C.bg} />
                    <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Se connecter</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color={C.bg} />
                    <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Envoyer le code de vérification</Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>ou</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              </View>

              <Pressable
                onPress={() => void handleGoogle()}
                disabled={operationLoading}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: C.border, opacity: operationLoading ? 0.6 : 1 }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#4285F4' }}>G</Text>
                </View>
                <Text style={{ fontSize: FontSize.body, color: C.textSecondary, fontWeight: '600' }}>Continuer avec Google</Text>
              </Pressable>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, textAlign: 'center', lineHeight: 16 }}>
                Connexion OAuth — aucun numéro de téléphone ni 2FA Google n’est requis.
              </Text>

              {mode === 'register' ? (
                <View style={{ flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start', backgroundColor: C.primary + '15', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: C.primary + '33' }}>
                  <MaterialIcons name="info-outline" size={13} color={C.primary} />
                  <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, flex: 1, lineHeight: 17 }}>
                    Un code de vérification sera envoyé sur votre email pour confirmer votre compte
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Features preview */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
            {[
              { icon: 'cloud-done', label: 'Sauvegarde cloud' },
              { icon: 'workspaces', label: 'Multi-workspaces' },
              { icon: 'psychology', label: 'IA personnalisée' },
            ].map(f => (
              <View key={f.label} style={{ alignItems: 'center', gap: Spacing.xs }}>
                <MaterialIcons name={f.icon as any} size={20} color={C.accent} />
                <Text style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', maxWidth: 72 }}>{f.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
