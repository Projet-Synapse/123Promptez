/**
 * Page Mémoire Simulation — Persona / Personnages / Liens (Objets, Relationnels, Évènements, Accords) / Lieux.
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
  MEMORY_LINK_SUBSECTIONS,
  MEMORY_LINK_SUBSECTION_META,
  MEMORY_CHARACTER_FICHE_FIELDS,
  MEMORY_EVENT_FICHE_FIELDS,
  MEMORY_OBJECT_FICHE_FIELDS,
  MEMORY_RELATION_FICHE_FIELDS,
  MEMORY_ACCORD_FICHE_FIELDS,
  MEMORY_PERSONA_FICHE_FIELDS,
  MEMORY_AUTO_UPDATE_EVERY_N,
  type MemorySectionId,
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
  linkSubsection?: MemoryLinkSubsection;
  age?: string;
  physique?: string;
  personality?: string;
  extraInfo?: string;
  location?: string;
  participants?: string;
  time?: string;
  owner?: string;
  origin?: string;
  interlocutors?: string;
  dynamics?: string;
  attitude?: string;
  attachmentLevel?: string;
  proposedBy?: string;
  task?: string;
  completed?: boolean;
};

type Props = {
  memory: SimulationMemory;
  generating: boolean;
  focusItemId?: string | null;
  /** Infos déjà dans le persona de base (pour le rappel sous l’onglet Persona). */
  personaBaseHint?: string;
  onClose: () => void;
  onRefresh: () => void;
  onAdd: (
    section: MemorySectionId,
    name: string,
    opts?: { linkSubsection?: MemoryLinkSubsection },
  ) => void;
  onRemove: (section: MemorySectionId, id: string) => void;
  onEditItem: (section: MemorySectionId, id: string, patch: EditPatch) => void;
  /** Marque une fiche comme consultée (retire le badge 🔴). */
  onMarkSeen: (section: MemorySectionId, id: string) => void;
};

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  C,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  C: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View>
      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={!!multiline}
        placeholder={placeholder ?? '…'}
        placeholderTextColor={C.textMuted}
        style={{
          borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
          paddingHorizontal: Spacing.sm, paddingVertical: 8,
          color: C.textPrimary, backgroundColor: C.bgCardAlt,
          fontSize: multiline ? FontSize.sm : FontSize.body,
          minHeight: multiline ? 64 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
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

function previewLine(section: MemorySectionId, it: SimulationMemoryItem): string {
  if (section === 'persona') {
    return it.summary || '';
  }
  if (section === 'characters') {
    const bits = [it.age ? `${it.age} ans` : '', it.location, it.personality || it.summary]
      .filter(Boolean);
    return bits.join(' · ');
  }
  if (section === 'links') {
    const sub = it.linkSubsection ?? 'rapports';
    if (sub === 'evenements') {
      return [it.time, it.participants, it.summary].filter(Boolean).join(' · ');
    }
    if (sub === 'objets') {
      return [it.owner, it.summary, it.origin].filter(Boolean).join(' · ');
    }
    if (sub === 'rapports') {
      return [it.interlocutors, it.dynamics, it.attitude, it.attachmentLevel].filter(Boolean).join(' · ');
    }
    if (sub === 'accords') {
      const mark = it.completed ? '✓' : '○';
      return [mark, it.proposedBy, it.participants, it.task || it.summary].filter(Boolean).join(' · ');
    }
  }
  return it.summary || '';
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
  const sub = it.linkSubsection ?? 'rapports';
  const kindLabel =
    section === 'links'
      ? MEMORY_LINK_SUBSECTION_META[sub].label
      : null;
  const preview = previewLine(section, it);
  const displayName = section === 'links' && sub === 'accords'
    ? (it.task || it.name)
    : it.name;

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
            {section === 'links' && sub === 'accords' ? (
              <Text style={{ fontSize: 14 }}>{it.completed ? '☑️' : '⬜'}</Text>
            ) : null}
            <Text style={{ fontSize: FontSize.body, fontWeight: '700', color: C.textPrimary }} numberOfLines={1}>
              {displayName}
            </Text>
            {it.isNew ? (
              <Text style={{ fontSize: 10, lineHeight: 12 }} accessibilityLabel="Nouveauté">🔴</Text>
            ) : null}
            {kindLabel ? (
              <View style={{
                paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill,
                backgroundColor: ACCENT + '18', borderWidth: 1, borderColor: ACCENT + '44',
              }}>
                <Text style={{ fontSize: 9, color: ACCENT, fontWeight: '800' }}>{kindLabel}</Text>
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
          {!open && preview ? (
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 }} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
        </View>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color={C.textMuted} />
      </Pressable>

      {open ? (
        <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
          {section === 'links' && sub === 'accords' ? (
            <Pressable
              onPress={() => onEditItem(section, it.id, { completed: !it.completed })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
            >
              <MaterialIcons
                name={it.completed ? 'check-box' : 'check-box-outline-blank'}
                size={22}
                color={it.completed ? ACCENT : C.textMuted}
              />
              <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: C.textPrimary }}>
                {it.completed ? 'Fait / tenu' : 'À faire'}
              </Text>
            </Pressable>
          ) : null}

          {section === 'persona' ? (
            MEMORY_PERSONA_FICHE_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                value={String(it[f.key] ?? '')}
                multiline={f.multiline}
                onChange={(v) => onEditItem(section, it.id, { [f.key]: v })}
                C={C}
              />
            ))
          ) : null}

          {section === 'characters' ? (
            <>
              <Field
                label="Nom"
                value={it.name}
                onChange={(v) => onEditItem(section, it.id, { name: v })}
                C={C}
              />
              {MEMORY_CHARACTER_FICHE_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={String(it[f.key] ?? '')}
                  multiline={f.multiline}
                  onChange={(v) => onEditItem(section, it.id, { [f.key]: v })}
                  C={C}
                />
              ))}
              <Field
                label="Notes"
                value={it.summary}
                multiline
                onChange={(v) => onEditItem(section, it.id, { summary: v })}
                placeholder="Notes libres…"
                C={C}
              />
            </>
          ) : null}

          {section === 'links' ? (
            <>
              <View>
                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginBottom: 4 }}>TYPE</Text>
                <LinkKindChips
                  value={sub}
                  onChange={(k) => onEditItem(section, it.id, { linkSubsection: k })}
                  C={C}
                />
              </View>
              {sub === 'evenements' ? (
                MEMORY_EVENT_FICHE_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={String(it[f.key] ?? '')}
                    multiline={f.multiline}
                    onChange={(v) => onEditItem(section, it.id, { [f.key]: v })}
                    C={C}
                  />
                ))
              ) : null}
              {sub === 'objets' ? (
                MEMORY_OBJECT_FICHE_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={String(it[f.key] ?? '')}
                    multiline={f.multiline}
                    onChange={(v) => onEditItem(section, it.id, { [f.key]: v })}
                    C={C}
                  />
                ))
              ) : null}
              {sub === 'rapports' ? (
                MEMORY_RELATION_FICHE_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={String(it[f.key] ?? '')}
                    multiline={f.multiline}
                    onChange={(v) => onEditItem(section, it.id, { [f.key]: v })}
                    C={C}
                  />
                ))
              ) : null}
              {sub === 'accords' ? (
                MEMORY_ACCORD_FICHE_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={String((f.key === 'task' ? (it.task || it.name) : it[f.key]) ?? '')}
                    multiline={f.multiline}
                    onChange={(v) => onEditItem(
                      section,
                      it.id,
                      f.key === 'task' ? { task: v, name: v } : { [f.key]: v },
                    )}
                    C={C}
                  />
                ))
              ) : null}
            </>
          ) : null}

          {section === 'places' ? (
            <>
              <Field
                label="Nom"
                value={it.name}
                onChange={(v) => onEditItem(section, it.id, { name: v })}
                C={C}
              />
              <Field
                label="Résumé"
                value={it.summary}
                multiline
                onChange={(v) => onEditItem(section, it.id, { summary: v })}
                placeholder="Faits à retenir…"
                C={C}
              />
            </>
          ) : null}

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
  onMarkSeen,
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
  onMarkSeen: Props['onMarkSeen'];
  linkFilter: MemoryLinkSubsection | 'all';
  setLinkFilter: (v: MemoryLinkSubsection | 'all') => void;
}) {
  const meta = MEMORY_SECTION_META[section];
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');

  const filtered = useMemo(() => {
    if (section === 'links' && linkFilter !== 'all') {
      return items.filter((it) => (it.linkSubsection ?? 'rapports') === linkFilter);
    }
    return items;
  }, [items, section, linkFilter]);

  const groups: { key: string; label: string; list: SimulationMemoryItem[] }[] = useMemo(() => {
    if (section === 'links' && linkFilter === 'all') {
      return MEMORY_LINK_SUBSECTIONS.map((k) => ({
        key: k,
        label: MEMORY_LINK_SUBSECTION_META[k].label,
        list: items.filter((it) => (it.linkSubsection ?? 'rapports') === k),
      })).filter((g) => g.list.length > 0);
    }
    return [{ key: 'flat', label: '', list: filtered }];
  }, [section, linkFilter, items, filtered]);

  const commitAdd = () => {
    if (draftName.trim()) {
      onAdd(
        section,
        draftName.trim(),
        section === 'links'
          ? { linkSubsection: linkFilter === 'all' ? 'rapports' : linkFilter }
          : undefined,
      );
    }
    setDraftName('');
    setAdding(false);
  };

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
          {items.some((it) => it.isNew) ? ' 🔴' : ''}
        </Text>
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700' }}>{items.length}</Text>
      </View>

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
              onToggle={() => {
                if (expandedId === it.id) {
                  setExpandedId(null);
                } else {
                  setExpandedId(it.id);
                  if (it.isNew) onMarkSeen(section, it.id);
                }
              }}
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
            onSubmitEditing={commitAdd}
            style={{
              flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
              paddingHorizontal: Spacing.sm, paddingVertical: 8,
              color: C.textPrimary, backgroundColor: C.bgCardAlt, fontSize: FontSize.body,
            }}
          />
          <Pressable onPress={commitAdd} style={{ padding: 8 }}>
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
  memory, generating, focusItemId, personaBaseHint, onClose, onRefresh, onEditItem, onAdd, onRemove, onMarkSeen,
}: Props) {
  const C = useThemeColors();
  const [expandedId, setExpandedId] = useState<string | null>(focusItemId ?? null);
  const [tab, setTab] = useState<MemorySectionId | 'all'>('all');
  const [linkFilter, setLinkFilter] = useState<MemoryLinkSubsection | 'all'>('all');

  useEffect(() => {
    if (!focusItemId) return;
    setExpandedId(focusItemId);
    for (const s of ['persona', 'characters', 'links', 'places'] as MemorySectionId[]) {
      const hit = memory[s].find((it) => it.id === focusItemId);
      if (hit?.isNew) {
        onMarkSeen(s, focusItemId);
        break;
      }
    }
  }, [focusItemId]);

  const sections = useMemo(() => {
    const all: MemorySectionId[] = ['persona', 'characters', 'links', 'places'];
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
            { id: 'persona' as const, label: 'Persona' },
            { id: 'characters' as const, label: 'Personnages' },
            { id: 'links' as const, label: 'Liens' },
            { id: 'places' as const, label: 'Lieux' },
          ]).map((t) => {
            const on = tab === t.id;
            const hasNew = t.id === 'all'
              ? (memory.persona.some((it) => it.isNew)
                || memory.characters.some((it) => it.isNew)
                || memory.links.some((it) => it.isNew)
                || memory.places.some((it) => it.isNew))
              : memory[t.id].some((it) => it.isNew);
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
                  {t.label}{hasNew ? ' 🔴' : ''}
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

        {(tab === 'all' || tab === 'persona') && personaBaseHint ? (
          <View style={{
            marginBottom: Spacing.md, padding: Spacing.sm, borderRadius: Radius.md,
            backgroundColor: ACCENT + '14', borderWidth: 1, borderColor: ACCENT + '44',
          }}>
            <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color: ACCENT, marginBottom: 4 }}>
              PERSONA DE BASE (référence — ne pas dupliquer)
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 16 }}>
              {personaBaseHint}
            </Text>
            <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>
              Ci-dessous : uniquement les faits appris en RP, différents de ces infos.
            </Text>
          </View>
        ) : null}

        {sections.map((section) => (
          <SectionBlock
            key={section}
            section={section}
            items={section === 'characters'
              ? memory.characters.filter((c) => !c.isPlayerPersona)
              : memory[section]}
            C={C}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onEditItem={onEditItem}
            onRemove={onRemove}
            onAdd={onAdd}
            onMarkSeen={onMarkSeen}
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
