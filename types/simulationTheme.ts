/** Thème UI par conversation Simulation (bulles + fond) — pas le thème global app. */

export type SimulationThemeId =
  | 'default'
  | 'violet'
  | 'ocean'
  | 'forest'
  | 'ember'
  | 'noir'
  | 'rose';

/** Couleurs appliquées à une conversation Simulation (hors `default` = thème app). */
export interface SimulationThemeColors {
  bg: string;
  bgCard: string;
  userBubble: string;
  accent: string;
}

export interface SimulationThemeMeta {
  id: SimulationThemeId;
  label: string;
  /** Aperçu mobile : 3 pastilles (fond / bulle joueur / accent) */
  swatches: [string, string, string];
  /** null = garder le thème global de l’app */
  colors: SimulationThemeColors | null;
}

export const SIMULATION_THEME_META: SimulationThemeMeta[] = [
  {
    id: 'default',
    label: 'Défaut (app)',
    swatches: ['#0A0C10', '#3D7EFF', '#00FF88'],
    colors: null,
  },
  {
    id: 'violet',
    label: 'Violet RP',
    swatches: ['#120A18', '#7C3AED', '#C084FC'],
    colors: {
      bg: '#120A18',
      bgCard: '#1C1028',
      userBubble: '#7C3AED',
      accent: '#C084FC',
    },
  },
  {
    id: 'ocean',
    label: 'Océan',
    swatches: ['#07131C', '#0284C7', '#38BDF8'],
    colors: {
      bg: '#07131C',
      bgCard: '#0C1E2C',
      userBubble: '#0284C7',
      accent: '#38BDF8',
    },
  },
  {
    id: 'forest',
    label: 'Forêt',
    swatches: ['#0A1410', '#059669', '#34D399'],
    colors: {
      bg: '#0A1410',
      bgCard: '#10201A',
      userBubble: '#059669',
      accent: '#34D399',
    },
  },
  {
    id: 'ember',
    label: 'Braise',
    swatches: ['#160C08', '#EA580C', '#FBBF24'],
    colors: {
      bg: '#160C08',
      bgCard: '#24140E',
      userBubble: '#EA580C',
      accent: '#FBBF24',
    },
  },
  {
    id: 'noir',
    label: 'Noir',
    swatches: ['#050505', '#525252', '#A3A3A3'],
    colors: {
      bg: '#050505',
      bgCard: '#141414',
      userBubble: '#404040',
      accent: '#A3A3A3',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    swatches: ['#160812', '#DB2777', '#F9A8D4'],
    colors: {
      bg: '#160812',
      bgCard: '#24101C',
      userBubble: '#DB2777',
      accent: '#F9A8D4',
    },
  },
];

export function normalizeSimulationThemeId(raw: unknown): SimulationThemeId {
  const id = String(raw ?? 'default');
  return SIMULATION_THEME_META.some((m) => m.id === id) ? (id as SimulationThemeId) : 'default';
}

export function resolveSimulationThemeColors(
  id: SimulationThemeId | undefined | null,
): SimulationThemeColors | null {
  const meta = SIMULATION_THEME_META.find((m) => m.id === (id ?? 'default'));
  return meta?.colors ?? null;
}

export function simulationThemeLabel(id: SimulationThemeId | undefined | null): string {
  const meta = SIMULATION_THEME_META.find((m) => m.id === (id ?? 'default'));
  return meta?.label ?? 'Défaut (app)';
}
