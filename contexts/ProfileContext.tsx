// Powered by OnSpace.AI
import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  bio: string;
  role: string;
  language: string;
  // What the AI should remember about the user
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
}

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  email: '',
  bio: '',
  role: '',
  language: 'Français',
  aiMemory: [
    {
      id: 'mem-demo-1',
      content: 'Je préfère des réponses concises et directes',
      category: 'preference',
      createdAt: new Date(),
    },
  ],
};

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const addMemory = (item: Omit<AiMemoryItem, 'id' | 'createdAt'>) => {
    const newItem: AiMemoryItem = {
      ...item,
      id: `mem-${Date.now()}`,
      createdAt: new Date(),
    };
    setProfile(prev => ({ ...prev, aiMemory: [...prev.aiMemory, newItem] }));
  };

  const updateMemory = (id: string, content: string) => {
    setProfile(prev => ({
      ...prev,
      aiMemory: prev.aiMemory.map(m => m.id === id ? { ...m, content } : m),
    }));
  };

  const removeMemory = (id: string) => {
    setProfile(prev => ({
      ...prev,
      aiMemory: prev.aiMemory.filter(m => m.id !== id),
    }));
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, addMemory, updateMemory, removeMemory }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
