// Powered by OnSpace.AI
// Profile screen — inline styles with C from useThemeColors(), language selector removed (moved to Settings)
import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { ThemedInput, IconButton } from '@/components';
import { useAppData } from '@/contexts/AppDataContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const C = useThemeColors();
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const { user, logout, updatePassword } = useAuth();
  const { showAlert } = useAlert();
  const { triggerSync, isSyncing, lastSyncAt } = useAppData();

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleProfileChange = (updates: Partial<typeof profile>) => {
    updateProfile(updates);
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => { triggerSync('profile', { ...profile, ...updates }); }, 1500);
  };

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: FontSize.xl, color: C.textPrimary, fontWeight: FontWeight.bold }}>Profil</Text>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>Identité et compte</Text>
        </View>

        {!user ? (
          /* Not logged in — CTA to login */
          <Pressable
            onPress={() => router.push('/login' as any)}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.primary + '15', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '33' }, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="cloud-off" size={16} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '600', marginBottom: 3 }}>Données locales uniquement</Text>
              <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 17 }}>Connectez-vous pour sauvegarder vos workspaces, conversations et configuration sur le cloud, et les retrouver sur tous vos appareils.</Text>
            </View>
            <MaterialIcons name="chevron-right" size={16} color={C.primary} />
          </Pressable>
        ) : null}

        {/* Avatar + Name */}
        <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: FontSize.lg, color: '#fff', fontWeight: '700' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: Spacing.sm }}>
            <View style={{ gap: Spacing.xs }}>
              <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nom complet</Text>
              <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={profile.name} onChangeText={v => handleProfileChange({ name: v })} placeholder="Votre nom..." placeholderTextColor={C.textMuted} />
            </View>
          </View>
        </View>

        {/* Identity */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Identité</Text>
          <View style={{ gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Rôle / Métier</Text>
            <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={profile.role} onChangeText={v => handleProfileChange({ role: v })} placeholder="Développeur, Designer..." placeholderTextColor={C.textMuted} />
          </View>
          <View style={{ gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Biographie</Text>
            <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.sm }} value={profile.bio} onChangeText={v => handleProfileChange({ bio: v })} placeholder="Décrivez-vous en quelques lignes..." placeholderTextColor={C.textMuted} multiline textAlignVertical="top" />
          </View>
        </View>


        {/* Compte (ex-Réglages ▸ Compte) */}
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
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.sm }}>
              <MaterialIcons name={isSyncing ? 'sync' : 'cloud-done'} size={15} color={isSyncing ? C.warning : C.accent} />
              <Text style={{ fontSize: FontSize.xs, color: isSyncing ? C.warning : C.textMuted, flex: 1 }}>
                {isSyncing ? 'Synchronisation en cours...' : lastSyncAt ? `Synchronisé à ${lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Données sauvegardées sur le cloud'}
              </Text>
            </View>
            <View style={{ gap: Spacing.xs }}>
              <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Nouveau mot de passe</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, minHeight: 50 }}>
                <ThemedInput value={newPassword} onChangeText={setNewPassword} placeholder="Min. 6 caractères" secureTextEntry={!showNewPassword} autoComplete="new-password" style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent' }} />
                <IconButton icon={showNewPassword ? 'visibility-off' : 'visibility'} label={showNewPassword ? 'Masquer' : 'Afficher'} bare onPress={() => setShowNewPassword(v => !v)} />
              </View>
              <ThemedInput value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Confirmer le mot de passe" secureTextEntry={!showNewPassword} autoComplete="new-password" />
              <Pressable
                onPress={async () => {
                  if (newPassword.length < 6) { showAlert('Mot de passe trop court', 'Au moins 6 caractères.'); return; }
                  if (newPassword !== confirmNewPassword) { showAlert('Mots de passe différents', 'Les deux mots de passe ne correspondent pas.'); return; }
                  setChangingPassword(true);
                  const { error } = await updatePassword(newPassword);
                  setChangingPassword(false);
                  if (error) { showAlert('Erreur', error); return; }
                  setNewPassword(''); setConfirmNewPassword('');
                  showAlert('Mot de passe modifié', 'Votre mot de passe a été mis à jour.');
                }}
                disabled={changingPassword || !newPassword || !confirmNewPassword}
                style={({ pressed }) => [{ alignItems: 'center', backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: (!newPassword || !confirmNewPassword) ? 0.5 : pressed ? 0.85 : 1 }]}
              >
                <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>{changingPassword ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => showAlert('Se déconnecter ?', 'Vos données sont sauvegardées sur le cloud.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Déconnexion', style: 'destructive', onPress: () => logout() }])}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.error + '15', borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, borderWidth: 1, borderColor: C.error + '33' }, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="logout" size={16} color={C.error} />
              <Text style={{ fontSize: FontSize.sm, color: C.error, fontWeight: '700' }}>Déconnexion</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Status */}
        {(profile.name || profile.bio) ? (
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.accentGlow, borderRadius: Radius.md, borderWidth: 1, borderColor: C.accent + '33', padding: Spacing.md }}>
            <MaterialIcons name="check-circle" size={16} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: C.accent, fontWeight: '600', marginBottom: 3 }}>Profil configuré</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 18 }}>L’IA connaît votre nom et votre rôle. Gérez la mémoire IA dans Paramètres ▸ Agents.</Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.warning + '10', borderRadius: Radius.md, borderWidth: 1, borderColor: C.warning + '33', padding: Spacing.md }}>
            <MaterialIcons name="person-outline" size={16} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: C.warning, fontWeight: '600', marginBottom: 3 }}>Profil incomplet</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 18 }}>Complétez votre profil pour que l’IA personnalise ses réponses</Text>
            </View>
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
