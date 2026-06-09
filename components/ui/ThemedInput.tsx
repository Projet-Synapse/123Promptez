// Powered by OnSpace.AI
// Theme fix: inline styles with useThemeColors() — no StyleSheet.create() with static Colors
import React from 'react';
import { TextInput, Text, View, TextInputProps } from 'react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ThemedInputProps extends TextInputProps {
  label?: string;
  mono?: boolean;
}

export function ThemedInput({ label, mono, style, ...props }: ThemedInputProps) {
  const C = useThemeColors();
  return (
    <View style={{ gap: Spacing.xs }}>
      {label ? (
        <Text style={{
          fontSize: FontSize.sm,
          color: C.textSecondary,
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        style={[{
          backgroundColor: C.bgCardAlt,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm + 4,
          color: mono ? C.textMono : C.textPrimary,
          fontSize: mono ? FontSize.sm : FontSize.body,
          fontFamily: mono ? 'monospace' : undefined,
        }, style]}
        placeholderTextColor={C.textMuted}
        {...props}
      />
    </View>
  );
}
