// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useProfile, type AiMemoryItem } from '@/contexts/ProfileContext';
import { useAlert } from '@/template';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

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
  const { profile, updateProfile, addMemory, updateMemory, removeMemory } = useProfile();
  const { showAlert } = useAlert();

  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [memContent, setMemContent] = useState('');
  const [memCategory, setMemCategory] = useState<AiMemoryItem['category']>('preference');
  const [editMemContent, setEditMemContent] = useState('');

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleAddMemory = () => {
    if (!memContent.trim()) return;
    addMemory({ content: memContent.trim(), category: memCategory });
    setMemContent('');
    setMemCategory('preference');
    setShowAddMemory(false);
  };

  const handleDeleteMemory = (item: AiMemoryItem) => {
    showAlert(
      'Supprimer ce souvenir ?',
      `"${item.content.slice(0, 60)}..."`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => removeMemory(item.id) },
      ]
    );
  };

  const startEditMemory = (item: AiMemoryItem) => {
    setEditingMemId(item.id);
    setEditMemContent(item.content);
  };

  const confirmEditMemory = (id: string) => {
    if (editMemContent.trim()) {
      updateMemory(id, editMemContent.trim());
    }
    setEditingMemId(null);
    setEditMemContent('');
  };

  const memoriesByCategory = MEMORY_CATEGORIES.map(cat => ({
    ...cat,
    items: profile.aiMemory.filter(m => m.category === cat.id),
  })).filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Profil</Text>
          <Text style={styles.screenSub}>Vos données personnelles et mémoire IA</Text>
        </View>

        {/* Avatar + Name */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, gap: Spacing.sm }}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nom complet</Text>
              <TextInput
                style={styles.textInput}
                value={profile.name}
                onChangeText={v => updateProfile({ name: v })}
                placeholder="Votre nom..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                value={profile.email}
                onChangeText={v => updateProfile({ email: v })}
                placeholder="votre@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialIcons name="person" size={13} color={Colors.primary} /> Identité
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Rôle / Métier</Text>
            <TextInput
              style={styles.textInput}
              value={profile.role}
              onChangeText={v => updateProfile({ role: v })}
              placeholder="Développeur, Designer, Entrepreneur..."
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Biographie</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={profile.bio}
              onChangeText={v => updateProfile({ bio: v })}
              placeholder="Décrivez-vous en quelques lignes pour que l'IA vous connaisse mieux..."
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Langue préférée</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.langRow}>
                {LANGUAGES.map(lang => (
                  <Pressable
                    key={lang}
                    onPress={() => updateProfile({ language: lang })}
                    style={[
                      styles.langChip,
                      profile.language === lang ? styles.langChipActive : null,
                    ]}
                  >
                    <Text style={[styles.langChipText, profile.language === lang ? styles.langChipTextActive : null]}>
                      {lang}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* AI Memory */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>
                <MaterialIcons name="psychology" size={13} color={Colors.accent} /> Mémoire IA
              </Text>
              <Text style={styles.sectionSubtitle}>
                Ce que l'IA retient de vous pour personnaliser ses réponses
              </Text>
            </View>
            <Pressable
              onPress={() => setShowAddMemory(true)}
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Ajouter</Text>
            </Pressable>
          </View>

          {/* Memory info banner */}
          <View style={styles.memoryBanner}>
            <MaterialIcons name="info-outline" size={14} color={Colors.accent} />
            <Text style={styles.memoryBannerText}>
              Ces informations sont injectées dans chaque conversation pour que l'IA vous comprenne et s'adapte à vos besoins spécifiques.
            </Text>
          </View>

          {profile.aiMemory.length === 0 ? (
            <View style={styles.emptyMemory}>
              <MaterialIcons name="psychology" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyMemoryText}>Aucun souvenir</Text>
              <Text style={styles.emptyMemorySub}>Ajoutez ce que l'IA doit retenir de vous</Text>
            </View>
          ) : null}

          {memoriesByCategory.map(group => (
            <View key={group.id} style={styles.memGroup}>
              <View style={styles.memGroupHeader}>
                <View style={[styles.memGroupIcon, { backgroundColor: group.color + '22' }]}>
                  <MaterialIcons name={group.icon as any} size={13} color={group.color} />
                </View>
                <Text style={[styles.memGroupLabel, { color: group.color }]}>{group.label}</Text>
                <Text style={styles.memGroupCount}>{group.items.length}</Text>
              </View>
              {group.items.map(item => (
                <View
                  key={item.id}
                  style={[styles.memItem, { borderLeftColor: group.color + '66' }]}
                >
                  {editingMemId === item.id ? (
                    <TextInput
                      style={[styles.textInput, { flex: 1, paddingVertical: Spacing.xs }]}
                      value={editMemContent}
                      onChangeText={setEditMemContent}
                      onBlur={() => confirmEditMemory(item.id)}
                      onSubmitEditing={() => confirmEditMemory(item.id)}
                      autoFocus
                      multiline
                    />
                  ) : (
                    <Text style={styles.memContent} onPress={() => startEditMemory(item)}>{item.content}</Text>
                  )}
                  <View style={styles.memItemActions}>
                    <Pressable onPress={() => startEditMemory(item)} hitSlop={8} style={styles.iconBtn}>
                      <MaterialIcons name="edit" size={14} color={Colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => handleDeleteMemory(item)} hitSlop={8} style={styles.iconBtn}>
                      <MaterialIcons name="delete-outline" size={14} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Stats */}
        {(profile.name || profile.email || profile.bio) ? (
          <View style={styles.statsCard}>
            <MaterialIcons name="check-circle" size={16} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statsTitle}>Profil configuré</Text>
              <Text style={styles.statsText}>
                L'IA connaît votre nom, rôle et {profile.aiMemory.length} information{profile.aiMemory.length !== 1 ? 's' : ''} personnalisée{profile.aiMemory.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.incompleteCard}>
            <MaterialIcons name="person-outline" size={16} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.incompleteTitle}>Profil incomplet</Text>
              <Text style={styles.incompleteText}>Complétez votre profil pour que l'IA puisse vous personnaliser ses réponses</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Memory Modal */}
      <Modal visible={showAddMemory} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau souvenir IA</Text>
              <Pressable onPress={() => setShowAddMemory(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={{ gap: Spacing.md }}>
              {/* Category */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Catégorie</Text>
                {MEMORY_CATEGORIES.map(cat => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setMemCategory(cat.id)}
                    style={({ pressed }) => [
                      styles.catRow,
                      memCategory === cat.id ? { borderColor: cat.color + '66', backgroundColor: cat.color + '10' } : null,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '22' }]}>
                      <MaterialIcons name={cat.icon as any} size={16} color={cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catLabel, memCategory === cat.id ? { color: cat.color } : null]}>{cat.label}</Text>
                      <Text style={styles.catDesc}>{cat.desc}</Text>
                    </View>
                    {memCategory === cat.id ? (
                      <MaterialIcons name="check-circle" size={18} color={cat.color} />
                    ) : null}
                  </Pressable>
                ))}
              </View>

              {/* Content */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Contenu</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={memContent}
                  onChangeText={setMemContent}
                  placeholder={
                    memCategory === 'preference' ? "Ex: Je préfère des réponses courtes et en bullet points" :
                    memCategory === 'fact' ? "Ex: Je suis développeur mobile avec 5 ans d'expérience" :
                    memCategory === 'goal' ? "Ex: Je souhaite lancer mon produit SaaS d'ici 6 mois" :
                    memCategory === 'context' ? "Ex: Je travaille dans une startup fintech de 10 personnes" :
                    "Ex: Ne jamais suggérer de solutions propriétaires"
                  }
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
              </View>
            </View>

            <Pressable
              onPress={handleAddMemory}
              disabled={!memContent.trim()}
              style={({ pressed }) => [
                styles.primaryBtn,
                !memContent.trim() ? styles.primaryBtnDisabled : null,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name="psychology" size={18} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>Enregistrer le souvenir</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, gap: Spacing.lg },
  header: { gap: 2 },
  screenTitle: { fontSize: FontSize.xl, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  screenSub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  avatarCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.lg, color: '#fff', fontWeight: '700' },

  section: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionLabel: {
    fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  sectionSubtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3 },

  field: { gap: Spacing.xs },
  fieldLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.body,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, minHeight: 44,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: Spacing.sm },

  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primaryLight },
  langChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  langChipTextActive: { color: '#fff' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  addBtnText: { fontSize: FontSize.sm, color: Colors.bg, fontWeight: '700' },

  memoryBanner: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start',
    backgroundColor: Colors.accentGlow, borderRadius: Radius.sm, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.accent + '33',
  },
  memoryBannerText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 17 },

  emptyMemory: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyMemoryText: { fontSize: FontSize.body, color: Colors.textSecondary },
  emptyMemorySub: { fontSize: FontSize.sm, color: Colors.textMuted },

  memGroup: { gap: Spacing.sm },
  memGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memGroupIcon: { width: 22, height: 22, borderRadius: Radius.xs ?? 4, alignItems: 'center', justifyContent: 'center' },
  memGroupLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  memGroupCount: { fontSize: FontSize.xs, color: Colors.textMuted, backgroundColor: Colors.bgCardAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },

  memItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3,
    padding: Spacing.sm + 2,
  },
  memContent: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 19 },
  memItemActions: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: Spacing.xs },

  statsCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.accentGlow, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.accent + '33', padding: Spacing.md,
  },
  statsTitle: { fontSize: FontSize.sm, color: Colors.accent, fontWeight: '600', marginBottom: 3 },
  statsText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  incompleteCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: Colors.warning + '10', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.warning + '33', padding: Spacing.md,
  },
  incompleteTitle: { fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600', marginBottom: 3 },
  incompleteText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '700' },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm + 2,
    marginBottom: Spacing.xs,
  },
  catIcon: { width: 32, height: 32, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  catDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.md,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: FontSize.body, color: Colors.bg, fontWeight: '700' },
});
