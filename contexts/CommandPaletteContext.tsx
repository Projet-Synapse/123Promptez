// Global command palette / search (Cmd/Ctrl+K)
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Platform } from 'react-native';

interface CommandPaletteContextType {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen(v => !v), []);

  // Web / Electron: listen for Cmd/Ctrl+K
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Electron IPC shortcuts (menu accelerators)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const api = (window as any).electronApp;
    if (!api?.onShortcut) return;
    const unsub = api.onShortcut((action: string) => {
      if (action === 'command-palette') setOpen(true);
    });
    return typeof unsub === 'function' ? unsub : undefined;
  }, []);

  const value = useMemo(() => ({ open, openPalette, closePalette, togglePalette }), [open, openPalette, closePalette, togglePalette]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}
