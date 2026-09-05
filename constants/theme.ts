// Dynamic theme colors — components should call useThemeColors() to get reactive colors.
// The static Colors export is kept for StyleSheet.create() backward compat (dark theme defaults).

export const Colors = {
  bg: '#0A0C10',
  bgCard: '#111520',
  bgCardAlt: '#161B28',
  border: '#1E2535',
  borderAccent: '#2A3550',
  primary: '#3D7EFF',
  primaryLight: '#5B99FF',
  primaryDark: '#2563EB',
  accent: '#00FF88',
  accentDim: '#00CC6A',
  accentGlow: 'rgba(0,255,136,0.15)',
  warning: '#FFB800',
  error: '#FF4455',
  success: '#00FF88',
  textPrimary: '#F0F4FF',
  textSecondary: '#8899BB',
  textMuted: '#445577',
  textMono: '#A0FFCC',
  gradientTop: '#0A0C10',
  gradientBottom: '#0D1526',
};

export const LightColors = {
  bg: '#F4F6FB',
  bgCard: '#FFFFFF',
  bgCardAlt: '#EDF0F7',
  border: '#D8DEF0',
  borderAccent: '#B8C4E0',
  primary: '#2563EB',
  primaryLight: '#3D7EFF',
  primaryDark: '#1E4FCC',
  accent: '#00A85A',
  accentDim: '#00874A',
  accentGlow: 'rgba(0,168,90,0.12)',
  warning: '#D97706',
  error: '#DC2626',
  success: '#00A85A',
  textPrimary: '#111827',
  textSecondary: '#4B5A78',
  textMuted: '#9AAAC0',
  textMono: '#065F46',
  gradientTop: '#F4F6FB',
  gradientBottom: '#E8ECF8',
};

export const DarkColors = { ...Colors };

/** User-overridable theme slots (settings → Interface). */
export type CustomPalette = {
  bg?: string;
  bgCard?: string;
  textPrimary?: string;
  primary?: string;
  border?: string;
  accent?: string;
};

export type ThemeColorMap = typeof DarkColors;

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function normalizeHex(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  let h = input.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
    const r = h[1], g = h[2], b = h[3];
    h = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return fallback;
  return h.toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex, '');
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => clampByte(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Relative luminance (WCAG) 0–1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = [rgb.r, rgb.g, rgb.b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  return rgbToHex(
    A.r + (B.r - A.r) * t,
    A.g + (B.g - A.g) * t,
    A.b + (B.b - A.b) * t,
  );
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/**
 * Build a full palette from light/dark base + optional custom slots.
 * Background luminance drives readable text/borders when those slots are unset.
 */
export function buildThemeColors(
  mode: 'dark' | 'light',
  custom: CustomPalette = {},
): ThemeColorMap {
  const base = mode === 'dark' ? DarkColors : LightColors;
  const bg = normalizeHex(custom.bg, base.bg);
  const lightBg = isLightColor(bg);

  // Prefer luminance of chosen background over the named mode when deriving
  // unset text/border/surface colors — mode still seeds defaults & accents.
  const derivedText = lightBg ? '#111827' : '#F0F4FF';
  const derivedSecondary = lightBg ? '#4B5A78' : '#8899BB';
  const derivedMuted = lightBg ? '#9AAAC0' : '#445577';
  const derivedBorder = lightBg ? mix(bg, '#111827', 0.14) : mix(bg, '#F0F4FF', 0.12);
  const derivedBorderAccent = lightBg ? mix(bg, '#111827', 0.22) : mix(bg, '#F0F4FF', 0.2);
  const derivedCard = lightBg ? mix(bg, '#FFFFFF', 0.85) : mix(bg, '#FFFFFF', 0.06);
  const derivedCardAlt = lightBg ? mix(bg, '#111827', 0.04) : mix(bg, '#FFFFFF', 0.1);

  const textPrimary = normalizeHex(custom.textPrimary, derivedText);
  const border = normalizeHex(custom.border, derivedBorder);
  const bgCard = normalizeHex(custom.bgCard, derivedCard);
  const primary = normalizeHex(custom.primary, base.primary);
  const accent = normalizeHex(custom.accent, base.accent);

  return {
    ...base,
    bg,
    bgCard,
    bgCardAlt: custom.bgCard ? mix(bgCard, lightBg ? '#111827' : '#FFFFFF', lightBg ? 0.04 : 0.08) : derivedCardAlt,
    border,
    borderAccent: custom.border ? mix(border, textPrimary, 0.25) : derivedBorderAccent,
    primary,
    primaryLight: mix(primary, '#FFFFFF', 0.18),
    primaryDark: mix(primary, '#000000', 0.18),
    accent,
    accentDim: mix(accent, '#000000', 0.15),
    accentGlow: withAlpha(accent, lightBg ? 0.12 : 0.15),
    textPrimary,
    textSecondary: custom.textPrimary
      ? mix(textPrimary, bg, 0.35)
      : derivedSecondary,
    textMuted: custom.textPrimary
      ? mix(textPrimary, bg, 0.55)
      : derivedMuted,
    textMono: lightBg ? mix(accent, '#000000', 0.35) : mix(accent, '#FFFFFF', 0.35),
    gradientTop: bg,
    gradientBottom: mix(bg, primary, lightBg ? 0.06 : 0.12),
  };
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  xs: 4,
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  body: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
