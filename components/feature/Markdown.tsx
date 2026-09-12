// Powered by OnSpace.AI
// Rendu markdown des réponses IA — react-native-markdown-display (déjà installée)
// avec styles thématés + bouton « copier » sur les blocs de code.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useToast } from '@/contexts/ToastContext';

export function MarkdownView({ content }: { content: string }) {
  const C = useThemeColors();
  const { showToast } = useToast();
  const [copiedFence, setCopiedFence] = useState<string | null>(null);

  const styles = useMemo(() => ({
    body: { color: C.textPrimary, fontSize: FontSize.body, lineHeight: 22, maxWidth: '100%', flexShrink: 1 },
    heading1: { color: C.textPrimary, fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.xs },
    heading2: { color: C.textPrimary, fontSize: FontSize.md, fontWeight: '700', marginTop: Spacing.sm + 4, marginBottom: Spacing.xs },
    heading3: { color: C.textPrimary, fontSize: FontSize.body, fontWeight: '700', marginTop: Spacing.sm, marginBottom: Spacing.xs },
    heading4: { color: C.textPrimary, fontSize: FontSize.body, fontWeight: '600' },
    heading5: { color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
    heading6: { color: C.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
    hr: { backgroundColor: C.border, height: 1, marginVertical: Spacing.sm },
    strong: { fontWeight: '700', color: C.textPrimary },
    em: { fontStyle: 'italic' },
    s: { textDecorationLine: 'line-through' },
    link: { color: C.accent, textDecorationLine: 'underline' },
    blockquote: { backgroundColor: C.bgCardAlt, borderLeftColor: C.accent, borderLeftWidth: 3, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2, marginVertical: Spacing.xs },
    blockquote_text: { color: C.textSecondary, fontStyle: 'italic' },
    code_inline: { color: C.textMono, backgroundColor: C.bgCardAlt, fontFamily: 'monospace', fontSize: FontSize.sm, lineHeight: 20, paddingHorizontal: 4, borderRadius: 4 },
    fence: { backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border },
    bullet_list_icon: { color: C.accent, lineHeight: 22 },
    ordered_list_icon: { color: C.accent, lineHeight: 22 },
    list_item: { marginVertical: 1 },
    table: { borderWidth: 1, borderColor: C.border, borderRadius: Radius.sm },
    thead: { backgroundColor: C.bgCardAlt },
    th: { color: C.textPrimary, fontWeight: '700', padding: Spacing.xs, borderWidth: 0.5, borderColor: C.border },
    td: { color: C.textSecondary, padding: Spacing.xs, borderWidth: 0.5, borderColor: C.border },
  }), [C]);

  const rules = useMemo(() => ({
    // Bloc de code : en-tête avec bouton « copier »
    fence: (node: any, _children: any, _parent: any, rootStyles: any) => {
      const code = node?.content ?? node?.children?.[0]?.content ?? '';
      const key = node?.key ?? node?.sourceInfo?.ln ?? '';
      return (
        <View key={key} style={{ marginVertical: Spacing.sm, width: '100%', alignSelf: 'stretch', overflow: 'hidden', flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bgCard, borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md, borderWidth: 1, borderBottomWidth: 0, borderColor: C.border, paddingHorizontal: Spacing.sm, paddingVertical: 5 }}>
            <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'monospace', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm, backgroundColor: pressed ? C.bgCardAlt : 'transparent' }]}
              accessibilityLabel="Copier le code"
            >
              <MaterialIcons name={copiedFence === key ? 'check' : 'content-copy'} size={13} color={copiedFence === key ? C.accent : C.textSecondary} />
              <Text style={{ fontSize: 10, color: copiedFence === key ? C.accent : C.textSecondary, fontWeight: '700' }}>{copiedFence === key ? 'Copié' : 'Copier'}</Text>
            </Pressable>
          </View>
          <Text style={{ backgroundColor: C.bgCardAlt, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.sm, color: C.textMono, fontFamily: 'monospace', fontSize: FontSize.sm, lineHeight: 20, width: '100%', flexShrink: 1 }}>
            {code}
          </Text>
        </View>
      );
    },
    // Liens : ouverture sécurisée (garde native + http/https uniquement)
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
  }), [C, copiedFence, showToast]);

  return (
    <Markdown style={styles as any} rules={rules as any}>
      {content}
    </Markdown>
  );
}
