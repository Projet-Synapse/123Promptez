// Powered by OnSpace.AI
// Theme fix: inline styles with useThemeColors()
import React from 'react';
import { Pressable, Text } from 'react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const C = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        height: 36,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        backgroundColor: selected ? C.primary : C.bgCardAlt,
        borderColor: selected ? C.primaryLight : C.border,
      }, pressed && { opacity: 0.75 }]}
    >
      <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: selected ? '#fff' : C.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}
