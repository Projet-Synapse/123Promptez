// Global search — conversations, workspaces, KB/files/tags
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, Platform, useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommandPalette } from '@/contexts/CommandPaletteContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useBot } from '@/hooks/useBot';
import { useThemeColors } from '@/hooks/useThemeColors';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import type { DBFile, Workspace } from '@/contexts/WorkspaceContext';

type ResultKind = 'workspace' | 'conversation' | 'file' | 'kb' | 'tag' | 'action';

interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  run: () => void;
}

function collectFiles(ws: Workspace): { file: DBFile; path: string }[] {
  const out: { file: DBFile; path: string }[] = [];
  for (const f of ws.database.rootFiles) out.push({ file: f, path: 'Racine' });
  for (const folder of ws.database.folders) {
    for (const f of folder.files) out.push({ file: f, path: folder.name });
    for (const sub of folder.subFolders ?? []) {
      for (const f of sub.files) out.push({ file: f, path: `${folder.name} / ${sub.name}` });
    }
  }
  return out;
}

export function CommandPalette() {
  const C = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { open, closePalette } = useCommandPalette();
  const { workspaces, activeWorkspace, setActiveWorkspace, setActiveConversation, addConversation } = useWorkspace();
  const { bot } = useBot();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: SearchResult[] = [];

    // Quick actions always available
    if (!q || 'nouvelle conversation'.includes(q) || 'new'.includes(q)) {
      list.push({
        id: 'action-new-conv',
        kind: 'action',
        title: 'Nouvelle conversation',
        subtitle: activeWorkspace ? `Dans « ${activeWorkspace.name} »` : 'Workspace actif',
        icon: 'add-comment',
        color: C.accent,
        run: () => {
          const target = activeWorkspace ?? workspaces[0];
          if (!target) return;
          const id = addConversation(target.id);
          setActiveWorkspace(target.id);
          setActiveConversation(target.id, id);
          router.push('/(tabs)/chat' as any);
        },
      });
    }

    for (const ws of workspaces) {
      const wsMatch = !q || ws.name.toLowerCase().includes(q) || ws.description?.toLowerCase().includes(q);
      if (wsMatch) {
        list.push({
          id: `ws-${ws.id}`,
          kind: 'workspace',
          title: ws.name,
          subtitle: 'Workspace',
          icon: ws.icon || 'workspaces',
          color: ws.color,
          run: () => {
            setActiveWorkspace(ws.id);
            router.push('/(tabs)/workspaces' as any);
          },
        });
      }

      for (const conv of ws.conversations) {
        const hay = `${conv.title} ${conv.messages.slice(-2).map(m => m.content).join(' ')}`.toLowerCase();
        if (!q || hay.includes(q)) {
          list.push({
            id: `conv-${ws.id}-${conv.id}`,
            kind: 'conversation',
            title: conv.title,
            subtitle: `${ws.name} · ${conv.messages.length} msg`,
            icon: 'chat-bubble',
            color: ws.color,
            run: () => {
              setActiveWorkspace(ws.id);
              setActiveConversation(ws.id, conv.id);
              router.push('/(tabs)/chat');
            },
          });
        }
      }

      for (const { file, path } of collectFiles(ws)) {
        const tagHay = file.tags.join(' ').toLowerCase();
        const matchFile = !q || file.name.toLowerCase().includes(q) || file.content.toLowerCase().includes(q) || tagHay.includes(q);
        if (matchFile) {
          list.push({
            id: `file-${ws.id}-${file.id}`,
            kind: 'file',
            title: file.name,
            subtitle: `${ws.name} · ${path}`,
            icon: 'description',
            color: C.primary,
            run: () => {
              setActiveWorkspace(ws.id);
              router.push({ pathname: '/workspace-database', params: { id: ws.id } });
            },
          });
        }
        for (const tag of file.tags) {
          if (q && tag.toLowerCase().includes(q)) {
            list.push({
              id: `tag-${ws.id}-${file.id}-${tag}`,
              kind: 'tag',
              title: `#${tag}`,
              subtitle: `${file.name} · ${ws.name}`,
              icon: 'local-offer',
              color: C.warning,
              run: () => {
                setActiveWorkspace(ws.id);
                router.push({ pathname: '/workspace-database', params: { id: ws.id } });
              },
            });
          }
        }
      }
    }

    for (const kb of bot.kbSources) {
      const hay = `${kb.label} ${kb.content}`.toLowerCase();
      if (!q || hay.includes(q)) {
        list.push({
          id: `kb-${kb.id}`,
          kind: 'kb',
          title: kb.label,
          subtitle: `Base de connaissances · ${kb.type}`,
          icon: 'menu-book',
          color: C.accent,
          run: () => router.push('/(tabs)/index' as any),
        });
      }
    }

    // Deduplicate by id, cap results
    const seen = new Set<string>();
    return list.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).slice(0, 40);
  }, [query, workspaces, activeWorkspace, bot.kbSources, C, addConversation, setActiveWorkspace, setActiveConversation, router]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const runAt = (idx: number) => {
    const r = results[idx];
    if (!r) return;
    closePalette();
    r.run();
  };

  const kindLabel = (k: ResultKind) => {
    switch (k) {
      case 'workspace': return 'Workspace';
      case 'conversation': return 'Conversation';
      case 'file': return 'Fichier';
      case 'kb': return 'KB';
      case 'tag': return 'Tag';
      case 'action': return 'Action';
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closePalette}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-start', paddingTop: Math.max(insets.top, 48), paddingHorizontal: Spacing.md }}
        onPress={closePalette}
      >
        <Pressable
          onPress={() => {}}
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: Math.min(640, width - 24),
            backgroundColor: C.bgCard,
            borderRadius: Radius.lg,
            borderWidth: 1,
            borderColor: C.border,
            overflow: 'hidden',
            maxHeight: '80%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <MaterialIcons name="search" size={20} color={C.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher conversations, workspaces, fichiers, tags…"
              placeholderTextColor={C.textMuted}
              style={{ flex: 1, color: C.textPrimary, fontSize: FontSize.body, paddingVertical: Platform.OS === 'web' ? 10 : 8 }}
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={() => runAt(activeIdx)}
              onKeyPress={(e: any) => {
                const key = e?.nativeEvent?.key || e?.key;
                if (key === 'ArrowDown') {
                  e.preventDefault?.();
                  setActiveIdx(i => Math.min(i + 1, Math.max(results.length - 1, 0)));
                } else if (key === 'ArrowUp') {
                  e.preventDefault?.();
                  setActiveIdx(i => Math.max(i - 1, 0));
                } else if (key === 'Escape') {
                  closePalette();
                }
              }}
            />
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.sm, backgroundColor: C.bgCardAlt, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 10, color: C.textMuted, fontFamily: 'monospace' }}>Esc</Text>
            </View>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
            {results.length === 0 ? (
              <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
                <Text style={{ color: C.textMuted, fontSize: FontSize.sm }}>Aucun résultat</Text>
              </View>
            ) : (
              results.map((r, idx) => (
                <Pressable
                  key={r.id}
                  onPress={() => runAt(idx)}
                  onHoverIn={() => setActiveIdx(idx)}
                  style={({ pressed }) => [{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.sm,
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm + 2,
                    backgroundColor: idx === activeIdx ? C.primary + '18' : 'transparent',
                    borderLeftWidth: 2,
                    borderLeftColor: idx === activeIdx ? C.primary : 'transparent',
                  }, pressed && { opacity: 0.8 }]}
                >
                  <View style={{ width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: r.color + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={r.icon as any} size={16} color={r.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '600' }} numberOfLines={1}>{r.title}</Text>
                    {r.subtitle ? (
                      <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 1 }} numberOfLines={1}>{r.subtitle}</Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>{kindLabel(r.kind)}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
