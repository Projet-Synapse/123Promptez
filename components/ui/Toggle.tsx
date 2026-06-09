// Powered by OnSpace.AI
// Theme fix: inline styles with useThemeColors()
import React from 'react';
import { Pressable, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ToggleProps {
  value: boolean;
  onToggle: () => void;
}

export function Toggle({ value, onToggle }: ToggleProps) {
  const C = useThemeColors();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        paddingHorizontal: 3,
        backgroundColor: value ? C.accent : C.bgCardAlt,
        borderWidth: value ? 0 : 1,
        borderColor: C.border,
      }}
    >
      <View style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#fff',
        alignSelf: value ? 'flex-end' : 'flex-start',
      }} />
    </Pressable>
  );
}
