/**
 * Page Mémoire Simulation — Personnages / Liens / Lieux clés.
 * Éditable à la main ; génération initiale + bouton Rafraîchir.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  MEMORY_SECTION_META,
  type MemorySectionId,
  type SimulationMemory,
  type SimulationMemoryItem,
} from '@/types/simulationMemory';
import { MEMORY_AUTO_UPDATE_EVERY_N } from '@/types/simulationMemory';

const ACCENT = '#9B59B6';

type Props = {
  memory: SimulationMemory;
  generating: boolean;
  focusItemId?: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onAdd: (section: MemorySectionId, name: string) => void;
  onRemove: (section: MemorySectionId, id: string) => void;
  onEditItem: (
    section: MemorySectionId,
    id: string,
    patch: { name?: string; summary?: string; from?: string; to?: string },
  ) => void;
};

function SectionBlock({
  section,
  items,
  C,
  expandedId,
  setExpandedId,
  onEditItem,
  onRemove,
  onAdd,
}: {
  section: MemorySectionId;
  items: SimulationMemoryItem[];
  C: ReturnType<typeof useThemeColors>;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onEditItem: Props['onEditItem'];
  onRemove: Props['onRemove'];
  onAdd: Props['onAdd'];
}) {
  const meta = MEMORY_SECTION_META[section];
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');

  return (
    <View style={{ marginBottom: Spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <View style={{
          width: 32, height: 32, borderRadius: Radius.sm,
          backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialIcons name={meta.icon as any} size={18} color={ACCENT} />
        </View>
        <Text style={{ flex: 1, fontSize: FontSize.md, fontWeight: '800', color: C.textPrimary }}>
          {meta.label}
        </Text>
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700' }}>
          {items.length}
        </Text>
      </View>

      {items.length === 0 ? (
        <Text style={{ fontSize: FontSize.sm, color: C.textMuted, marginBottom: Spacing.sm, lineHeight: 18 }}>
          {meta.empty}
        </Text>
      ) : null}

      {items.map((it) => {
        const open = expandedId === it.id;
        return (
          <View
            key={it.id}
            style={{
              backgroundColor: C.bgCard,
              borderWidth: 1,
              borderColor: open ? ACCENT + '66' : C.border,
              borderRadius: Radius.md,
              padding: Spacing.sm,
              marginBottom: Spacing.xs,
            }}
          >
            <Pressable
              onPress={() => setExpandedId(open ? null : it.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: FontSize.body, fontWeight: '700', color: C.textPrimary }} numberOfLines={1}>
                    {it.name}
                  </Text>
                  {it.userEdited ? (
                    <View style={{
                      paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill,
                      backgroundColor: C.warning + '22', borderWidth: 1, borderColor: C.warning + '55',
                    }}>
                      <Text style={{ fontSize: 9, color: C.warning, fontWeight: '800' }}>MODIFIÉ</Text>
                    </View>
                  ) : null}
                </View>
                {!open && it.summary ? (
                  <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }} numberOfLines={2}>
                    {it.summary}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={C.textMuted} />
            </Pressable>

            {open ? (
              <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
                <View>
                  <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>NOM</Text>
                  <TextInput
                    value={it.name}
                    onChangeText={(v) => onEditItem(section, it.id, { name: v })}
                    style={{
                      borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
                      paddingHorizontal: Spacing.sm, paddingVertical: 8,
                      color: C.textPrimary, backgroundColor: C.bgCardAlt, fontSize: FontSize.body,
                    }}
                    placeholderTextColor={C.textMuted}
                  />
                </View>
                {section === 'links' ? (
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>DE</Text>
                      <TextInput
                        value={it.from ?? ''}
                        onChangeText={(v) => onEditItem(section, it.id, { from: v })}
                        style={{
                          borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
                          paddingHorizontal: Spacing.sm, paddingVertical: 8,
                          color: C.textPrimary, backgroundColor: C.bgCardAlt, fontSize: FontSize.sm,
                        }}
                        placeholderTextColor={C.textMuted}
                        placeholder="…"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>VERS</Text>
                      <TextInput
                        value={it.to ?? ''}
                        onChangeText={(v) => onEditItem(section, it.id, { to: v })}
                        style={{
                          borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
                          paddingHorizontal: Spacing.sm, paddingVertical: 8,
                          color: C.textPrimary, backgroundColor: C.bgCardAlt, fontSize: FontSize.sm,
                        }}
                        placeholderTextColor={C.textMuted}
                        placeholder="…"
                      />
                    </View>
                  </View>
                ) : null}
                <View>
                  <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>RÉSUMÉ</Text>
                  <TextInput
                    value={it.summary}
                    onChangeText={(v) => onEditItem(section, it.id, { summary: v })}
                    multiline
                    style={{
                      borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
                      paddingHorizontal: Spacing.sm, paddingVertical: 8,
                      color: C.textPrimary, backgroundColor: C.bgCardAlt, fontSize: FontSize.sm,
                      minHeight: 72, textAlignVertical: 'top',
                    }}
                    placeholderTextColor={C.textMuted}
                    placeholder="Faits à retenir…"
                  />
                </View>
                <Pressable
                  onPress={() => onRemove(section, it.id)}
                  style={({ pressed }) => [{
                    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingVertical: 6, paddingHorizontal: 8, borderRadius: Radius.sm,
                  }, pressed && { opacity: 0.7 }]}
                >
                  <MaterialIcons name="delete-outline" size={16} color={C.error} />
                  <Text style={{ fontSize: FontSize.xs, color: C.error, fontWeight: '700' }}>Supprimer</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      {adding ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
          marginTop: Spacing.xs,
        }}>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Nom…"
            placeholderTextColor={C.textMuted}
            autoFocus
            style={{
              flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
              paddingHorizontal: Spacing.sm, paddingVertical: 8,
              color: C.textPrimary, backgroundColor: C.bgCardAlt, fontSize: FontSize.body,
            }}
            onSubmitEditing={() => {
              if (draftName.trim()) onAdd(section, draftName.trim());
              setDraftName('');
              setAdding(false);
            }}
          />
          <Pressable
            onPress={() => {
              if (draftName.trim()) onAdd(section, draftName.trim());
              setDraftName('');
              setAdding(false);
            }}
            style={{ padding: 8 }}
          >
            <MaterialIcons name="check" size={22} color={ACCENT} />
          </Pressable>
          <Pressable onPress={() => { setAdding(false); setDraftName(''); }} style={{ padding: 8 }}>
            <MaterialIcons name="close" size={22} color={C.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 10, paddingHorizontal: Spacing.sm, marginTop: 4,
          }, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name="add-circle-outline" size={18} color={ACCENT} />
          <Text style={{ fontSize: FontSize.sm, color: ACCENT, fontWeight: '700' }}>{meta.addLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function SimulationMemoryScreen({
  memory, generating, focusItemId, onClose, onRefresh, onEditItem, onAdd, onRemove,
}: Props) {
  const C = useThemeColors();
  const [expandedId, setExpandedId] = useState<string | null>(focusItemId ?? null);
  const [tab, setTab] = useState<MemorySectionId | 'all'>('all');

  useEffect(() => {
    if (focusItemId) setExpandedId(focusItemId);
  }, [focusItemId]);

  const sections = useMemo(() => {
    const all: MemorySectionId[] = ['characters', 'links', 'places'];
    return tab === 'all' ? all : [tab];
  }, [tab]);

  const everyN = memory.updateEveryN || MEMORY_AUTO_UPDATE_EVERY_N;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [{
            width: 38, height: 38, borderRadius: 19,
            alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgCardAlt,
          }, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Fermer la mémoire"
        >
          <MaterialIcons name="arrow-back" size={22} color={C.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.md, fontWeight: '800', color: C.textPrimary }}>Mémoire</Text>
          <Text style={{ fontSize: FontSize.xs, color: ACCENT, fontWeight: '700', letterSpacing: 0.4 }}>
            ROLEPLAY · MAJ auto tous les {everyN} messages
          </Text>
        </View>
        <Pressable
          onPress={onRefresh}
          disabled={generating}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.pill,
            backgroundColor: ACCENT + '22', borderWidth: 1, borderColor: ACCENT + '55',
            opacity: generating ? 0.6 : 1,
          }, pressed && { opacity: 0.75 }]}
          accessibilityLabel="Rafraîchir la mémoire"
        >
          {generating ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <MaterialIcons name="auto-awesome" size={16} color={ACCENT} />
          )}
          <Text style={{ fontSize: FontSize.xs, color: ACCENT, fontWeight: '800' }}>
            {generating ? 'Génération…' : 'Rafraîchir'}
          </Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}>
          {([
            { id: 'all' as const, label: 'Tout' },
            { id: 'characters' as const, label: 'Personnages' },
            { id: 'links' as const, label: 'Liens' },
            { id: 'places' as const, label: 'Lieux' },
          ]).map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill,
                  backgroundColor: on ? ACCENT + '22' : C.bgCardAlt,
                  borderWidth: 1, borderColor: on ? ACCENT + '66' : C.border,
                }}
              >
                <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: on ? ACCENT : C.textSecondary }}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {generating && !memory.initialized ? (
          <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={{ color: C.textSecondary, textAlign: 'center' }}>
              Génération initiale de la mémoire…
            </Text>
          </View>
        ) : null}

        {sections.map((section) => (
          <SectionBlock
            key={section}
            section={section}
            items={memory[section]}
            C={C}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onEditItem={onEditItem}
            onRemove={onRemove}
            onAdd={onAdd}
          />
        ))}

        {memory.lastUpdatedAt ? (
          <Text style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', marginTop: Spacing.md }}>
            Dernière MAJ : {new Date(memory.lastUpdatedAt).toLocaleString('fr-FR')}
            {' · '}
            {memory.messageCountAtLastUpdate} message(s) pris en compte
          </Text>
        ) : null}
      </ScrollView>

      {/* Overlay léger pendant refresh si déjà initialisé */}
      <Modal visible={generating && memory.initialized} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#0006', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            backgroundColor: C.bgCard, padding: Spacing.lg, borderRadius: Radius.lg,
            alignItems: 'center', gap: Spacing.sm, minWidth: 200,
          }}>
            <ActivityIndicator color={ACCENT} />
            <Text style={{ color: C.textPrimary, fontWeight: '700' }}>Mise à jour…</Text>
            <Text style={{ color: C.textMuted, fontSize: FontSize.xs, textAlign: 'center' }}>
              Les entrées modifiées à la main sont préservées
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default SimulationMemoryScreen;
