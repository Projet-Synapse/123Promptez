// Powered by OnSpace.AI
import React from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';

interface ThemedInputProps extends TextInputProps {
  label?: string;
  mono?: boolean;
}

export function ThemedInput({ label, mono, style, ...props }: ThemedInputProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, mono ? styles.mono : null, style]}
        placeholderTextColor={Colors.textMuted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    color: Colors.textPrimary,
    fontSize: FontSize.body,
  },
  mono: {
    fontFamily: 'monospace',
    color: Colors.textMono,
    fontSize: FontSize.sm,
  },
});
