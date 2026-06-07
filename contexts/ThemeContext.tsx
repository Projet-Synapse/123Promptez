// Powered by OnSpace.AI
import React, { createContext, useState, useContext, ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

export const DarkColors = {
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

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  colors: typeof DarkColors;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  const toggleTheme = () => setMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  const setTheme = (m: ThemeMode) => setMode(m);
  const colors = mode === 'dark' ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme, colors, isDark: mode === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
