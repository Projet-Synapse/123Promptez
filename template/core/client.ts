import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

class SupabaseManager {
  private static instance: SupabaseClient | null = null;
  private static creating = false;
  private static creationCount = 0;
  private static appStateSub: { remove: () => void } | null = null;

  static getClient(): SupabaseClient {

    if (this.instance) {
      return this.instance;
    }

    if (this.creating) {
      throw new Error('[Template:Client] Client is being created, please wait');
    }

    this.creating = true;
    this.creationCount++;
    
    try {
      console.log(`[Template:Client] Creating Supabase client instance #${this.creationCount}`);
      
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        const errorMsg = '[Template:Client] Supabase environment variables missing\n' +
          'Please check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      if (this.creationCount > 1) {
        console.warn(`[Template:Client] ⚠️ Multiple client creation detected! This is creation #${this.creationCount}`);
        console.warn('[Template:Client] This may indicate a development environment hot reload or architecture issue.');
      }

      // Session persistée par appareil (comme 123Créez / 123Écriture) :
      // - natif : AsyncStorage (pas de localStorage → sinon session en mémoire
      //   seulement, reconnexion à chaque ouverture)
      // - web / Electron : localStorage de l'origine (http://127.0.0.1:47823
      //   côté desktop — port fixe, voir electron/static-server.js)
      const isWeb = Platform.OS === 'web';
      
      this.instance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: this.createStorageAdapter(),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: isWeb,
          flowType: 'pkce',
        },
      });

      this.installAutoRefreshOnForeground(this.instance);
      
      console.log('[Template:Client] Supabase client created successfully');
      return this.instance;
      
    } finally {
      this.creating = false;
    }
  }

  // Sur mobile, les timers JS sont gelés en arrière-plan : on ne rafraîchit
  // le jeton que lorsque l'app est au premier plan (reco. Supabase RN).
  private static installAutoRefreshOnForeground(c: SupabaseClient) {
    if (Platform.OS === 'web') return;
    this.appStateSub?.remove();
    if (AppState.currentState === 'active') c.auth.startAutoRefresh();
    this.appStateSub = AppState.addEventListener('change', (st) => {
      if (st === 'active') c.auth.startAutoRefresh();
      else c.auth.stopAutoRefresh();
    });
  }

  private static createStorageAdapter = () => {
    if (Platform.OS === 'web') {
      return {
        getItem: (key: string) => {
          if (typeof window !== 'undefined' && window.localStorage) {
            return Promise.resolve(window.localStorage.getItem(key));
          }
          return Promise.resolve(null);
        },
        setItem: (key: string, value: string) => {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
            return Promise.resolve();
          }
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
            return Promise.resolve();
          }
          return Promise.resolve();
        },
      };
    } else {
      return AsyncStorage;
    }
  }
}

export const getSharedSupabaseClient = (): SupabaseClient => {
  return SupabaseManager.getClient();
};

export const safeSupabaseOperation = async <T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> => {
  const client = getSharedSupabaseClient();
  return await operation(client);
};
