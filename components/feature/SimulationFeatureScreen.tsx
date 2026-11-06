/**
 * Écran module gameplay Simulation — CRUD Inventaire / Album / Compétences / Messages.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  SIMULATION_FEATURE_META,
  type SimulationFeatureId,
} from '@/types/simulation';
import type {
  SimulationFeatureContent,
  SimulationInventoryItem,
  SimulationAlbumItem,
  SimulationSkillItem,
  SimulationFeatureMessageItem,
} from '@/types/simulationFeatureContent';
import {
  emptyInventoryItem,
  emptyAlbumItem,
  emptySkillItem,
  emptyFeatureMessageItem,
  emptyContactItem,
} from '@/types/simulationFeatureContent';
import { normalizeMemoryKey } from '@/types/simulationMemory';

const ACCENT = '#9B59B6';

type Props = {
  featureId: SimulationFeatureId;
  content: SimulationFeatureContent;
  onChange: (next: SimulationFeatureContent) => void;
  onClose: () => void;
  /** Personnages mémoire (pour ajouter des contacts) */
  memoryCharacters?: { name: string; key?: string }[];
};

function Field({
  label, value, onChange, multiline, placeholder, C, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  C: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={!!multiline}
        placeholder={placeholder ?? '…'}
        placeholderTextColor={C.textMuted}
        keyboardType={keyboardType}
        style={{
          borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm, paddingVertical: 8,
          color: C.textPrimary, backgroundColor: C.bgCardAlt,
          fontSize: FontSize.sm,
          minHeight: multiline ? 64 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

function CardShell({
  title, subtitle, open, onToggle, onRemove, children, C,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  children: React.ReactNode;
  C: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{
      backgroundColor: C.bgCard, borderWidth: 1,
      borderColor: open ? ACCENT + '66' : C.border,
      borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs,
    }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.body, fontWeight: '700', color: C.textPrimary }} numberOfLines={1}>
            {title}
          </Text>
          {!open && subtitle ? (
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={C.textMuted} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: Spacing.sm }}>
          {children}
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [{
              alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingVertical: 6, paddingHorizontal: 4,
            }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="delete-outline" size={16} color={C.error} />
            <Text style={{ fontSize: FontSize.xs, color: C.error, fontWeight: '700' }}>Supprimer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function SimulationFeatureScreen({ featureId, content, onChange, onClose, memoryCharacters }: Props) {
  const C = useThemeColors();
  const meta = SIMULATION_FEATURE_META[featureId];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const items = useMemo(() => {
    if (featureId === 'inventory') return content.inventory;
    if (featureId === 'album') return content.album;
    if (featureId === 'skills') return content.skills;
    return content.messages;
  }, [featureId, content]);

  const addItem = () => {
    const now = new Date().toISOString();
    if (featureId === 'inventory') {
      const it = emptyInventoryItem({ name: 'Nouvel objet', updatedAt: now });
      onChange({ ...content, inventory: [it, ...content.inventory] });
      setExpandedId(it.id);
    } else if (featureId === 'album') {
      const it = emptyAlbumItem({ title: 'Nouvelle entrée', updatedAt: now });
      onChange({ ...content, album: [it, ...content.album] });
      setExpandedId(it.id);
    } else if (featureId === 'skills') {
      const it = emptySkillItem({ name: 'Nouvelle compétence', updatedAt: now });
      onChange({ ...content, skills: [it, ...content.skills] });
      setExpandedId(it.id);
    } else {
      const it = emptyFeatureMessageItem({ from: 'Expéditeur', content: '', updatedAt: now });
      onChange({ ...content, messages: [it, ...content.messages] });
      setExpandedId(it.id);
    }
  };

  const removeById = (id: string) => {
    if (featureId === 'inventory') {
      onChange({ ...content, inventory: content.inventory.filter((x) => x.id !== id) });
    } else if (featureId === 'album') {
      onChange({ ...content, album: content.album.filter((x) => x.id !== id) });
    } else if (featureId === 'skills') {
      onChange({ ...content, skills: content.skills.filter((x) => x.id !== id) });
    } else {
      onChange({ ...content, messages: content.messages.filter((x) => x.id !== id) });
    }
    if (expandedId === id) setExpandedId(null);
  };

  const patchInventory = (id: string, patch: Partial<SimulationInventoryItem>) => {
    onChange({
      ...content,
      inventory: content.inventory.map((it) =>
        it.id === id
          ? emptyInventoryItem({ ...it, ...patch, id, updatedAt: new Date().toISOString() })
          : it,
      ),
    });
  };
  const patchAlbum = (id: string, patch: Partial<SimulationAlbumItem>) => {
    onChange({
      ...content,
      album: content.album.map((it) =>
        it.id === id
          ? emptyAlbumItem({ ...it, ...patch, id, updatedAt: new Date().toISOString() })
          : it,
      ),
    });
  };
  const patchSkill = (id: string, patch: Partial<SimulationSkillItem>) => {
    onChange({
      ...content,
      skills: content.skills.map((it) =>
        it.id === id
          ? emptySkillItem({ ...it, ...patch, id, updatedAt: new Date().toISOString() })
          : it,
      ),
    });
  };
  const patchMessage = (id: string, patch: Partial<SimulationFeatureMessageItem>) => {
    onChange({
      ...content,
      messages: content.messages.map((it) =>
        it.id === id
          ? emptyFeatureMessageItem({ ...it, ...patch, id, updatedAt: new Date().toISOString() })
          : it,
      ),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg,
      }}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [{
            width: 38, height: 38, borderRadius: 19,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: C.bgCardAlt,
          }, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Fermer"
        >
          <MaterialIcons name="arrow-back" size={22} color={C.textPrimary} />
        </Pressable>
        <View style={{
          width: 36, height: 36, borderRadius: Radius.md,
          backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialIcons name={meta.icon as any} size={20} color={ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.md, fontWeight: '700', color: C.textPrimary }}>
            {meta.label}
          </Text>
          <Text style={{ fontSize: FontSize.xs, color: ACCENT, fontWeight: '700', letterSpacing: 0.4 }}>
            ROLEPLAY · {items.length} entrée{items.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          onPress={addItem}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.pill,
            backgroundColor: ACCENT + '22', borderWidth: 1, borderColor: ACCENT + '55',
          }, pressed && { opacity: 0.75 }]}
          accessibilityLabel="Ajouter"
        >
          <MaterialIcons name="add" size={16} color={ACCENT} />
          <Text style={{ fontSize: FontSize.xs, color: ACCENT, fontWeight: '800' }}>Ajouter</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: ACCENT + '18', alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: ACCENT + '44',
            }}>
              <MaterialIcons name={meta.icon as any} size={34} color={ACCENT} />
            </View>
            <Text style={{ fontSize: FontSize.body, color: C.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 360 }}>
              {meta.emptyHint}
            </Text>
            <Pressable
              onPress={addItem}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.pill,
                backgroundColor: ACCENT + '22', borderWidth: 1, borderColor: ACCENT + '55',
              }, pressed && { opacity: 0.75 }]}
            >
              <MaterialIcons name="add-circle-outline" size={18} color={ACCENT} />
              <Text style={{ fontSize: FontSize.sm, color: ACCENT, fontWeight: '700' }}>Créer une entrée</Text>
            </Pressable>
          </View>
        ) : null}

        {featureId === 'inventory'
          ? content.inventory.map((it) => (
            <CardShell
              key={it.id}
              title={`${it.name} ×${it.quantity}`}
              subtitle={it.description}
              open={expandedId === it.id}
              onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
              onRemove={() => removeById(it.id)}
              C={C}
            >
              <Field label="Nom" value={it.name} onChange={(v) => patchInventory(it.id, { name: v })} C={C} />
              <Field
                label="Quantité"
                value={String(it.quantity)}
                keyboardType="numeric"
                onChange={(v) => patchInventory(it.id, { quantity: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })}
                C={C}
              />
              <Field label="Description" value={it.description} multiline onChange={(v) => patchInventory(it.id, { description: v })} C={C} />
            </CardShell>
          ))
          : null}

        {featureId === 'album'
          ? content.album.map((it) => (
            <CardShell
              key={it.id}
              title={it.title}
              subtitle={it.description}
              open={expandedId === it.id}
              onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
              onRemove={() => removeById(it.id)}
              C={C}
            >
              <Field label="Titre" value={it.title} onChange={(v) => patchAlbum(it.id, { title: v })} C={C} />
              <Field label="Description" value={it.description} multiline onChange={(v) => patchAlbum(it.id, { description: v })} C={C} />
              <Field label="URI / lien (optionnel)" value={it.uri ?? ''} onChange={(v) => patchAlbum(it.id, { uri: v })} placeholder="https://…" C={C} />
            </CardShell>
          ))
          : null}

        {featureId === 'skills'
          ? content.skills.map((it) => (
            <CardShell
              key={it.id}
              title={`${it.name} · ${it.level}`}
              subtitle={it.description}
              open={expandedId === it.id}
              onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
              onRemove={() => removeById(it.id)}
              C={C}
            >
              <Field label="Nom" value={it.name} onChange={(v) => patchSkill(it.id, { name: v })} C={C} />
              <Field label="Niveau" value={it.level} onChange={(v) => patchSkill(it.id, { level: v })} placeholder="ex. Novice, 3/10" C={C} />
              <Field label="Description" value={it.description} multiline onChange={(v) => patchSkill(it.id, { description: v })} C={C} />
            </CardShell>
          ))
          : null}

        {featureId === 'messages' ? (
          <View style={{ marginBottom: Spacing.md, gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color: ACCENT, letterSpacing: 0.4 }}>
              CONTACTS
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginBottom: 4, lineHeight: 16 }}>
              Personnages autorisés à t’envoyer des messages (depuis la mémoire).
            </Text>
            {(content.contacts ?? []).map((c) => (
              <View
                key={c.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingVertical: 8, paddingHorizontal: Spacing.sm,
                  borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard,
                }}
              >
                <MaterialIcons name="person" size={16} color={ACCENT} />
                <Text style={{ flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: C.textPrimary }}>{c.name}</Text>
                <Pressable
                  onPress={() => onChange({
                    ...content,
                    contacts: (content.contacts ?? []).filter((x) => x.id !== c.id),
                  })}
                  hitSlop={8}
                  accessibilityLabel={`Retirer ${c.name}`}
                >
                  <MaterialIcons name="close" size={18} color={C.textMuted} />
                </Pressable>
              </View>
            ))}
            {(memoryCharacters ?? [])
              .filter((ch) => {
                const k = normalizeMemoryKey(ch.key || ch.name);
                return !(content.contacts ?? []).some((c) => c.key === k);
              })
              .slice(0, 12)
              .map((ch) => {
                const k = normalizeMemoryKey(ch.key || ch.name);
                return (
                  <Pressable
                    key={k}
                    onPress={() => {
                      const next = emptyContactItem({ key: k, name: ch.name });
                      onChange({
                        ...content,
                        contacts: [...(content.contacts ?? []), next],
                      });
                    }}
                    style={({ pressed }) => [{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingVertical: 8, paddingHorizontal: Spacing.sm,
                    }, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name="person-add" size={16} color={ACCENT} />
                    <Text style={{ fontSize: FontSize.sm, color: ACCENT, fontWeight: '700' }}>
                      Ajouter « {ch.name} »
                    </Text>
                  </Pressable>
                );
              })}
            <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color: C.textMuted, marginTop: Spacing.sm, letterSpacing: 0.4 }}>
              BOÎTE DE RÉCEPTION
            </Text>
          </View>
        ) : null}

        {featureId === 'messages'
          ? content.messages.map((it) => (
            <CardShell
              key={it.id}
              title={`${it.from}${it.read ? '' : ' · nouveau'}`}
              subtitle={it.content}
              open={expandedId === it.id}
              onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
              onRemove={() => removeById(it.id)}
              C={C}
            >
              <Field label="De" value={it.from} onChange={(v) => patchMessage(it.id, { from: v })} C={C} />
              <Field label="Contenu" value={it.content} multiline onChange={(v) => patchMessage(it.id, { content: v })} C={C} />
              <Field label="Influence" value={it.influence} multiline onChange={(v) => patchMessage(it.id, { influence: v })} placeholder="Effet potentiel…" C={C} />
              <Pressable
                onPress={() => patchMessage(it.id, { read: !it.read })}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingVertical: 8, marginBottom: Spacing.sm,
                }}
              >
                <MaterialIcons
                  name={it.read ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={it.read ? ACCENT : C.textMuted}
                />
                <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600' }}>
                  Lu
                </Text>
              </Pressable>
            </CardShell>
          ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
