# Audit UX & productivité — 123Promptez

**Date** : 2026-09-03
**Périmètre** : code source (`app/`, `components/`, `contexts/`, `services/`) + exécution réelle de l'application (build web, captures d'écran).
**Méthode** : lecture du code de tous les écrans principaux, exécution du build (`pnpm install`, `pnpm run lint`, `tsc --noEmit`, `expo export --platform web`), puis rendu de l'app exportée dans un navigateur headless pour observer l'UI réelle (login, chat, workspaces, profil, paramètres).

## Ce qui a été exécuté

| Étape | Résultat |
|---|---|
| `pnpm install` | ✅ OK (20s, aucune erreur) |
| `pnpm run lint` | ✅ 0 erreur, 15 avertissements mineurs (imports/vars inutilisés, deps `useEffect`) |
| `tsc --noEmit` | ✅ 0 erreur de typage |
| `expo export --platform web` | ✅ build réussi, 17 routes statiques générées |
| Rendu réel dans le navigateur | ✅ captures des écrans Login, Chat, Workspaces, Profil, Paramètres |

Le code est sain et se construit sans erreur — le travail ci-dessous porte donc uniquement sur l'ergonomie et la productivité, pas sur la stabilité du build.

---

## 1. Analyse de l'interface actuelle

**Structure générale** : navigation par 5 onglets bas (Builder, Workspaces, Chat, Profil, Paramètres), cohérente et simple sur mobile. Chaque fonctionnalité « workspace » avancée (Base de données, Tâches, Automatisations) est en revanche accessible via un empilement d'écrans complets (`Workspaces` → `workspace-settings` → `workspace-database` / `-tasks` / `-automations`), sans navigation latérale entre elles une fois qu'on y est.

**Hiérarchie visuelle** : cohérente écran par écran (cartes, badges de statut, code couleur par catégorie), thème sombre par défaut bien exécuté. Les captures montrent cependant que **la mise en page reste calée sur une largeur mobile même en fenêtre desktop 1280 px** : les cartes/formulaires s'étirent bord à bord sans largeur maximale, et la barre d'onglets bas (pensée pour le pouce) est conservée telle quelle dans le build Electron desktop — pas de barre latérale ni de layout adapté au clavier/souris.

**Parcours utilisateur** : le parcours de conversation (chat) est fluide et bien pensé (chips de raccourcis, streaming visible). Les parcours de configuration (Automatisations, Base de connaissances, Tâches) sont plus profonds et reposent beaucoup sur des modales plein écran empilées, ce qui rallonge le nombre de clics pour des actions fréquentes.

---

## 2. Points de friction & fonctionnalités manquantes

### Friction majeure (impacte tous les usages avancés)
- **Aucune recherche globale** : ni dans les conversations/messages, ni dans les workspaces, ni dans les fichiers de la base de connaissances (qui ont pourtant un système de tags), ni dans les paramètres. Au-delà de quelques éléments, tout se fait en scrollant.
- **Aucun raccourci clavier / palette de commandes** sur la version desktop (Electron) : le menu ne définit que les rôles OS par défaut (`editMenu`, `viewMenu`, `windowMenu`) — pas de `Cmd/Ctrl+K`, pas de « nouvelle conversation » au clavier, alors que l'app est packagée nativement pour Windows/macOS/Linux.
- **Pas de sélection multiple / actions groupées** nulle part (suppression de plusieurs fichiers, conversations ou tâches à la fois) : tout est un-par-un via une petite icône.

### Friction moyenne (gêne un usage régulier)
- **Un seul mécanisme de retour utilisateur** : 40+ appels à une alerte modale bloquante (`showAlert`) et aucun composant toast/snackbar. Les confirmations destructrices (suppression) s'en servent à raison, mais des notifications à faible enjeu (tâche marquée accomplie, fichier importé, lien ajouté) interrompent le flux de la même façon qu'une suppression irréversible.
- **Aucune fonction d'annulation (undo)** : toute suppression confirmée est définitive, il n'existe ni corbeille ni « annuler » après coup.
- **Pas d'export/import des données** (workspaces, conversations, base de connaissances, mémoire IA) : tout vit uniquement dans la synchronisation cloud debouncée, sans sauvegarde/restauration côté utilisateur.
- **Feedback de synchronisation cloud incomplet** : chaque domaine (profil, workspace, bot) synchronise silencieusement avec un debounce de 1,5–2 s, mais seul l'écran Profil affiche un indicateur « synchronisation… ». Ailleurs (Paramètres, écrans workspace), une modification est mise en file sans aucun signal visuel, et un échec de synchronisation n'est journalisé qu'en console (`cloudSyncService.ts`), invisible pour l'utilisateur.
- **Couverture i18n incomplète** : `LanguageContext` propose 9 langues et une fonction `t()`, mais elle n'est réellement utilisée que dans `chat.tsx` et `workspaces.tsx`. Les écrans Automatisations, Base de données, Paramètres workspace, Tâches, Connexion et l'essentiel de Paramètres ont du texte français codé en dur — changer la langue de l'interface laisse donc la majorité de l'app non traduite.
- **Accessibilité minimale** : `hitSlop` bien utilisé sur les petits boutons icône, mais aucun `accessibilityLabel`/`accessibilityRole` nulle part ; plusieurs indicateurs d'état (actif/inactif, échéance) reposent uniquement sur la couleur.

### Bugs concrets repérés pendant l'analyse (à corriger, faible effort)
- **Bouton « Réinitialiser la configuration » inopérant** (`app/(tabs)/settings.tsx:385`) : la confirmation destructrice s'affiche, mais `onPress: () => {}` — rien ne se passe si l'utilisateur confirme. Fonctionnalité morte, potentiellement trompeuse.
- **Thème non réactif sur 2 écrans** (`app/workspace-settings.tsx`, `app/workspace-tasks.tsx`) : contrairement aux autres écrans qui utilisent le hook réactif `useThemeColors()`, ces deux-là utilisent `StyleSheet.create()` au niveau module contre l'objet statique `Colors`, que `ThemeContext` met à jour par mutation en place. `StyleSheet.create()` résout les valeurs une seule fois au chargement du module : ces deux écrans restent donc très probablement figés sur le thème actif au premier lancement, sans réagir au bouton clair/sombre.
- **Bouton « Continuer avec Google »** sur l'écran de connexion : entièrement stylé et cliquable, mais n'ouvre qu'une alerte expliquant que ce n'est pas configuré — un utilisateur peut croire à tort que l'OAuth Google fonctionne.
- **Sélecteur de moteur de recherche web** (Paramètres) : stocké en `useState` local uniquement, jamais persisté — le choix revient silencieusement à « Google » après rechargement.
- **`moveFile` non branché** : la fonction pour déplacer un fichier entre dossiers existe dans `WorkspaceContext` mais n'est appelée par aucun écran — capacité créée puis jamais exposée dans l'UI de la base de connaissances.

### Points déjà bien conçus (à préserver)
- Écran **Automatisations** : le plus abouti — aperçu « flux » en direct dans le formulaire, cartes trigger/action claires, bon texte d'explication pour une fonctionnalité complexe.
- **Chat** : streaming visible, contexte workspace/conversation toujours affiché, chips de raccourcis contextuels qui pré-remplissent le champ de saisie.
- **Tâches** : bannière « à faire maintenant » scannable, regroupement par fréquence.
- **Mémoire IA (Profil)** : regroupement par catégorie avec code couleur et explication claire de l'usage.
- `updateService.ts` : vérificateur de mise à jour propre, ne télécharge jamais automatiquement, laisse la main à l'utilisateur.

---

## 3. Priorisation (impact × effort)

| # | Suggestion | Impact | Effort | Priorité |
|---|---|---|---|---|
| 1 | Corriger le bouton « Réinitialiser la configuration » (no-op) | Moyen (confiance/fiabilité) | Très faible | 🔴 Immédiat |
| 2 | Corriger la réactivité du thème sur `workspace-settings.tsx` / `workspace-tasks.tsx` | Moyen | Faible | 🔴 Immédiat |
| 3 | Retirer ou griser le bouton « Continuer avec Google » tant qu'il n'est pas actif | Faible-moyen (confiance) | Très faible | 🔴 Immédiat |
| 4 | Persister le choix du moteur de recherche web | Faible | Très faible | 🔴 Immédiat |
| 5 | Introduire un composant toast/snackbar pour les confirmations à faible enjeu | Élevé (fluidité perçue) | Moyen | 🟠 Court terme |
| 6 | Ajouter une recherche globale (conversations, workspaces, fichiers KB) | Très élevé | Moyen-élevé | 🟠 Court terme |
| 7 | Afficher un indicateur de synchronisation cloud unifié + erreurs visibles | Élevé (confiance dans la sauvegarde) | Moyen | 🟠 Court terme |
| 8 | Ajouter la sélection multiple / actions groupées (fichiers, tâches, conversations) | Élevé (productivité) | Moyen | 🟠 Court terme |
| 9 | Brancher `moveFile` dans l'UI (glisser/déplacer ou menu « déplacer vers ») | Moyen | Faible-moyen | 🟠 Court terme |
| 10 | Compléter la couverture i18n (`t()`) sur les écrans workspace/paramètres | Moyen (marché international) | Moyen | 🟡 Moyen terme |
| 11 | Raccourcis clavier + palette de commandes sur le build Electron | Élevé pour les power users desktop | Moyen-élevé | 🟡 Moyen terme |
| 12 | Layout desktop adapté (largeur max, navigation latérale) pour Electron/web large écran | Élevé sur desktop | Moyen-élevé | 🟡 Moyen terme |
| 13 | Ajouter export/import des données (JSON) | Moyen (sécurité/portabilité) | Moyen | 🟡 Moyen terme |
| 14 | Actions sur les messages du chat (copier, régénérer, stop génération) | Élevé (usage quotidien) | Moyen | 🟡 Moyen terme |
| 15 | Historique d'exécution des automatisations + mode test/dry-run | Moyen (débogage utilisateur) | Moyen-élevé | 🟢 Long terme |
| 16 | Ajout d'`accessibilityLabel`/`accessibilityRole` sur les boutons icône | Moyen (accessibilité) | Faible-moyen, mais étendu à tout le code | 🟢 Long terme |
| 17 | Undo / corbeille pour les suppressions | Moyen | Moyen-élevé (nécessite un état « soft delete ») | 🟢 Long terme |

---

## 4. Liste de suggestions concrètes, avec justification

### 🔴 Corrections immédiates (bugs, quelques lignes chacun)
1. **Implémenter réellement la réinitialisation du bot** (`app/(tabs)/settings.tsx:385`) — actuellement l'utilisateur confirme une action destructrice qui ne fait rien : c'est trompeur et nuit à la confiance dans le reste des boutons « danger zone ».
2. **Remplacer `StyleSheet.create()`+`Colors` statique par `useThemeColors()`** dans `workspace-settings.tsx` et `workspace-tasks.tsx` — ces deux écrans ne suivent probablement pas le changement de thème clair/sombre, contrairement au reste de l'app.
3. **Désactiver ou masquer temporairement le bouton Google** sur l'écran de connexion jusqu'à ce que l'OAuth soit réellement câblé, avec une mention « bientôt disponible » plutôt qu'une alerte surprise après clic.
4. **Persister `selectedSearchEngine`** dans le contexte `bot`/workspace au lieu d'un `useState` local — le réglage doit survivre à un rechargement de page, comme les autres préférences.

### 🟠 Gains de productivité à court terme
5. **Recherche globale** (barre de recherche accessible depuis le chat/les workspaces, filtrant conversations, titres de workspace, fichiers KB et leurs tags) — c'est le manque le plus cité par les utilisateurs de ce type d'outil dès que le volume de contenu grandit ; c'est aussi la fonctionnalité la plus rentable ici car elle sert transversalement toutes les sections.
6. **Système de toast/snackbar** pour les confirmations non destructives (tâche complétée, fichier ajouté, lien inséré) en réservant les alertes modales bloquantes aux vraies suppressions — réduit le nombre d'interruptions de flux sans rien retirer à la sécurité des actions irréversibles.
7. **Indicateur de synchronisation cloud global** (petit badge « synchronisé »/« en cours »/« erreur, réessayer ») visible sur toutes les pages qui modifient des données, pas seulement Profil — évite qu'un utilisateur ferme l'app en pensant que ses réglages sont sauvegardés alors qu'une synchro a échoué silencieusement.
8. **Sélection multiple** sur la liste de fichiers (Base de connaissances) et de conversations (tiroir de chat) pour supprimer/déplacer en lot — la suppression un par un via une icône de 15px devient pénible dès qu'il y a plus de quelques éléments.
9. **Brancher `moveFile`** dans l'UI de la base de connaissances (menu contextuel « Déplacer vers… » sur chaque fichier) — la fonction existe déjà côté état, il ne manque que l'accroche UI.

### 🟡 Moyen terme
10. **Finir la traduction (`t()`)** des écrans Automatisations, Base de données, Paramètres workspace, Tâches et Connexion — l'infrastructure i18n existe déjà et fonctionne bien dans Chat/Workspaces ; il s'agit surtout de remplacer des chaînes en dur.
11. **Raccourcis clavier et palette de commandes** sur le build Electron (`Cmd/Ctrl+K` pour rechercher/naviguer, `Cmd/Ctrl+N` pour une nouvelle conversation) — l'app est distribuée nativement pour desktop mais n'offre aujourd'hui aucune interaction clavier au-delà des rôles système par défaut du menu.
12. **Layout desktop dédié** : largeur de contenu maximale centrée + navigation latérale (au lieu de la barre d'onglets bas) au-delà d'un certain seuil de largeur d'écran — les captures montrent le contenu actuellement étiré bord à bord jusqu'à 1280px, ce qui nuit à la lisibilité sur grand écran/desktop.
13. **Export/import JSON** des workspaces, conversations, base de connaissances et mémoire IA — actuellement aucune sauvegarde locale n'existe en dehors du cloud sync ; c'est un vrai risque de confiance pour des utilisateurs qui construisent des configurations élaborées (agents, automatisations).
14. **Actions sur les messages du chat** : copier une réponse, régénérer, arrêter une génération en cours — l'app n'offre aujourd'hui qu'un curseur clignotant pendant le streaming, sans moyen d'interrompre une réponse longue ni de la régénérer sans tout retaper.

### 🟢 Long terme
15. **Historique d'exécution + mode test** pour les automatisations — permettrait de vérifier une règle avant de la rendre active en production, et de comprendre pourquoi une règle ne s'est pas déclenchée.
16. **Audit d'accessibilité complet** (`accessibilityLabel`/`accessibilityRole` sur tous les boutons icône, redondance texte/icône pour les états actuellement signalés par la couleur seule).
17. **Corbeille / annulation** pour les suppressions (workspace, conversation, fichier, tâche, automatisation) — actuellement toute suppression confirmée est immédiate et définitive.

---

## Conclusion

L'application est saine techniquement (build, lint et typage passent sans erreur) et certains écrans — notamment Automatisations et le système de Mémoire IA — sont déjà bien pensés en termes d'ergonomie. **Ce n'est donc pas un cas où « aucune amélioration ne se dégage » : plusieurs fonctionnalités de productivité de base manquent encore (recherche globale, actions groupées, undo, raccourcis clavier desktop)**, la couverture i18n est inégale, et quatre bugs concrets et rapides à corriger ont été identifiés pendant l'analyse (réinitialisation inopérante, thème non réactif sur 2 écrans, bouton Google trompeur, réglage moteur de recherche non persisté). Les corrections immédiates (section 🔴) sont recommandées en premier car elles sont peu coûteuses et touchent directement la confiance de l'utilisateur dans l'app ; la recherche globale et les indicateurs de synchronisation (section 🟠) apportent ensuite le plus grand gain de productivité pour un effort raisonnable.
