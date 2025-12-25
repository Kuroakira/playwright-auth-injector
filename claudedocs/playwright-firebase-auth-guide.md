# Playwright + Firebase Authentication E2E Testing Guide

Firebase 認証を使用したアプリケーションで、Playwright E2E テストを実行するための完全ガイド。

## 概要

### 課題

Firebase Authentication を使用したアプリでは、E2E テスト時に以下の課題がある：

1. **Google OAuth などの外部認証フロー**をテストで自動化するのは困難
2. **Firebase SDK はブラウザの IndexedDB** に認証状態を保存するため、単純な Cookie/localStorage 操作では認証できない
3. アプリコードに**テスト用のバックドア**を作りたくない（セキュリティリスク）

### 解決策

**IndexedDB 直接注入方式**を採用：

1. Node.js 側で Firebase Admin SDK を使用してトークンを生成
2. Firebase REST API でブラウザ用トークンに交換
3. Playwright の `addInitScript` で IndexedDB に認証データを注入
4. アプリの Firebase SDK が認証状態を自動認識

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Firebase Admin    │     │   Firebase REST     │     │      Browser        │
│   (Node.js)         │────▶│   API               │────▶│   IndexedDB         │
│                     │     │                     │     │                     │
│ createCustomToken() │     │ signInWithCustom    │     │ Firebase SDK が     │
│                     │     │ Token               │     │ 認証状態を認識      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### メリット

- **アプリコード変更不要**: 本番コードにテスト用コードを混入させない
- **セキュリティホールなし**: テスト専用エンドポイント不要
- **外部プラグイン不要**: firebase-admin と Playwright の標準機能のみ
- **CI/CD 対応**: 環境変数でクレデンシャルを管理

---

## 前提条件

### 必要なもの

1. **Firebase プロジェクト**
2. **テスト用ユーザー**: Firebase Authentication に登録済みのユーザー
3. **サービスアカウント**: Firebase Admin SDK 用の認証情報
4. **Firebase API キー**: プロジェクトの Web API キー

### インストール

```bash
npm install -D @playwright/test
npm install -D firebase-admin
npx playwright install chromium
```

---

## セットアップ

### 1. ディレクトリ構成

```
project/
├── playwright.config.ts
├── playwright.env.json          # 環境変数（gitignore）
├── playwright.env.json.sample   # テンプレート
└── e2e/
    ├── .auth/
    │   └── user.json            # 認証状態保存（自動生成）
    └── tests/
        ├── auth.setup.ts        # 認証セットアップ
        └── example/
            └── example.spec.ts  # テストファイル
```

### 2. 環境変数ファイル

**playwright.env.json.sample**:

```json
{
  "TEST_UID": "Firebase Authentication のユーザー UID",
  "SERVICE_ACCOUNT": {
    "type": "service_account",
    "project_id": "your-project-id",
    "private_key_id": "...",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "client_email": "...",
    "client_id": "...",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token"
  },
  "FIREBASE_API_KEY": "your-web-api-key"
}
```

**取得方法**:

| 項目 | 取得場所 |
|------|----------|
| TEST_UID | Firebase Console → Authentication → Users → UID列 |
| SERVICE_ACCOUNT | Firebase Console → プロジェクト設定 → サービスアカウント → 新しい秘密鍵の生成 |
| FIREBASE_API_KEY | Firebase Console → プロジェクト設定 → 全般 → ウェブ API キー |

### 3. .gitignore に追加

```gitignore
playwright.env.json
e2e/.auth/
```

---

## 実装

### playwright.config.ts

```typescript
import { defineConfig, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ESM 環境で __dirname を取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// playwright.env.json を読み込む
const envPath = path.join(__dirname, "playwright.env.json");
if (fs.existsSync(envPath)) {
  const env = JSON.parse(fs.readFileSync(envPath, "utf-8"));
  process.env.SERVICE_ACCOUNT = JSON.stringify(env.SERVICE_ACCOUNT);
  process.env.TEST_UID = env.TEST_UID;
  process.env.FIREBASE_API_KEY = env.FIREBASE_API_KEY;
}

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // 認証セットアップ（テスト前に一度だけ実行）
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    // 認証が必要なテスト
    {
      name: "authenticated",
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
```

### e2e/tests/auth.setup.ts

```typescript
import { test as setup } from "@playwright/test";
import admin from "firebase-admin";

// Firebase Admin SDK 初期化（一度だけ）
function initializeFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) return;

  const serviceAccountStr = process.env.SERVICE_ACCOUNT;
  if (!serviceAccountStr) {
    throw new Error(
      "SERVICE_ACCOUNT environment variable is not set. " +
        "Please create playwright.env.json from playwright.env.json.sample",
    );
  }

  const serviceAccount = JSON.parse(serviceAccountStr);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

setup("authenticate", async ({ page }) => {
  const testUid = process.env.TEST_UID;
  if (!testUid) {
    throw new Error(
      "TEST_UID environment variable is not set. " +
        "Please create playwright.env.json from playwright.env.json.sample",
    );
  }

  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FIREBASE_API_KEY environment variable is not set. " +
        "Please create playwright.env.json from playwright.env.json.sample",
    );
  }

  initializeFirebaseAdmin();

  // 1. Admin SDK でカスタムトークン生成
  const customToken = await admin.auth().createCustomToken(testUid);

  // 2. Firebase REST API でトークン交換
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange custom token: ${error}`);
  }

  const { idToken, refreshToken, expiresIn } = await response.json();

  // 3. テストユーザーの情報を取得
  const userRecord = await admin.auth().getUser(testUid);

  // 4. IndexedDB に注入する認証データを作成
  const authData = {
    fbase_key: `firebase:authUser:${apiKey}:[DEFAULT]`,
    value: {
      uid: testUid,
      email: userRecord.email || "test@example.com",
      emailVerified: userRecord.emailVerified || true,
      isAnonymous: false,
      providerData: userRecord.providerData || [],
      stsTokenManager: {
        accessToken: idToken,
        refreshToken: refreshToken,
        expirationTime: Date.now() + parseInt(expiresIn) * 1000,
      },
      createdAt: userRecord.metadata.creationTime
        ? new Date(userRecord.metadata.creationTime).getTime().toString()
        : Date.now().toString(),
      lastLoginAt: Date.now().toString(),
      apiKey: apiKey,
      appName: "[DEFAULT]",
    },
  };

  // 5. ページロード前に IndexedDB を設定するスクリプトを追加
  await page.addInitScript((data) => {
    const request = indexedDB.open("firebaseLocalStorageDb", 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
        db.createObjectStore("firebaseLocalStorage");
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = db.transaction(["firebaseLocalStorage"], "readwrite");
      const store = tx.objectStore("firebaseLocalStorage");
      store.put(data.value, data.fbase_key);
    };
  }, authData);

  // 6. ページに移動
  await page.goto("/", { waitUntil: "networkidle" });

  // 7. 認証状態が反映されるまで待機
  await page.waitForTimeout(3000);

  // 8. 認証状態を保存
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
```

### e2e/tests/example/example.spec.ts

```typescript
import { test, expect } from "@playwright/test";

test.describe("認証が必要なページ", () => {
  test("ダッシュボードが表示される", async ({ page }) => {
    await page.goto("/dashboard");

    // 認証済みユーザーにのみ表示される要素を確認
    await expect(page.locator("text=ようこそ")).toBeVisible();
  });
});
```

---

## 仕組みの詳細

### 認証フロー

```
┌────────────────────────────────────────────────────────────────────┐
│                         Node.js 環境                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐    createCustomToken(uid)                    │
│  │ Firebase Admin  │ ─────────────────────────────┐               │
│  │ SDK             │                              │               │
│  └─────────────────┘                              ▼               │
│                                          ┌─────────────────┐      │
│                                          │ Custom Token    │      │
│                                          │ (有効期限: 1時間) │      │
│                                          └────────┬────────┘      │
│                                                   │               │
│                         POST /signInWithCustomToken               │
│                                                   ▼               │
│                                          ┌─────────────────┐      │
│  ┌─────────────────┐                     │ Firebase REST   │      │
│  │ 認証データ構造   │ ◀───────────────── │ API Response    │      │
│  │ (authData)      │   idToken          │                 │      │
│  └────────┬────────┘   refreshToken     └─────────────────┘      │
│           │            expiresIn                                  │
└───────────┼────────────────────────────────────────────────────────┘
            │
            │ addInitScript(data)
            ▼
┌────────────────────────────────────────────────────────────────────┐
│                         ブラウザ環境                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    addInitScript                             │  │
│  │  ┌─────────────────┐                                        │  │
│  │  │ IndexedDB       │                                        │  │
│  │  │ - open DB       │                                        │  │
│  │  │ - create store  │                                        │  │
│  │  │ - put data      │                                        │  │
│  │  └────────┬────────┘                                        │  │
│  └───────────┼─────────────────────────────────────────────────┘  │
│              │                                                     │
│              ▼ ページの JavaScript 実行前に完了                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ IndexedDB: firebaseLocalStorageDb                           │  │
│  │ ├── ObjectStore: firebaseLocalStorage                       │  │
│  │ │   └── Key: firebase:authUser:{apiKey}:[DEFAULT]           │  │
│  │ │         Value: { uid, email, stsTokenManager, ... }       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│              │                                                     │
│              │ page.goto("/")                                      │
│              ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Firebase Client SDK                                          │  │
│  │                                                               │  │
│  │  onAuthStateChanged() ◀── IndexedDB から認証データ読み取り   │  │
│  │         │                                                     │  │
│  │         ▼                                                     │  │
│  │  ユーザー認証済み状態                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### IndexedDB データ構造

Firebase SDK が期待する構造：

```typescript
{
  // IndexedDB のキー
  fbase_key: "firebase:authUser:{apiKey}:[DEFAULT]",

  // 値（この構造は厳密に守る必要がある）
  value: {
    uid: string,
    email: string,
    emailVerified: boolean,
    isAnonymous: boolean,
    providerData: Array<{
      providerId: string,
      uid: string,
      displayName: string | null,
      email: string | null,
      phoneNumber: string | null,
      photoURL: string | null
    }>,
    stsTokenManager: {
      accessToken: string,    // idToken
      refreshToken: string,
      expirationTime: number  // ミリ秒タイムスタンプ
    },
    createdAt: string,        // ミリ秒タイムスタンプ（文字列）
    lastLoginAt: string,      // ミリ秒タイムスタンプ（文字列）
    apiKey: string,
    appName: string           // 通常は "[DEFAULT]"
  }
}
```

### addInitScript vs page.evaluate

| 方式 | 実行タイミング | 用途 |
|------|----------------|------|
| `addInitScript` | ページの JavaScript 実行**前** | 認証データの事前注入 |
| `page.evaluate` | ページの JavaScript 実行**後** | DOM 操作、状態確認 |

`addInitScript` を使う理由：
- Firebase SDK が初期化される**前**に IndexedDB にデータを入れる必要がある
- `page.evaluate` だと Firebase SDK が先に初期化され、未認証状態になる

---

## トラブルシューティング

### よくあるエラー

#### 1. `Execution context was destroyed`

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

**原因**: ページがリダイレクトされて `page.evaluate` が中断された

**解決策**: `addInitScript` を使用する（本ガイドの実装）

#### 2. `Cannot read properties of undefined (reading 'length')`

```
TypeError: Cannot read properties of undefined (reading 'length')
  at admin.apps.length
```

**原因**: firebase-admin の ESM インポート問題

**解決策**:
```typescript
// NG
import * as admin from "firebase-admin";

// OK
import admin from "firebase-admin";
```

#### 3. 認証状態が反映されない

**確認ポイント**:

1. IndexedDB のキー形式が正しいか
   - 正: `firebase:authUser:{apiKey}:[DEFAULT]`
   - 誤: `firebase:authUser:apiKey:[DEFAULT]`（apiKey が実際の値でない）

2. `stsTokenManager.expirationTime` が未来の時刻か
   - `Date.now() + parseInt(expiresIn) * 1000` で計算

3. DevTools → Application → IndexedDB でデータを確認

#### 4. NextAuth など別の認証層がある場合

IndexedDB 注入だけでは不十分な場合がある：

- NextAuth のセッション Cookie が必要
- サーバーサイドで認証チェックしている

**解決策**: 認証後に NextAuth の signIn も実行するか、API ルート経由でセッションを作成

---

## テスト実行

```bash
# 全テスト実行
npx playwright test

# 特定のテストファイル
npx playwright test example.spec.ts

# UI モードで実行
npx playwright test --ui

# デバッグモード
npx playwright test --debug
```

---

## CI/CD 設定例

### GitHub Actions

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test
        env:
          SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          TEST_UID: ${{ secrets.FIREBASE_TEST_UID }}
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          BASE_URL: ${{ secrets.BASE_URL }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**GitHub Secrets に設定**:
- `FIREBASE_SERVICE_ACCOUNT`: サービスアカウント JSON（1行に整形）
- `FIREBASE_TEST_UID`: テストユーザーの UID
- `FIREBASE_API_KEY`: Firebase Web API キー
- `BASE_URL`: テスト対象の URL

---

## 参考リンク

- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firebase REST API - signInWithCustomToken](https://firebase.google.com/docs/reference/rest/auth#section-verify-custom-token)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

## ライセンス

MIT
