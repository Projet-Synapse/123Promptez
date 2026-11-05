/**
 * Page Mémoire Simulation — Personnages (catégories) / Liens (sous-sections) / Lieux.
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
  MEMORY_CHARACTER_CATEGORIES,
  MEMORY_CHARACTER_CATEGORY_META,
  MEMORY_LINK_SUBSECTIONS,
  MEMORY_LINK_SUBSECTION_META,
  MEMORY_AUTO_UPDATE_EVERY_N,
  type MemorySectionId,
  type MemoryCharacterCategory,
  type MemoryLinkSubsection,
  type SimulationMemory,
  type SimulationMemoryItem,
} from '@/types/simulationMemory';

const ACCENT = '#9B59B6';

type EditPatch = {
  name?: string;
  summary?: string;
  from?: string;
  to?: string;
  characterCategory?: MemoryCharacterCategory;
  linkSubsection?: MemoryLinkSubsection;
};

type Props = {
  memory: SimulationMemory;
  generating: boolean;
  focusItemId?: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onAdd: (
    section: MemorySectionId,
    name: string,
    opts?: { characterCategory?: MemoryCharacterCategory; linkSubsection?: MemoryLinkSubsection },
  ) => void;
  onRemove: (section: MemorySectionId, id: string) => void;
  onEditItem: (section: MemorySectionId, id: string, patch: EditPatch) => void;
};

function CategoryChips({
  value,
  onChange,
  disabledPrincipal,
  C,
}: {
  value: MemoryCharacterCategory;
  onChange: (c: MemoryCharacterCategory) => void;
  disabledPrincipal?: boolean;
  C: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {MEMORY_CHARACTER_CATEGORIES.map((cat) => {
        const on = value === cat;
        const blocked = cat === 'principal' && disabledPrincipal;
        return (
          <Pressable
            key={cat}
            disabled={blocked}
            onPress={() => onChange(cat)}
            style={{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
              backgroundColor: on ? ACCENT + '28' : C.bgCardAlt,
              borderWidth: 1, borderColor: on ? ACCENT + '77' : C.border,
              opacity: blocked ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: on ? ACCENT : C.textSecondary }}>
              {MEMORY_CHARACTER_CATEGORY_META[cat].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LinkKindChips({
  value,
  onChange,
  C,
}: {
  value: MemoryLinkSubsection;
  onChange: (k: MemoryLinkSubsection) => void;
  C: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {MEMORY_LINK_SUBSECTIONS.map((k) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
              backgroundColor: on ? ACCENT + '28' : C.bgCardAlt,
              borderWidth: 1, borderColor: on ? ACCENT + '77' : C.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: on ? ACCENT : C.textSecondary }}>
              {MEMORY_LINK_SUBSECTION_META[k].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ItemCard({
  section,
  it,
  open,
  onToggle,
  onEditItem,
  onRemove,
  C,
}: {
  section: MemorySectionId;
  it: SimulationMemoryItem;
  open: boolean;
  onToggle: () => void;
  onEditItem: Props['onEditItem'];
  onRemove: Props['onRemove'];
  C: ReturnType<typeof useThemeColors>;
}) {
  const catLabel =
    section === 'characters' && it.characterCategory
      ? MEMORY_CHARACTER_CATEGORY_META[it.characterCategory].label
      : section === 'links' && it.linkSubsection
        ? MEMORY_LINK_SUBSECTION_META[it.linkSubsection].label
        : null;

  return (
    <View
      style={{
        backgroundColor: C.bgCard,
        borderWidth: 1,
        borderColor: open ? ACCENT + '66' : C.border,
        borderRadius: Radius.md,
        padding: Spacing.sm,
        marginBottom: Spacing.xs,
      }}
    >
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: FontSize.body, fontWeight: '700', color: C.textPrimary }} numberOfLines={1}>
              {it.name}
            </Text>
            {catLabel ? (
              <View style={{
                paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill,
                backgroundColor: ACCENT + '18', borderWidth: 1, borderColor: ACCENT + '44',
              }}>
                <Text style={{ fontSize: 9, color: ACCENT, fontWeight: '800' }}>{catLabel}</Text>
              </View>
            ) : null}
            {it.isPlayerPersona ? (
              <View style={{
                paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill,
                backgroundColor: C.bgCardAlt, borderWidth: 1, borderColor: C.border,
              }}>
                <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '800' }}>PERSONA</Text>
              </View>
            ) : null}
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

          {section === 'characters' ? (
            <View>
              <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>CATÉGORIE</Text>
              <CategoryChips
                value={it.characterCategory ?? 'secondaires'}
                disabledPrincipal={!!it.isPlayerPersona}
                onChange={(c) => onEditItem(section, it.id, { characterCategory: c })}
                C={C}
              />
              {it.isPlayerPersona ? (
                <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                  Le persona joueur ne peut pas être Principal.
                </Text>
              ) : null}
            </View>
          ) : null}

          {section === 'links' ? (
            <>
              <View>
                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>SOUS-SECTION</Text>
                <LinkKindChips
                  value={it.linkSubsection ?? 'rapports'}
                  onChange={(k) => onEditItem(section, it.id, { linkSubsection: k })}
                  C={C}
                />
              </View>
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
            </>
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
              paddingVertical: 6, paddingHorizontal: 8,
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

function SectionBlock({
  section,
  items,
  C,
  expandedId,
  setExpandedId,
  onEditItem,
  onRemove,
  onAdd,
  charFilter,
  setCharFilter,
  linkFilter,
  setLinkFilter,
}: {
  section: MemorySectionId;
  items: SimulationMemoryItem[];
  C: ReturnType<typeof useThemeColors>;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onEditItem: Props['onEditItem'];
  onRemove: Props['onRemove'];
  onAdd: Props['onAdd'];
  charFilter: MemoryCharacterCategory | 'all';
  setCharFilter: (v: MemoryCharacterCategory | 'all') => void;
  linkFilter: MemoryLinkSubsection | 'all';
  setLinkFilter: (v: MemoryLinkSubsection | 'all') => void;
}) {
  const meta = MEMORY_SECTION_META[section];
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');

  const filtered = useMemo(() => {
    if (section === 'characters' && charFilter !== 'all') {
      return items.filter((it) => (it.characterCategory ?? 'secondaires') === charFilter);
    }
    if (section === 'links' && linkFilter !== 'all') {
      return items.filter((it) => (it.linkSubsection ?? 'rapports') === linkFilter);
    }
    return items;
  }, [items, section, charFilter, linkFilter]);

  // Grouped view for "all" on characters/links
  const groups: { key: string; label: string; list: SimulationMemoryItem[] }[] = useMemo(() => {
    if (section === 'characters' && charFilter === 'all') {
      return MEMORY_CHARACTER_CATEGORIES.map((cat) => ({
        key: cat,
        label: MEMORY_CHARACTER_CATEGORY_META[cat].label,
        list: items.filter((it) => (it.characterCategory ?? 'secondaires') === cat),
      })).filter((g) => g.list.length > 0);
    }
    if (section === 'links' && linkFilter === 'all') {
      return MEMORY_LINK_SUBSECTIONS.map((k) => ({
        key: k,
        label: MEMORY_LINK_SUBSECTION_META[k].label,
        list: items.filter((it) => (it.linkSubsection ?? 'rapports') === k),
      })).filter((g) => g.list.length > 0);
    }
    return [{ key: 'flat', label: '', list: filtered }];
  }, [section, charFilter, linkFilter, items, filtered]);

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
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700' }}>{items.length}</Text>
      </View>

      {section === 'characters' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              onPress={() => setCharFilter('all')}
              style={{
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
                backgroundColor: charFilter === 'all' ? ACCENT + '28' : C.bgCardAlt,
                borderWidth: 1, borderColor: charFilter === 'all' ? ACCENT + '77' : C.border,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: charFilter === 'all' ? ACCENT : C.textSecondary }}>Tout</Text>
            </Pressable>
            {MEMORY_CHARACTER_CATEGORIES.map((cat) => {
              const on = charFilter === cat;
              const n = items.filter((it) => (it.characterCategory ?? 'secondaires') === cat).length;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCharFilter(cat)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
                    backgroundColor: on ? ACCENT + '28' : C.bgCardAlt,
                    borderWidth: 1, borderColor: on ? ACCENT + '77' : C.border,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: on ? ACCENT : C.textSecondary }}>
                    {MEMORY_CHARACTER_CATEGORY_META[cat].label}{n ? ` · ${n}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {section === 'links' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              onPress={() => setLinkFilter('all')}
              style={{
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
                backgroundColor: linkFilter === 'all' ? ACCENT + '28' : C.bgCardAlt,
                borderWidth: 1, borderColor: linkFilter === 'all' ? ACCENT + '77' : C.border,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: linkFilter === 'all' ? ACCENT : C.textSecondary }}>Tout</Text>
            </Pressable>
            {MEMORY_LINK_SUBSECTIONS.map((k) => {
              const on = linkFilter === k;
              const n = items.filter((it) => (it.linkSubsection ?? 'rapports') === k).length;
              return (
                <Pressable
                  key={k}
                  onPress={() => setLinkFilter(k)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
                    backgroundColor: on ? ACCENT + '28' : C.bgCardAlt,
                    borderWidth: 1, borderColor: on ? ACCENT + '77' : C.border,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: on ? ACCENT : C.textSecondary }}>
                    {MEMORY_LINK_SUBSECTION_META[k].label}{n ? ` · ${n}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {items.length === 0 ? (
        <Text style={{ fontSize: FontSize.sm, color: C.textMuted, marginBottom: Spacing.sm, lineHeight: 18 }}>
          {meta.empty}
        </Text>
      ) : null}

      {groups.map((g) => (
        <View key={g.key} style={{ marginBottom: g.label ? Spacing.sm : 0 }}>
          {g.label ? (
            <Text style={{
              fontSize: FontSize.xs, fontWeight: '800', color: ACCENT,
              letterSpacing: 0.5, marginBottom: 6, marginTop: 4,
            }}>
              {g.label.toUpperCase()}
            </Text>
          ) : null}
          {g.list.length === 0 ? (
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginBottom: 6 }}>Aucune entrée</Text>
          ) : null}
          {g.list.map((it) => (
            <ItemCard
              key={it.id}
              section={section}
              it={it}
              open={expandedId === it.id}
              onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
              onEditItem={onEditItem}
              onRemove={onRemove}
              C={C}
            />
          ))}
        </View>
      ))}

      {adding ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
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
              if (draftName.trim()) {
                onAdd(
                  section,
                  draftName.trim(),
                  section === 'characters'
                    ? { characterCategory: charFilter === 'all' ? 'anecdotiques' : charFilter }
                    : section === 'links'
                      ? { linkSubsection: linkFilter === 'all' ? 'rapports' : linkFilter }
                      : undefined,
                );
              }
              setDraftName('');
              setAdding(false);
            }}
          />
          <Pressable
            onPress={() => {
              if (draftName.trim()) {
                onAdd(
                  section,
                  draftName.trim(),
                  section === 'characters'
                    ? { characterCategory: charFilter === 'all' ? 'anecdotiques' : charFilter }
                    : section === 'links'
                      ? { linkSubsection: linkFilter === 'all' ? 'rapports' : linkFilter }
                      : undefined,
                );
              }
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
  const [charFilter, setCharFilter] = useState<MemoryCharacterCategory | 'all'>('all');
  const [linkFilter, setLinkFilter] = useState<MemoryLinkSubsection | 'all'>('all');

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
            charFilter={charFilter}
            setCharFilter={setCharFilter}
            linkFilter={linkFilter}
            setLinkFilter={setLinkFilter}
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
