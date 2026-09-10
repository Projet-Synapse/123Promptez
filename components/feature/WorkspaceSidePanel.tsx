// WorkspaceSidePanel — panneau latéral droit façon Grok :
// accès direct aux fichiers du workspace (avec glisser-déposer), aux
// instructions, aux dépôts de code connectés et à des sites web / sandbox.
import React, { useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { IconButton } from '@/components/ui/IconButton';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/contexts/ToastContext';
import { DropZone, useDnDState, useDragHandlers } from '@/components/feature/dnd';
import {
  canMirrorToDisk, vaultWriteFile, vaultDeletePath, vaultMovePath, vaultOpenPath,
  type VaultMeta,
} from '@/services/vaultService';
import type { Workspace, DBFile, DBFolder, DBSubFolder, FileLocation } from '@/contexts/WorkspaceContext';

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
function FileChip({ file, depth, active, fromLoc, onPress }: {
  file: DBFile; depth: number; active: boolean; fromLoc: FileLocation; onPress: () => void;
}) {
  const C = useThemeColors();
  const info = fileTypeInfo(file.type);
  const dragHandlers = useDragHandlers(
    () => ({
      kind: 'file' as const,
      id: file.id,
      label: file.name,
      icon: info.icon,
      color: info.color,
      data: { file, fromLoc },
    }),
    onPress,
  );
  return (
    <View {...dragHandlers}>
      <View style={[{
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingVertical: 6, paddingHorizontal: Spacing.sm, marginLeft: depth * Spacing.md,
        borderRadius: Radius.sm, backgroundColor: active ? C.accent + '18' : 'transparent',
      }]}>
        <MaterialIcons name={info.icon as any} size={14} color={info.color} />
        <Text style={{ flex: 1, fontSize: FontSize.sm, color: active ? C.accent : C.textSecondary }} numberOfLines={1}>{file.name}</Text>
      </View>
    </View>
  );
}

function FilesTab({ workspace, onOpenFull }: { workspace: Workspace; onOpenFull: () => void }) {
  const C = useThemeColors();
  const { moveFile, updateFile } = useWorkspace();
  const { showToast } = useToast();
  const dragState = useDnDState();
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<DBFile | null>(null);

  const toggleFolder = (id: string) => setOpenFolderIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ── Miroir disque (vault / dépôts locaux) ────────────────────────
  const metaAt = (loc: FileLocation): VaultMeta | null => {
    const folderOf = (fid: string) => workspace.database.folders.find(f => f.id === fid);
    if (typeof loc === 'string') {
      const f = folderOf(loc);
      return f?.vault ?? f?.repo ?? null;
    }
    if (loc && typeof loc === 'object') {
      const f = folderOf(loc.folderId);
      return f?.vault ?? f?.repo ?? null;
    }
    return null;
  };
  const prefixOf = (loc: FileLocation): string => {
    if (!loc || typeof loc !== 'object') return '';
    const f = workspace.database.folders.find(x => x.id === loc.folderId);
    const subName = f?.subFolders?.find(s => s.id === loc.subId)?.name ?? '';
    return subName ? `${subName}/` : '';
  };
  const performMove = async (file: DBFile, fromLoc: FileLocation, toLoc: FileLocation) => {
    const fromMeta = metaAt(fromLoc);
    const toMeta = metaAt(toLoc);
    const fromMirror = canMirrorToDisk(fromMeta);
    const toMirror = canMirrorToDisk(toMeta);
    const base = file.name.split('/').pop() ?? file.name;
    if (file.type !== 'url' && fromMirror && toMirror && fromMeta!.path === toMeta!.path) {
      const toRel = `${prefixOf(toLoc)}${base}`;
      const r = await vaultMovePath(fromMeta, file.name, toRel);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'déplacement impossible'}`, { tone: 'error' }); return; }
      moveFile(workspace.id, file.id, fromLoc, toLoc);
      updateFile(workspace.id, toLoc, file.id, { name: toRel });
      return;
    }
    if (file.type !== 'url' && fromMirror && !toMirror) {
      const r = await vaultDeletePath(fromMeta, file.name, false);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'suppression impossible'}`, { tone: 'error' }); return; }
      moveFile(workspace.id, file.id, fromLoc, toLoc);
      updateFile(workspace.id, toLoc, file.id, { name: base });
      showToast('Fichier retiré du disque (conservé dans la base)', { tone: 'success' });
      return;
    }
    if (file.type !== 'url' && !fromMirror && toMirror) {
      const toRel = `${prefixOf(toLoc)}${base}`;
      const r = await vaultWriteFile(toMeta, toRel, file.content);
      if (!r.ok) { showToast(`Disque : ${r.error ?? 'écriture impossible'}`, { tone: 'error' }); return; }
      moveFile(workspace.id, file.id, fromLoc, toLoc);
      updateFile(workspace.id, toLoc, file.id, { name: toRel });
      return;
    }
    moveFile(workspace.id, file.id, fromLoc, toLoc);
  };

  // Lignes dépliables : dossiers racine + sous-dossiers IMBRIQUÉS à toute
  // profondeur (vault et dépôts inclus). `loc` = localisation exacte de la ligne.
  const rows: { key: string; folder: DBFolder; depth: number; loc: FileLocation }[] = [];
  const walkRows = (subs: DBSubFolder[], folderId: string, depth: number) => {
    subs.forEach(s => {
      rows.push({ key: s.id, folder: s as unknown as DBFolder, depth, loc: { folderId, subId: s.id } });
      if (openFolderIds.has(s.id)) walkRows(s.subFolders ?? [], folderId, depth + 1);
    });
  };
  for (const folder of workspace.database.folders) {
    rows.push({ key: folder.id, folder, depth: 0, loc: folder.id });
    if (openFolderIds.has(folder.id)) walkRows(folder.subFolders ?? [], folder.id, 1);
  }

  const folderMeta = (folder: DBFolder): VaultMeta | null => folder.vault ?? folder.repo ?? null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.sm, gap: 2 }} showsVerticalScrollIndicator={false}>
        {/* Bande de dépôt vers la racine, visible pendant un glisser-déposer */}
        {dragState ? (
          <DropZone
            zoneId="panel-root-strip"
            accepts={() => true}
            onDrop={(item) => {
              if (item.kind !== 'file') return;
              const { file, fromLoc } = item.data ?? {};
              if (!file) return;
              void performMove(file, fromLoc ?? null, null);
              showToast(`« ${file.name.split('/').pop()} » déplacé à la racine`, { tone: 'success' });
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: C.accent + '66', borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: Spacing.sm, backgroundColor: C.accent + '10' }}
          >
            <MaterialIcons name="home" size={14} color={C.accent} />
            <Text style={{ fontSize: FontSize.xs, color: C.accent, fontWeight: '700' }}>Déposer ici → Racine du workspace</Text>
          </DropZone>
        ) : null}

        {/* Fichiers racine */}
        {workspace.database.rootFiles.map(f => (
          <FileChip
            key={f.id}
            file={f}
            depth={0}
            active={selectedFile?.id === f.id}
            fromLoc={null}
            onPress={() => setSelectedFile(f)}
          />
        ))}

        {/* Dossiers dépliables (vault et dépôts inclus, sous-dossiers imbriqués) — zones de dépôt */}
        {rows.map(row => {
          const { folder, depth, loc } = row;
          const open = openFolderIds.has(folder.id);
          const meta = folderMeta(folder);
          return (
            <DropZone
              key={row.key}
              zoneId={`panel-folder-${folder.id}`}
              accepts={(item) => item.kind === 'file'}
              onDrop={(item) => {
                if (item.kind !== 'file') return;
                const { file, fromLoc } = item.data ?? {};
                if (file) void performMove(file, fromLoc ?? null, loc);
              }}
              style={{ borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent' }}
              activeStyle={{ borderColor: C.accent, opacity: 0.85 }}
            >
              <Pressable
                onPress={() => toggleFolder(folder.id)}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 7, paddingHorizontal: Spacing.sm, marginLeft: depth * Spacing.md }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name={open ? 'folder-open' : (folder.icon as any) || 'folder'} size={16} color={folder.color} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600' }} numberOfLines={1}>{folder.name}</Text>
                  {meta?.path ? (
                    <Text style={{ fontSize: 10, color: C.textMuted }} numberOfLines={1}>
                      {meta.sourceKind === 'github' ? 'GitHub' : 'Local'} · {meta.path}
                    </Text>
                  ) : null}
                </View>
                {folder.vault ? (
                  <View style={{ backgroundColor: (folder.color || '#9B59B6') + '22', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, color: folder.color || '#9B59B6', fontWeight: '700' }}>vault</Text>
                  </View>
                ) : folder.repo ? (
                  <View style={{ backgroundColor: (folder.color || '#00BFFF') + '22', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 9, color: folder.color || '#00BFFF', fontWeight: '700' }}>dépôt</Text>
                  </View>
                ) : null}
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={14} color={C.textMuted} />
              </Pressable>
              {open ? (folder.files ?? []).map(f => (
                <FileChip
                  key={f.id}
                  file={f}
                  depth={depth + 1}
                  active={selectedFile?.id === f.id}
                  fromLoc={loc}
                  onPress={() => setSelectedFile(f)}
                />
              )) : null}
            </DropZone>
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

// ─── Onglet Sites (web + dépôts connectés) ────────────────────────────────────
function SitesTab({ workspace }: { workspace: Workspace }) {
  const C = useThemeColors();
  const { showToast } = useToast();
  const [url, setUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  // Dépôts connectés au workspace (séparés du vault)
  const repos = useMemo(() => workspace.database.folders.filter(f => f.repo), [workspace]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [repoFile, setRepoFile] = useState<DBFile | null>(null);
  const activeRepo = repos.find(r => r.id === activeRepoId) ?? null;
  const activeRepoMeta = activeRepo?.repo ?? null;
  const repoFiles: DBFile[] = activeRepo
    ? [...activeRepo.files, ...(activeRepo.subFolders ?? []).flatMap(s => s.files)]
    : [];

  const normalize = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

  const openHere = (target?: string) => {
    const t = (target ?? url).trim();
    if (!t) return;
    const full = normalize(t);
    setLoading(true);
    setLoadedUrl(full);
  };

  const openRepo = (folder: DBFolder) => {
    setActiveRepoId(folder.id);
    setRepoFile(null);
    const meta = folder.repo!;
    if (meta.sourceKind === 'github') {
      const target = meta.path || `https://github.com/${meta.repoFullName}`;
      setUrl(target);
      setLoading(true);
      setLoadedUrl(target);
    }
  };

  const openRepoExternal = async () => {
    if (!activeRepoMeta) return;
    if (activeRepoMeta.sourceKind === 'github') {
      const target = activeRepoMeta.path || `https://github.com/${activeRepoMeta.repoFullName}`;
      setUrl(target);
      setLoading(true);
      setLoadedUrl(target);
    } else if (activeRepoMeta.path) {
      const r = await vaultOpenPath(activeRepoMeta.path);
      if (!r.ok) showToast(r.error ?? 'Ouverture impossible', { tone: 'error' });
    }
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

      {/* Dépôts connectés — ouvrables ici */}
      {repos.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xs }}>
          <MaterialIcons name="source" size={12} color={C.textMuted} />
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Dépôts</Text>
          {repos.map(folder => {
            const active = folder.id === activeRepoId;
            return (
              <Pressable
                key={folder.id}
                onPress={() => openRepo(folder)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? (folder.color || '#00BFFF') : C.border, backgroundColor: active ? (folder.color || '#00BFFF') + '22' : C.bgCardAlt }}
              >
                <MaterialIcons name="code" size={12} color={folder.color || '#00BFFF'} />
                <Text style={{ fontSize: FontSize.xs, color: active ? (folder.color || '#00BFFF') : C.textSecondary, fontWeight: '700' }} numberOfLines={1}>{folder.name}</Text>
                {active ? (
                  <Pressable onPress={() => { setActiveRepoId(null); setRepoFile(null); }} hitSlop={6}>
                    <MaterialIcons name="close" size={12} color={folder.color || '#00BFFF'} />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Navigateur de dépôt : fichiers de code du dépôt actif */}
      {activeRepo ? (
        <View style={{ borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bgCardAlt, maxHeight: '45%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 }}>
            <MaterialIcons name="folder-open" size={14} color={activeRepo.color || '#00BFFF'} />
            <Text style={{ flex: 1, fontSize: FontSize.xs, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>
              {activeRepoMeta?.sourceKind === 'github' ? activeRepoMeta.repoFullName : activeRepoMeta?.path}
            </Text>
            <Pressable onPress={() => void openRepoExternal()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: C.accent + '55', backgroundColor: C.accent + '18' }}>
              <MaterialIcons name={activeRepoMeta?.sourceKind === 'github' ? 'open-in-new' : 'folder-open'} size={11} color={C.accent} />
              <Text style={{ fontSize: 10, color: C.accent, fontWeight: '700' }}>{activeRepoMeta?.sourceKind === 'github' ? 'Ouvrir le site' : 'Ouvrir le dossier'}</Text>
            </Pressable>
            {repoFile ? (
              <Pressable onPress={() => setRepoFile(null)} hitSlop={6}>
                <MaterialIcons name="list" size={16} color={C.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          {repoFile ? (
            <View style={{ paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name={fileTypeInfo(repoFile.type).icon as any} size={13} color={fileTypeInfo(repoFile.type).color} />
                <Text style={{ flex: 1, fontSize: FontSize.xs, color: C.textPrimary, fontWeight: '700', fontFamily: 'monospace' }} numberOfLines={1}>{repoFile.name}</Text>
                <Pressable onPress={() => setRepoFile(null)} hitSlop={6}>
                  <MaterialIcons name="close" size={14} color={C.textSecondary} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 180 }}>
                <Text style={{ fontSize: 10, color: C.textSecondary, lineHeight: 15, fontFamily: 'monospace' }}>
                  {repoFile.content || '(Contenu vide)'}
                </Text>
              </ScrollView>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 190 }} contentContainerStyle={{ paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 1 }} showsVerticalScrollIndicator={false}>
              {repoFiles.length === 0 ? (
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted, paddingVertical: Spacing.sm }}>
                  Aucun fichier importé — resynchronisez le dépôt dans la base de données.
                </Text>
              ) : (
                repoFiles.map(f => (
                  <Pressable
                    key={f.id}
                    onPress={() => setRepoFile(f)}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 4, borderRadius: Radius.sm }, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name={fileTypeInfo(f.type).icon as any} size={12} color={fileTypeInfo(f.type).color} />
                    <Text style={{ flex: 1, fontSize: FontSize.xs, color: C.textSecondary, fontFamily: 'monospace' }} numberOfLines={1}>{f.name}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
        </View>
      ) : null}

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
              <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>L’affichage intégré n’est disponible que sur la version web.</Text>
            </View>
          )
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg }}>
            <MaterialIcons name="language" size={36} color={C.textMuted} />
            <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, textAlign: 'center' }}>
              Saisissez une URL pour consulter un site directement ici, sans quitter la conversation de {workspace.name}.
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: C.textMuted, textAlign: 'center', marginTop: Spacing.xs }}>
              Certains sites refusent l’intégration (X-Frame-Options). Dans ce cas :
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
          <SitesTab workspace={workspace} />
        </View>
      </View>
    </View>
  );
}
