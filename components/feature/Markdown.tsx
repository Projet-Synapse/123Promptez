// Rendu markdown des bulles chat — react-native-markdown-display + plugin [[wikilink]]
// (même règle que 123Écriture). Gras/italique via markdown-it standard.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useToast } from '@/contexts/ToastContext';
import { createChatMarkdownIt } from '@/services/markdownPlugins';

type NodeWithMeta = { key?: string; content?: string; sourceMeta?: { target?: string }; attributes?: { href?: string }; sourceInfo?: { info?: string; ln?: number }; children?: any[] };

export function MarkdownView({
  content,
  variant = 'assistant',
  onWikilinkPress,
}: {
  content: string;
  /** `user` = texte clair sur bulle colorée */
  variant?: 'assistant' | 'user';
  /** Clic sur [[lien]] — défaut : toast « Mémoire bientôt » */
  onWikilinkPress?: (target: string) => void;
}) {
  const C = useThemeColors();
  const { showToast } = useToast();
  const [copiedFence, setCopiedFence] = useState<string | null>(null);
  const markdownIt = useMemo(() => createChatMarkdownIt(), []);
  const isUser = variant === 'user';
  const textColor = isUser ? '#FFFFFF' : C.textPrimary;
  const mutedColor = isUser ? 'rgba(255,255,255,0.75)' : C.textSecondary;
  const wikiColor = isUser ? '#FFE08A' : C.accent;
  const codeBg = isUser ? 'rgba(0,0,0,0.2)' : C.bgCardAlt;

  const styles = useMemo(() => ({
    body: { color: textColor, fontSize: FontSize.body, lineHeight: 22, maxWidth: '100%', flexShrink: 1 },
    heading1: { color: textColor, fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.xs },
    heading2: { color: textColor, fontSize: FontSize.md, fontWeight: '700', marginTop: Spacing.sm + 4, marginBottom: Spacing.xs },
    heading3: { color: textColor, fontSize: FontSize.body, fontWeight: '700', marginTop: Spacing.sm, marginBottom: Spacing.xs },
    heading4: { color: textColor, fontSize: FontSize.body, fontWeight: '600' },
    heading5: { color: mutedColor, fontSize: FontSize.sm, fontWeight: '600' },
    heading6: { color: mutedColor, fontSize: FontSize.sm, fontWeight: '600' },
    hr: { backgroundColor: isUser ? 'rgba(255,255,255,0.3)' : C.border, height: 1, marginVertical: Spacing.sm },
    strong: { fontWeight: '700', color: textColor },
    em: { fontStyle: 'italic', color: textColor },
    s: { textDecorationLine: 'line-through' },
    link: { color: wikiColor, textDecorationLine: 'underline' },
    blockquote: {
      backgroundColor: codeBg, borderLeftColor: wikiColor, borderLeftWidth: 3,
      borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, marginVertical: Spacing.xs,
    },
    code_inline: {
      color: isUser ? '#E8FFF0' : C.textMono, backgroundColor: codeBg, fontFamily: 'monospace',
      fontSize: 12, lineHeight: 16, paddingHorizontal: 4, paddingVertical: 0, borderRadius: 4, alignSelf: 'center',
    },
    fence: { backgroundColor: codeBg, borderRadius: Radius.md, borderWidth: 1, borderColor: isUser ? 'rgba(255,255,255,0.25)' : C.border },
    bullet_list_icon: { color: wikiColor, lineHeight: 22 },
    ordered_list_icon: { color: wikiColor, lineHeight: 22 },
    list_item: { marginVertical: 1 },
    text: { color: textColor },
    table: { borderWidth: 1, borderColor: isUser ? 'rgba(255,255,255,0.3)' : C.border, borderRadius: Radius.sm },
    thead: { backgroundColor: codeBg },
    th: { color: textColor, fontWeight: '700', padding: Spacing.xs, borderWidth: 0.5, borderColor: isUser ? 'rgba(255,255,255,0.3)' : C.border },
    td: { color: mutedColor, padding: Spacing.xs, borderWidth: 0.5, borderColor: isUser ? 'rgba(255,255,255,0.3)' : C.border },
  }), [C, textColor, mutedColor, wikiColor, codeBg, isUser]);

  const handleWiki = (target: string) => {
    if (onWikilinkPress) onWikilinkPress(target);
    else showToast('Mémoire bientôt', { tone: 'info' });
  };

  const rules = useMemo(() => ({
    fence: (node: any, _children: any, _parent: any, _rootStyles: any) => {
      const code = node?.content ?? node?.children?.[0]?.content ?? '';
      const key = node?.key ?? node?.sourceInfo?.ln ?? '';
      return (
        <View key={key} style={{ marginVertical: Spacing.sm, width: '100%', alignSelf: 'stretch', overflow: 'hidden', flexShrink: 1 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: isUser ? 'rgba(0,0,0,0.25)' : C.bgCard,
            borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md,
            borderWidth: 1, borderBottomWidth: 0, borderColor: isUser ? 'rgba(255,255,255,0.25)' : C.border,
            paddingHorizontal: Spacing.sm, paddingVertical: 5,
          }}>
            <Text style={{ fontSize: 10, color: mutedColor, fontFamily: 'monospace', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {node?.sourceInfo?.info || 'code'}
            </Text>
            <Pressable
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(code);
                  setCopiedFence(key);
                  setTimeout(() => setCopiedFence(null), 1600);
                  showToast('Code copié', { tone: 'success' });
                } catch {
                  showToast('Impossible de copier', { tone: 'error' });
                }
              }}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm, backgroundColor: pressed ? codeBg : 'transparent' }]}
              accessibilityLabel="Copier le code"
            >
              <MaterialIcons name={copiedFence === key ? 'check' : 'content-copy'} size={13} color={copiedFence === key ? wikiColor : mutedColor} />
              <Text style={{ fontSize: 10, color: copiedFence === key ? wikiColor : mutedColor, fontWeight: '700' }}>{copiedFence === key ? 'Copié' : 'Copier'}</Text>
            </Pressable>
          </View>
          <Text style={{
            backgroundColor: codeBg, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md,
            borderWidth: 1, borderColor: isUser ? 'rgba(255,255,255,0.25)' : C.border,
            paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
            color: isUser ? '#E8FFF0' : C.textMono, fontFamily: 'monospace', fontSize: 11, lineHeight: 16,
            width: '100%', flexShrink: 1,
          }}>
            {code}
          </Text>
        </View>
      );
    },
    link: (node: any, children: any, _parent: any, rootStyles: any) => (
      <Text
        key={node.key}
        style={rootStyles.link}
        onPress={() => {
          const url = node?.attributes?.href;
          if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            Linking.openURL(url).catch(() => {});
          }
        }}
      >
        {children}
      </Text>
    ),
    // [[cible]] / [[cible|alias]] — style distinct, clic → mémoire (plus tard)
    wikilink: (node: NodeWithMeta) => {
      const target = String(node.sourceMeta?.target ?? node.content ?? '');
      const label = String(node.content ?? target);
      return (
        <Text
          key={node.key}
          style={{
            color: wikiColor,
            textDecorationLine: 'underline',
            fontWeight: '700',
            backgroundColor: isUser ? 'rgba(0,0,0,0.18)' : C.accent + '22',
            borderRadius: 4,
            paddingHorizontal: 3,
            overflow: 'hidden',
          }}
          onPress={() => handleWiki(target)}
          accessibilityRole="link"
          accessibilityLabel={`Lien interne : ${label}`}
        >
          {label}
        </Text>
      );
    },
  }), [C, copiedFence, showToast, isUser, mutedColor, wikiColor, codeBg, onWikilinkPress]);

  return (
    <Markdown markdownit={markdownIt} style={styles as any} rules={rules as any}>
      {content}
    </Markdown>
  );
}
