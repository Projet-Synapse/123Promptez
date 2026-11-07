/**
 * Format léger des réponses Simulation (roleplay).
 *
 * Blocs (un par ligne d’ouverture) :
 *   <<<narr>>>
 *   Narration générale…
 *   <<<char:Nom Du PNJ>>>
 *   Dialogue / narration dédiée à ce personnage…
 *
 * Règles parseur :
 * - Tout texte hors marqueur → narration générale (fallback sûr).
 * - Si le modèle n’utilise aucun marqueur → un seul segment `narr` (italique, sans avatar LLM).
 * - Les marqueurs sont retirés de l’affichage.
 *
 * Documenté ici + injecté dans buildSimulationPromptInjection.
 */

export type SimRpSegmentKind = 'narr' | 'char';

export interface SimRpSegment {
  kind: SimRpSegmentKind;
  /** Nom du personnage si kind === 'char' */
  name?: string;
  content: string;
}

const OPEN_RE = /^<<<\s*(narr|char(?:\s*:\s*([^>]+)?))\s*>>>\s*$/im;

/** Découpe une réponse assistant Simulation en segments affichables. */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Repli sans marqueurs : une ligne « Nom : « … » » / « **Nom** — … » dont le nom
 * est un personnage connu devient une bulle dédiée.
 */
function splitByKnownSpeakers(text: string, knownNames: string[]): SimRpSegment[] | null {
  const names = knownNames.map((n) => n.trim()).filter((n) => n.length >= 2);
  if (!names.length) return null;
  const alt = names.sort((a, b) => b.length - a.length).map(esc).join('|');
  const re = new RegExp(`^\\s*(?:\\*\\*|\\[\\[)?(${alt})(?:\\]\\]|\\*\\*)?\\s*(?::|—|–|-)\\s*(.+)$`, 'i');
  const out: SimRpSegment[] = [];
  let narr: string[] = [];
  let found = false;
  const flushNarr = () => {
    const c = narr.join('\n').trim();
    if (c) out.push({ kind: 'narr', content: c });
    narr = [];
  };
  for (const line of text.split('\n')) {
    const m = line.match(re);
    if (m) {
      flushNarr();
      found = true;
      const canon = names.find((n) => n.toLowerCase() === m[1].toLowerCase()) ?? m[1];
      const prev = out[out.length - 1];
      if (prev && prev.kind === 'char' && prev.name === canon) prev.content += `\n${m[2].trim()}`;
      else out.push({ kind: 'char', name: canon, content: m[2].trim() });
    } else {
      narr.push(line);
    }
  }
  flushNarr();
  return found ? out : null;
}

export function parseSimulationRoleplayContent(raw: string, knownNames: string[] = []): SimRpSegment[] {
  // Marqueurs en ligne (« texte <<<char:X>>> réplique ») → forcés sur leur propre ligne
  const text = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]*(<<<\s*(?:narr|char)[^>]*>>>)[ \t]*/gi, '\n$1\n');
  if (!text.trim()) return [];

  // Aucun marqueur → repli locuteurs connus, sinon narration
  if (!/<<<\s*(narr|char)\b/i.test(text)) {
    return splitByKnownSpeakers(text.trim(), knownNames) ?? [{ kind: 'narr', content: text.trim() }];
  }

  const lines = text.split('\n');
  const segments: SimRpSegment[] = [];
  let current: SimRpSegment | null = null;
  const flush = () => {
    if (!current) return;
    const c = current.content.replace(/^\n+/, '').replace(/\n+$/, '').trim();
    if (c) segments.push({ ...current, content: c });
    current = null;
  };

  for (const line of lines) {
    const m = line.match(OPEN_RE);
    if (m) {
      flush();
      const tag = m[1].toLowerCase();
      if (tag.startsWith('char')) {
        const name = (m[2] || '').replace(/^\[\[|\]\]$/g, '').trim() || 'Personnage';
        current = { kind: 'char', name, content: '' };
      } else {
        current = { kind: 'narr', content: '' };
      }
      continue;
    }
    if (!current) {
      // Préambule avant premier marqueur → narration
      current = { kind: 'narr', content: '' };
    }
    current.content += (current.content ? '\n' : '') + line;
  }
  flush();

  if (segments.length === 0) {
    return [{ kind: 'narr', content: text.trim() }];
  }
  return segments;
}

/** Consigne injectée dans le prompt Simulation. */
export const SIMULATION_OUTPUT_FORMAT_INSTRUCTIONS = [
  '### FORMAT DE SORTIE (OBLIGATOIRE pour l’interface)',
  'Structure CHAQUE réponse avec ces marqueurs (une ligne chacun) :',
  '<<<narr>>>',
  'Narration générale (descriptions, ambiance, actions du monde — PAS le persona joueur qui parle).',
  '<<<char:NomExactDuPersonnage>>>',
  'Dialogue ou actions / pensées de CE personnage uniquement.',
  'Tu peux enchaîner plusieurs <<<narr>>> et <<<char:…>>> dans le même message.',
  '- Quand plusieurs personnages parlent, ouvre un NOUVEAU <<<char:…>>> à CHAQUE changement de locuteur (une bulle par réplique), et remets <<<narr>>> pour la narration entre deux.',
  '- Un bloc <<<char:…>>> ne contient que ce personnage : pas la réplique d’un autre.',
  'Règles :',
  '- Utilise le nom exact du PNJ (comme dans le worldbuilding / mémoire).',
  '- Ne mets PAS le persona joueur dans un <<<char:…>>> (le joueur parle via ses propres messages).',
  '- Ne renvoie PAS de raisonnement, de plan, ni de « thinking » visible — uniquement la scène.',
  '- Si tu ne peux pas respecter le format, écris uniquement de la narration immersive (sans marqueurs) : l’app l’affichera correctement.',
].join('\n');
