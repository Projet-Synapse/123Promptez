// Theme fix: inline styles with useThemeColors()
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ChatMessage } from '@/contexts/BotContext';
import { MarkdownView } from '@/components/feature/Markdown';

interface ChatBubbleProps {
  message: ChatMessage;
  botName: string;
  botColor: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  /** Éditer ce message utilisateur (reprise de la conversation à partir de lui) */
  onEdit?: () => void;
  showActions?: boolean;
}

export function ChatBubble({ message, botName, botColor, onCopy, onRegenerate, onEdit, showActions }: ChatBubbleProps) {
  const C = useThemeColors();
  const isUser = message.role === 'user';
  const actionsVisible = showActions !== false && (!!onCopy || (!isUser && !!onRegenerate) || (isUser && !!onEdit));

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

        <View style={[
          isUser
            ? {
                maxWidth: '85%',
                borderRadius: Radius.lg,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm + 2,
                backgroundColor: C.primary,
                borderBottomRightRadius: 4,
              }
            : {
                // Réponse de l'IA SANS bulle : texte étalé sur toute la largeur,
                // rendu en markdown (titres, listes, blocs de code copiables)
                flex: 1,
                paddingHorizontal: Spacing.xs,
              },
        ]}>
          {isUser ? (
            <Text style={{ fontSize: FontSize.body, lineHeight: 22, color: '#fff' }}>
              {message.content}
            </Text>
          ) : (
            <MarkdownView content={message.content} />
          )}
        </View>

        {message.toolsUsed && message.toolsUsed.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 4 }}>
            <MaterialIcons name="bolt" size={12} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.accent }}>{message.toolsUsed.join(', ')}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4, marginLeft: 4 }}>
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
              {isUser && onEdit ? (
                <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Modifier le message" style={({ pressed }) => [{ padding: 3, borderRadius: 4 }, pressed && { opacity: 0.6 }]}>
                  <MaterialIcons name="edit" size={13} color={C.textMuted} />
                </Pressable>
              ) : null}
              {!isUser && onRegenerate ? (
                <Pressable onPress={onRegenerate} hitSlop={8} accessibilityLabel="Régénérer" style={({ pressed }) => [{ padding: 3, borderRadius: 4 }, pressed && { opacity: 0.6 }]}>
                  <MaterialIcons name="refresh" size={14} color={C.textMuted} />
                </Pressable>
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
    </View>
  );
}
