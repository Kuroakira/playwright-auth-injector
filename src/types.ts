/**
 * Type definitions
 */

/** Supported providers */
export type Provider = 'firebase' | 'supabase';

/** Main configuration */
export interface AuthConfig {
  /** Provider to use */
  provider: Provider;

  /** Firebase configuration */
  firebase?: FirebaseConfig;

  /** Supabase configuration */
  supabase?: SupabaseConfig;

  /** Multiple user profiles (optional) */
  profiles?: Record<string, ProfileOverride>;

  /** Debug mode */
  debug?: boolean;
}

/** Firebase configuration */
export interface FirebaseConfig {
  /** Service account JSON (string) */
  serviceAccount: string;

  /** Firebase Web API Key */
  apiKey: string;

  /** Test user's UID */
  uid: string;
}

/** Supabase configuration */
export interface SupabaseConfig {
  /** Supabase Project URL */
  url: string;

  /** Supabase Anon Key */
  anonKey: string;

  /** Test user's email address */
  email: string;

  /** Test user's password */
  password: string;
}

/** Profile override */
export interface ProfileOverride {
  /** Firebase: alternative UID */
  uid?: string;

  /** Supabase: alternative credentials */
  email?: string;
  password?: string;
}

/** injectAuth options */
export interface InjectAuthOptions {
  /** Profile name to use */
  profile?: string;

  /** Wait time after injection (ms) default: 2000 */
  waitAfter?: number;
}

/** Firebase REST API response */
export interface FirebaseTokenResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

/** Firebase user info (format stored in IndexedDB) */
export interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: ProviderUserInfo[];
  stsTokenManager: {
    accessToken: string;
    refreshToken: string;
    expirationTime: number;
  };
  createdAt: string;
  lastLoginAt: string;
  apiKey: string;
  appName: string;
}

/** Provider user info */
export interface ProviderUserInfo {
  providerId: string;
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
}
