// Powered by OnSpace.AI
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { KBSource } from '@/contexts/BotContext';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';

const KB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  text: 'text-fields',
  file: 'upload-file',
  url: 'link',
  faq: 'question-answer',
  schema: 'account-tree',
};

const KB_COLORS: Record<string, string> = {
  text: '#3D7EFF',
  file: '#FF6B35',
  url: '#9B59B6',
  faq: '#00CC6A',
  schema: '#FFB800',
};

interface KBSourceCardProps {
  source: KBSource;
  onRemove: (id: string) => void;
}

export function KBSourceCard({ source, onRemove }: KBSourceCardProps) {
  const color = KB_COLORS[source.type] || Colors.primary;
  const icon = KB_ICONS[source.type] || 'text-fields';

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label} numberOfLines={1}>{source.label}</Text>
        <Text style={styles.preview} numberOfLines={2}>{source.content}</Text>
        <Text style={styles.meta}>{source.type.toUpperCase()} · {new Date(source.addedAt).toLocaleDateString('fr-FR')}</Text>
      </View>
      <Pressable
        onPress={() => onRemove(source.id)}
        hitSlop={8}
        style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
      >
        <MaterialIcons name="close" size={18} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  label: { fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '600', marginBottom: 4 },
  preview: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6, lineHeight: 18 },
  meta: { fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 0.5 },
  removeBtn: { padding: 4 },
});
