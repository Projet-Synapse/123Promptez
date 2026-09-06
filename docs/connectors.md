# Connecteurs — 123Promptez

## État actuel

| Connecteur | Statut | Auth | Capacités branchées |
|---|---|---|---|
| **GitHub** | ✅ Disponible | Personal Access Token (PAT) stocké dans `connectedApps[].webhookUrl` (champ réutilisé) via le catalogue Builder | Recherche de dépôts (`searchGitHubRepos`) + import racine comme dossier vault (`importGitHubRepoAsVault`) dans la Base de données workspace |
| Supabase | ⏳ Bientôt | — | UI catalogue seulement |
| Google | ⏳ Bientôt | — | UI catalogue seulement |
| Slack | ⏳ Bientôt | — | UI catalogue seulement |
| Notion | ⏳ Bientôt | — | UI catalogue seulement |
| Discord | ⏳ Bientôt | — | UI catalogue seulement |
| Webhook custom | ✅ | URL | Persistence + toggle ; appel runtime selon outils agents |

## GitHub — configuration

1. Ouvrir **Builder → Connecteurs → GitHub**, activer le toggle.
2. Créer un PAT GitHub (scope `repo` recommandé).
3. Coller le token dans le champ dédié (masqué).
4. Dans un workspace → **Base de données** → panneau Vault → rechercher/importer un dépôt.

Le token est synchronisé avec `bot_config` cloud (comme le reste de la config bot). L’export JSON de l’app **redacte** le PAT.

## Non inclus (volontairement)

- OAuth App / Device Flow pour chaque connecteur
- Sync bidirectionnelle live GitHub (import racine ponctuel seulement)
- Scopes fins / rotation automatique de tokens
