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
export function parseSimulationRoleplayContent(raw: string): SimRpSegment[] {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  if (!text.trim()) return [];

  // Aucun marqueur → fallback narration
  if (!/<<<\s*(narr|char)\b/i.test(text)) {
    return [{ kind: 'narr', content: text.trim() }];
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
        const name = (m[2] || '').trim() || 'Personnage';
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
  'Règles :',
  '- Utilise le nom exact du PNJ (comme dans le worldbuilding / mémoire).',
  '- Ne mets PAS le persona joueur dans un <<<char:…>>> (le joueur parle via ses propres messages).',
  '- Ne renvoie PAS de raisonnement, de plan, ni de « thinking » visible — uniquement la scène.',
  '- Si tu ne peux pas respecter le format, écris uniquement de la narration immersive (sans marqueurs) : l’app l’affichera correctement.',
].join('\n');
