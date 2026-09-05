import { AuthUser, SendOTPOptions, SignUpResult, GoogleSignInResult, SendOTPResult, AuthResult, LogoutResult } from '../types';
import { safeSupabaseOperation, getSharedSupabaseClient } from '../../core/client';
import { configManager } from '../../core/config';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Ensure Web platform correctly handles auth callbacks
WebBrowser.maybeCompleteAuthSession();

// Visibility change listener related variables
let lastVisibilityChange = 0;
let visibilityListener: (() => void) | null = null;

// Operation state tracking to prevent deadlock
let isUpdatingUserInOTPFlow = false;

const TIMEOUT_CONFIG = {
  AUTH_OPERATIONS: 10000,
  DATA_QUERIES: 8000,  
  SESSION_REFRESH: 5000,
  USER_UPDATE: 15000,
};

// Utility function to add timeout to any Promise with proper cleanup
const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string = 'Operation'
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timeout after ${timeoutMs/1000} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const isAuthError = (error: any): boolean => {
  if (error.message?.includes('timeout')) return false;
  return error.status === 401 || 
         error.status === 403 || 
         error.message?.includes('invalid_token');
};

// Visibility monitoring logic - used to optimize auth event handling
const setupVisibilityMonitoring = () => {
  if (visibilityListener || Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  visibilityListener = () => {
    lastVisibilityChange = Date.now();
  };

  document.addEventListener('visibilitychange', visibilityListener);
};

export const isVisibilityTriggeredAuthEvent = (event: string): boolean => {
  if (event !== 'SIGNED_IN') return false;

  const timeSinceVisibilityChange = Date.now() - lastVisibilityChange;
  return timeSinceVisibilityChange < 1000;
};

export const getLastVisibilityChange = (): number => lastVisibilityChange;

// Enhanced event filtering to prevent deadlock
export const shouldIgnoreAuthEvent = (event: string): boolean => {
  // Ignore USER_UPDATED events during updateUser operation to prevent deadlock
  if (event === 'USER_UPDATED' && isUpdatingUserInOTPFlow) {
    return true;
  }
  
  // Ignore visibility-triggered events
  if (isVisibilityTriggeredAuthEvent(event)) {
    return true;
  }
  
  return false;
};

export class AuthService {
  constructor() {
    // Initialize visibility monitoring
    setupVisibilityMonitoring();
  }

  private get supabase() {
    return getSharedSupabaseClient();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const session = await safeSupabaseOperation(async (client) => {
        const { data: { session }, error } = await withTimeout(
          client.auth.getSession(),
          TIMEOUT_CONFIG.DATA_QUERIES,
          'GetSession'
        );
        
        if (error) throw error;
        return session;
      });

      if (!session?.user) return null;

      // Map session.user to AuthUser (unified for all auth methods)
      return this.mapSessionToAuthUser(session.user);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown getCurrentUser error';
      
      if (isAuthError(error)) {
        return null;
      }
      
      return null;
    }
  }

  // Unified session.user mapping - used by all auth flows
  private mapSessionToAuthUser(sessionUser: any): AuthUser {
    return {
      id: sessionUser.id,
      email: sessionUser.email || '',
      username: sessionUser.user_metadata?.username || 
               sessionUser.user_metadata?.full_name || 
               sessionUser.user_metadata?.name || 
               sessionUser.email?.split('@')[0] || 
               `user_${sessionUser.id.slice(0, 8)}`,
      created_at: sessionUser.created_at,
      updated_at: sessionUser.updated_at || sessionUser.created_at,
    };
  }

  async sendOTP(email: string, options: SendOTPOptions = {}): Promise<SendOTPResult> {
    try {
      const { shouldCreateUser = true, emailRedirectTo } = options;
      
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser,
              emailRedirectTo,
            }
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SendOTP'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Network is slow, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sendOTP error';
      console.warn('[Template:AuthService] SendOTP system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Network connection timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: 'Failed to send verification code', errorType: 'network' };
    }
  }

  async verifyOTPAndLogin(email: string, otp: string, options?: { password?: string }): Promise<AuthResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        // Step 1: Verify OTP first
        const { data, error } = await withTimeout(
          client.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'VerifyOTP'
        );

        if (error) {
          if (error.message.includes('Database error saving new user')) {
            console.warn('[Template:AuthService] Database trigger missing, auth function available but user profile creation failed');
            console.warn('[Template:AuthService] Please refer to SDK documentation to set up user_profiles table and triggers');
          }
          
          if (error.message.includes('timeout')) {
            return { error: 'Verification timeout, please retry', user: null, errorType: 'timeout' };
          }
          
          return { error: error.message, user: null, errorType: 'business' };
        }

        if (data.user) {
  
          // Step 2: Update user with password if provided (with deadlock prevention)
          if (options?.password) {
            
            try {
              // Set flag to prevent deadlock
              isUpdatingUserInOTPFlow = true;
              
              const { data: updateData, error: updateError } = await withTimeout(
                client.auth.updateUser({ password: options.password }),
                TIMEOUT_CONFIG.USER_UPDATE,
                'UpdateUser'
              );
              
              
              if (updateError) {
                console.warn('[Template:AuthService] User update failed after OTP verification:', updateError.message);
                // Note: We don't fail the entire operation if user update fails
                // The user is still successfully authenticated via OTP
              }
              
              // Clear flag after a delay to ensure all events are processed
              setTimeout(() => {
                isUpdatingUserInOTPFlow = false;
              }, 2000);
              
            } catch (updateError) {
              // Clear flag on error
              isUpdatingUserInOTPFlow = false;
              // Continue with the authentication flow
            }
          }

          // Standard flow: Check session status (wait a bit if we just updated user)
          if (options?.password) {
            // Wait a moment for the update to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          try {
            const authUser = await this.getCurrentUser();
            
            if (authUser) {
              return { user: authUser };
            } else {
              // Final fallback: Use original verification data
              const fallbackUser: AuthUser = {
                id: data.user.id,
                email: data.user.email || '',
                username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
                created_at: data.user.created_at,
                updated_at: data.user.updated_at || data.user.created_at,
              };
              return { user: fallbackUser };
            }
          } catch (userError) {
            const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
            
            // Use fallback data
            const fallbackUser: AuthUser = {
              id: data.user.id,
              email: data.user.email || '',
              username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
              created_at: data.user.created_at,
              updated_at: data.user.updated_at || data.user.created_at,
            };
            return { user: fallbackUser };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown verifyOTP error';
      console.warn('[Template:AuthService] VerifyOTPAndLogin system exception:', errorMessage);
      
      // Clear flag on any error
      isUpdatingUserInOTPFlow = false;
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Login timeout, please retry', user: null, errorType: 'timeout' };
      }
      
      return { error: 'Login failed', user: null, errorType: 'network' };
    }
  }

  async signUpWithPassword(email: string, password: string, metadata: Record<string, any> = {}): Promise<SignUpResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signUp({
            email,
            password,
            options: {
              data: metadata
            }
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignUp'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Sign up timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }

        if (data.user && !data.session) {
          return { 
            user: null, 
            needsEmailConfirmation: true 
          };
        }

        if (data.user && data.session) {
          try {
            const authUser = await this.getCurrentUser();
            return { user: authUser };
          } catch (userError) {
            console.warn('[Template:AuthService] Error retrieving user after signup:', userError);
            return { error: 'Sign up succeeded but failed to load profile', user: null, errorType: 'network' };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signUp error';
      console.warn('[Template:AuthService] SignUpWithPassword system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Sign up timeout, please retry', errorType: 'timeout' };
      }
      
      return { error: 'Sign up failed', errorType: 'network' };
    }
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signInWithPassword({
            email,
            password
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignIn'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Sign in timeout, please retry', user: null, errorType: 'timeout' };
          }
          return { error: error.message, user: null, errorType: 'business' };
        }

        if (data.user) {
          try {
            const authUser = await this.getCurrentUser();
            
            if (authUser) {
              return { user: authUser };
            } else {
              return { error: 'Failed to load user profile', user: null, errorType: 'business' };
            }
          } catch (userError) {
            console.warn('[Template:AuthService] Error retrieving user after sign in:', userError);
            return { error: 'Sign in succeeded but failed to load profile', user: null, errorType: 'network' };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signIn error';
      console.warn('[Template:AuthService] SignInWithPassword system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Sign in timeout, please retry', user: null, errorType: 'timeout' };
      }
      
      return { error: 'Sign in failed', user: null, errorType: 'network' };
    }
  }

  async logout(): Promise<LogoutResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signOut(),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'Logout'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Logout timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown logout error';
      console.warn('[Template:AuthService] Logout system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Logout timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: errorMessage, errorType: 'network' };
    }
  }

  async updatePassword(newPassword: string): Promise<LogoutResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.updateUser({ password: newPassword }),
          TIMEOUT_CONFIG.USER_UPDATE,
          'UpdatePassword'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Password update timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }

        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown updatePassword error';
      console.warn('[Template:AuthService] UpdatePassword system exception:', errorMessage);

      if (errorMessage.includes('timeout')) {
        return { error: 'Password update timeout, please check network and retry', errorType: 'timeout' };
      }

      return { error: errorMessage, errorType: 'network' };
    }
  }

  // Sends a password-recovery email. Unlike sendOTP, this one is meant to
  // stay a clickable link (Supabase's "Reset Password" template) — clicking
  // it signs the user into a short-lived recovery session, from which
  // updateUser({password}) / updatePassword() above sets the new password.
  async requestPasswordReset(email: string): Promise<SendOTPResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.resetPasswordForEmail(email),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'RequestPasswordReset'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Network is slow, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }

        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown requestPasswordReset error';
      console.warn('[Template:AuthService] RequestPasswordReset system exception:', errorMessage);

      if (errorMessage.includes('timeout')) {
        return { error: 'Network connection timeout, please check network and retry', errorType: 'timeout' };
      }

      return { error: 'Failed to send password reset email', errorType: 'network' };
    }
  }

  async refreshSession() {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.refreshSession(),
          TIMEOUT_CONFIG.SESSION_REFRESH,
          'RefreshSession'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            console.warn('[Template:AuthService] Session refresh timeout');
          } else {
            console.warn('[Template:AuthService] Refresh session error:', error);
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown refresh error';
      console.warn('[Template:AuthService] RefreshSession system exception:', errorMessage);
    }
  }


  private getGoogleRedirectUrl(): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const { origin, pathname } = window.location;
      const segments = pathname.split('/').filter(Boolean);
      const base = segments[0] === '123Promptez' ? '/123Promptez' : '';
      return `${origin}${base}/login`;
    }

    return AuthSession.makeRedirectUri({
      scheme: 'onspaceapp',
      path: 'auth',
    });
  }

  private mapGoogleOAuthError(raw: string): string {
    const msg = (raw || '').toLowerCase();
    if (msg.includes('redirect') || msg.includes('url not allowed') || msg.includes('not allowed')) {
      return "Adresse de retour non autorisée. Vérifiez les Redirect URLs dans Supabase Auth.";
    }
    if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
      return 'Le fournisseur Google n’est pas activé dans Supabase Auth.';
    }
    if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('dismiss')) {
      return 'Connexion Google annulée.';
    }
    return raw;
  }

  async signInWithGoogle(): Promise<GoogleSignInResult> {
    try {
      const redirectUrl = this.getGoogleRedirectUrl();

      const { data, error } = await withTimeout(
        this.supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              prompt: 'select_account',
            },
            skipBrowserRedirect: Platform.OS !== 'web'
          }
        }),
        TIMEOUT_CONFIG.AUTH_OPERATIONS,
        'GoogleOAuth'
      );

      if (error) {
        return { error: this.mapGoogleOAuthError(`Échec Google : ${error.message}`) };
      }

      if (!data?.url) {
        return { error: 'Impossible de démarrer la connexion Google. Réessayez.' };
      }

      // Web: forcer la navigation (sur GitHub Pages le redirect interne peut ne rien faire)
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && data.url) {
          window.location.assign(data.url);
        }
        return { error: null };
      }

      // Mobile: flux OAuth manuel
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success') {
        const url = result.url;
        
        try {
          const params = new URL(url).searchParams;
          const code = params.get('code');
          
          if (!code) {
            const error = params.get('error');
            const errorDescription = params.get('error_description');
            
            if (error) {
              return { 
                error: this.mapGoogleOAuthError(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`)
              };
            }
            
            return { error: 'No authorization code received' };
          }

          const { data: sessionData, error: sessionError } = await withTimeout(
            this.supabase.auth.exchangeCodeForSession(code),
            TIMEOUT_CONFIG.AUTH_OPERATIONS,
            'ExchangeCode'
          );

          if (sessionError) {
            return { error: this.mapGoogleOAuthError(`Session exchange failed: ${sessionError.message}`) };
          }

          if (sessionData.user) {
            return { error: null };
          }
          
          return { error: 'Failed to establish session' };
          
        } catch (parseError) {
          return { 
            error: `Callback parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          };
        }
      } else if (result.type === 'cancel') {
        return { error: 'Connexion Google annulée.' };
      } else {
        return { error: 'OAuth authentication failed' };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Google login error';
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Google login timeout, please retry' };
      }
      
      return { 
        error: this.mapGoogleOAuthError(`Google login failed: ${errorMessage}`)
      };
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    try {
      const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
        async (event, session) => {
          // Use enhanced event filtering to prevent deadlock
          if (shouldIgnoreAuthEvent(event)) {
            return;
          }
          
          if (session?.user) {
            try {
              const authUser = this.mapSessionToAuthUser(session.user);
              callback(authUser);
            } catch (error) {
              console.warn('[Template:AuthService] Error in auth state change callback:', error);
              callback(null);
            }
          } else {
            callback(null);
          }
        }
      );

      return subscription;
    } catch (error) {
      console.error('[Template:AuthService] Failed to set up auth state listener:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();