# IA locale (Ollama / LM Studio)

## Première étape conseillée : Ollama

1. Installer Ollama sur le PC, puis télécharger un modèle de chat adapté à la RAM :
   `ollama pull qwen3:8b` (exemple, pas un téléchargement automatique).
2. Redémarrer le serveur avec les variables d’environnement
   `OLLAMA_HOST=0.0.0.0` et `OLLAMA_ORIGINS=*`. Pour un lancement shell Unix :
   `OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS='*' ollama serve`.
   Sous Windows, définir les variables utilisateur, quitter puis relancer Ollama.
   Ne pas lancer un deuxième serveur si l’application Ollama tourne déjà.
3. Réglages → Assistant → IA locale : activer, choisir Ollama, URL par défaut
   `http://localhost:11434`. Tester la connexion lit `/api/tags`.
4. Sélectionner séparément le modèle du récit et de la passe mémoire.

LM Studio : charger un modèle chat, démarrer son serveur (souvent port 1234),
activer CORS et l’écoute réseau si nécessaire, puis choisir « OpenAI / LM Studio ».
Liste via `/v1/models`, génération via `/v1/chat/completions`. URL avec ou sans `/v1`.
Pas de prise en charge de clés d’authentification locales dans cette version.

## Android et réseau

Sur Android, localhost = téléphone. Utiliser `http://IP_DU_PC:11434` (ou IP
Tailscale), avec PC joignable et pare-feu autorisant le port. Le plugin Expo
`withLocalAIHttp` active `android:usesCleartextTraffic=true` à la compilation.
Une nouvelle APK sera nécessaire, aucune release n’est faite dans cette PR.
L’autorisation Android concerne tous les hôtes HTTP (les IP LAN/Tailscale sont
configurables) ; les appels cloud restent HTTPS. Pas de désactivation TLS/CORS.

Le Web HTTPS peut bloquer le contenu mixte et/ou demander l’accès au réseau
privé. Préférer Electron ou un serveur local HTTPS sécurisé. Ne pas exposer Ollama
sur Internet : HOST=0.0.0.0 et ORIGINS=* doivent être limités par le pare-feu à un
réseau de confiance (préférer ensuite des origines précises).

## Transport / confidentialité

- Génération locale directe du client : Ollama `/api/chat`, NDJSON ; OpenAI
  compatible : SSE. Android demande explicitement `stream:false`, sans le piège
  du SSE brut rencontré dans #153. Repli de lecture bufferisée si pas de getReader.
- Mémoire : modèle distinct, `format:'json'` Ollama ou
  `response_format:{type:'json_object'}` OpenAI, non-streaming. Le parseur tolérant,
  la relance et la préservation de la mémoire existante restent appliqués.
- Délai de connexion/liste 15 s, génération 5 min ; annulation du chat propagée.
- Repli Gemini **off par défaut** : opt-in explicite (historique/mémoire envoyés à
  Google via Supabase si erreur locale, nécessite la clé Gemini enregistrée).
  Modèle de repli : gemini-2.5-flash-lite. Une erreur n’active jamais cette option.
- Ce n’est pas un mode entièrement hors ligne : authentification, synchronisation
  et outils externes de l’app restent inchangés. Le serveur local ne passe jamais
  par la fonction Edge ; seule la génération de repli optionnelle y passe.
- La capacité du modèle (contexte, JSON, français, marqueurs RP) et sa vitesse
  dépendent du matériel ; aucune installation ou gestion de modèles automatique.

## Vérifications

`npx tsx scripts/test-local-ai.ts` : mocks sans réseau, couvre liste, URLs, NDJSON,
SSE, Android sans streaming, modes JSON, choix de modèles, erreurs HTTP et absence
d’appels Supabase. `expo config --type introspect` : manifeste Android clair activé.
TypeScript + ESLint. Pas de test physique Android ni d’inférence réelle sur PC local.
