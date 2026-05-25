// Powered by OnSpace.AI
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import { ChatMessage } from '@/contexts/BotContext';

interface ChatBubbleProps {
  message: ChatMessage;
  botName: string;
  botColor: string;
}

export function ChatBubble({ message, botName, botColor }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      {!isUser ? (
        <View style={[styles.avatar, { backgroundColor: botColor }]}>
          <MaterialIcons name="smart-toy" size={14} color="#fff" />
        </View>
      ) : null}
      <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {!isUser ? <Text style={styles.senderName}>{botName}</Text> : null}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.text, isUser ? styles.userText : styles.botText]}>
            {message.content}
          </Text>
        </View>
        {message.toolsUsed && message.toolsUsed.length > 0 ? (
          <View style={styles.toolsRow}>
            <MaterialIcons name="bolt" size={12} color={Colors.accent} />
            <Text style={styles.toolsText}>{message.toolsUsed.join(', ')}</Text>
          </View>
        ) : null}
        <Text style={styles.time}>
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {isUser ? (
        <View style={[styles.avatar, styles.userAvatar]}>
          <MaterialIcons name="person" size={14} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'flex-end',
  },
  userContainer: { justifyContent: 'flex-end' },
  botContainer: { justifyContent: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatar: { backgroundColor: Colors.primary },
  senderName: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
    marginLeft: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  text: { fontSize: FontSize.body, lineHeight: 22 },
  userText: { color: '#fff' },
  botText: { color: Colors.textPrimary },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
  },
  toolsText: { fontSize: FontSize.xs, color: Colors.accent },
  time: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, marginLeft: 4 },
});
