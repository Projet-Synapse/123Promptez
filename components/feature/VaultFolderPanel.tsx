// Vault folders — local FS sync + GitHub repo search (FR UI).
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { IconButton } from '@/components/ui/IconButton';
import { useBot } from '@/hooks/useBot';
import { useAlert } from '@/template';
import type { DBFolder } from '@/contexts/WorkspaceContext';
import {
  getVaultCapability,
  pickLocalVaultFolder,
  resyncLocalVault,
  searchGitHubRepos,
  importGitHubRepoAsVault,
  resolveGitHubToken,
  type GitHubRepoHit,
} from '@/services/vaultService';

type Props = {
  workspaceId: string;
  folders: DBFolder[];
  onOpenFolder: (folder: DBFolder) => void;
  addVaultFolder: (workspaceId: string, folder: Omit<DBFolder, 'id' | 'files' | 'subFolders' | 'createdAt'>, files: { name: string; type: any; content: string; tags: string[] }[]) => string;
  updateFolder: (workspaceId: string, folderId: string, updates: Partial<DBFolder>) => void;
  removeFolder: (workspaceId: string, folderId: string) => void;
  /** Replace vault folder files after sync */
  replaceFolderFiles: (workspaceId: string, folderId: string, files: { name: string; type: any; content: string; tags: string[] }[]) => void;
};

export function VaultFolderPanel({
  workspaceId,
  folders,
  onOpenFolder,
  addVaultFolder,
  updateFolder,
  removeFolder,
  replaceFolderFiles,
}: Props) {
  const C = useThemeColors();
  const { bot } = useBot();
  const { showAlert } = useAlert();
  const capability = useMemo(() => getVaultCapability(), []);

  const vaultFolders = folders.filter(f => !!f.vault);
  const githubEnabled = bot.connectedApps.some(
    a => (a.presetId === 'github' || a.id === 'github') && a.enabled,
  );
  const githubToken = resolveGitHubToken(bot.connectedApps);

  const [busy, setBusy] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [ghQuery, setGhQuery] = useState('');
  const [ghResults, setGhResults] = useState<GitHubRepoHit[]>([]);
  const [ghError, setGhError] = useState<string | null>(null);

  const handleAddLocalVault = async () => {
    if (!capability.canPickFolder) {
      showAlert(
        'Synchro dossier indisponible',
        capability.hintFr + '\n\nAstuce : utilisez « Insérer → Fichier » pour importer manuellement, ou l’app Electron Windows.',
      );
      return;
    }
    setBusy(true);
    try {
      const result = await pickLocalVaultFolder();
      if (!result) {
        setBusy(false);
        return;
      }
      const base = (result.meta.path || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Vault local';
      addVaultFolder(workspaceId, {
        name: base,
        icon: 'lock',
        color: '#9B59B6',
        description: `Vault local · ${result.meta.path}`,
        vault: result.meta,
      }, result.files);
      showAlert('Dossier vault ajouté', result.meta.syncMessage || `${result.files.length} fichier(s) importé(s).`);
    } catch (e: any) {
      showAlert('Erreur vault', e?.message ?? 'Impossible d’accéder au dossier.');
    } finally {
      setBusy(false);
    }
  };

  const handleResync = async (folder: DBFolder) => {
    if (!folder.vault) return;
    setBusy(true);
    try {
      if (folder.vault.sourceKind === 'local') {
        const result = await resyncLocalVault(folder.vault);
        if (!result) return;
        updateFolder(workspaceId, folder.id, { vault: result.meta });
        if (result.files.length) replaceFolderFiles(workspaceId, folder.id, result.files);
        showAlert('Synchronisation', result.meta.syncMessage || 'Terminé');
      } else if (folder.vault.sourceKind === 'github' && folder.vault.repoFullName && githubToken) {
        const fakeRepo: GitHubRepoHit = {
          id: folder.vault.repoId || 0,
          full_name: folder.vault.repoFullName,
          description: null,
          private: false,
          html_url: folder.vault.path || '',
          default_branch: 'main',
        };
        const result = await importGitHubRepoAsVault(githubToken, fakeRepo);
        updateFolder(workspaceId, folder.id, { vault: result.meta });
        if (result.files.length) replaceFolderFiles(workspaceId, folder.id, result.files);
        showAlert('Import GitHub', result.meta.syncMessage || 'Terminé');
      }
    } catch (e: any) {
      showAlert('Erreur sync', e?.message ?? 'Échec');
    } finally {
      setBusy(false);
    }
  };

  const handleSearchGithub = async () => {
    if (!githubEnabled) {
      setGhError('Activez le connecteur GitHub dans Builder ▸ Connecteurs.');
      return;
    }
    if (!githubToken) {
      setGhError('Aucun jeton. Dans Builder ▸ Connecteurs ▸ GitHub, collez un Personal Access Token (ghp_…).');
      return;
    }
    setBusy(true);
    setGhError(null);
    const { repos, error } = await searchGitHubRepos(githubToken, ghQuery);
    setBusy(false);
    if (error) setGhError(error);
    setGhResults(repos);
  };

  const handleAttachRepo = async (repo: GitHubRepoHit) => {
    if (!githubToken) {
      showAlert('Jeton manquant', 'Configurez un Personal Access Token GitHub dans Builder ▸ Connecteurs.');
      return;
    }
    setBusy(true);
    try {
      const result = await importGitHubRepoAsVault(githubToken, repo);
      addVaultFolder(workspaceId, {
        name: repo.full_name,
        icon: 'code',
        color: '#E6EDF3',
        description: repo.description || `Vault GitHub · ${repo.full_name}`,
        vault: result.meta,
      }, result.files);
      setShowGithub(false);
      showAlert('Dépôt attaché', result.meta.syncMessage || repo.full_name);
    } catch (e: any) {
      showAlert('Erreur GitHub', e?.message ?? 'Import impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ backgroundColor: C.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FontSize.sm, color: C.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Dossiers vault
          </Text>
          <Text style={{ fontSize: FontSize.xs, color: C.textMuted, marginTop: 3, lineHeight: 16 }}>
            {capability.labelFr}
          </Text>
        </View>
        {busy ? <ActivityIndicator color={C.accent} /> : null}
      </View>

      <View style={{ backgroundColor: C.bgCardAlt, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: C.border }}>
        <Text style={{ fontSize: FontSize.xs, color: C.textSecondary, lineHeight: 17 }}>{capability.hintFr}</Text>
        {Platform.OS !== 'web' ? (
          <Text style={{ fontSize: FontSize.xs, color: C.warning, marginTop: 6, lineHeight: 16 }}>
            Sur mobile, préférez l’import fichier. La synchro dossier est optimisée pour Electron (Windows) et navigateurs compatibles.
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
        <Pressable
          onPress={handleAddLocalVault}
          disabled={busy}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
            borderRadius: Radius.md, borderWidth: 1,
            borderColor: C.primary + '55', backgroundColor: C.primary + '15',
            opacity: busy ? 0.5 : pressed ? 0.75 : 1,
          }]}
          accessibilityLabel="Ajouter un dossier vault local"
        >
          <MaterialIcons name="create-new-folder" size={18} color={C.primary} />
          <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '700' }}>Dossier local</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowGithub(v => !v)}
          disabled={busy}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
            borderRadius: Radius.md, borderWidth: 1,
            borderColor: '#E6EDF3' + '55', backgroundColor: '#E6EDF3' + '12',
            opacity: pressed ? 0.75 : 1,
          }]}
          accessibilityLabel="Rechercher un dépôt GitHub"
        >
          <MaterialIcons name="code" size={18} color={C.textPrimary} />
          <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }}>GitHub</Text>
        </Pressable>
      </View>

      {showGithub ? (
        <View style={{ gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: C.border }}>
          {!githubEnabled ? (
            <Text style={{ fontSize: FontSize.sm, color: C.warning, lineHeight: 18 }}>
              Connecteur GitHub désactivé. Allez dans Builder ▸ Connecteurs et activez GitHub.
            </Text>
          ) : !githubToken ? (
            <Text style={{ fontSize: FontSize.sm, color: C.warning, lineHeight: 18 }}>
              Aucun jeton GitHub. Dans Builder ▸ Connecteurs ▸ GitHub, collez un Personal Access Token (scope repo).
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: FontSize.xs, color: C.textMuted }}>Recherchez vos dépôts (laissez vide pour les plus récents)</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                <TextInput
                  value={ghQuery}
                  onChangeText={setGhQuery}
                  placeholder="nom du dépôt…"
                  placeholderTextColor={C.textMuted}
                  style={{
                    flex: 1, backgroundColor: C.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.border,
                    color: C.textPrimary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: FontSize.sm,
                  }}
                  onSubmitEditing={handleSearchGithub}
                />
                <IconButton icon="search" label="Rechercher" onPress={handleSearchGithub} color={C.accent} borderColor={C.accent + '55'} />
              </View>
            </>
          )}
          {ghError ? <Text style={{ fontSize: FontSize.xs, color: C.error }}>{ghError}</Text> : null}
          {ghResults.map(repo => (
            <Pressable
              key={repo.id}
              onPress={() => handleAttachRepo(repo)}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.border,
                backgroundColor: C.bg, opacity: pressed ? 0.75 : 1,
              }]}
            >
              <MaterialIcons name={repo.private ? 'lock' : 'public'} size={16} color={C.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '600' }}>{repo.full_name}</Text>
                {repo.description ? (
                  <Text style={{ fontSize: FontSize.xs, color: C.textMuted }} numberOfLines={1}>{repo.description}</Text>
                ) : null}
              </View>
              <MaterialIcons name="add-link" size={18} color={C.accent} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {vaultFolders.length === 0 ? (
        <Text style={{ fontSize: FontSize.sm, color: C.textMuted, textAlign: 'center', paddingVertical: Spacing.sm }}>
          Aucun dossier vault pour l’instant
        </Text>
      ) : (
        vaultFolders.map(folder => (
          <View
            key={folder.id}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
              backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1,
              borderColor: (folder.color || '#9B59B6') + '44', padding: Spacing.sm + 2,
            }}
          >
            <Pressable onPress={() => onOpenFolder(folder)} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: Radius.sm, backgroundColor: (folder.color || '#9B59B6') + '22', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={(folder.icon as any) || 'lock'} size={22} color={folder.color || '#9B59B6'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.body, color: C.textPrimary, fontWeight: '700' }} numberOfLines={1}>{folder.name}</Text>
                <Text style={{ fontSize: FontSize.xs, color: C.textMuted }} numberOfLines={1}>
                  {folder.vault?.sourceKind === 'github'
                    ? `GitHub · ${folder.vault.repoFullName}`
                    : `Local · ${folder.vault?.path}`}
                  {folder.vault?.syncStatus ? ` · ${folder.vault.syncStatus}` : ''}
                </Text>
              </View>
            </Pressable>
            <IconButton icon="sync" label="Resynchroniser" onPress={() => handleResync(folder)} size={18} bare color={C.accent} />
            <IconButton
              icon="delete-outline"
              label="Supprimer le vault"
              onPress={() => showAlert(`Supprimer « ${folder.name} » ?`, 'Les métadonnées vault et fichiers associés seront retirés de ce workspace.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: () => removeFolder(workspaceId, folder.id) },
              ])}
              size={18}
              bare
              color={C.textMuted}
            />
          </View>
        ))
      )}
    </View>
  );
}
