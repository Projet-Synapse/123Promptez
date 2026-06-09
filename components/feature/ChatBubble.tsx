// Powered by OnSpace.AI
// Theme fix: inline styles with useThemeColors()
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ChatMessage } from '@/contexts/BotContext';

interface ChatBubbleProps {
  message: ChatMessage;
  botName: string;
  botColor: string;
}

export function ChatBubble({ message, botName, botColor }: ChatBubbleProps) {
  const C = useThemeColors();
  const isUser = message.role === 'user';

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
          {
            maxWidth: '85%',
            borderRadius: Radius.lg,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm + 2,
          },
          isUser
            ? { backgroundColor: C.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
        ]}>
          <Text style={{ fontSize: FontSize.body, lineHeight: 22, color: isUser ? '#fff' : C.textPrimary }}>
            {message.content}
          </Text>
        </View>

        {message.toolsUsed && message.toolsUsed.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 4 }}>
            <MaterialIcons name="bolt" size={12} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.accent }}>{message.toolsUsed.join(', ')}</Text>
          </View>
        ) : null}

        <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 4, marginLeft: 4 }}>
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {isUser ? (
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: C.primary }}>
          <MaterialIcons name="person" size={14} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}
