# playwright-auth-injector

Playwright E2Eテストで認証UIをスキップし、認証状態を直接ブラウザに注入する。

## 特徴

- **シンプルなAPI**: 設定ファイル + 1行で認証完了
- **UIスキップ**: ログイン画面の操作不要で高速テスト
- **セキュア**: テスト専用エンドポイント不要、本番コード変更なし

## 対応プロバイダー

- [x] Firebase Authentication
- [ ] Supabase (Coming soon)
- [ ] AWS Amplify (Planned)
- [ ] Auth0 (Planned)

## インストール

```bash
npm install -D playwright-auth-injector
```

## セットアップ

### 1. 設定ファイルを作成

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

### 2. 認証セットアップを作成

```typescript
// e2e/tests/auth.setup.ts
import { test as setup } from '@playwright/test';
import { injectAuth } from 'playwright-auth-injector';

setup('authenticate', async ({ page }) => {
  await injectAuth(page);
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

### 3. Playwright設定に追加

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'authenticated',
      testMatch: /.*\.spec\.ts/,
      use: {
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

### 4. テストを書く

```typescript
// e2e/tests/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('認証済みページにアクセス', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `FIREBASE_SERVICE_ACCOUNT` | サービスアカウントJSON（1行に整形） |
| `FIREBASE_API_KEY` | Firebase Web API Key |
| `TEST_USER_UID` | テストユーザーのUID |

## API

### `injectAuth(page, options?)`

認証状態をブラウザに注入する。

```typescript
await injectAuth(page);

// オプション
await injectAuth(page, {
  profile: 'admin',    // プロファイル名
  waitAfter: 3000,     // 注入後の待機時間（ms）
});
```

### `defineConfig(config)`

型安全な設定ヘルパー。

## License

MIT
