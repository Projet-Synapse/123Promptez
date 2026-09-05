//////////////////////////////////////////////////////////////////////////
//                      🔒 check-supabase-env.mjs                        //
//////////////////////////////////////////////////////////////////////////

/*
 * Garde-fou : refuse toute construction/publication si la configuration
 * Supabase n'est pas celle du vrai projet.
 *
 * POURQUOI CE FICHIER EXISTE
 * Le 21/08/2026, une fusion a réécrit .env avec l'ancien backend OnSpace
 * (https://eavwsimyureaefgyeavw.backend.onspace.ai). Rien n'a échoué à la
 * construction : tsc, eslint et le bundle web passaient tous. La version
 * 1.2.4 est donc partie en production avec une base morte — connexion
 * impossible, Google impossible, digests d'e-mails en erreur toutes les
 * heures. Une erreur invisible pour le compilateur, fatale pour l'appli.
 *
 * Ce script rend cette panne-là impossible : il est branché sur `npm run
 * verify`, sur le hook de fin de tâche (.claude/verify.sh) et sur les deux
 * workflows GitHub (release + déploiement web), en amont de tout le reste.
 *
 * SOMMAIRE
 * Chap 1. Constantes attendues
 * Chap 2. Lecture de la configuration
 * Chap 3. Vérifications
 * Chap 4. Point d'entrée
 *
 * USAGE
 *   node scripts/check-supabase-env.mjs          → contrôles hors ligne
 *   node scripts/check-supabase-env.mjs --live   → + le serveur répond vraiment
 *
 * Aucune valeur secrète n'est affichée : uniquement des verdicts.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/////////////////////////////// Chap 1. Constantes ///////////////////////////////

/*
 * Référence du projet Supabase « Projet Synapse ». Épinglée volontairement :
 * c'est elle qui transforme « la config a changé » en échec bruyant plutôt
 * qu'en panne silencieuse. Pour migrer vers un autre projet, changer cette
 * constante DANS LE MÊME commit que .env — c'est le geste explicite qu'on
 * veut rendre obligatoire.
 */
const EXPECTED_REF = 'yvzqbjxngagapskqfcrm';
const EXPECTED_URL = `https://${EXPECTED_REF}.supabase.co`;

const ENV_FILE = path.join(process.cwd(), '.env');

/////////////////////////////// Chap 2. Lecture ///////////////////////////////

/** Analyse minimale d'un .env : `CLE=valeur`, commentaires et lignes vides ignorés. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/*
 * L'environnement réel l'emporte sur le fichier : c'est l'ordre qu'applique
 * Expo lui-même, donc c'est bien ce couple-là qui finira dans le bundle.
 */
function resolveConfig() {
  const fromFile = readEnvFile(ENV_FILE);
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || fromFile.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fromFile.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    hasFile: Object.keys(fromFile).length > 0,
  };
}

/** Décode la charge utile d'un JWT sans vérifier la signature (on ne lit que `iss`/`ref`). */
function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/////////////////////////////// Chap 3. Vérifications ///////////////////////////////

function checkOffline(config, problems) {
  if (!config.url || !config.anonKey) {
    problems.push(
      `EXPO_PUBLIC_SUPABASE_URL et/ou EXPO_PUBLIC_SUPABASE_ANON_KEY sont absents.\n` +
        `   → sans eux, le module d'authentification se désactive tout seul et\n` +
        `     l'appli se construit sans erreur mais sans connexion possible.`,
    );
    return;
  }

  if (config.url !== EXPECTED_URL) {
    problems.push(
      `EXPO_PUBLIC_SUPABASE_URL ne pointe pas sur le projet attendu.\n` +
        `   attendu : ${EXPECTED_URL}\n` +
        `   trouvé  : ${config.url}`,
    );
  }

  const payload = decodeJwtPayload(config.anonKey);
  if (!payload) {
    problems.push(`EXPO_PUBLIC_SUPABASE_ANON_KEY n'est pas un JWT lisible.`);
    return;
  }
  if (payload.iss !== 'supabase') {
    problems.push(
      `La clé anon n'a pas été émise par Supabase (iss = « ${payload.iss} »).\n` +
        `   C'est la signature d'une clé venue d'un autre backend.`,
    );
  }
  if (payload.ref !== EXPECTED_REF) {
    problems.push(
      `La clé anon appartient au projet « ${payload.ref} », pas à « ${EXPECTED_REF} ».`,
    );
  }
  if (payload.role !== 'anon') {
    problems.push(
      `La clé publique porte le rôle « ${payload.role} » au lieu de « anon ».\n` +
        `   Ne JAMAIS mettre une clé service_role dans une variable EXPO_PUBLIC_*` +
        ` : elle finirait en clair dans le bundle.`,
    );
  }
  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    problems.push(`La clé anon est expirée (exp = ${new Date(payload.exp * 1000).toISOString()}).`);
  }
}

/*
 * Le contrôle hors ligne ne dit pas si le serveur existe encore. Celui-ci si :
 * /auth/v1/health répond 200 sur un projet vivant. Utilisé en CI, où une
 * seconde d'attente est un prix dérisoire face à une release inutilisable.
 */
async function checkLive(config, problems) {
  const endpoint = `${config.url}/auth/v1/health`;
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: config.anonKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      problems.push(`${endpoint} répond ${res.status} — le service d'authentification est KO.`);
    }
  } catch (err) {
    problems.push(`${endpoint} est injoignable (${err.message}).`);
  }
}

/////////////////////////////// Chap 4. Point d'entrée ///////////////////////////////

async function main() {
  const live = process.argv.includes('--live');
  const config = resolveConfig();
  const problems = [];

  checkOffline(config, problems);
  if (problems.length === 0 && live) await checkLive(config, problems);

  if (problems.length > 0) {
    console.error('\n❌ Configuration Supabase invalide — construction interrompue.\n');
    problems.forEach((p, i) => console.error(` ${i + 1}. ${p}\n`));
    console.error(
      'Pour réparer : remettre dans .env\n' +
        `  EXPO_PUBLIC_SUPABASE_URL=${EXPECTED_URL}\n` +
        '  EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé « anon » du projet, onglet Settings → API Keys>\n',
    );
    process.exit(1);
  }

  console.log(
    `✅ Supabase : ${EXPECTED_URL} — clé anon du bon projet${live ? ', service joignable' : ''}.`,
  );
}

await main();
