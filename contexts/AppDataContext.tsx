// Powered by OnSpace.AI
// Manages cloud sync of all user app data (workspaces, bot config, profile)
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/template';
import { saveToCloud, loadAllUserData } from '@/services/cloudSyncService';

interface AppDataContextType {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;
  triggerSync: (dataType: 'workspaces' | 'bot_config' | 'profile', data: unknown) => Promise<void>;
  loadedData: {
    workspaces: unknown | null;
    bot_config: unknown | null;
    profile: unknown | null;
  };
  isDataLoaded: boolean;
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
      } catch (e) {
        if (!cancelled) setIsDataLoaded(true); // Still mark loaded so app works offline
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const triggerSync = useCallback(async (dataType: 'workspaces' | 'bot_config' | 'profile', data: unknown) => {
    if (!user?.id) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await saveToCloud(user.id, dataType, data);
      setLastSyncAt(new Date());
    } catch (e: any) {
      setSyncError(e.message ?? 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id]);

  return (
    <AppDataContext.Provider value={{ isSyncing, lastSyncAt, syncError, triggerSync, loadedData, isDataLoaded }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
