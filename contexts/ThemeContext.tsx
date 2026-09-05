import React, { createContext, useState, useContext, useEffect, useMemo, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Colors,
  DarkColors,
  LightColors,
  buildThemeColors,
  type CustomPalette,
  type ThemeColorMap,
} from '@/constants/theme';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = '@123promptez/theme_prefs_v1';

interface ThemePrefs {
  mode: ThemeMode;
  custom: CustomPalette;
}

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  colors: ThemeColorMap;
  isDark: boolean;
  customPalette: CustomPalette;
  setCustomColor: (key: keyof CustomPalette, value: string | undefined) => void;
  setCustomPalette: (palette: CustomPalette) => void;
  resetCustomPalette: () => void;
}

export { DarkColors, LightColors };

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applySharedColors(palette: ThemeColorMap) {
  (Object.keys(palette) as (keyof ThemeColorMap)[]).forEach(key => {
    (Colors as any)[key] = palette[key];
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [custom, setCustom] = useState<CustomPalette>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as ThemePrefs;
          if (parsed.mode === 'dark' || parsed.mode === 'light') setMode(parsed.mode);
          if (parsed.custom && typeof parsed.custom === 'object') setCustom(parsed.custom);
        }
      } catch {
        // ignore corrupt prefs
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, custom } satisfies ThemePrefs)).catch(() => {});
  }, [mode, custom, hydrated]);

  const colors = useMemo(() => buildThemeColors(mode, custom), [mode, custom]);

  useEffect(() => {
    applySharedColors(colors);
  }, [colors]);

  const toggleTheme = useCallback(() => {
    setMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((m: ThemeMode) => {
    setMode(m);
  }, []);

  const setCustomColor = useCallback((key: keyof CustomPalette, value: string | undefined) => {
    setCustom(prev => {
      const next = { ...prev };
      if (!value || !value.trim()) delete next[key];
      else next[key] = value.trim();
      return next;
    });
  }, []);

  const setCustomPalette = useCallback((palette: CustomPalette) => {
    setCustom(palette);
  }, []);

  const resetCustomPalette = useCallback(() => {
    setCustom({});
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    mode,
    toggleTheme,
    setTheme,
    colors,
    isDark: mode === 'dark',
    customPalette: custom,
    setCustomColor,
    setCustomPalette,
    resetCustomPalette,
  }), [mode, toggleTheme, setTheme, colors, custom, setCustomColor, setCustomPalette, resetCustomPalette]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
