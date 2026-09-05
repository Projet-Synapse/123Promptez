import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { AuthUser } from '../types';
import { authService } from './service';

interface AuthContextState {
  user: AuthUser | null;
  loading: boolean;
  operationLoading: boolean;
  initialized: boolean;
}

interface AuthContextActions {
  setOperationLoading: (loading: boolean) => void;
}

type AuthContextType = AuthContextState & AuthContextActions;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthContextState>({
    user: null,
    loading: true,
    operationLoading: false,
    initialized: false,
  });

  const updateState = (updates: Partial<AuthContextState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      return newState;
    });
  };

  const setOperationLoading = (loading: boolean) => {
    updateState({ operationLoading: loading });
  };

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      try {
        // On web OAuth return, URL may contain `code=` while PKCE exchange is
        // still in flight. Poll briefly so we don't mark initialized with null
        // and leave the user stuck on /login before onAuthStateChange fires.
        const urlHasOAuthCode =
          typeof window !== 'undefined' &&
          (window.location.search.includes('code=') ||
            window.location.hash.includes('code=') ||
            window.location.search.includes('error=') ||
            window.location.hash.includes('error='));

        let currentUser = await authService.getCurrentUser();
        if (!currentUser && urlHasOAuthCode) {
          for (let i = 0; i < 3 && !currentUser; i++) {
            await new Promise((r) => setTimeout(r, 300));
            currentUser = await authService.getCurrentUser();
          }
        }

        if (isMounted) {
          updateState({
            user: currentUser,
            loading: false,
            initialized: true,
          });
        }

        authSubscription = authService.onAuthStateChange((authUser) => {
          if (isMounted) {
            updateState({ user: authUser });
          }
        });
      } catch (error) {
        console.warn('[Template:AuthProvider] Auth initialization failed:', error);
        if (isMounted) {
          updateState({
            user: null,
            loading: false,
            initialized: true,
          });
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (authSubscription?.unsubscribe) {
        authSubscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array ensures single execution
  const contextValue: AuthContextType = {
    ...state,
    setOperationLoading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuthContext Hook - internal use
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
}