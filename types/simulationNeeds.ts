/**
 * Besoins façon Sims (module optionnel) — 0…100.
 * Baissent avec l’horloge in-game, remontent avec les actions (passe d’extraction).
 */
export type NeedKey = 'hunger' | 'energy' | 'hygiene' | 'social' | 'fun' | 'mood';

export type SimulationNeeds = Record<NeedKey, number>;

export const NEED_META: Record<NeedKey, { label: string; icon: string; perHour: number }> = {
  hunger: { label: 'Faim', icon: 'restaurant', perHour: 6 },
  energy: { label: 'Énergie', icon: 'bolt', perHour: 4 },
  hygiene: { label: 'Hygiène', icon: 'shower', perHour: 3 },
  social: { label: 'Social', icon: 'groups', perHour: 3 },
  fun: { label: 'Loisirs', icon: 'sports-esports', perHour: 4 },
  mood: { label: 'Humeur', icon: 'mood', perHour: 1.5 },
};

export const NEED_KEYS = Object.keys(NEED_META) as NeedKey[];
export const NEED_CRITICAL = 20;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function emptyNeeds(partial?: Partial<SimulationNeeds> | null): SimulationNeeds {
  const out = {} as SimulationNeeds;
  for (const k of NEED_KEYS) {
    const v = Number((partial as any)?.[k]);
    out[k] = Number.isFinite(v) ? clamp(v) : 80;
  }
  return out;
}

/** Décroissance selon les minutes in-game écoulées (max 3 jours d’un coup). */
export function decayNeeds(needs: SimulationNeeds, minutes: number): SimulationNeeds {
  const h = Math.max(0, Math.min(72 * 60, minutes)) / 60;
  const out = { ...needs };
  for (const k of NEED_KEYS) out[k] = clamp(needs[k] - NEED_META[k].perHour * h);
  return out;
}

/** Applique des deltas (LLM) bornés à ±60. */
export function applyNeedDeltas(needs: SimulationNeeds, deltas: Partial<Record<NeedKey, number>>): SimulationNeeds {
  const out = { ...needs };
  for (const k of NEED_KEYS) {
    const d = Number((deltas as any)?.[k]);
    if (Number.isFinite(d) && d !== 0) out[k] = clamp(needs[k] + Math.max(-60, Math.min(60, d)));
  }
  return out;
}

/** Besoins qui viennent de passer sous le seuil critique. */
export function newlyCriticalNeeds(before: SimulationNeeds, after: SimulationNeeds): NeedKey[] {
  return NEED_KEYS.filter((k) => before[k] > NEED_CRITICAL && after[k] <= NEED_CRITICAL);
}

export function needColor(v: number): string {
  if (v <= NEED_CRITICAL) return '#E53935';
  if (v <= 50) return '#FB8C00';
  return '#43A047';
}

export function formatNeedsForPrompt(needs: SimulationNeeds): string {
  const lines = NEED_KEYS.map((k) => `- ${NEED_META[k].label} : ${needs[k]}/100${needs[k] <= NEED_CRITICAL ? ' (CRITIQUE)' : ''}`);
  return [
    '#### Besoins du persona (0 = au plus bas, 100 = comblé)',
    ...lines,
    'Fais ressentir ces besoins dans la narration (fatigue, faim, irritabilité…) ; un besoin CRITIQUE pèse nettement sur les actions et l’humeur.',
  ].join('\n');
}
