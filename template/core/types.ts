// Supabase configuration
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Auth module configuration (whether/how the auth module is enabled —
// distinct from auth/types.ts's AuthConfig, which is the auth service's
// own runtime config; both are re-exported from template/index.ts, so
// they must not share a name)
export interface AuthModuleConfig {
  enabled?: boolean;
  profileTableName?: string;
  autoCreateProfile?: boolean;
}

// Future module configuration interfaces
export interface PaymentsConfig {
  enabled?: boolean;
  stripePublishableKey?: string;
}

export interface StorageConfig {
  enabled?: boolean;
  defaultBucket?: string;
}

// Module configuration union type
export interface ModuleConfig {
  auth?: AuthModuleConfig | false;
  payments?: PaymentsConfig | false;
  storage?: StorageConfig | false;
}

// Main configuration interface
// `supabase` is optional: when EXPO_PUBLIC_SUPABASE_URL/ANON_KEY aren't set,
// createDefaultConfig()/createConfig() intentionally omit it and disable auth.
export interface OnSpaceConfig extends ModuleConfig {
  supabase?: SupabaseConfig;
}

// Runtime state
export interface SDKState {
  initialized: boolean;
  enabledModules: string[];
  config: OnSpaceConfig;
}

// Error type
export interface OnSpaceError {
  code: string;
  message: string;
  module?: string;
  details?: any;
}