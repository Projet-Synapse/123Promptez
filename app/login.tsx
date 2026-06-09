// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';

type Step = 'form' | 'otp';
type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, signUpWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Champs requis', 'Veuillez entrer votre email et mot de passe.');
      return;
    }
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) {
      showAlert('Erreur de connexion', error);
    }
  };

  const handleRegisterSendOTP = async () => {
    if (!email.trim()) {
      showAlert('Email requis', 'Veuillez entrer votre adresse email.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      showAlert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Mots de passe différents', 'Les mots de passe ne correspondent pas.');
      return;
    }
    const { error } = await sendOTP(email.trim());
    if (error) {
      showAlert('Erreur', error);
      return;
    }
    setStep('otp');
    showAlert('Code envoyé', `Un code de vérification a été envoyé à ${email.trim()}`);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showAlert('Code requis', 'Veuillez entrer le code de vérification.');
      return;
    }
    const { error } = await verifyOTPAndLogin(email.trim(), otp.trim(), { password });
    if (error) {
      showAlert('Code invalide', error);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo area */}
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <MaterialIcons name="psychology" size={40} color={Colors.accent} />
            </View>
            <Text style={styles.appName}>LLM Builder</Text>
            <Text style={styles.appTagline}>Construisez votre assistant IA personnalisé</Text>
          </View>

          {/* Mode tabs */}
          {step === 'form' ? (
            <View style={styles.modeTabs}>
              <Pressable
                onPress={() => setMode('login')}
                style={[styles.modeTab, mode === 'login' ? styles.modeTabActive : null]}
              >
                <Text style={[styles.modeTabText, mode === 'login' ? styles.modeTabTextActive : null]}>
                  Connexion
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('register')}
                style={[styles.modeTab, mode === 'register' ? styles.modeTabActive : null]}
              >
                <Text style={[styles.modeTabText, mode === 'register' ? styles.modeTabTextActive : null]}>
                  Inscription
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* OTP step */}
          {step === 'otp' ? (
            <View style={styles.card}>
              <View style={styles.otpHeader}>
                <View style={styles.otpIconWrap}>
                  <MaterialIcons name="mark-email-read" size={32} color={Colors.accent} />
                </View>
                <Text style={styles.otpTitle}>Vérification email</Text>
                <Text style={styles.otpSub}>
                  Un code à 4 chiffres a été envoyé à{'\n'}
                  <Text style={styles.otpEmail}>{email}</Text>
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Code de vérification</Text>
                <TextInput
                  style={[styles.textInput, styles.otpInput]}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="0000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                />
              </View>

              <Pressable
                onPress={handleVerifyOTP}
                disabled={operationLoading}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              >
                {operationLoading ? (
                  <ActivityIndicator size="small" color={Colors.bg} />
                ) : (
                  <>
                    <MaterialIcons name="verified" size={18} color={Colors.bg} />
                    <Text style={styles.primaryBtnText}>Vérifier et créer le compte</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => setStep('form')} style={styles.backLink}>
                <MaterialIcons name="arrow-back" size={15} color={Colors.textMuted} />
                <Text style={styles.backLinkText}>Modifier l'email</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Adresse email</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="email" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInputIcon}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="votre@email.com"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Mot de passe</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInputIcon}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min. 6 caractères"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                    <MaterialIcons
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={18}
                      color={Colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Confirm password (register only) */}
              {mode === 'register' ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Confirmer le mot de passe</Text>
                  <View style={styles.inputWrap}>
                    <MaterialIcons name="lock-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInputIcon}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Répétez votre mot de passe"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                </View>
              ) : null}

              {/* Action button */}
              <Pressable
                onPress={mode === 'login' ? handleLogin : handleRegisterSendOTP}
                disabled={operationLoading}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              >
                {operationLoading ? (
                  <ActivityIndicator size="small" color={Colors.bg} />
                ) : mode === 'login' ? (
                  <>
                    <MaterialIcons name="login" size={18} color={Colors.bg} />
                    <Text style={styles.primaryBtnText}>Se connecter</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color={Colors.bg} />
                    <Text style={styles.primaryBtnText}>Envoyer le code de vérification</Text>
                  </>
                )}
              </Pressable>

              {mode === 'register' ? (
                <View style={styles.emailVerifyNote}>
                  <MaterialIcons name="info-outline" size={13} color={Colors.primary} />
                  <Text style={styles.emailVerifyText}>
                    Un code de vérification sera envoyé sur votre email pour confirmer votre compte
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Features preview */}
          <View style={styles.featuresRow}>
            {[
              { icon: 'cloud-done', label: 'Sauvegarde cloud' },
              { icon: 'workspaces', label: 'Multi-workspaces' },
              { icon: 'psychology', label: 'IA personnalisée' },
            ].map(f => (
              <View key={f.label} style={styles.featureItem}>
                <MaterialIcons name={f.icon as any} size={20} color={Colors.accent} />
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, gap: Spacing.lg, flexGrow: 1 },
  logoArea: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.accentGlow, borderWidth: 2, borderColor: Colors.accent + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  appName: { fontSize: FontSize.xxl, color: Colors.textPrimary, fontWeight: '800', letterSpacing: -0.5 },
  appTagline: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  modeTabs: {
    flexDirection: 'row', backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 4,
  },
  modeTab: {
    flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm,
  },
  modeTabActive: { backgroundColor: Colors.primary },
  modeTabText: { fontSize: FontSize.body, color: Colors.textMuted, fontWeight: '600' },
  modeTabTextActive: { color: '#fff' },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md,
  },
  field: { gap: Spacing.xs },
  fieldLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, minHeight: 50,
  },
  inputIcon: { marginLeft: Spacing.md },
  textInputIcon: {
    flex: 1, color: Colors.textPrimary, fontSize: FontSize.body,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
  },
  eyeBtn: { padding: Spacing.md },
  textInput: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.body,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 50,
  },
  otpInput: {
    textAlign: 'center', fontSize: 32, fontWeight: '800', letterSpacing: 12,
    minHeight: 70, color: Colors.accent,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2,
  },
  primaryBtnText: { fontSize: FontSize.body, color: Colors.bg, fontWeight: '700' },
  emailVerifyNote: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start',
    backgroundColor: Colors.primary + '15', borderRadius: Radius.sm, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.primary + '33',
  },
  emailVerifyText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center' },
  backLinkText: { fontSize: FontSize.sm, color: Colors.textMuted },
  otpHeader: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  otpIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.accentGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.accent + '44',
  },
  otpTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  otpSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  otpEmail: { color: Colors.accent, fontWeight: '600' },
  featuresRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  featureItem: { alignItems: 'center', gap: Spacing.xs },
  featureLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', maxWidth: 72 },
});
