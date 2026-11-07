/** Fins de partie : objectifs → [FIN:GAGNÉ] / [FIN:PERDU]. */
export type SimulationEnding = { result: 'won' | 'lost'; at: string };

const END_RE = /\[FIN\s*:\s*(GAGN[ÉE]E?|PERDUE?)\s*\]/i;

export function parseEnding(text: string): { ending: 'won' | 'lost' | null; rest: string } {
  const m = String(text ?? '').match(END_RE);
  if (!m) return { ending: null, rest: text };
  return { ending: /^gagn/i.test(m[1]) ? 'won' : 'lost', rest: text.replace(m[0], '').trim() };
}

export function normalizeEnding(raw: any): SimulationEnding | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (raw.result !== 'won' && raw.result !== 'lost') return undefined;
  return { result: raw.result, at: String(raw.at ?? new Date().toISOString()) };
}

export function objectivesPromptBlock(objectives?: string): string {
  const o = String(objectives ?? '').trim();
  if (!o) return '';
  return [
    '### OBJECTIFS / CONDITIONS DE VICTOIRE ET DE DÉFAITE',
    o,
    'Surveille ces conditions. Quand l’objectif est CLAIREMENT atteint, termine ta réponse par la ligne [FIN:GAGNÉ]. Quand une condition de défaite survient (ex. mort interdite, but devenu impossible), termine par [FIN:PERDU].',
    'N’émets ces marqueurs qu’une seule fois, au moment décisif, après avoir raconté la scène de conclusion. Jamais par anticipation.',
  ].join('\n');
}
