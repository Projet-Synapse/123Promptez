/**
 * Dilemmes décisifs : l’IA peut émettre [CHOIX: question | option 1 | option 2 | …]
 * → carte à boutons ; un clic envoie le choix comme action du persona.
 */
export interface SimulationDilemma {
  question: string;
  options: string[];
}

const CHOICE_RE = /\[CHOIX\s*:\s*([^\]]+)\]/i;

export function parseDilemma(text: string): { dilemma: SimulationDilemma | null; rest: string } {
  const m = String(text ?? '').match(CHOICE_RE);
  if (!m) return { dilemma: null, rest: text };
  const parts = m[1].split('|').map((s) => s.trim()).filter(Boolean);
  const rest = text.replace(m[0], '').replace(/\n{3,}/g, '\n\n').trim();
  if (parts.length < 3) return { dilemma: null, rest };
  return { dilemma: { question: parts[0], options: parts.slice(1, 7) }, rest };
}

export const DILEMMA_PREFIX = '➤ Choix : ';

export const DILEMMA_PROMPT_RULE = [
  '### DILEMMES DÉCISIFS (rare)',
  'Seulement lors d’un vrai TOURNANT de l’histoire (choix lourd de conséquences), tu peux terminer ta réponse par UNE ligne : [CHOIX: question courte | option 1 | option 2 | option 3] (2 à 5 options, concises, à la 1re personne du persona).',
  'N’en mets pas à chaque réponse : au maximum une fois de temps en temps. La joueuse peut aussi répondre librement.',
  'Quand le message de la joueuse commence par « ➤ Choix : », c’est l’option choisie : joue-en les conséquences.',
].join('\n');
