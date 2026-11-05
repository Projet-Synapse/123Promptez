// Choix Classique / Simulation à la création d'une conversation.
import React from 'react';
import {
  Modal, View, Text, Pressable, Platform, useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ConversationKind } from '@/types/simulation';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Appelé avec le type choisi ; le parent crée la conversation et navigue. */
  onChoose: (kind: ConversationKind) => void;
}

const OPTIONS: {
  kind: ConversationKind;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  desc: string;
  accent: string;
}[] = [
  {
    kind: 'classique',
    icon: 'chat',
    title: 'Classique',
    desc: 'Discussion normale avec l’IA — prompts, outils, base de connaissances.',
    accent: '#3D7EFF',
  },
  {
    kind: 'simulation',
    icon: 'theater-comedy',
    title: 'Simulation',
    desc: 'Roleplay immersif : monde, personnages et mémoire (moteur RP à venir).',
    accent: '#9B59B6',
  },
];

export default function NewConversationModal({ visible, onClose, onChoose }: Props) {
  const C = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: isWide ? 'center' : 'flex-end',
          alignItems: 'center',
          padding: isWide ? Spacing.lg : 0,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            width: isWide ? Math.min(440, width - 48) : '100%',
            backgroundColor: C.bgCard,
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            borderBottomLeftRadius: isWide ? Radius.lg : 0,
            borderBottomRightRadius: isWide ? Radius.lg : 0,
            paddingTop: Spacing.lg,
            paddingHorizontal: Spacing.lg,
            paddingBottom: (isWide ? Spacing.lg : Math.max(insets.bottom, Spacing.md)) + Spacing.sm,
            gap: Spacing.md,
            borderWidth: Platform.OS === 'web' ? 1 : 0,
            borderColor: C.border,
            maxWidth: 480,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ fontSize: FontSize.lg, fontWeight: '700', color: C.textPrimary }}>
                Nouvelle conversation
              </Text>
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary }}>
                Quel type veux-tu ouvrir ?
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{ padding: 6, borderRadius: Radius.pill, backgroundColor: C.bgCardAlt }}
            >
              <MaterialIcons name="close" size={18} color={C.textMuted} />
            </Pressable>
          </View>

          <View style={{ gap: Spacing.sm }}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.kind}
                onPress={() => {
                  onChoose(opt.kind);
                  onClose();
                }}
                style={({ pressed }) => [{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: Spacing.md,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: opt.accent + '55',
                  backgroundColor: opt.accent + '12',
                }, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={opt.title}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: Radius.md,
                  backgroundColor: opt.accent + '28',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <MaterialIcons name={opt.icon} size={24} color={opt.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: FontSize.body, fontWeight: '700', color: C.textPrimary }}>
                    {opt.title}
                  </Text>
                  <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 16 }}>
                    {opt.desc}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={opt.accent} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
