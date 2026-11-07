/**
 * Module Besoins (façon Sims) — jauges 0–100, réglables à la main (−/+ par 10, tap sur la jauge).
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  NEED_KEYS, NEED_META, NEED_CRITICAL, needColor, type SimulationNeeds, type NeedKey,
} from '@/types/simulationNeeds';

const ACCENT = '#9B59B6';

type Props = {
  needs: SimulationNeeds;
  onChange: (n: SimulationNeeds) => void;
  onClose: () => void;
};

export function SimulationNeedsScreen({ needs, onChange, onClose }: Props) {
  const C = useThemeColors();
  const set = (k: NeedKey, v: number) => onChange({ ...needs, [k]: Math.max(0, Math.min(100, Math.round(v))) });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderBottomWidth: 1, borderColor: C.border,
      }}>
        <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }} accessibilityLabel="Retour">
          <MaterialIcons name="arrow-back" size={22} color={C.textPrimary} />
        </Pressable>
        <MaterialIcons name="favorite" size={20} color={ACCENT} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.body, fontWeight: '800', color: C.textPrimary }}>Besoins</Text>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>
            Baissent avec l’horloge, remontent avec les actions
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
        {NEED_KEYS.map((k) => {
          const v = needs[k];
          const col = needColor(v);
          return (
            <View key={k} style={{
              backgroundColor: C.bgCard, borderRadius: Radius.md, borderWidth: 1,
              borderColor: v <= NEED_CRITICAL ? col : C.border, padding: Spacing.sm, gap: 6,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name={NEED_META[k].icon as any} size={18} color={col} />
                <Text style={{ flex: 1, fontSize: FontSize.body, fontWeight: '700', color: C.textPrimary }}>
                  {NEED_META[k].label}
                </Text>
                {v <= NEED_CRITICAL ? (
                  <Text style={{ fontSize: 10, fontWeight: '800', color: col }}>CRITIQUE</Text>
                ) : null}
                <Text style={{ fontSize: FontSize.sm, fontWeight: '800', color: col, minWidth: 36, textAlign: 'right' }}>{v}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pressable onPress={() => set(k, v - 10)} hitSlop={8} accessibilityLabel={`Baisser ${NEED_META[k].label}`}>
                  <MaterialIcons name="remove-circle-outline" size={22} color={C.textSecondary} />
                </Pressable>
                <View style={{ flex: 1, flexDirection: 'row', height: 14, gap: 2 }}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <Pressable
                      key={i}
                      onPress={() => set(k, (i + 1) * 10)}
                      style={{ flex: 1, borderRadius: 3, backgroundColor: v >= (i + 1) * 10 - 5 ? col : C.bgCardAlt }}
                    />
                  ))}
                </View>
                <Pressable onPress={() => set(k, v + 10)} hitSlop={8} accessibilityLabel={`Augmenter ${NEED_META[k].label}`}>
                  <MaterialIcons name="add-circle-outline" size={22} color={C.textSecondary} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
