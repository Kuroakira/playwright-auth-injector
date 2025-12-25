# Playwright Auth Injector: インターフェース詳細設計

## 1. 設計原則

### 1.1 型安全性
- すべての公開APIはTypeScriptの型で保護
- `unknown`や`any`の使用を最小限に
- ジェネリクスによるプロバイダー固有の型サポート

### 1.2 エラーハンドリング
- Result型パターンによる明示的なエラー処理
- カスタムエラークラスによる詳細なエラー情報

### 1.3 拡張性
- Strategy Patternによるプロバイダー追加の容易さ
- プラグイン可能なストレージバックエンド

---

## 2. コアインターフェース

### 2.1 AuthStrategy (メインインターフェース)

```typescript
/**
 * 認証プロバイダーの共通インターフェース
 * 各プロバイダー(Firebase, Supabase等)はこのインターフェースを実装する
 */
export interface AuthStrategy<
  TConfig extends BaseAuthConfig = BaseAuthConfig,
  TSession extends AuthSession = AuthSession
> {
  /**
   * プロバイダー識別子
   * @example 'firebase', 'supabase', 'amplify', 'auth0'
   */
  readonly name: AuthProviderName;

  /**
   * プロバイダーの設定を検証
   * @param config - プロバイダー固有の設定
   * @returns 検証結果（成功時は正規化された設定を返す）
   */
  validateConfig(config: unknown): Result<TConfig, AuthConfigError>;

  /**
   * 認証を実行しセッションを取得
   * @param config - 検証済みの設定
   * @returns 認証セッション
   */
  authenticate(config: TConfig): Promise<Result<TSession, AuthError>>;

  /**
   * セッションからブラウザストレージ状態を生成
   * @param session - 認証セッション
   * @param config - プロバイダー設定
   * @returns ブラウザに注入するストレージ状態
   */
  getStorageState(session: TSession, config: TConfig): StorageState;

  /**
   * ストレージ注入スクリプトを生成
   * @param state - ストレージ状態
   * @returns ブラウザで実行するスクリプト文字列
   */
  getInjectionScript(state: StorageState): string;
}
```

### 2.2 AuthProviderName (プロバイダー識別子)

```typescript
/**
 * サポートする認証プロバイダーの識別子
 */
export type AuthProviderName =
  | 'firebase'
  | 'supabase'
  | 'amplify'
  | 'auth0';

/**
 * プロバイダー名からConfigを解決する型マップ
 */
export type ProviderConfigMap = {
  firebase: FirebaseAuthConfig;
  supabase: SupabaseAuthConfig;
  amplify: AmplifyAuthConfig;
  auth0: Auth0AuthConfig;
};
```

---

## 3. セッション型

### 3.1 AuthSession (基底セッション型)

```typescript
/**
 * 認証セッションの基底型
 * すべてのプロバイダーが共通して持つ情報
 */
export interface AuthSession {
  /** プロバイダー識別子 */
  provider: AuthProviderName;

  /** ユーザー識別子 */
  userId: string;

  /** アクセストークン */
  accessToken: string;

  /** リフレッシュトークン（存在する場合） */
  refreshToken?: string;

  /** トークン有効期限（Unix timestamp in milliseconds） */
  expiresAt: number;

  /** セッション取得時刻 */
  issuedAt: number;
}
```

### 3.2 プロバイダー固有セッション型

```typescript
/**
 * Firebase固有のセッション情報
 */
export interface FirebaseAuthSession extends AuthSession {
  provider: 'firebase';

  /** Firebase ID Token */
  idToken: string;

  /** ユーザーのメールアドレス */
  email?: string;

  /** メール確認済みフラグ */
  emailVerified: boolean;

  /** 匿名ユーザーフラグ */
  isAnonymous: boolean;

  /** プロバイダーデータ（Google, GitHub等の連携情報） */
  providerData: ProviderUserInfo[];

  /** Firebase API Key */
  apiKey: string;
}

/**
 * Supabase固有のセッション情報
 */
export interface SupabaseAuthSession extends AuthSession {
  provider: 'supabase';

  /** Supabase Project Reference ID */
  projectRef: string;

  /** ユーザーメタデータ */
  userMetadata?: Record<string, unknown>;

  /** アプリメタデータ */
  appMetadata?: Record<string, unknown>;
}

/**
 * Amplify (Cognito) 固有のセッション情報
 */
export interface AmplifyAuthSession extends AuthSession {
  provider: 'amplify';

  /** Cognito ID Token */
  idToken: string;

  /** Cognito User Pool ID */
  userPoolId: string;

  /** Cognito Client ID */
  clientId: string;

  /** Identity Pool ID（Federated Identitiesを使用する場合） */
  identityPoolId?: string;
}

/**
 * Auth0固有のセッション情報
 */
export interface Auth0AuthSession extends AuthSession {
  provider: 'auth0';

  /** Auth0 ID Token */
  idToken: string;

  /** Auth0 Domain */
  domain: string;

  /** Auth0 Client ID */
  clientId: string;

  /** スコープ */
  scope?: string;
}
```

### 3.3 プロバイダーユーザー情報

```typescript
/**
 * OAuth連携プロバイダーのユーザー情報
 */
export interface ProviderUserInfo {
  /** プロバイダーID (google.com, github.com等) */
  providerId: string;

  /** プロバイダーでのユーザーID */
  uid: string;

  /** 表示名 */
  displayName?: string;

  /** メールアドレス */
  email?: string;

  /** 電話番号 */
  phoneNumber?: string;

  /** プロフィール画像URL */
  photoURL?: string;
}
```

---

## 4. ストレージ状態型

### 4.1 StorageState (ブラウザ注入用)

```typescript
/**
 * ブラウザに注入するストレージ状態
 */
export interface StorageState {
  /** LocalStorage に保存するエントリ */
  localStorage?: LocalStorageEntry[];

  /** IndexedDB に保存するエントリ */
  indexedDB?: IndexedDBEntry[];

  /** Cookie に設定するエントリ */
  cookies?: CookieEntry[];

  /** SessionStorage に保存するエントリ */
  sessionStorage?: SessionStorageEntry[];
}
```

### 4.2 ストレージエントリ型

```typescript
/**
 * LocalStorage エントリ
 */
export interface LocalStorageEntry {
  /** キー名 */
  key: string;

  /** 値（JSON文字列化される） */
  value: unknown;
}

/**
 * IndexedDB エントリ
 */
export interface IndexedDBEntry {
  /** データベース名 */
  databaseName: string;

  /** データベースバージョン */
  version: number;

  /** オブジェクトストア名 */
  storeName: string;

  /** キー */
  key: string;

  /** 値 */
  value: unknown;
}

/**
 * Cookie エントリ
 */
export interface CookieEntry {
  /** Cookie名 */
  name: string;

  /** 値 */
  value: string;

  /** ドメイン */
  domain?: string;

  /** パス */
  path?: string;

  /** 有効期限 (Unix timestamp in seconds) */
  expires?: number;

  /** HttpOnly フラグ */
  httpOnly?: boolean;

  /** Secure フラグ */
  secure?: boolean;

  /** SameSite 設定 */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * SessionStorage エントリ
 */
export interface SessionStorageEntry {
  /** キー名 */
  key: string;

  /** 値 */
  value: unknown;
}
```

---

## 5. 設定型

### 5.1 BaseAuthConfig (基底設定)

```typescript
/**
 * 全プロバイダー共通の基底設定
 */
export interface BaseAuthConfig {
  /** プロバイダー種別 */
  type: AuthProviderName;

  /** デバッグモード */
  debug?: boolean;

  /** タイムアウト（ミリ秒） */
  timeout?: number;
}
```

### 5.2 プロバイダー固有設定

```typescript
/**
 * Firebase認証設定
 */
export interface FirebaseAuthConfig extends BaseAuthConfig {
  type: 'firebase';

  /** サービスアカウントJSON（文字列またはオブジェクト） */
  serviceAccount: string | ServiceAccountCredential;

  /** テストユーザーのUID */
  uid: string;

  /** Firebase Web API Key */
  apiKey: string;

  /** カスタムクレーム（オプション） */
  customClaims?: Record<string, unknown>;
}

/**
 * Supabase認証設定
 */
export interface SupabaseAuthConfig extends BaseAuthConfig {
  type: 'supabase';

  /** Supabase Project URL */
  url: string;

  /** Supabase Anon Key または Service Role Key */
  key: string;

  /** テストユーザーのメールアドレス */
  email: string;

  /** テストユーザーのパスワード */
  password: string;
}

/**
 * AWS Amplify (Cognito) 認証設定
 */
export interface AmplifyAuthConfig extends BaseAuthConfig {
  type: 'amplify';

  /** AWS Region */
  region: string;

  /** Cognito User Pool ID */
  userPoolId: string;

  /** Cognito App Client ID */
  clientId: string;

  /** テストユーザーのユーザー名 */
  username: string;

  /** テストユーザーのパスワード */
  password: string;

  /** Identity Pool ID（オプション） */
  identityPoolId?: string;
}

/**
 * Auth0認証設定
 */
export interface Auth0AuthConfig extends BaseAuthConfig {
  type: 'auth0';

  /** Auth0 Domain */
  domain: string;

  /** Auth0 Client ID */
  clientId: string;

  /** Auth0 Client Secret */
  clientSecret: string;

  /** テストユーザーのメールアドレス */
  email: string;

  /** テストユーザーのパスワード */
  password: string;

  /** Audience（APIの場合） */
  audience?: string;

  /** スコープ */
  scope?: string;
}
```

### 5.3 サービスアカウント型

```typescript
/**
 * Firebase Service Account Credential
 */
export interface ServiceAccountCredential {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}
```

---

## 6. エラー型

### 6.1 カスタムエラークラス

```typescript
/**
 * 認証エラーの基底クラス
 */
export abstract class AuthError extends Error {
  abstract readonly code: string;
  abstract readonly provider?: AuthProviderName;

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * 設定エラー
 */
export class AuthConfigError extends AuthError {
  readonly code = 'CONFIG_ERROR';

  constructor(
    message: string,
    public readonly field?: string,
    public readonly provider?: AuthProviderName,
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * 認証失敗エラー
 */
export class AuthenticationError extends AuthError {
  readonly code = 'AUTHENTICATION_ERROR';

  constructor(
    message: string,
    public readonly provider: AuthProviderName,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * トークン交換エラー
 */
export class TokenExchangeError extends AuthError {
  readonly code = 'TOKEN_EXCHANGE_ERROR';

  constructor(
    message: string,
    public readonly provider: AuthProviderName,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * ストレージ注入エラー
 */
export class StorageInjectionError extends AuthError {
  readonly code = 'STORAGE_INJECTION_ERROR';

  constructor(
    message: string,
    public readonly storageType: 'localStorage' | 'indexedDB' | 'cookie' | 'sessionStorage',
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * タイムアウトエラー
 */
export class AuthTimeoutError extends AuthError {
  readonly code = 'TIMEOUT_ERROR';

  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly provider?: AuthProviderName,
    cause?: Error
  ) {
    super(message, cause);
  }
}
```

### 6.2 エラーコード定数

```typescript
/**
 * エラーコード定数
 */
export const AuthErrorCodes = {
  // 設定エラー
  CONFIG_MISSING_REQUIRED: 'CONFIG_MISSING_REQUIRED',
  CONFIG_INVALID_FORMAT: 'CONFIG_INVALID_FORMAT',
  CONFIG_INVALID_CREDENTIALS: 'CONFIG_INVALID_CREDENTIALS',

  // 認証エラー
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_USER_DISABLED: 'AUTH_USER_DISABLED',
  AUTH_TOO_MANY_REQUESTS: 'AUTH_TOO_MANY_REQUESTS',

  // トークンエラー
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXCHANGE_FAILED: 'TOKEN_EXCHANGE_FAILED',

  // ストレージエラー
  STORAGE_NOT_AVAILABLE: 'STORAGE_NOT_AVAILABLE',
  STORAGE_INJECTION_FAILED: 'STORAGE_INJECTION_FAILED',

  // その他
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AuthErrorCode = typeof AuthErrorCodes[keyof typeof AuthErrorCodes];
```

---

## 7. Result型

### 7.1 Result型定義

```typescript
/**
 * 成功結果
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  readonly error?: never;
}

/**
 * 失敗結果
 */
export interface Err<E> {
  readonly ok: false;
  readonly value?: never;
  readonly error: E;
}

/**
 * Result型（成功または失敗）
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;
```

### 7.2 Result ユーティリティ

```typescript
/**
 * Result型のファクトリ関数
 */
export const Result = {
  /**
   * 成功結果を作成
   */
  ok<T>(value: T): Ok<T> {
    return { ok: true, value };
  },

  /**
   * 失敗結果を作成
   */
  err<E>(error: E): Err<E> {
    return { ok: false, error };
  },

  /**
   * Promiseをラップしてエラーをキャッチ
   */
  async fromPromise<T, E = Error>(
    promise: Promise<T>,
    errorMapper?: (e: unknown) => E
  ): Promise<Result<T, E>> {
    try {
      const value = await promise;
      return Result.ok(value);
    } catch (e) {
      const error = errorMapper
        ? errorMapper(e)
        : (e as E);
      return Result.err(error);
    }
  },

  /**
   * Result の値を変換
   */
  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (result.ok) {
      return Result.ok(fn(result.value));
    }
    return result;
  },

  /**
   * Result をフラット化
   */
  flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> {
    if (result.ok) {
      return fn(result.value);
    }
    return result;
  },

  /**
   * 成功時の値を取得、失敗時はデフォルト値
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.ok ? result.value : defaultValue;
  },

  /**
   * 成功時の値を取得、失敗時は例外をスロー
   */
  unwrap<T, E extends Error>(result: Result<T, E>): T {
    if (result.ok) {
      return result.value;
    }
    throw result.error;
  },
} as const;
```

---

## 8. メインAPI型

### 8.1 injectAuth 関数

```typescript
import type { Page, BrowserContext } from '@playwright/test';

/**
 * 認証注入オプション
 */
export interface InjectAuthOptions {
  /** 注入後にリロードするか（デフォルト: false） */
  reload?: boolean;

  /** 注入後の待機時間（ミリ秒） */
  waitAfterInjection?: number;

  /** デバッグモード */
  debug?: boolean;
}

/**
 * 認証注入結果
 */
export interface InjectAuthResult {
  /** 成功フラグ */
  success: boolean;

  /** 使用したプロバイダー */
  provider: AuthProviderName;

  /** ユーザーID */
  userId: string;

  /** トークン有効期限 */
  expiresAt: number;
}

/**
 * メイン関数のシグネチャ
 */
export function injectAuth(
  page: Page,
  providerName: AuthProviderName,
  options?: InjectAuthOptions
): Promise<Result<InjectAuthResult, AuthError>>;

/**
 * BrowserContext に対して認証を注入
 * 複数ページで共有する場合に使用
 */
export function injectAuthToContext(
  context: BrowserContext,
  providerName: AuthProviderName,
  options?: InjectAuthOptions
): Promise<Result<InjectAuthResult, AuthError>>;
```

---

## 9. 型ガード

```typescript
/**
 * AuthSessionの型ガード
 */
export function isFirebaseSession(
  session: AuthSession
): session is FirebaseAuthSession {
  return session.provider === 'firebase';
}

export function isSupabaseSession(
  session: AuthSession
): session is SupabaseAuthSession {
  return session.provider === 'supabase';
}

export function isAmplifySession(
  session: AuthSession
): session is AmplifyAuthSession {
  return session.provider === 'amplify';
}

export function isAuth0Session(
  session: AuthSession
): session is Auth0AuthSession {
  return session.provider === 'auth0';
}

/**
 * エラーの型ガード
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isAuthConfigError(error: unknown): error is AuthConfigError {
  return error instanceof AuthConfigError;
}
```

---

## 10. 次のステップ

1. **設定スキーマ設計**: Zodを使った設定ファイルのバリデーション詳細
2. **各プロバイダー実装詳細**: Firebase, Supabase, Amplify, Auth0の個別設計
3. **ストレージ注入戦略**: IndexedDB/LocalStorage/Cookieの使い分け
