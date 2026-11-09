/**
 * Horloge in-game Simulation (t232u). Format stocké : "YYYY-MM-DD HH:MM" (heure naïve, sans fuseau).
 */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Préfixe d’un message « marqueur de temps » (rendu centré dans le chat). */
export const TIME_MARKER_PREFIX = '⟦TEMPS⟧';

/** true si le jour in-game change entre deux horloges (→ marqueur affiché). */
export function clockDayChanged(before?: string | null, after?: string | null): boolean {
  return String(before ?? '').slice(0, 10) !== String(after ?? '').slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function defaultClock(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 09:00`;
}

export function parseClock(s?: string | null): Date | null {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function serializeClock(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function normalizeClock(s?: string | null): string | undefined {
  const d = parseClock(s);
  return d ? serializeClock(d) : undefined;
}

/** « 12 mars 2026 - 07:30 » */
export function formatClockFr(s?: string | null): string {
  const d = parseClock(s);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Marqueur que l’IA place en 1re ligne : [TEMPS:+8h30], [TEMPS:+2j], [TEMPS:+45min], [TEMPS:=2026-03-12 07:30] */
const MARKER_RE = /^\s*\[TEMPS\s*:\s*([^\]]+)\]\s*\n?/i;

export function parseTimeMarker(text: string): { minutes?: number; absolute?: string; rest: string } | null {
  const m = String(text ?? '').match(MARKER_RE);
  if (!m) return null;
  const spec = m[1].trim();
  const rest = text.slice(m[0].length).replace(/^\s+/, '');
  if (spec.startsWith('=')) {
    const abs = normalizeClock(spec.slice(1).trim());
    return abs ? { absolute: abs, rest } : { rest };
  }
  const norm = spec.toLowerCase()
    .replace(/jours?|days?|d\b/g, 'j')
    .replace(/heures?/g, 'h')
    .replace(/minutes?|mins?/g, 'm');
  let minutes = 0;
  let any = false;
  const re = /(\d+(?:[.,]\d+)?)\s*([jhm])(?:\s*(\d{1,2})(?![\d.,]*\s*[jhm]))?/g;
  let r: RegExpExecArray | null;
  while ((r = re.exec(norm))) {
    any = true;
    const v = parseFloat(r[1].replace(',', '.'));
    if (r[2] === 'j') minutes += v * 1440;
    else if (r[2] === 'h') minutes += v * 60 + (r[3] ? +r[3] : 0);
    else minutes += v;
  }
  return any && minutes > 0 ? { minutes: Math.round(minutes), rest } : { rest };
}

/** Retire le marqueur (affichage du streaming). */
export function stripTimeMarker(text: string): string {
  return String(text ?? '').replace(MARKER_RE, '');
}

export function advanceClock(clock: string | undefined, minutes: number): string {
  const d = parseClock(clock) ?? parseClock(defaultClock())!;
  return serializeClock(new Date(d.getTime() + minutes * 60000));
}


/** Règle des marqueurs de temps — identique d'un tour à l'autre (cache-friendly). */
export const CLOCK_MARKER_RULE = [
  '### TEMPS IN-GAME',
  'Tiens compte du moment (jour/nuit, horaires, délais, fatigue, ouverture des lieux…).',
  'Si ta réponse fait passer du temps de façon notable (ex. le persona dort jusqu’au lendemain, voyage, ellipse), commence ta réponse par UNE ligne seule au format [TEMPS:+Xh] / [TEMPS:+Xh30] / [TEMPS:+Nj] / [TEMPS:+Nmin] (durée écoulée AVANT la scène que tu racontes), ou [TEMPS:=AAAA-MM-JJ HH:MM] pour une date précise. Pour de petits passages (quelques minutes), tu peux mettre [TEMPS:+Nmin]. N’écris jamais la date toi-même en tête : l’application l’affiche.',
].join('\n');

export function clockPromptBlock(clock?: string): string {
  const c = normalizeClock(clock) ?? defaultClock();
  return [
    CLOCK_MARKER_RULE,
    `Date et heure actuelles dans l’histoire : ${formatClockFr(c)}.`,
  ].join('\n');
}
