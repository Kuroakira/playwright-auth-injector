# Playwright Auth Injector: 最小設計 v0.1

## 設計思考の記録

### 前提条件
- **対象**: OSS公開（npm）
- **初期対応**: Firebase + Supabase
- **拡張予定**: あり（Amplify, Auth0, Clerk等）
- **DX方針**: 設定ファイル + 1行で使える

### 設計判断
| 決定事項 | 選択 | 理由 |
|----------|------|------|
| 抽象化レベル | 最小限で開始 | 2つ実装して初めてパターンが見える |
| API設計 | シンプル優先 | OSSはDXが最重要 |
| エラー処理 | throw（標準的） | Resultは過剰設計 |
| 進め方 | Firebase→設計見直し→Supabase | 実装から学ぶ |

---

## 1. ユーザー体験（最終形）

### インストール
```bash
npm install -D playwright-auth-injector
```

### 設定ファイル作成
```typescript
// playwright-auth.config.ts
import { defineConfig } from 'playwright-auth-injector';

export default defineConfig({
  provider: 'firebase',
  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT!,
    apiKey: process.env.FIREBASE_API_KEY!,
    uid: process.env.TEST_USER_UID!,
  },
});
```

### セットアップ
```typescript
// e2e/tests/auth.setup.ts
import { test as setup } from '@playwright/test';
import { injectAuth } from 'playwright-auth-injector';

setup('authenticate', async ({ page }) => {
  await injectAuth(page);
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

### テストで使用
```typescript
// e2e/tests/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('認証済みページにアクセス', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

---

## 2. 公開API

### injectAuth

```typescript
import type { Page } from '@playwright/test';

/**
 * 認証状態をブラウザに注入する
 *
 * @param page - Playwright Page オブジェクト
 * @param options - オプション設定
 * @returns 注入が完了したら resolve
 * @throws AuthError - 認証失敗時
 *
 * @example
 * // 基本的な使い方
 * await injectAuth(page);
 *
 * @example
 * // プロファイル指定
 * await injectAuth(page, { profile: 'admin' });
 */
export async function injectAuth(
  page: Page,
  options?: InjectAuthOptions
): Promise<void>;
```

### defineConfig

```typescript
/**
 * 設定ファイルの型安全なヘルパー
 *
 * @example
 * export default defineConfig({
 *   provider: 'firebase',
 *   firebase: { ... }
 * });
 */
export function defineConfig(config: AuthConfig): AuthConfig;
```

---

## 3. 型定義

### 設定型

```typescript
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
```

### オプション型

```typescript
/** injectAuth オプション */
export interface InjectAuthOptions {
  /** 使用するプロファイル名 */
  profile?: string;

  /** 注入後の待機時間（ms） */
  waitAfter?: number;
}
```

### エラー型

```typescript
/** 認証エラー基底クラス */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** エラーコード */
export type AuthErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'AUTH_FAILED'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'INJECTION_FAILED';
```

---

## 4. 内部構造（Phase 1: Firebaseのみ）

```
src/
├── index.ts              # 公開API (injectAuth, defineConfig)
├── config.ts             # 設定ファイル読み込み
├── firebase.ts           # Firebase認証ロジック
└── errors.ts             # エラークラス
```

### 処理フロー

```
injectAuth(page)
    │
    ▼
┌─────────────────────────┐
│ 1. 設定ファイル読み込み   │  config.ts
│    playwright-auth.config │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Firebase認証         │  firebase.ts
│    - Admin SDK初期化     │
│    - カスタムトークン生成 │
│    - REST APIでトークン交換│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. IndexedDB注入        │  firebase.ts
│    - addInitScript      │
│    - firebaseLocalStorage│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. ページ遷移 & 待機     │
│    - goto('/')          │
│    - waitForTimeout     │
└─────────────────────────┘
```

---

## 5. Phase 2以降の拡張ポイント

### Supabase追加時に検討すること

```typescript
// 共通化できそうな部分
interface AuthProvider {
  authenticate(config: unknown): Promise<TokenData>;
  getStorageEntries(token: TokenData): StorageEntry[];
  getInjectionScript(entries: StorageEntry[]): string;
}

// プロバイダーごとの違い
// - Firebase: IndexedDB
// - Supabase: LocalStorage
// - 認証方法: カスタムトークン vs パスワード認証
```

### 抽象化の判断基準

```
✅ 抽象化する:
   - 両方のプロバイダーで同じ形で使われる
   - テスト容易性が向上する

❌ 抽象化しない:
   - 無理に共通化すると複雑になる
   - プロバイダーごとの違いが本質的
```

---

## 6. 次のアクション

1. **Firebase実装**: `src/` 以下に最小実装を作る
2. **動作確認**: 実際のFirebaseプロジェクトでテスト
3. **設計振り返り**: 何が上手くいった/いかなかったか記録
4. **Supabase実装**: 共通パターンを見つけながら実装
