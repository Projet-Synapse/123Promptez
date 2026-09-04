import React, { createContext, useState, useContext, ReactNode, useCallback, useRef } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  bio: string;
  role: string;
  language: string;
  aiMemory: AiMemoryItem[];
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
      if (parsed && typeof parsed === 'object') setProfileRaw(parsed);
    } catch (e) {
      console.warn('[ProfileContext] hydrateFromCloud failed:', e);
    } finally {
      isHydrating.current = false;
    }
  }, []);

  const updateProfile = (updates: Partial<UserProfile>) =>
    setProfile(prev => ({ ...prev, ...updates }));

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
