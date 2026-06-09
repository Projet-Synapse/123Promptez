// Powered by OnSpace.AI
// Theme fix: inline styles with useThemeColors()
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Toggle } from '@/components/ui/Toggle';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

interface AgentToolRowProps {
  id: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

export function AgentToolRow({ label, icon, description, enabled, onToggle }: AgentToolRowProps) {
  const C = useThemeColors();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: enabled ? C.accentGlow : C.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: enabled ? C.accent + '44' : C.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: Radius.sm,
        backgroundColor: enabled ? C.accent + '22' : C.bgCardAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <MaterialIcons name={icon as any} size={20} color={enabled ? C.accent : C.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSize.body, color: enabled ? C.textPrimary : C.textSecondary, fontWeight: '600', marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: FontSize.sm, color: C.textMuted, lineHeight: 18 }}>{description}</Text>
      </View>
      <Toggle value={enabled} onToggle={onToggle} />
    </View>
  );
}
