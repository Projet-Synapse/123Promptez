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
  SimulationLifeStage,
  SimulationFeatureMessageItem,
} from '@/types/simulationFeatureContent';
import {
  emptyInventoryItem,
  emptyAlbumItem,
  emptySkillItem,
  emptyLifeStage,
  SKILL_MAX_LEVEL,
  SKILL_XP_PER_LEVEL,
  emptyFeatureMessageItem,
  addContactByNumber,
} from '@/types/simulationFeatureContent';

const ACCENT = '#9B59B6';

type Props = {
  featureId: SimulationFeatureId;
  content: SimulationFeatureContent;
  onChange: (next: SimulationFeatureContent) => void;
  onClose: () => void;
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
  title, subtitle, open, onToggle, onRemove, children, C, header,
}: {
  header?: React.ReactNode;
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
          {header}
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

export function SimulationFeatureScreen({ featureId, content, onChange, onClose }: Props) {
  const C = useThemeColors();
  const meta = SIMULATION_FEATURE_META[featureId];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skillsTab, setSkillsTab] = useState<'skills' | 'life'>('skills');
  const [dialValue, setDialValue] = useState('');
  const [dialError, setDialError] = useState<string | null>(null);
  const tryDial = () => {
    const res = addContactByNumber(content, dialValue);
    if (!res) { setDialError('Numéro introuvable'); return; }
    onChange(res.next);
    setDialValue('');
    setDialError(null);
  };

  const items = useMemo(() => {
    if (featureId === 'inventory') return content.inventory;
    if (featureId === 'album') return content.album;
    if (featureId === 'skills') return skillsTab === 'skills' ? content.skills : (content.lifeStages ?? []);
    return content.messages;
  }, [featureId, content, skillsTab]);

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
    } else if (featureId === 'skills' && skillsTab === 'life') {
      const it = emptyLifeStage({ title: 'Nouvelle étape de vie', updatedAt: now });
      onChange({ ...content, lifeStages: [it, ...(content.lifeStages ?? [])] });
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
      onChange({
        ...content,
        skills: content.skills.filter((x) => x.id !== id),
        lifeStages: (content.lifeStages ?? []).filter((x) => x.id !== id),
      });
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
  const patchLife = (id: string, patch: Partial<SimulationLifeStage>) => {
    onChange({
      ...content,
      lifeStages: (content.lifeStages ?? []).map((it) =>
        it.id === id ? emptyLifeStage({ ...it, ...patch, id, updatedAt: new Date().toISOString() }) : it,
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
        {featureId === 'skills' ? (
          <View style={{ flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.md }}>
            {([['skills', 'Compétences', 'trending-up'], ['life', 'Étapes de vie', 'flag']] as const).map(([id, label, icon]) => {
              const on = skillsTab === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => { setSkillsTab(id); setExpandedId(null); }}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    paddingVertical: 10, minHeight: 40, borderRadius: Radius.pill,
                    backgroundColor: on ? ACCENT + '22' : C.bgCardAlt,
                    borderWidth: 1, borderColor: on ? ACCENT + '66' : C.border,
                  }}
                >
                  <MaterialIcons name={icon} size={16} color={on ? ACCENT : C.textSecondary} />
                  <Text style={{ fontSize: FontSize.sm, lineHeight: 18, fontWeight: '700', color: on ? ACCENT : C.textSecondary }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
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

        {featureId === 'skills' && skillsTab === 'skills'
          ? content.skills.map((it) => {
            const pct = it.level >= SKILL_MAX_LEVEL ? 100 : Math.round((it.xp / SKILL_XP_PER_LEVEL) * 100);
            return (
              <CardShell
                key={it.id}
                title={`${it.name} · niv. ${it.level}/10`}
                subtitle={it.description}
                open={expandedId === it.id}
                onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
                onRemove={() => removeById(it.id)}
                C={C}
                header={
                  <View style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {Array.from({ length: SKILL_MAX_LEVEL }).map((_, i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1, height: 8, borderRadius: 2,
                            backgroundColor: i < it.level ? ACCENT : C.bgCardAlt,
                            borderWidth: 1, borderColor: i < it.level ? ACCENT : C.border,
                            overflow: 'hidden',
                          }}
                        >
                          {i === it.level && it.level < SKILL_MAX_LEVEL ? (
                            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: ACCENT + '88' }} />
                          ) : null}
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                      {it.level >= SKILL_MAX_LEVEL ? 'Niveau maximum' : `${it.xp}/${SKILL_XP_PER_LEVEL} XP vers le niveau ${it.level + 1}`}
                    </Text>
                  </View>
                }
              >
                <Field label="Nom" value={it.name} onChange={(v) => patchSkill(it.id, { name: v })} C={C} />
                <Field
                  label="Niveau (0–10)"
                  value={String(it.level)}
                  keyboardType="numeric"
                  onChange={(v) => patchSkill(it.id, { level: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })}
                  C={C}
                />
                <Field
                  label="XP (0–99)"
                  value={String(it.xp)}
                  keyboardType="numeric"
                  onChange={(v) => patchSkill(it.id, { xp: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 })}
                  C={C}
                />
                <Field label="Description" value={it.description} multiline onChange={(v) => patchSkill(it.id, { description: v })} C={C} />
                <Field
                  label="Notions acquises (une par ligne, « N: texte »)"
                  value={it.notions.map((n) => `${n.level}: ${n.text}`).join('\n')}
                  multiline
                  onChange={(v) => patchSkill(it.id, {
                    notions: v.split('\n').map((line) => {
                      const m = line.match(/^\s*(\d{1,2})\s*[:\-]\s*(.*)$/);
                      return m ? { level: parseInt(m[1], 10), text: m[2] } : { level: it.level, text: line };
                    }).filter((n) => n.text.trim()),
                  })}
                  C={C}
                />
              </CardShell>
            );
          })
          : null}

        {featureId === 'skills' && skillsTab === 'life'
          ? (content.lifeStages ?? []).map((it) => (
            <CardShell
              key={it.id}
              title={it.title}
              subtitle={[it.when, it.impact].filter(Boolean).join(' · ')}
              open={expandedId === it.id}
              onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
              onRemove={() => removeById(it.id)}
              C={C}
            >
              <Field label="Titre" value={it.title} onChange={(v) => patchLife(it.id, { title: v })} C={C} />
              <Field label="Description" value={it.description} multiline onChange={(v) => patchLife(it.id, { description: v })} C={C} />
              <Field label="Moment / date RP" value={it.when} onChange={(v) => patchLife(it.id, { when: v })} C={C} />
              <Field label="Impact sur l’avenir" value={it.impact} multiline onChange={(v) => patchLife(it.id, { impact: v })} C={C} />
            </CardShell>
          ))
          : null}

        {featureId === 'messages' ? (
          <View style={{ marginBottom: Spacing.md, gap: Spacing.xs }}>
            <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color: ACCENT, letterSpacing: 0.4 }}>
              CONTACTS
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginBottom: 4, lineHeight: 16 }}>
              Un personnage devient contact quand il t’a donné son numéro (xxx-xxx) et que tu le composes ici.
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
                <Text style={{ flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: C.textPrimary }}>{c.name}{c.number ? `  ·  ${c.number}` : ''}</Text>
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
            <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginTop: Spacing.sm }}>AJOUTER UN CONTACT</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TextInput
                value={dialValue}
                onChangeText={(v) => { setDialValue(v.replace(/[^0-9-]/g, '').slice(0, 7)); setDialError(null); }}
                placeholder="xxx-xxx"
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
                maxLength={7}
                onSubmitEditing={tryDial}
                style={{
                  flex: 1, borderWidth: 1, borderColor: dialError ? C.error : C.border, borderRadius: Radius.sm,
                  paddingHorizontal: Spacing.sm, paddingVertical: 8, color: C.textPrimary,
                  backgroundColor: C.bgCardAlt, fontSize: FontSize.body, letterSpacing: 2,
                }}
              />
              <Pressable
                onPress={tryDial}
                accessibilityLabel="Ajouter le contact"
                style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.sm, backgroundColor: ACCENT }, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="person-add" size={18} color="#fff" />
              </Pressable>
            </View>
            {dialError ? <Text style={{ fontSize: FontSize.xs, color: C.error }}>{dialError}</Text> : null}
            <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', marginTop: Spacing.sm }}>MON NUMÉRO (IMAGINAIRE)</Text>
            <TextInput
              value={content.personaNumber ?? ''}
              onChangeText={(v) => onChange({ ...content, personaNumber: v.replace(/[^0-9-]/g, '').slice(0, 7) || undefined })}
              placeholder="ex. 555-123"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              maxLength={7}
              style={{
                borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
                paddingHorizontal: Spacing.sm, paddingVertical: 8, color: C.textPrimary,
                backgroundColor: C.bgCardAlt, fontSize: FontSize.body, letterSpacing: 2,
              }}
            />
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
              {it.unknownSender && it.fromNumber ? (
                <Pressable
                  onPress={() => {
                    const res = addContactByNumber(content, it.fromNumber!);
                    if (res) onChange(res.next);
                  }}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: Spacing.sm }, pressed && { opacity: 0.7 }]}
                >
                  <MaterialIcons name="person-add" size={18} color={ACCENT} />
                  <Text style={{ fontSize: FontSize.sm, color: ACCENT, fontWeight: '700' }}>
                    Enregistrer {it.fromNumber}{it.suspicious ? ' (suspect)' : ''}
                  </Text>
                </Pressable>
              ) : null}
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
