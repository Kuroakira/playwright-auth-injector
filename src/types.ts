/**
 * 型定義
 */

/** サポートするプロバイダー */
export type Provider = 'firebase' | 'supabase';

/** メイン設定 */
export interface AuthConfig {
  /** 使用するプロバイダー */
  provider: Provider;

  /** Firebase設定 */
  firebase?: FirebaseConfig;

  /** Supabase設定 */
  supabase?: SupabaseConfig;

  /** 複数ユーザープロファイル（オプション） */
  profiles?: Record<string, ProfileOverride>;

  /** デバッグモード */
  debug?: boolean;
}

/** Firebase設定 */
export interface FirebaseConfig {
  /** サービスアカウントJSON（文字列） */
  serviceAccount: string;

  /** Firebase Web API Key */
  apiKey: string;

  /** テストユーザーのUID */
  uid: string;
}

/** Supabase設定 */
export interface SupabaseConfig {
  /** Supabase Project URL */
  url: string;

  /** Supabase Anon Key */
  anonKey: string;

  /** テストユーザーのメールアドレス */
  email: string;

  /** テストユーザーのパスワード */
  password: string;
}

/** プロファイルオーバーライド */
export interface ProfileOverride {
  /** Firebase: 別のUID */
  uid?: string;

  /** Supabase: 別の認証情報 */
  email?: string;
  password?: string;
}

/** injectAuth オプション */
export interface InjectAuthOptions {
  /** 使用するプロファイル名 */
  profile?: string;

  /** 注入後の待機時間（ms）デフォルト: 2000 */
  waitAfter?: number;
}

/** Firebase REST API レスポンス */
export interface FirebaseTokenResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

/** Firebase ユーザー情報（IndexedDBに保存する形式） */
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

/** プロバイダーユーザー情報 */
export interface ProviderUserInfo {
  providerId: string;
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
}
