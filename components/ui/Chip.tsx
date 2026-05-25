// Powered by OnSpace.AI
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipDefault,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelDefault]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  chipDefault: {
    backgroundColor: Colors.bgCardAlt,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  label: { fontSize: FontSize.sm, fontWeight: '600' },
  labelDefault: { color: Colors.textSecondary },
  labelSelected: { color: '#fff' },
});
