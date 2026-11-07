/**
 * Sauvegardes & branches Simulation — créer un point, restaurer, brancher, supprimer.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { SimulationSave } from '@/types/simulationSaves';
import { formatClockFr } from '@/types/simulationClock';

const ACCENT = '#9B59B6';

type Props = {
  saves: SimulationSave[];
  onCreate: (label: string) => void;
  onRestore: (s: SimulationSave) => void;
  onBranch: (s: SimulationSave) => void;
  onDelete: (s: SimulationSave) => void;
  onClose: () => void;
};

export function SimulationSavesScreen({ saves, onCreate, onRestore, onBranch, onDelete, onClose }: Props) {
  const C = useThemeColors();
  const [label, setLabel] = useState('');
  const btn = (icon: string, text: string, onPress: () => void, color = ACCENT) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: Radius.pill, backgroundColor: color + '1A', borderWidth: 1, borderColor: color + '55',
      }, pressed && { opacity: 0.7 }]}
      accessibilityLabel={text}
    >
      <MaterialIcons name={icon as any} size={14} color={color} />
      <Text style={{ fontSize: FontSize.xs, fontWeight: '800', color }}>{text}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: C.border,
      }}>
        <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }} accessibilityLabel="Retour">
          <MaterialIcons name="arrow-back" size={22} color={C.textPrimary} />
        </Pressable>
        <MaterialIcons name="bookmarks" size={20} color={ACCENT} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.body, fontWeight: '800', color: C.textPrimary }}>Sauvegardes & branches</Text>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>Mémoire, inventaire, besoins et horloge inclus</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, alignItems: 'center' }}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Nom du point (optionnel)"
          placeholderTextColor={C.textMuted}
          style={{
            flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm,
            paddingHorizontal: Spacing.sm, paddingVertical: 8, color: C.textPrimary, backgroundColor: C.bgCardAlt,
          }}
        />
        {btn('save', 'Sauvegarder', () => { onCreate(label); setLabel(''); })}
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingTop: 0, gap: Spacing.sm }}>
        {saves.length === 0 ? (
          <Text style={{ color: C.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.lg }}>
            Aucune sauvegarde. Crée un point pour pouvoir y revenir ou brancher l’histoire.
          </Text>
        ) : null}
        {saves.map((s) => (
          <View key={s.id} style={{
            backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border,
            padding: Spacing.sm, gap: 6,
          }}>
            <Text style={{ fontSize: FontSize.body, fontWeight: '700', color: C.textPrimary }}>{s.label}</Text>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>
              {new Date(s.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              {' · '}{s.messageCount} message{s.messageCount > 1 ? 's' : ''}
              {s.clock ? ` · ${formatClockFr(s.clock)}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {btn('restore', 'Restaurer', () => onRestore(s))}
              {btn('call-split', 'Brancher', () => onBranch(s), '#3BA7FF')}
              {btn('delete-outline', 'Supprimer', () => onDelete(s), '#E53935')}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
