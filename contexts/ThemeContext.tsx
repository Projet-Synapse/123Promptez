// Powered by OnSpace.AI
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Colors, LightColors, DarkColors } from '@/constants/theme';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  colors: typeof DarkColors;
  isDark: boolean;
}

export { DarkColors, LightColors };

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  const applyColors = (newMode: ThemeMode) => {
    const src = newMode === 'dark' ? DarkColors : LightColors;
    // Mutate the shared Colors object so all StyleSheet.create() references update
    (Object.keys(src) as Array<keyof typeof src>).forEach(key => {
      (Colors as any)[key] = src[key];
    });
  };

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyColors(next);
      return next;
    });
  };

  const setTheme = (m: ThemeMode) => {
    setMode(m);
    applyColors(m);
  };

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
