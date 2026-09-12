// diagnostics — FINI LES DEVINETTES : capture les erreurs réelles de l'appli
// et produit un rapport compact que l'utilisatrice colle tel quel dans la
// conversation. Le protocole :
//   1. Le problème se produit → ne rien refaire de spécial
//   2. Paramètres ▸ « Copier le diagnostic » → coller le texte à l'agent
// Le rapport contient : version, plateforme, sonde scrollbar, et les
// DERNIÈRES erreurs réellement capturées (pas des suppositions).
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface DiagEntry {
  at: string;
  kind: string;
  message: string;
}

const ENTRIES_MAX = 40;
let entries: DiagEntry[] = [];

/** Enregistre un événement de diagnostic (erreur, échec réseau, état inhabituel). */
export function recordDiag(kind: string, message: string): void {
  entries.unshift({ at: new Date().toISOString(), kind, message: String(message).slice(0, 400) });
  if (entries.length > ENTRIES_MAX) entries = entries.slice(0, ENTRIES_MAX);
}

/** Liste des événements capturés (du plus récent au plus ancien). */
export function getDiagEntries(): DiagEntry[] {
  return [...entries];
}

let installed = false;

/** Capte les erreurs NON rattrapées de la page (web). À monter une fois. */
export function installGlobalDiag(): void {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', e => {
    recordDiag('window.error', `${e.message} (${e.filename?.split('/').pop() ?? '?'}:${e.lineno})`);
  });
  window.addEventListener('unhandledrejection', e => {
    const reason: any = e.reason;
    recordDiag('promesse.rejetée', reason?.message ?? String(reason));
  });
}

export interface ScrollbarProbe {
  styleInjectee: boolean;
  conteneurDéfilantTrouvé: boolean;
  overflowY?: string;
  /** scrollbar-width calculé sur le conteneur trouvé */
  scrollbarWidth?: string;
  /** largeur réelle occupée par la barre (0 = invisible) */
  largeurBarrePx?: number;
  navigateur?: string;
}

/** Sonde la page : existe-t-il un conteneur défilant, et sa barre occupe-t-elle de la place ? */
function probeScrollbar(): ScrollbarProbe | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const probe: ScrollbarProbe = {
    styleInjectee: !!document.getElementById('promptez-scrollbars'),
    conteneurDéfilantTrouvé: false,
    navigateur: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 90) : undefined,
  };
  const scrollables = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(el => {
    const o = getComputedStyle(el);
    return /(auto|scroll)/.test(o.overflowY) && el.scrollHeight > el.clientHeight + 4;
  });
  if (scrollables.length > 0) {
    const el = scrollables[0];
    const cs = getComputedStyle(el);
    probe.conteneurDéfilantTrouvé = true;
    probe.overflowY = cs.overflowY;
    probe.scrollbarWidth = cs.scrollbarWidth;
    probe.largeurBarrePx = el.offsetWidth - el.clientWidth;
  }
  return probe;
}

/** Rapport complet, prêt à coller dans la conversation. */
export async function collectDiagnostics(contexte?: string): Promise<string> {
  const expoAny = Constants as any;
  const report = {
    quoi: contexte ?? 'diagnostic manuel',
    horodaté: new Date().toISOString(),
    application: {
      nom: expoAny.expoConfig?.name ?? '?',
      version: expoAny.expoConfig?.version ?? '?',
      plateforme: Platform.OS,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      écran: typeof window !== 'undefined' ? window.location.hash || window.location.pathname : undefined,
    },
    scrollbar: probeScrollbar(),
    erreursRécentes: entries,
  };
  return JSON.stringify(report, null, 2);
}
