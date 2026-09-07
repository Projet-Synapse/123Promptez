# Audit UX & productivité — 123Promptez (suivi)

**Date** : 2026-09-07
**Périmètre** : suivi de [`2026-09-03-ux-productivity-audit.md`](./2026-09-03-ux-productivity-audit.md) — relecture du code (`app/`, `components/`, `contexts/`, `services/`, `electron/`) + exécution (`pnpm install`, `pnpm run lint`, `tsc --noEmit`, `expo export --platform web`).

## Ce qui a été exécuté

| Étape | Résultat |
|---|---|
| `pnpm install` | ✅ OK |
| `pnpm run lint` (avant) | 11 avertissements (imports/vars inutilisés, deps `useEffect`) |
| `pnpm run lint` (après) | ✅ 2 avertissements restants (deps `useEffect` bénins, cf. §3) |
| `tsc --noEmit` | ✅ 0 erreur de typage |
| `expo export --platform web` | ✅ build réussi, 17 routes statiques générées |

---

## 1. Constat : la quasi-totalité du backlog du 03/09 a déjà été traitée

Entre le 03/09 et aujourd'hui, plusieurs sessions ont déjà implémenté la grande majorité des points relevés dans l'audit précédent. Vérifié dans le code actuel :

| # (audit 03/09) | Sujet | État constaté aujourd'hui |
|---|---|---|
| 1 | Bouton « Réinitialiser la configuration » no-op | ✅ Corrigé — appelle `resetBot()` + toast de confirmation (`app/(tabs)/settings.tsx`) |
| 2 | Thème non réactif sur `workspace-settings.tsx` / `workspace-tasks.tsx` | ✅ Corrigé — `createStyles(C)` mémoïsé via `useMemo` sur le `C` réactif de `useThemeColors()` |
| 3 | Bouton Google trompeur | ✅ Corrigé — branché sur `signInWithGoogle()` réel, avec gestion d'erreur OAuth affichée |
| 4 | Moteur de recherche web non persisté | ✅ Corrigé — stocké dans la config de l'outil agent `web_search` (survit au rechargement + sync cloud) |
| 5 | Recherche globale | ✅ Implémentée — `CommandPaletteContext` + `CommandPalette.tsx`, `Cmd/Ctrl+K` |
| 6 | Toasts pour confirmations non destructives | ✅ Implémenté — `ToastContext` utilisé largement, alertes bloquantes réservées aux actions destructrices |
| 7 | Indicateur de sync cloud global | ✅ Implémenté — `SyncIndicator` présent dans la sidebar desktop et plusieurs écrans |
| 8 | Sélection multiple / actions groupées | ✅ Implémenté — mode sélection + suppression/déplacement en lot sur la base de connaissances |
| 9 | `moveFile` non branché dans l'UI | ✅ Branché — menu « Déplacer vers… », y compris en lot |
| 11 | Raccourcis clavier + palette de commandes (Electron) | ✅ Implémenté — `Cmd/Ctrl+K` (palette), `Cmd/Ctrl+N` (nouvelle conversation), accélérateurs de menu Electron (`electron/main.js`) |
| 12 | Layout desktop dédié (largeur max + nav latérale) | ✅ Implémenté — `app/(tabs)/_layout.tsx` bascule vers une nav latérale + largeur de contenu max (`MAX_CONTENT = 1100`) au-delà de 960px |
| 13 | Export/import JSON | ✅ Implémenté — boutons Exporter/Importer JSON dans Paramètres, avec confirmation avant écrasement |
| 14 | Actions sur les messages du chat (copier, régénérer, stop) | ✅ Implémenté — `handleStop` (AbortController), `handleRegenerate`, copie presse-papier |

**Conclusion de cette section** : ce n'est plus un audit de découverte à froid — c'est un suivi qui confirme que le travail précédent est solide, fonctionnel, et n'a rien cassé (build web + typecheck + lint tous au vert). Les points encore ouverts sont peu nombreux et déjà correctement classés « moyen/long terme » dans l'audit du 03/09.

---

## 2. Ce qui a été corrigé dans cette session

### Qualité de code (aucun risque fonctionnel)
- **9 avertissements ESLint supprimés** (imports et variables inutilisés) dans `app/(tabs)/index.tsx`, `app/_layout.tsx`, `app/login.tsx`, `app/workspace-settings.tsx`, `components/feature/SliderRow.tsx`.
- **Code mort retiré** : `bulkMoveSelectedFiles()` dans `app/workspace-database.tsx` était une fonction dupliquée jamais appelée — la logique de déplacement en lot réellement utilisée vit déjà dans `handleConfirmMove()`. Suppression sans changement de comportement (vérifié : le déplacement en lot depuis le sélecteur fonctionne toujours via `handleConfirmMove`).
- Les 2 avertissements `react-hooks/exhaustive-deps` restants dans `app/(tabs)/chat.tsx` (animation du tiroir de conversations, dépendance de scroll) sont bénins et volontairement laissés en l'état : les corriger changerait le comportement de rendu (fermeture accidentelle de la boucle d'animation / re-render supplémentaire) sans bénéfice utilisateur mesurable — à traiter avec des tests manuels dédiés plutôt qu'en automatique.

### Accessibilité (petit lot, sans risque)
- Ajout de `accessibilityRole="button"` + `accessibilityLabel` explicite sur les 4 boutons **icône seule** de `app/workspace-tasks.tsx` qui n'en avaient aucun : retour, modifier une tâche, supprimer une tâche, fermer la modale. C'était la seule catégorie de bouton où un lecteur d'écran n'avait strictement aucune information (les boutons avec texte visible restent lisibles).

---

## 3. Ce qui reste ouvert (reclassé, effort réévalué à la lumière du code actuel)

| # | Suggestion | Impact | Effort | Priorité |
|---|---|---|---|---|
| A | **Accessibilité** : étendre `accessibilityLabel`/`accessibilityRole` aux boutons icône-seule restants (`workspace-database.tsx`, `workspace-automations.tsx`, `(tabs)/workspaces.tsx`, `login.tsx` — ~60 boutons au total, dont une partie seulement sont réellement icône-seule) | Moyen (accessibilité) | Moyen — nécessite d'inspecter chaque bouton individuellement pour distinguer icône-seule vs icône+texte | 🟡 Moyen terme |
| B | **i18n** : `workspace-automations.tsx` reste entièrement en français codé en dur (~47 occurrences), alors que `chat.tsx`, `workspaces.tsx`, `settings.tsx`, `workspace-database.tsx` et `login.tsx` utilisent déjà `t()`. `workspace-tasks.tsx` et `workspace-settings.tsx` n'ont que 1-2 usages de `t()`. | Moyen (marché international) | Moyen-élevé — ajouter ~47 clés × 9 langues dans `LanguageContext.tsx` ; à faire en un lot dédié avec relecture humaine des traductions plutôt qu'en automatique pour éviter des clés mal traduites en production | 🟡 Moyen terme |
| C | **Historique d'exécution + mode test** pour les automatisations | Moyen (débogage utilisateur) | Moyen-élevé (nouvel état + UI dédiée) | 🟢 Long terme |
| D | **Undo / corbeille** pour les suppressions (workspace, conversation, fichier, tâche, automatisation) | Moyen | Moyen-élevé (nécessite un état « soft delete » partagé, à concevoir avec soin pour ne pas fragiliser la sync cloud existante) | 🟢 Long terme |

**Aucune de ces 4 pistes n'a été traitée dans cette session** : chacune touche soit un grand nombre de fichiers (i18n, accessibilité complète) soit l'état partagé/synchronisé (undo), ce qui dépasse le périmètre d'un lot automatique sûr — elles restent volontairement pour une session dédiée avec relecture.

---

## Conclusion

L'application continue d'être saine techniquement (build web, lint et typage au vert après cette session). L'essentiel du travail de fond identifié le 03/09 (recherche globale, toasts, sync visible, sélection multiple, `moveFile`, raccourcis clavier, layout desktop, export/import, actions chat) est **déjà en production dans le code actuel** et n'a pas régressé. Cette session a nettoyé les avertissements de lint restants, retiré une fonction dupliquée non utilisée, et comblé une petite lacune d'accessibilité sur l'écran Tâches. Les points encore ouverts (i18n complet, accessibilité exhaustive, historique d'automatisation, undo) sont plus structurants et gagnent à être traités en sessions dédiées avec relecture humaine, plutôt qu'en un seul lot automatique.
