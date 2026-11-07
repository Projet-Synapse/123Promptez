/**
 * Points de sauvegarde / branches Simulation.
 * Un instantané = l’état Simulation (mémoire, inventaire, horloge…) + position dans le fil.
 */
export interface SimulationSave {
  id: string;
  label: string;
  createdAt: string;
  /** Dernier message inclus dans la sauvegarde (null = début) */
  messageId: string | null;
  messageCount: number;
  /** Horloge in-game au moment de la sauvegarde (affichage) */
  clock?: string;
  /** Instantané SimulationData (sans `saves`) */
  snapshot: any;
}

export const SIMULATION_SAVES_MAX = 30;

export function normalizeSaves(raw: any): SimulationSave[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === 'object' && s.id && s.snapshot)
    .map((s) => ({
      id: String(s.id),
      label: String(s.label ?? 'Sauvegarde'),
      createdAt: String(s.createdAt ?? new Date().toISOString()),
      messageId: s.messageId ? String(s.messageId) : null,
      messageCount: Number(s.messageCount) || 0,
      clock: s.clock ? String(s.clock) : undefined,
      snapshot: s.snapshot,
    }))
    .slice(0, SIMULATION_SAVES_MAX);
}

/** Copie profonde sans les sauvegardes elles-mêmes. */
export function snapshotSimulation(sim: any): any {
  const { saves: _drop, ...rest } = sim ?? {};
  return JSON.parse(JSON.stringify(rest));
}

export function makeSave(sim: any, messages: { id: string }[], label?: string): SimulationSave {
  const last = messages[messages.length - 1];
  return {
    id: `save-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: label?.trim() || `Sauvegarde ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`,
    createdAt: new Date().toISOString(),
    messageId: last?.id ?? null,
    messageCount: messages.length,
    clock: sim?.world?.clock,
    snapshot: snapshotSimulation(sim),
  };
}

/** Sauvegarde la plus récente positionnée au plus tard à `index` (dans la liste des messages). */
export function nearestSaveAtOrBefore(saves: SimulationSave[], messages: { id: string }[], index: number): SimulationSave | null {
  let best: SimulationSave | null = null;
  let bestIdx = -2;
  for (const s of saves) {
    const i = s.messageId ? messages.findIndex((m) => m.id === s.messageId) : -1;
    if (s.messageId && i < 0) continue;
    if (i <= index && i > bestIdx) { best = s; bestIdx = i; }
  }
  return best;
}
