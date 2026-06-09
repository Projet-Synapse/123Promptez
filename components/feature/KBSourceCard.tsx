// Powered by OnSpace.AI
// Theme fix: inline styles with useThemeColors()
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { KBSource } from '@/contexts/BotContext';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

const KB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  text: 'text-fields',
  file: 'upload-file',
  url: 'link',
  faq: 'question-answer',
  schema: 'account-tree',
  image: 'image',
};

const KB_COLORS: Record<string, string> = {
  text: '#3D7EFF',
  file: '#FF6B35',
  url: '#9B59B6',
  faq: '#00CC6A',
  schema: '#FFB800',
  image: '#00CC6A',
};

interface KBSourceCardProps {
  source: KBSource;
  onRemove: (id: string) => void;
}

export function KBSourceCard({ source, onRemove }: KBSourceCardProps) {
  const C = useThemeColors();
  const color = KB_COLORS[source.type] || C.primary;
  const icon = KB_ICONS[source.type] || 'text-fields';

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: C.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    }}>
      <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>{source.label}</Text>
        <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, marginBottom: 6, lineHeight: 18 }} numberOfLines={2}>{source.content}</Text>
        <Text style={{ fontSize: FontSize.xs, color: C.textMuted, letterSpacing: 0.5 }}>{source.type.toUpperCase()} · {new Date(source.addedAt).toLocaleDateString('fr-FR')}</Text>
      </View>
      <Pressable onPress={() => onRemove(source.id)} hitSlop={8} style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}>
        <MaterialIcons name="close" size={18} color={C.textMuted} />
      </Pressable>
    </View>
  );
}
