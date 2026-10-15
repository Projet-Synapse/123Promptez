// ThinkingCard — bloc « Raisonnement » repliable (extended thinking Claude).
// En direct (live) : déplié et animé pendant que le raisonnement s'écrit ;
// une fois la génération finie : replié automatiquement, consultable à volonté.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ThinkingCardProps {
  text: string;
  /** true pendant la génération : spinner + repli automatique à la fin */
  live?: boolean;
  /** État ouvert initial (défaut : déplié si live, replié sinon) */
  defaultOpen?: boolean;
}

export function ThinkingCard({ text, live = false, defaultOpen }: ThinkingCardProps) {
  const C = useThemeColors();
  const [open, setOpen] = useState(defaultOpen ?? live);

  // Fin de génération → on replie (la réponse est là, le raisonnement reste
  // consultable en un tap — comme un « thought » repliable).
  useEffect(() => {
    if (!live) setOpen(defaultOpen ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  if (!text || text.trim().length === 0) return null;
  return (
    <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: live ? C.accent + '44' : C.border, marginBottom: Spacing.xs, overflow: 'hidden' }}>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityLabel={open ? 'Replier le raisonnement' : 'Déplier le raisonnement'} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }, pressed && { opacity: 0.7 }]}>
        <MaterialIcons name="psychology" size={14} color={C.accent} />
        <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '700', flex: 1 }}>Raisonnement</Text>
        {live ? <ActivityIndicator size="small" color={C.accent} /> : null}
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={16} color={C.textMuted} />
      </Pressable>
      {open ? (
        <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm + 2 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: FontSize.xs, lineHeight: 18, color: C.textMuted, fontStyle: 'italic' }}>{text}</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}
