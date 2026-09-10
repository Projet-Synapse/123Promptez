// RepoPanel — connexion de dépôts de code au workspace (dossier local ou
// GitHub). Les dépôts sont stockés comme dossiers de la base, marqués `repo`,
// bien séparés du vault : on les parcourt dans la base et dans l'onglet Sites.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { IconButton } from '@/components/ui/IconButton';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useBot } from '@/hooks/useBot';
import { useAlert } from '@/template';
import {
  getVaultCapability,
  pickLocalVaultFolder,
  searchGitHubRepos,
  importGitHubRepoAsVault,
  resolveGitHubToken,
  type GitHubRepoHit,
} from '@/services/vaultService';

type Props = {
  workspaceId: string;
  onClose: () => void;
};

export function RepoPanel({ workspaceId, onClose }: Props) {
  const C = useThemeColors();
  const { addVaultFolder } = useWorkspace();
  const { bot } = useBot();
  const { showAlert } = useAlert();
  const capability = useMemo(() => getVaultCapability(), []);

  const githubEnabled = bot.connectedApps.some(
    a => (a.presetId === 'github' || a.id === 'github') && a.enabled,
  );
  const githubToken = resolveGitHubToken(bot.connectedApps);

  const [busy, setBusy] = useState(false);
  const [ghQuery, setGhQuery] = useState('');
  const [ghResults, setGhResults] = useState<GitHubRepoHit[]>([]);
  const [ghError, setGhError] = useState<string | null>(null);

  const handleAddLocalRepo = async () => {
    if (!capability.canPickFolder) {
      showAlert('Synchro dossier indisponible', capability.hintFr + "\n\nAstuce : utilisez l'application bureau (Electron) pour connecter un dossier local.");
      return;
    }
    setBusy(true);
    try {
      const result = await pickLocalVaultFolder();
      if (!result) {
        setBusy(false);
        return;
      }
      const base = (result.meta.path || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Dépôt local';
      addVaultFolder(workspaceId, {
        name: base,
        icon: 'code',
        color: '#00BFFF',
        description: `Dépôt local · ${result.meta.path}`,
        repo: { ...result.meta, syncMessage: `${result.files.length} fichier(s) importé(s)` },
      }, result.files.map(f => ({ ...f, tags: ['dépôt', 'local'] })));
      onClose();
      showAlert('Dépôt connecté', result.meta.syncMessage || `${result.files.length} fichier(s) importé(s).`);
    } catch (e: any) {
      showAlert('Erreur dépôt', e?.message ?? "Impossible d'accéder au dossier.");
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
        description: repo.description || `Dépôt GitHub · ${repo.full_name}`,
        repo: { ...result.meta, syncMessage: `${result.files.length} fichier(s) importé(s) (racine du dépôt)` },
      }, result.files.map(f => ({ ...f, tags: ['dépôt', 'github'] })));
      onClose();
      showAlert('Dépôt connecté', result.meta.syncMessage || repo.full_name);
    } catch (e: any) {
      showAlert('Erreur GitHub', e?.message ?? 'Import impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.sm, backgroundColor: C.bgCardAlt, borderRadius: Radius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <MaterialIcons name="source" size={16} color={C.accent} />
        <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }}>Connecter un dépôt</Text>
        {busy ? <ActivityIndicator size="small" color={C.accent} /> : null}
        <IconButton icon="close" label="Fermer" onPress={onClose} bare size={18} color={C.textSecondary} />
      </View>
      <Text style={{ fontSize: FontSize.xs, color: C.textMuted, lineHeight: 16 }}>
        Un dépôt est indépendant du vault : ses fichiers de code apparaissent dans la base du workspace et dans l’onglet Sites du chat.
      </Text>

      <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
        <Pressable
          onPress={handleAddLocalRepo}
          disabled={busy}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
            borderRadius: Radius.md, borderWidth: 1,
            borderColor: '#00BFFF' + '55', backgroundColor: '#00BFFF' + '15',
            opacity: busy ? 0.5 : pressed ? 0.75 : 1,
          }]}
          accessibilityLabel="Connecter un dossier local comme dépôt"
        >
          <MaterialIcons name="create-new-folder" size={18} color="#00BFFF" />
          <Text style={{ fontSize: FontSize.sm, color: '#00BFFF', fontWeight: '700' }}>Dossier local</Text>
        </Pressable>

        <Pressable
          onPress={handleSearchGithub}
          disabled={busy}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
            borderRadius: Radius.md, borderWidth: 1,
            borderColor: '#E6EDF3' + '55', backgroundColor: '#E6EDF3' + '12',
            opacity: busy ? 0.5 : pressed ? 0.75 : 1,
          }]}
          accessibilityLabel="Rechercher un dépôt GitHub"
        >
          <MaterialIcons name="code" size={18} color={C.textPrimary} />
          <Text style={{ fontSize: FontSize.sm, color: C.textPrimary, fontWeight: '700' }}>GitHub</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
        <TextInput
          value={ghQuery}
          onChangeText={setGhQuery}
          placeholder="Filtrer / rechercher vos dépôts GitHub…"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSearchGithub}
          style={{ flex: 1, backgroundColor: C.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.border, color: C.textPrimary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, fontSize: FontSize.sm }}
        />
        <IconButton icon="search" label="Rechercher sur GitHub" onPress={handleSearchGithub} color={C.accent} borderColor={C.accent + '55'} />
      </View>

      {ghResults.length > 0 || ghError ? (
        <View style={{ gap: Spacing.sm }}>
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
    </View>
  );
}
