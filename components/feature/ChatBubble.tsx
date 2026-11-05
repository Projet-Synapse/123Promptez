// Theme fix: inline styles with useThemeColors()
import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ChatMessage } from '@/contexts/BotContext';
import { MarkdownView } from '@/components/feature/Markdown';
import { ThinkingCard } from '@/components/feature/ThinkingCard';
import { QuestionnaireCard, QuestionnaireAnswer } from '@/components/feature/QuestionnaireCard';

interface ChatBubbleProps {
  message: ChatMessage;
  botName: string;
  botColor: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  /** Éditer ce message (utilisateur ou assistant) */
  onEdit?: () => void;
  /** Repartir d'ici : garder ce message, tronquer la suite */
  onRestartFromHere?: () => void;
  /** Supprimer ce message */
  onDelete?: () => void;
  showActions?: boolean;
  /** Mettre en avant le bouton régénérer (Simulation) */
  emphasizeRegenerate?: boolean;
  questionnaireAnswered?: boolean;
  onAnswerQuestionnaire?: (answers: QuestionnaireAnswer[]) => void;
}

export function ChatBubble({
  message, botName, botColor, onCopy, onRegenerate, onEdit,
  onRestartFromHere, onDelete, showActions, emphasizeRegenerate,
  questionnaireAnswered, onAnswerQuestionnaire,
}: ChatBubbleProps) {
  const C = useThemeColors();
  const [menuOpen, setMenuOpen] = useState(false);
  const isUser = message.role === 'user';
  const isToolResults = isUser && message.content.startsWith('[RÉSULTATS D\'OUTILS');
  const isQuestionnaireAnswers = isUser && message.content.startsWith('[RÉPONSES AU QUESTIONNAIRE]');
  const isSyntheticCard = isToolResults || isQuestionnaireAnswers;
  const hasLongPress = !isSyntheticCard && (!!onEdit || !!onRestartFromHere || !!onDelete || !!onCopy);
  const actionsVisible = !isSyntheticCard && showActions !== false && (
    !!onCopy || (!isUser && !!onRegenerate) || !!onEdit || !!onRestartFromHere || !!onDelete
  );

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
                  backgroundColor: C.primary,
                  borderBottomRightRadius: 4,
                }
              : {
                  flex: 1,
                  paddingHorizontal: Spacing.xs,
                },
          ]}>
            {isUser ? (
              <MarkdownView content={message.content} variant="user" />
            ) : (
              <>
                {message.thinking ? <ThinkingCard text={message.thinking} /> : null}
                <MarkdownView content={message.content} variant="assistant" />
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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4, marginLeft: 4, flexWrap: 'wrap' }}>
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
      </View>

      {isUser ? (
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: C.primary }}>
          <MaterialIcons name="person" size={14} color="#fff" />
        </View>
      ) : null}

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
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', marginBottom: Spacing.sm, paddingHorizontal: 8 }}>
              OPTIONS DU MESSAGE
            </Text>
            {menuItems.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMenuOpen(false);
                  item.action?.();
                }}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                  paddingVertical: 14, paddingHorizontal: 12, borderRadius: Radius.md,
                }, pressed && { backgroundColor: C.bgCardAlt }]}
              >
                <MaterialIcons name={item.icon} size={20} color={item.color ?? C.textPrimary} />
                <Text style={{ fontSize: FontSize.body, color: item.color ?? C.textPrimary, fontWeight: '600' }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={({ pressed }) => [{
                marginTop: Spacing.sm, paddingVertical: 12, alignItems: 'center',
                borderRadius: Radius.md, backgroundColor: C.bgCardAlt,
              }, pressed && { opacity: 0.8 }]}
            >
              <Text style={{ color: C.textSecondary, fontWeight: '700' }}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
