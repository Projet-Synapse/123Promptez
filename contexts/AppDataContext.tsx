// AppDataContext — orchestrates cloud sync for all contexts.
// Passes onDataChange callbacks to WorkspaceProvider & ProfileProvider so every
// mutation is auto-saved to cloud after a 2-second debounce.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/template';
import { saveToCloud, loadAllUserData } from '@/services/cloudSyncService';

interface AppDataContextType {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;
  triggerSync: (dataType: 'workspaces' | 'bot_config' | 'profile', data: unknown) => Promise<void>;
  retrySync: () => Promise<void>;
  loadedData: {
    workspaces: unknown | null;
    bot_config: unknown | null;
    profile: unknown | null;
  };
  isDataLoaded: boolean;
  /** Recharge TOUT depuis le cloud puis incrémente reloadToken (ré-hydratation) */
  reloadFromCloud: () => Promise<void>;
  reloadToken: number;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loadedData, setLoadedData] = useState<{
    workspaces: unknown | null;
    bot_config: unknown | null;
    profile: unknown | null;
  }>({ workspaces: null, bot_config: null, profile: null });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const lastPayloads = useRef<Partial<Record<'workspaces' | 'bot_config' | 'profile', unknown>>>({});

  // Load all data when user logs in
  useEffect(() => {
    if (!user?.id) {
      setIsDataLoaded(false);
      setLoadedData({ workspaces: null, bot_config: null, profile: null });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await loadAllUserData(user.id);
        if (!cancelled) {
          setLoadedData({
            workspaces: (data as any).workspaces ?? null,
            bot_config: (data as any).bot_config ?? null,
            profile: (data as any).profile ?? null,
          });
          setIsDataLoaded(true);
        }
      } catch {
        if (!cancelled) setIsDataLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const triggerSync = useCallback(async (dataType: 'workspaces' | 'bot_config' | 'profile', data: unknown) => {
    if (!user?.id) return;
    lastPayloads.current[dataType] = data;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await saveToCloud(user.id, dataType, data);
      setLastSyncAt(new Date());
    } catch (e: any) {
      setSyncError(e.message ?? 'Échec de synchronisation');
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id]);

  const retrySync = useCallback(async () => {
    const entries = Object.entries(lastPayloads.current) as ['workspaces' | 'bot_config' | 'profile', unknown][];
    for (const [type, data] of entries) {
      if (data != null) await triggerSync(type, data);
    }
  }, [triggerSync]);

  // Recharge TOUT depuis le cloud puis incrémente reloadToken : CloudHydrator
  // ré-hydrate les contextes (utilisé quand l'IA modifie la bibliothèque côté
  // serveur — sinon le client écraserait les changements à sa prochaine sync).
  const reloadFromCloud = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await loadAllUserData(user.id);
      setLoadedData({
        workspaces: (data as any).workspaces ?? null,
        bot_config: (data as any).bot_config ?? null,
        profile: (data as any).profile ?? null,
      });
      setReloadToken(t => t + 1);
    } catch {
      // silencieux — un nouvel essai partira à la prochaine modification
    }
  }, [user?.id]);

  return (
    <AppDataContext.Provider value={{ isSyncing, lastSyncAt, syncError, triggerSync, retrySync, loadedData, isDataLoaded, reloadFromCloud, reloadToken }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
