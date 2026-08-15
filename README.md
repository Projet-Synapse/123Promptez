# Assistant IA

Application d'assistant IA multiplateforme (iOS, Android, Web, Windows, macOS, Linux), construite avec React Native / Expo pour le mobile et le web, et Electron pour le desktop. Le backend (authentification, base de données, fonction de chat) tourne sur votre propre projet Supabase, avec Claude (Anthropic) comme moteur IA.

## Démarrage

### 1. Installer les dépendances

```bash
pnpm install
```

### 2. Lancer le projet

```bash
pnpm start             # Serveur de développement Expo
pnpm android           # Émulateur Android
pnpm ios                # Simulateur iOS
pnpm web                 # Version web (navigateur)
pnpm electron            # Version desktop (nécessite `pnpm web` lancé dans un autre terminal)
```

- Réinitialiser le projet (cache, etc.) :

```bash
pnpm run reset-project
```

### 3. Linter le code

```bash
pnpm run lint
```

## Backend (Supabase + Claude)

L'app se connecte au projet Supabase déclaré dans `.env` (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`) :

- La table `user_app_data` et les policies RLS associées sont gérées par la migration `create_user_app_data`.
- Le chat IA passe par la fonction Edge `supabase/functions/chat`, qui appelle directement l'API Anthropic Claude (`claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5` — voir `constants/config.ts`).
- **Pour activer le chat IA**, ajoutez votre clé Anthropic comme secret sur le projet Supabase :

  ```bash
  supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <votre-ref-projet>
  ```

  (ou via le dashboard Supabase → Project Settings → Edge Functions → Secrets)

## Build Desktop (Electron)

```bash
pnpm run electron:build         # build pour l'OS courant
pnpm run electron:build:mac     # macOS (.dmg, .zip)
pnpm run electron:build:win     # Windows (.exe installeur + portable)
pnpm run electron:build:linux   # Linux (.AppImage, .deb)
```

Les installeurs sont générés dans `release/`. Le desktop réutilise le build web (`expo export --platform web`) affiché dans une fenêtre Electron — aucune fonctionnalité spécifique au natif mobile n'est requise.

## Releases (GitHub Actions)

Le workflow [`.github/workflows/release.yml`](./.github/workflows/release.yml) compile automatiquement :

- **Web** (bundle statique zippé)
- **Android** (APK debug, installable directement — non signé pour le Play Store)
- **Desktop** Windows / macOS / Linux

Pour publier une release avec tous ces artefacts :

```bash
git tag v1.1.0
git push origin v1.1.0
```

Le workflow se déclenche sur tout tag `vX.Y.Z` et crée une GitHub Release avec les fichiers attachés. Il peut aussi être lancé manuellement (`workflow_dispatch`) pour valider les builds sans publier.

> iOS n'est pas couvert par ce workflow : un build `.ipa` signé nécessite un compte Apple Developer et [EAS Build](https://docs.expo.dev/eas/) ou une machine macOS dédiée.

## Dépendances principales

- React Native: 0.79.3
- React: 19.0.0
- Expo: ~53.0.9
- Expo Router: ~5.0.7
- Supabase JS: ^2.50.0
- Electron: ^43 / electron-builder: ^26

Pour la liste complète, voir [package.json](./package.json).

## Outils de développement

- TypeScript: ~5.8.3
- ESLint: ^9.25.0

## Licence

Projet privé (`"private": true`).
