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
