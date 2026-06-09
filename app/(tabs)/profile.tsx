// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useProfile, type AiMemoryItem } from '@/contexts/ProfileContext';
import { useAuth, useAlert } from '@/template';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';
import { useAppData } from '@/contexts/AppDataContext';
import { useEffect, useRef } from 'react';

const MEMORY_CATEGORIES: { id: AiMemoryItem['category']; label: string; icon: string; color: string; desc: string }[] = [
  { id: 'preference', label: 'Préférence', icon: 'tune', color: '#3D7EFF', desc: 'Style, ton, format préféré' },
  { id: 'fact', label: 'Fait', icon: 'info', color: '#00CC6A', desc: 'Information sur vous' },
  { id: 'goal', label: 'Objectif', icon: 'flag', color: '#FFB800', desc: 'Vos buts et ambitions' },
  { id: 'context', label: 'Contexte', icon: 'work', color: '#FF6B35', desc: 'Contexte professionnel' },
  { id: 'constraint', label: 'Contrainte', icon: 'block', color: '#FF4455', desc: 'Limites à respecter' },
];

const LANGUAGES = ['Français', 'English', 'Español', 'Deutsch', 'Italiano', 'Português'];

function getCategoryInfo(cat: AiMemoryItem['category']) {
  return MEMORY_CATEGORIES.find(c => c.id === cat) ?? MEMORY_CATEGORIES[0];
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const C = useThemeColors();
  const { profile, updateProfile, addMemory, updateMemory, removeMemory } = useProfile();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { triggerSync, isSyncing, lastSyncAt } = useAppData();

  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [memContent, setMemContent] = useState('');
  const [memCategory, setMemCategory] = useState<AiMemoryItem['category']>('preference');
  const [editMemContent, setEditMemContent] = useState('');

  // Auto-sync profile changes
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleProfileChange = (updates: Partial<typeof profile>) => {
    updateProfile(updates);
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      triggerSync('profile', { ...profile, ...updates });
    }, 1500);
  };

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const handleAddMemory = () => {
    if (!memContent.trim()) return;
    addMemory({ content: memContent.trim(), category: memCategory });
    setMemContent('');
    setMemCategory('preference');
    setShowAddMemory(false);
    triggerSync('profile', { ...profile, aiMemory: [...profile.aiMemory, { content: memContent.trim(), category: memCategory }] });
  };

  const handleDeleteMemory = (item: AiMemoryItem) => {
    showAlert('Supprimer ce souvenir ?', `"${item.content.slice(0, 60)}${item.content.length > 60 ? '...' : ''}"`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { removeMemory(item.id); triggerSync('profile', { ...profile, aiMemory: profile.aiMemory.filter(m => m.id !== item.id) }); } },
    ]);
  };

  const startEditMemory = (item: AiMemoryItem) => { setEditingMemId(item.id); setEditMemContent(item.content); };
  const confirmEditMemory = (id: string) => {
    if (editMemContent.trim()) { updateMemory(id, editMemContent.trim()); }
    setEditingMemId(null); setEditMemContent('');
  };

  const memoriesByCategory = MEMORY_CATEGORIES.map(cat => ({
    ...cat,
    items: profile.aiMemory.filter(m => m.category === cat.id),
  })).filter(g => g.items.length > 0);

  const handleLogout = () => {
    showAlert('Se déconnecter ?', 'Vos données sont sauvegardées sur le cloud.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: FontSize.xl, color: C.textPrimary, fontWeight: FontWeight.bold }}>Profil</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>Données personnelles et mémoire IA</Text>
          </View>
          {user ? (
            <Pressable onPress={handleLogout} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.error + '15', paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.error + '33' }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="logout" size={14} color={C.error} />
              <Text style={{ fontSize: FontSize.xs, color: C.error, fontWeight: '600' }}>Déconnexion</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Account card */}
        {user ? (
          <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Compte</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: FontSize.lg, color: '#fff', fontWeight: '700' }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }}>{profile.name || 'Compte'}</Text>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>{user.email}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent }} />
                  <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '600' }}>Compte vérifié</Text>
                </View>
              </View>
            </View>
            {/* Sync status */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.sm }}>
              <MaterialIcons name={isSyncing ? 'sync' : 'cloud-done'} size={15} color={isSyncing ? C.warning : C.accent} />
              <Text style={{ fontSize: FontSize.xs, color: isSyncing ? C.warning : C.textMuted, flex: 1 }}>
                {isSyncing ? 'Synchronisation en cours...' : lastSyncAt ? `Synchronisé à ${lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Données sauvegardées sur le cloud'}
              </Text>
            </View>
          </View>
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
            <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44 }} value={profile.role} onChangeText={v => handleProfileChange({ role: v })} placeholder="Développeur, Designer, Entrepreneur..." placeholderTextColor={C.textMuted} />
          </View>
          <View style={{ gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Biographie</Text>
            <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.sm }} value={profile.bio} onChangeText={v => handleProfileChange({ bio: v })} placeholder="Décrivez-vous en quelques lignes..." placeholderTextColor={C.textMuted} multiline textAlignVertical="top" />
          </View>
          <View style={{ gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Langue préférée</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                {LANGUAGES.map(lang => (
                  <Pressable key={lang} onPress={() => handleProfileChange({ language: lang })} style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill, borderWidth: 1, borderColor: profile.language === lang ? C.primaryLight : C.border, backgroundColor: profile.language === lang ? C.primary : C.bgCardAlt }}>
                    <Text style={{ fontSize: FontSize.sm, color: profile.language === lang ? '#fff' : C.textSecondary, fontWeight: '600' }}>{lang}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* AI Memory */}
        <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Mémoire IA</Text>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 3 }}>Ce que l'IA retient de vous pour personnaliser ses réponses</Text>
            </View>
            <Pressable onPress={() => setShowAddMemory(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accent, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, borderRadius: Radius.pill }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="add" size={16} color={C.bg} />
              <Text style={{ fontSize: FontSize.sm, color: C.bg, fontWeight: '700' }}>Ajouter</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start', backgroundColor: C.accentGlow, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: C.accent + '33' }}>
            <MaterialIcons name="info-outline" size={14} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, flex: 1, lineHeight: 17 }}>Ces informations sont injectées dans chaque conversation pour que l'IA vous comprenne et s'adapte.</Text>
          </View>
          {profile.aiMemory.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
              <MaterialIcons name="psychology" size={32} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.body, color: C.textSecondary }}>Aucun souvenir</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textMuted }}>Ajoutez ce que l'IA doit retenir de vous</Text>
            </View>
          ) : null}
          {memoriesByCategory.map(group => (
            <View key={group.id} style={{ gap: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <View style={{ width: 22, height: 22, borderRadius: 4, backgroundColor: group.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={group.icon as any} size={13} color={group.color} />
                </View>
                <Text style={{ fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: group.color, flex: 1 }}>{group.label}</Text>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted, backgroundColor: C.bgCardAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill }}>{group.items.length}</Text>
              </View>
              {group.items.map(item => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3, borderLeftColor: group.color + '66', padding: Spacing.sm + 2 }}>
                  {editingMemId === item.id ? (
                    <TextInput style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.primary, color: C.textPrimary, fontSize: FontSize.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs }} value={editMemContent} onChangeText={setEditMemContent} onBlur={() => confirmEditMemory(item.id)} onSubmitEditing={() => confirmEditMemory(item.id)} autoFocus multiline />
                  ) : (
                    <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, lineHeight: 19 }} onPress={() => startEditMemory(item)}>{item.content}</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    <Pressable onPress={() => startEditMemory(item)} hitSlop={8} style={{ padding: Spacing.xs }}>
                      <MaterialIcons name="edit" size={14} color={C.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => handleDeleteMemory(item)} hitSlop={8} style={{ padding: Spacing.xs }}>
                      <MaterialIcons name="delete-outline" size={14} color={C.textMuted} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Status card */}
        {(profile.name || profile.bio) ? (
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.accentGlow, borderRadius: Radius.md, borderWidth: 1, borderColor: C.accent + '33', padding: Spacing.md }}>
            <MaterialIcons name="check-circle" size={16} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: C.accent, fontWeight: '600', marginBottom: 3 }}>Profil configuré</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 18 }}>L'IA connaît votre nom, rôle et {profile.aiMemory.length} information{profile.aiMemory.length !== 1 ? 's' : ''} personnalisée{profile.aiMemory.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', backgroundColor: C.warning + '10', borderRadius: Radius.md, borderWidth: 1, borderColor: C.warning + '33', padding: Spacing.md }}>
            <MaterialIcons name="person-outline" size={16} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.sm, color: C.warning, fontWeight: '600', marginBottom: 3 }}>Profil incomplet</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 18 }}>Complétez votre profil pour que l'IA personnalise ses réponses</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Memory Modal */}
      <Modal visible={showAddMemory} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, gap: Spacing.md, paddingBottom: insets.bottom + Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: FontSize.md, color: C.textPrimary, fontWeight: '700' }}>Nouveau souvenir IA</Text>
              <Pressable onPress={() => setShowAddMemory(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <View style={{ gap: Spacing.md }}>
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Catégorie</Text>
                {MEMORY_CATEGORIES.map(cat => (
                  <Pressable key={cat.id} onPress={() => setMemCategory(cat.id)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: memCategory === cat.id ? cat.color + '66' : C.border, backgroundColor: memCategory === cat.id ? cat.color + '10' : C.bgCardAlt, padding: Spacing.sm + 2, marginBottom: Spacing.xs }, pressed && { opacity: 0.75 }]}>
                    <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: cat.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={cat.icon as any} size={16} color={cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.sm, color: memCategory === cat.id ? cat.color : C.textPrimary, fontWeight: '600' }}>{cat.label}</Text>
                      <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }}>{cat.desc}</Text>
                    </View>
                    {memCategory === cat.id ? <MaterialIcons name="check-circle" size={18} color={cat.color} /> : null}
                  </Pressable>
                ))}
              </View>
              <View style={{ gap: Spacing.xs }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Contenu</Text>
                <TextInput style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, color: C.textPrimary, fontSize: FontSize.body, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.sm }} value={memContent} onChangeText={setMemContent} placeholder={memCategory === 'preference' ? "Ex: Je préfère des réponses courtes et en bullet points" : memCategory === 'fact' ? "Ex: Je suis développeur mobile avec 5 ans d'expérience" : "Ex: Je souhaite lancer mon produit SaaS d'ici 6 mois"} placeholderTextColor={C.textMuted} multiline textAlignVertical="top" autoFocus />
              </View>
            </View>
            <Pressable onPress={handleAddMemory} disabled={!memContent.trim()} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, opacity: !memContent.trim() ? 0.4 : 1 }, pressed && { opacity: 0.8 }]}>
              <MaterialIcons name="psychology" size={18} color={C.bg} />
              <Text style={{ fontSize: FontSize.body, color: C.bg, fontWeight: '700' }}>Enregistrer le souvenir</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
