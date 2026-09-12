// AppDataContext — orchestrates cloud sync for all contexts.
// Passes onDataChange callbacks to WorkspaceProvider & ProfileProvider so every
// mutation is auto-saved to cloud after a 2-second debounce.
//
// GARDE-FOU MULTI-ONGLETS : deux onglets ouverts = deux états en concurrence,
// chacun resauvegarde sa version et ÉCRASE l'autre (import effacé par un
// onglet chargé avant — perte de données réelle). Seul l'onglet LEADER (le
// plus ancien encore vivant) sauvegarde dans le cloud ; les autres affichent
// un avertissement et restent locaux.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/template';
import { saveToCloud, loadAllUserData } from '@/services/cloudSyncService';
import { recordDiag } from '@/services/diagnostics';

interface AppDataContextType {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncError: string | null;
  /** false si un AUTRE onglet de l'app est le leader de sauvegarde */
  isLeader: boolean;
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

  // ── Élection du tab leader (web) ────────────────────────────────────
  const tabIdRef = useRef(Math.random().toString(36).slice(2, 9));
  const startedAtRef = useRef(Date.now());
  const [isLeader, setIsLeader] = useState(true);
  const isLeaderRef = useRef(true);
  useEffect(() => { isLeaderRef.current = isLeader; }, [isLeader]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const KEY = 'promptez.tabs.heartbeat';
    const beat = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
        raw[tabIdRef.current] = { startedAt: startedAtRef.current, at: Date.now() };
        for (const id of Object.keys(raw)) {
          if (Date.now() - raw[id].at > 8000) delete raw[id]; // onglet mort
        }
        localStorage.setItem(KEY, JSON.stringify(raw));
        const ids = Object.keys(raw);
        const leaderId = ids.sort((a, b) => raw[a].startedAt - raw[b].startedAt)[0];
        setIsLeader(leaderId === tabIdRef.current);
      } catch {
        // stockage indisponible : on reste leader par défaut
      }
    };
    beat();
    const iv = setInterval(beat, 3000);
    const unload = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
        delete raw[tabIdRef.current];
        localStorage.setItem(KEY, JSON.stringify(raw));
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', unload);
    return () => { clearInterval(iv); window.removeEventListener('beforeunload', unload); };
  }, []);

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
    // Un onglet NON leader ne sauvegarde PAS : ses données restent locales,
    // l'onglet leader (le plus ancien) garde la main sur le cloud.
    if (!isLeaderRef.current) {
      recordDiag('sync.bloqué', `${dataType} — onglet non leader (un autre onglet sauvegarde)`);
      return;
    }
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
    <AppDataContext.Provider value={{ isSyncing, lastSyncAt, syncError, isLeader, triggerSync, retrySync, loadedData, isDataLoaded, reloadFromCloud, reloadToken }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
