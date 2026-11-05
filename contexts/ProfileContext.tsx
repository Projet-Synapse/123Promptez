import React, { createContext, useState, useContext, ReactNode, useCallback, useRef } from 'react';

/** Limites de caractères du mode Simulation / Roleplay. */
export interface RoleplaySettings {
  /** Max caractères saisis par l'utilisatrice */
  maxUserChars: number;
  /** Max caractères attendus des réponses du chatbot */
  maxBotChars: number;
}

export const DEFAULT_ROLEPLAY_SETTINGS: RoleplaySettings = {
  maxUserChars: 1000,
  maxBotChars: 2000,
};

export const ROLEPLAY_CHAR_BOUNDS = {
  user: { min: 100, max: 4000 },
  bot: { min: 100, max: 8000 },
} as const;

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function normalizeRoleplaySettings(raw: unknown): RoleplaySettings {
  const r = raw && typeof raw === 'object' ? (raw as any) : {};
  return {
    maxUserChars: clampInt(
      r.maxUserChars,
      ROLEPLAY_CHAR_BOUNDS.user.min,
      ROLEPLAY_CHAR_BOUNDS.user.max,
      DEFAULT_ROLEPLAY_SETTINGS.maxUserChars,
    ),
    maxBotChars: clampInt(
      r.maxBotChars,
      ROLEPLAY_CHAR_BOUNDS.bot.min,
      ROLEPLAY_CHAR_BOUNDS.bot.max,
      DEFAULT_ROLEPLAY_SETTINGS.maxBotChars,
    ),
  };
}

export function getRoleplaySettings(profile: UserProfile | null | undefined): RoleplaySettings {
  return normalizeRoleplaySettings(profile?.roleplay);
}

export interface UserProfile {
  name: string;
  email: string;
  bio: string;
  role: string;
  language: string;
  aiMemory: AiMemoryItem[];
  /** Réglages Roleplay (Simulation) — absents sur les anciens profils → défauts */
  roleplay?: RoleplaySettings;
}

export interface AiMemoryItem {
  id: string;
  content: string;
  category: 'preference' | 'fact' | 'goal' | 'context' | 'constraint';
  createdAt: Date;
}

interface ProfileContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addMemory: (item: Omit<AiMemoryItem, 'id' | 'createdAt'>) => void;
  updateMemory: (id: string, content: string) => void;
  removeMemory: (id: string) => void;
  hydrateFromCloud: (data: unknown) => void;
}

const DEFAULT_PROFILE: UserProfile = {
  name: '', email: '', bio: '', role: '', language: 'Français',
  aiMemory: [{ id: 'mem-demo-1', content: 'Je préfère des réponses concises et directes', category: 'preference', createdAt: new Date() }],
};

function reviveDates(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) result[key] = new Date(v);
    else if (v && typeof v === 'object') result[key] = reviveDates(v);
    else result[key] = v;
  }
  return result;
}

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface Props { children: ReactNode; onDataChange?: (profile: UserProfile) => void; }

export function ProfileProvider({ children, onDataChange }: Props) {
  const [profile, setProfileRaw] = useState<UserProfile>(DEFAULT_PROFILE);
  const isHydrating = useRef(false);

  const setProfile = useCallback((updater: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setProfileRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!isHydrating.current) onDataChange?.(next);
      return next;
    });
  }, [onDataChange]);

  const hydrateFromCloud = useCallback((data: unknown) => {
    if (!data) return;
    try {
      isHydrating.current = true;
      const parsed = reviveDates(data) as UserProfile;
      if (parsed && typeof parsed === 'object') {
        setProfileRaw({
          ...DEFAULT_PROFILE,
          ...parsed,
          aiMemory: Array.isArray(parsed.aiMemory) ? parsed.aiMemory : DEFAULT_PROFILE.aiMemory,
          roleplay: normalizeRoleplaySettings(parsed.roleplay),
        });
      }
    } catch (e) {
      console.warn('[ProfileContext] hydrateFromCloud failed:', e);
    } finally {
      isHydrating.current = false;
    }
  }, []);

  const updateProfile = (updates: Partial<UserProfile>) =>
    setProfile(prev => {
      const next = { ...prev, ...updates };
      if (updates.roleplay !== undefined) {
        next.roleplay = normalizeRoleplaySettings({ ...prev.roleplay, ...updates.roleplay });
      }
      return next;
    });

  const addMemory = (item: Omit<AiMemoryItem, 'id' | 'createdAt'>) =>
    setProfile(prev => ({ ...prev, aiMemory: [...prev.aiMemory, { ...item, id: `mem-${Date.now()}`, createdAt: new Date() }] }));

  const updateMemory = (id: string, content: string) =>
    setProfile(prev => ({ ...prev, aiMemory: prev.aiMemory.map(m => m.id === id ? { ...m, content } : m) }));

  const removeMemory = (id: string) =>
    setProfile(prev => ({ ...prev, aiMemory: prev.aiMemory.filter(m => m.id !== id) }));

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, addMemory, updateMemory, removeMemory, hydrateFromCloud }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
