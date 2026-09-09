// WorkspaceSidePanel — panneau latéral droit façon Grok :
// accès direct aux fichiers du workspace, aux instructions et à des sites web / sandbox.
import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { IconButton } from '@/components/ui/IconButton';
import type { Workspace, DBFile, DBFolder } from '@/contexts/WorkspaceContext';

type PanelTab = 'files' | 'instructions' | 'web';

// iframe n'existe que sur web — on le crée dynamiquement pour éviter le crash natif.
const Iframe: React.FC<{ src: string; onLoad?: () => void }> = Platform.OS === 'web'
  ? (props) => (React as any).createElement('iframe', {
      src: props.src,
      title: 'web-preview',
      style: { flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' },
      sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
      onLoad: props.onLoad,
    })
  : () => null;

const FILE_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  note: { label: 'Note', icon: 'sticky-note-2', color: '#FFB800' },
  markdown: { label: 'Markdown', icon: 'article', color: '#3D7EFF' },
  text: { label: 'Texte brut', icon: 'text-snippet', color: '#8899BB' },
  url: { label: 'URL', icon: 'link', color: '#00CC6A' },
  json: { label: 'JSON', icon: 'data-object', color: '#FF6B35' },
  code: { label: 'Code', icon: 'code', color: '#9B59B6' },
};

function fileTypeInfo(type: string) {
  return FILE_TYPES[type] ?? FILE_TYPES.text;
}

// ─── Onglet Fichiers ──────────────────────────────────────────────────────────
function FilesTab({ workspace, onOpenFull }: { workspace: Workspace; onOpenFull: () => void }) {
  const C = useThemeColors();
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<DBFile | null>(null);

  const toggleFolder = (id: string) => setOpenFolderIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const rows: { key: string; folder: DBFolder; depth: number }[] = [];
  for (const folder of workspace.database.folders) {
    rows.push({ key: folder.id, folder, depth: 0 });
    if (openFolderIds.has(folder.id)) {
      for (const sub of folder.subFolders ?? []) {
        rows.push({ key: `${folder.id}/${sub.id}`, folder: sub as unknown as DBFolder, depth: 1 });
      }
    }
  }

  const fileChip = (file: DBFile, depth: number) => {
    const info = fileTypeInfo(file.type);
    const active = selectedFile?.id === file.id;
    return (
      <Pressable
        key={file.id}
        onPress={() => setSelectedFile(file)}
        style={({ pressed }) => [{
          flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
          paddingVertical: 6, paddingHorizontal: Spacing.sm, marginLeft: depth * Spacing.md,
          borderRadius: Radius.sm, backgroundColor: active ? C.accent + '18' : 'transparent',
        }, pressed && { opacity: 0.7 }]}
      >
        <MaterialIcons name={info.icon as any} size={14} color={info.color} />
        <Text style={{ flex: 1, fontSize: FontSize.sm, color: active ? C.accent : C.textSecondary }} numberOfLines={1}>{file.name}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.sm, gap: 2 }} showsVerticalScrollIndicator={false}>
        {/* Fichiers racine */}
        {workspace.database.rootFiles.map(f => fileChip(f, 0))}

        {/* Dossiers dépliables (vault inclus) */}
        {rows.map(({ key, folder, depth }) => {
          const open = openFolderIds.has(folder.id);
          return (
            <View key={key}>
              <Pressable
                onPress={() => toggleFolder(folder.id)}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 7, paddingHorizontal: Spacing.sm, marginLeft: depth * Spacing.md, borderRadius: Radius.sm }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name={open ? 'folder-open' : (folder.icon as any) || 'folder'} size={16} color={folder.color} />
                <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600' }} numberOfLines={1}>{folder.name}</Text>
                {folder.vault ? (
                  <View style={{ backgroundColor: (folder.color || '#9B59B6') + '22', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, color: folder.color || '#9B59B6', fontWeight: '700' }}>vault</Text>
                  </View>
                ) : null}
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={14} color={C.textMuted} />
              </Pressable>
              {open ? folder.files.map(f => fileChip(f, depth + 1)) : null}
            </View>
          );
        })}

        {workspace.database.rootFiles.length === 0 && workspace.database.folders.length === 0 ? (
          <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center', paddingVertical: Spacing.lg }}>
            Aucun fichier dans ce workspace
          </Text>
        ) : null}
      </ScrollView>

      {/* Aperçu du fichier sélectionné */}
      {selectedFile ? (
        <View style={{ maxHeight: '55%', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgCard, padding: Spacing.md, gap: Spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name={fileTypeInfo(selectedFile.type).icon as any} size={16} color={fileTypeInfo(selectedFile.type).color} />
            <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{selectedFile.name}</Text>
            <IconButton icon="close" label="Fermer l aperçu" bare size={16} color={C.textSecondary} onPress={() => setSelectedFile(null)} />
          </View>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 17, fontFamily: selectedFile.type === 'code' || selectedFile.type === 'json' ? 'monospace' : undefined }}>
              {selectedFile.content || '(Contenu vide)'}
            </Text>
          </ScrollView>
          <Pressable onPress={onOpenFull} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.xs + 2, borderRadius: Radius.md, backgroundColor: C.accent + '18', borderWidth: 1, borderColor: C.accent + '44' }, pressed && { opacity: 0.75 }]}>
            <MaterialIcons name="open-in-new" size={13} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Gérer dans la base de données</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ─── Onglet Instructions ──────────────────────────────────────────────────────
function InstructionsTab({ workspace, onEdit }: { workspace: Workspace; onEdit: () => void }) {
  const C = useThemeColors();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, lineHeight: 20, fontFamily: 'monospace' }}>
        {workspace.systemPrompt || 'Aucune instruction définie pour ce workspace. Ajoutez-en dans les paramètres du workspace.'}
      </Text>
      <Pressable onPress={onEdit} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: workspace.color + '22', borderWidth: 1, borderColor: workspace.color + '55' }, pressed && { opacity: 0.75 }]}>
        <MaterialIcons name="edit" size={14} color={workspace.color} />
        <Text style={{ fontSize: FontSize.sm, color: workspace.color, fontWeight: '700' }}>Modifier les instructions</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Onglet Web ───────────────────────────────────────────────────────────────
function WebTab({ workspaceName }: { workspaceName: string }) {
  const C = useThemeColors();
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const normalize = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

  const openHere = (target?: string) => {
    const t = (target ?? url).trim();
    if (!t) return;
    const full = normalize(t);
    setLoading(true);
    setLoadedUrl(full);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Barre d'adresse */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <TextInput
          style={{ flex: 1, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: Spacing.sm, paddingVertical: 6, color: C.textPrimary, fontSize: FontSize.sm }}
          value={url}
          onChangeText={setUrl}
          placeholder="https://… (site à consulter)"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={() => openHere()}
        />
        <IconButton icon="arrow-forward" label="Charger" onPress={() => openHere()} bare size={18} color={C.accent} />
      </View>

      {/* Raccourcis */}
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs }}>
        {[
          { label: 'Sandbox', icon: 'code', url: 'https://codesandbox.io/embed/new?theme=dark' },
          { label: 'GitHub', icon: 'code', url: 'https://github.com/Projet-Synapse' },
          { label: 'StackBlitz', icon: 'bolt', url: 'https://stackblitz.com/edit/vitejs-vite?embed=1&view=editor&theme=dark' },
        ].map(s => (
          <Pressable key={s.label} onPress={() => { setUrl(s.url); openHere(s.url); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCardAlt }}>
            <MaterialIcons name={s.icon as any} size={12} color={C.textSecondary} />
            <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, fontWeight: '600' }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Zone d'affichage */}
      <View style={{ flex: 1, backgroundColor: C.bgCardAlt }}>
        {loadedUrl ? (
          Platform.OS === 'web' ? (
            <View style={{ flex: 1 }}>
              {loading ? <ActivityIndicator color={C.accent} style={{ position: 'absolute', top: 20, alignSelf: 'center', zIndex: 2 }} /> : null}
              <Iframe src={loadedUrl} onLoad={() => setLoading(false)} />
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg }}>
              <MaterialIcons name="public" size={32} color={C.textMuted} />
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>L'affichage intégré n'est disponible que sur la version web.</Text>
            </View>
          )
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg }}>
            <MaterialIcons name="language" size={36} color={C.textMuted} />
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>
              Saisissez une URL pour consulter un site directement ici, sans quitter la conversation de {workspaceName}.
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, textAlign: 'center', marginTop: Spacing.xs }}>
              Certains sites refusent l'intégration (X-Frame-Options). Dans ce cas :
            </Text>
            <Pressable
              onPress={() => { if (typeof window !== 'undefined') window.open(loadedUrl, '_blank', 'noopener'); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: C.accent + '18', borderWidth: 1, borderColor: C.accent + '44' }}
            >
              <MaterialIcons name="open-in-new" size={13} color={C.accent} />
              <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Ouvrir dans un nouvel onglet</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Panneau principal ────────────────────────────────────────────────────────
export function WorkspaceSidePanel({
  visible, onClose, workspace, onOpenDatabase, onOpenSettings,
}: {
  visible: boolean;
  onClose: () => void;
  workspace: Workspace;
  onOpenDatabase: () => void;
  onOpenSettings: () => void;
}) {
  const C = useThemeColors();
  const [tab, setTab] = useState<PanelTab>('files');
  if (!visible) return null;

  const tabs: { id: PanelTab; label: string; icon: string }[] = [
    { id: 'files', label: 'Fichiers', icon: 'folder-open' },
    { id: 'instructions', label: 'Instructions', icon: 'psychology' },
    { id: 'web', label: 'Sites', icon: 'language' },
  ];

  return (
    <View style={{
      position: 'absolute', top: 0, bottom: 0, right: 0, width: '100%', maxWidth: 420,
      backgroundColor: C.bgCard, borderLeftWidth: 1, borderLeftColor: C.border, zIndex: 110,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
    }}>
      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: workspace.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={workspace.icon as any} size={15} color={workspace.color} />
        </View>
        <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{workspace.name}</Text>
        <IconButton icon="open-in-new" label="Base de données complète" onPress={onOpenDatabase} bare size={18} color={C.textSecondary} />
        <IconButton icon="close" label="Fermer le panneau" onPress={onClose} bare size={20} color={C.textSecondary} />
      </View>

      {/* Onglets */}
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.sm, paddingTop: 6 }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={({ pressed }) => [{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                paddingVertical: 7, borderRadius: Radius.md,
                backgroundColor: active ? C.accent + '18' : 'transparent',
                borderWidth: 1, borderColor: active ? C.accent + '44' : 'transparent',
              }, pressed && { opacity: 0.75 }]}
            >
              <MaterialIcons name={t.icon as any} size={14} color={active ? C.accent : C.textMuted} />
              <Text style={{ fontSize: FontSize.xs, color: active ? C.accent : C.textMuted, fontWeight: '700' }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Contenu — onglets gardés montés pour préserver l'état (dossiers dépliés, aperçu, URL) */}
      <View style={{ flex: 1, marginTop: 6 }}>
        <View style={{ flex: 1, display: tab === 'files' ? 'flex' : 'none' }}>
          <FilesTab workspace={workspace} onOpenFull={onOpenDatabase} />
        </View>
        <View style={{ flex: 1, display: tab === 'instructions' ? 'flex' : 'none' }}>
          <InstructionsTab workspace={workspace} onEdit={onOpenSettings} />
        </View>
        <View style={{ flex: 1, display: tab === 'web' ? 'flex' : 'none' }}>
          <WebTab workspaceName={workspace.name} />
        </View>
      </View>
    </View>
  );
}
