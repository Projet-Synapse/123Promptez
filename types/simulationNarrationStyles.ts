/**
 * Styles de narration Simulation (t229u) — presets de prompt système.
 * Le modèle LLM sous-jacent reste celui configuré ; seul le ton/déroulement change.
 */

export const NARRATION_AXES = [
  { key: 'social', label: 'Compréhension sociale et nuances', short: 'Social' },
  { key: 'emotion', label: 'Émotionnalité, piquant', short: 'Émotion' },
  { key: 'coherence', label: 'Cohérence', short: 'Cohérence' },
  { key: 'immersion', label: 'Immersion et détails', short: 'Immersion' },
  { key: 'plot', label: 'Développement de l’intrigue', short: 'Intrigue' },
] as const;

export type NarrationAxisKey = (typeof NARRATION_AXES)[number]['key'];
export type NarrationScores = Record<NarrationAxisKey, number>;

export interface NarrationStyle {
  id: string;
  name: string;
  description: string;
  scores: NarrationScores;
  prompt: string;
}

export const NARRATION_STYLES: NarrationStyle[] = [
  {
    id: 'equilibre',
    name: 'Équilibré',
    description: 'Un peu de tout : rythme régulier, personnages crédibles, intrigue qui avance.',
    scores: { social: 3, emotion: 3, coherence: 4, immersion: 3, plot: 3 },
    prompt: 'Équilibre dialogue, action et description. Fais avancer l’histoire à un rythme régulier sans sacrifier la cohérence ni la personnalité des PNJ.',
  },
  {
    id: 'intrigue',
    name: 'Intrigue soutenue',
    description: 'Rebondissements, enjeux, secrets : l’histoire avance vite.',
    scores: { social: 2, emotion: 3, coherence: 3, immersion: 3, plot: 5 },
    prompt: 'Priorise le développement de l’intrigue : introduis des enjeux, des complications, des indices et des rebondissements crédibles. Termine souvent sur une tension ou une question ouverte. Évite les scènes qui stagnent.',
  },
  {
    id: 'emotionnel',
    name: 'Émotionnel & piquant',
    description: 'Tension, désir, conflits, répliques qui font mouche.',
    scores: { social: 4, emotion: 5, coherence: 3, immersion: 3, plot: 3 },
    prompt: 'Accentue les émotions et le piquant : tension (romantique, conflictuelle ou dramatique), répliques vives, réactions intenses mais crédibles des personnages. Montre les sentiments par les gestes, le ton et les non-dits.',
  },
  {
    id: 'immersif',
    name: 'Immersif & détaillé',
    description: 'Sensations, décors, ambiance : on s’y croirait.',
    scores: { social: 3, emotion: 3, coherence: 4, immersion: 5, plot: 2 },
    prompt: 'Privilégie l’immersion : détails sensoriels (sons, odeurs, lumière, textures), décors vivants, gestes précis. Prends le temps de poser l’ambiance avant de faire avancer l’action.',
  },
  {
    id: 'slowburn',
    name: 'Slow-burn social',
    description: 'Relations qui se construisent lentement, sous-entendus, finesse.',
    scores: { social: 5, emotion: 4, coherence: 4, immersion: 3, plot: 2 },
    prompt: 'Mise sur la finesse sociale : relations qui évoluent lentement, sous-entendus, langage corporel, malaises et complicités. Les PNJ ont des motivations et une mémoire des interactions ; rien n’est précipité.',
  },
  {
    id: 'realiste',
    name: 'Cohérent & réaliste',
    description: 'Logique stricte, conséquences réalistes, pas de facilités.',
    scores: { social: 4, emotion: 2, coherence: 5, immersion: 4, plot: 3 },
    prompt: 'Sois strictement cohérent et réaliste : respecte la logique du monde, la chronologie, les capacités des personnages et les conséquences des actes. Pas de deus ex machina ni de facilités narratives.',
  },
];

export const DEFAULT_NARRATION_STYLE_ID = 'equilibre';

export function getNarrationStyle(id?: string | null): NarrationStyle {
  return NARRATION_STYLES.find((s) => s.id === id) ?? NARRATION_STYLES[0];
}

export function formatNarrationStyleForPrompt(id?: string | null): string {
  const s = getNarrationStyle(id);
  return [`### STYLE DE NARRATION — ${s.name}`, s.prompt, '(Les règles du roleplay restent prioritaires sur ce style.)'].join('\n');
}
