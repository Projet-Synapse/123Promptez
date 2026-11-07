# Conversations sans workspace

- Le + du titre de l’historique crée et ouvre immédiatement un chat classique.
- `Conversation.workspaceId` accepte `null` (nouveau chat indépendant) et l’absence
  du champ (anciennes conversations imbriquées, inchangées).
- Le stockage historique de l’app et la synchronisation `user_app_data/workspaces`
  utilisent un seul blob JSON. Le namespace réservé `__unassigned_conversations__`
  transporte les chats indépendants sans migration SQL, ni rattachement à un
  workspace utilisateur. Il ne figure pas dans la page Workspaces.
- Les APIs de routage existantes reçoivent une façade neutre nommée « Sans workspace » :
  prompt vide, modes/tâches/automatisations vides, base vide. Le chat ne récupère donc
  aucune instruction du workspace précédent. La façade est reconstruite à la lecture.
- Historique, recherche titre/contenu, épinglage, renommage, suppression (simple ou
  multiple), et palette parcourent ce namespace comme les autres conversations.
- Simulation créée via le + du groupe reste possible : son état propre est initialisé
  normalement (mémoire, monde et modules). Le + du titre crée toujours un chat classique.
- Supprimer le dernier chat laisse un chat vide (comportement historique de l’app).
- La façade n’est pas modifiable/supprimable via updateWorkspace/removeWorkspace.

Vérification avant publication : TypeScript et ESLint ; inspection des chemins de
normalisation, des appels Supabase (blob JSON sans FK workspace_id), du filtrage et
suppression. Aucun test physique Android ni aller-retour Supabase avec compte réel.
