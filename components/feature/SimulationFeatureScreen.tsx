/**
 * Squelette d'écran pour un module gameplay Simulation (inventaire, album, …).
 * Remplissage par le moteur : plus tard — ici titre + état vide.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  SIMULATION_FEATURE_META,
  type SimulationFeatureId,
} from '@/types/simulation';

const ACCENT = '#9B59B6';

export function SimulationFeatureScreen({
  featureId,
  onClose,
}: {
  featureId: SimulationFeatureId;
  onClose: () => void;
}) {
  const C = useThemeColors();
  const meta = SIMULATION_FEATURE_META[featureId];

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
            ROLEPLAY · MODULE
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1, padding: Spacing.lg,
          alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: ACCENT + '18', alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: ACCENT + '44',
        }}>
          <MaterialIcons name={meta.icon as any} size={34} color={ACCENT} />
        </View>
        <Text style={{ fontSize: FontSize.lg, fontWeight: '700', color: C.textPrimary, textAlign: 'center' }}>
          {meta.label}
        </Text>
        <Text style={{
          fontSize: FontSize.body, color: C.textSecondary, textAlign: 'center',
          lineHeight: 22, maxWidth: 360,
        }}>
          {meta.emptyHint}
        </Text>
        <View style={{
          marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
          borderRadius: Radius.pill, backgroundColor: C.bgCardAlt, borderWidth: 1, borderColor: C.border,
        }}>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '600' }}>
            Module activé — contenu à venir
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

