// Powered by OnSpace.AI
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Toggle } from '@/components/ui/Toggle';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';

interface AgentToolRowProps {
  id: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

export function AgentToolRow({ label, icon, description, enabled, onToggle }: AgentToolRowProps) {
  return (
    <View style={[styles.row, enabled ? styles.rowEnabled : null]}>
      <View style={[styles.iconWrap, enabled ? styles.iconWrapEnabled : null]}>
        <MaterialIcons name={icon as any} size={20} color={enabled ? Colors.accent : Colors.textMuted} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, enabled ? styles.labelEnabled : null]}>{label}</Text>
        <Text style={styles.desc}>{description}</Text>
      </View>
      <Toggle value={enabled} onToggle={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rowEnabled: {
    borderColor: Colors.accentDim + '55',
    backgroundColor: Colors.accentGlow,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapEnabled: {
    backgroundColor: Colors.accent + '22',
  },
  content: { flex: 1 },
  label: { fontSize: FontSize.body, color: Colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  labelEnabled: { color: Colors.textPrimary },
  desc: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18 },
});
