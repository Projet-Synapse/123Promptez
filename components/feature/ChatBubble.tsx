// Theme fix: inline styles with useThemeColors()
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ChatMessage } from '@/contexts/BotContext';
import { MarkdownView } from '@/components/feature/Markdown';
import { ThinkingCard } from '@/components/feature/ThinkingCard';
import { QuestionnaireCard, QuestionnaireAnswer } from '@/components/feature/QuestionnaireCard';
import { parseSimulationRoleplayContent } from '@/services/simulationRoleplayFormat';
import { normalizeMemoryKey } from '@/types/simulationMemory';

const RP_ACCENT = '#9B59B6';

export type SimCharacterLook = {
  name: string;
  avatarUri?: string;
  avatarColor?: string;
};

interface ChatBubbleProps {
  message: ChatMessage;
  botName: string;
  botColor: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onRestartFromHere?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  emphasizeRegenerate?: boolean;
  questionnaireAnswered?: boolean;
  onAnswerQuestionnaire?: (answers: QuestionnaireAnswer[]) => void;
  onWikilinkPress?: (target: string) => void;
  /**
   * Simulation : pas de thinking, pas d’avatar LLM / label bot,
   * narration en italique, bulles personnage dédiées.
   */
  roleplayMode?: boolean;
  /** PNJ connus pour résoudre icône / couleur par nom */
  simCharacters?: SimCharacterLook[];
  /** Couleurs de thème par conversation (Simulation) — bulles */
  simThemeColors?: { userBubble?: string; assistantBubble?: string; accent?: string } | null;
  /** Persona joueur (photo dans les bulles user en Simulation) */
  personaLook?: SimCharacterLook | null;
}

function colorFromName(name: string): string {
  const palette = ['#9B59B6', '#3498DB', '#E67E22', '#1ABC9C', '#E74C3C', '#8E44AD', '#16A085', '#D35400'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function resolveLook(name: string, chars?: SimCharacterLook[]): SimCharacterLook {
  const key = normalizeMemoryKey(name);
  const hit = (chars ?? []).find((c) => normalizeMemoryKey(c.name) === key);
  return {
    name,
    avatarUri: hit?.avatarUri,
    avatarColor: hit?.avatarColor || colorFromName(name),
  };
}

function CharAvatar({ look, size = 28 }: { look: SimCharacterLook; size?: number }) {
  const bg = look.avatarColor || RP_ACCENT;
  if (look.avatarUri) {
    return (
      <Image
        source={{ uri: look.avatarUri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>
        {(look.name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function ChatBubble({
  message, botName, botColor, onCopy, onRegenerate, onEdit,
  onRestartFromHere, onDelete, showActions, emphasizeRegenerate,
  questionnaireAnswered, onAnswerQuestionnaire, onWikilinkPress,
  roleplayMode, simCharacters, simThemeColors, personaLook,
}: ChatBubbleProps) {
  const C = useThemeColors();
  const userBubbleBg = simThemeColors?.userBubble || C.primary;
  const charBubbleBg = simThemeColors?.assistantBubble || C.bgCard;
  const themeAccent = simThemeColors?.accent || RP_ACCENT;
  const [menuOpen, setMenuOpen] = useState(false);
  const isUser = message.role === 'user';
  const isToolResults = isUser && message.content.startsWith('[RÉSULTATS D\'OUTILS');
  const isQuestionnaireAnswers = isUser && message.content.startsWith('[RÉPONSES AU QUESTIONNAIRE]');
  const isSyntheticCard = isToolResults || isQuestionnaireAnswers;
  const hasLongPress = !isSyntheticCard && (!!onEdit || !!onRestartFromHere || !!onDelete || !!onCopy);
  const actionsVisible = !isSyntheticCard && showActions !== false && (
    !!onCopy || (!isUser && !!onRegenerate) || !!onEdit || !!onRestartFromHere || !!onDelete
  );

  const rpSegments = useMemo(() => {
    if (!roleplayMode || isUser) return null;
    return parseSimulationRoleplayContent(message.content);
  }, [roleplayMode, isUser, message.content]);

  if (isSyntheticCard) {
    return (
      <View style={{ alignSelf: 'center', width: '92%', marginVertical: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: isQuestionnaireAnswers ? '#00CC6A' + '55' : C.border, padding: Spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <MaterialIcons name={isQuestionnaireAnswers ? 'task-alt' : 'precision-manufacturing'} size={13} color={isQuestionnaireAnswers ? '#00CC6A' : C.accent} />
          <Text style={{ fontSize: FontSize.xs, color: isQuestionnaireAnswers ? '#00CC6A' : C.accent, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {isQuestionnaireAnswers ? 'Réponses au questionnaire' : 'Résultats d’outils — transmis à l’IA'}
          </Text>
        </View>
        <Text style={{ fontSize: 11, lineHeight: 16, color: C.textSecondary, fontFamily: 'monospace' }} numberOfLines={8}>
          {message.content.replace('[RÉPONSES AU QUESTIONNAIRE]\n', '').replace('[RÉSULTATS D\'OUTILS', '—')}
        </Text>
      </View>
    );
  }

  const openMenu = () => { if (hasLongPress) setMenuOpen(true); };

  const menuItems: { key: string; label: string; icon: React.ComponentProps<typeof MaterialIcons>['name']; color?: string; action?: () => void }[] = [
    onCopy ? { key: 'copy', label: 'Copier', icon: 'content-copy', action: onCopy } : null,
    onEdit ? { key: 'edit', label: 'Modifier', icon: 'edit', action: onEdit } : null,
    onRestartFromHere ? { key: 'restart', label: 'Repartir d’ici', icon: 'subdirectory-arrow-left', action: onRestartFromHere } : null,
    onDelete ? { key: 'delete', label: 'Supprimer', icon: 'delete-outline', color: C.error, action: onDelete } : null,
  ].filter(Boolean) as any[];

  const actionsRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4, marginLeft: roleplayMode && !isUser ? 0 : 4, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>
        {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </Text>
      {actionsVisible ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {onCopy ? (
            <Pressable onPress={onCopy} hitSlop={8} accessibilityLabel="Copier" style={({ pressed }) => [{ padding: 3, borderRadius: 4 }, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="content-copy" size={13} color={C.textMuted} />
            </Pressable>
          ) : null}
          {hasLongPress ? (
            <Pressable onPress={openMenu} hitSlop={8} accessibilityLabel="Options du message" style={({ pressed }) => [{ padding: 3, borderRadius: 4 }, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="more-horiz" size={14} color={C.textMuted} />
            </Pressable>
          ) : null}
          {!isUser && onRegenerate ? (
            emphasizeRegenerate ? (
              <Pressable
                onPress={onRegenerate}
                hitSlop={6}
                accessibilityLabel="Régénérer"
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill,
                  borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCardAlt,
                }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="refresh" size={13} color={C.textSecondary} />
                <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600' }}>Régénérer</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onRegenerate} hitSlop={8} accessibilityLabel="Régénérer" style={({ pressed }) => [{ padding: 3, borderRadius: 4 }, pressed && { opacity: 0.6 }]}>
                <MaterialIcons name="refresh" size={14} color={C.textMuted} />
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const menuModal = (
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={() => setMenuOpen(false)}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            backgroundColor: C.bgCard,
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.xl,
            paddingHorizontal: Spacing.md,
            gap: 2,
            borderWidth: Platform.OS === 'web' ? 1 : 0,
            borderColor: C.border,
            maxWidth: 480,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', marginBottom: Spacing.sm, letterSpacing: 0.5 }}>
            MESSAGE
          </Text>
          {menuItems.map((it) => (
            <Pressable
              key={it.key}
              onPress={() => { setMenuOpen(false); it.action?.(); }}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                paddingVertical: 14, paddingHorizontal: Spacing.sm, borderRadius: Radius.md,
              }, pressed && { backgroundColor: C.bgCardAlt }]}
            >
              <MaterialIcons name={it.icon} size={20} color={it.color || C.textPrimary} />
              <Text style={{ fontSize: FontSize.body, fontWeight: '600', color: it.color || C.textPrimary }}>{it.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ── Simulation RP : segments narration / personnage ──────────────────────
  if (roleplayMode && !isUser && rpSegments) {
    return (
      <View style={{ marginBottom: Spacing.md, gap: Spacing.sm }}>
        <Pressable
          onLongPress={openMenu}
          delayLongPress={380}
          {...(Platform.OS === 'web' ? { onContextMenu: (e: any) => { e?.preventDefault?.(); openMenu(); } } as any : null)}
        >
          <View style={{ gap: Spacing.sm }}>
            {/* Pas de ThinkingCard en Simulation */}
            {rpSegments.map((seg, idx) => {
              if (seg.kind === 'char') {
                const look = resolveLook(seg.name || 'Personnage', simCharacters);
                return (
                  <View
                    key={`char-${idx}-${look.name}`}
                    style={{
                      flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
                    }}
                  >
                    <CharAvatar look={look} />
                    <View style={{
                      flex: 1,
                      backgroundColor: charBubbleBg,
                      borderRadius: Radius.lg,
                      borderBottomLeftRadius: 4,
                      borderWidth: 1,
                      borderColor: (look.avatarColor || themeAccent) + '44',
                      paddingHorizontal: Spacing.md,
                      paddingVertical: Spacing.sm + 2,
                    }}>
                      <Text style={{
                        fontSize: FontSize.xs, fontWeight: '800', color: look.avatarColor || RP_ACCENT,
                        letterSpacing: 0.4, marginBottom: 4, textTransform: 'uppercase',
                      }}>
                        {look.name}
                      </Text>
                      <MarkdownView content={seg.content} variant="narration" onWikilinkPress={onWikilinkPress} />
                    </View>
                  </View>
                );
              }
              // Narration générale — pas d’icône LLM, italique
              return (
                <View key={`narr-${idx}`} style={{ paddingHorizontal: Spacing.xs }}>
                  <MarkdownView content={seg.content} variant="narration" onWikilinkPress={onWikilinkPress} />
                </View>
              );
            })}
            {message.questionnaire ? (
              <QuestionnaireCard
                data={message.questionnaire}
                answered={questionnaireAnswered}
                onSubmit={onAnswerQuestionnaire}
              />
            ) : null}
          </View>
        </Pressable>
        {actionsRow}
        {menuModal}
      </View>
    );
  }

  // ── Classique (et user Simulation) ───────────────────────────────────────
  return (
    <View style={{
      flexDirection: 'row',
      marginBottom: Spacing.md,
      gap: Spacing.sm,
      alignItems: 'flex-end',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      {!isUser ? (
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: botColor }}>
          <MaterialIcons name="smart-toy" size={14} color="#fff" />
        </View>
      ) : null}

      <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {!isUser ? (
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginBottom: 4, marginLeft: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {botName}
          </Text>
        ) : null}

        <Pressable
          onLongPress={openMenu}
          delayLongPress={380}
          {...(Platform.OS === 'web' ? { onContextMenu: (e: any) => { e?.preventDefault?.(); openMenu(); } } as any : null)}
          style={{ maxWidth: isUser ? '85%' : '100%', alignSelf: isUser ? 'flex-end' : 'stretch' }}
        >
          <View style={[
            isUser
              ? {
                  borderRadius: Radius.lg,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm + 2,
                  backgroundColor: userBubbleBg,
                  borderBottomRightRadius: 4,
                }
              : {
                  flex: 1,
                  paddingHorizontal: Spacing.xs,
                },
          ]}>
            {isUser ? (
              <MarkdownView content={message.content} variant="user" onWikilinkPress={onWikilinkPress} />
            ) : (
              <>
                {message.thinking ? <ThinkingCard text={message.thinking} /> : null}
                <MarkdownView content={message.content} variant="assistant" onWikilinkPress={onWikilinkPress} />
                {message.questionnaire ? (
                  <QuestionnaireCard
                    data={message.questionnaire}
                    answered={questionnaireAnswered}
                    onSubmit={onAnswerQuestionnaire}
                  />
                ) : null}
              </>
            )}
          </View>
        </Pressable>

        {message.toolsUsed && message.toolsUsed.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 4 }}>
            <MaterialIcons name="bolt" size={12} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.accent }}>{message.toolsUsed.join(', ')}</Text>
          </View>
        ) : null}

        {actionsRow}
      </View>

      {isUser ? (
        roleplayMode && personaLook ? (
          <CharAvatar look={personaLook} size={28} />
        ) : (
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: userBubbleBg }}>
            <MaterialIcons name="person" size={14} color="#fff" />
          </View>
        )
      ) : null}

      {menuModal}
    </View>
  );
}
