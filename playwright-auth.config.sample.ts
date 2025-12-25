/**
 * playwright-auth-injector 設定ファイルのサンプル
 *
 * このファイルをコピーして `playwright-auth.config.ts` を作成してください。
 */

import { defineConfig } from 'playwright-auth-injector';

export default defineConfig({
  // 使用するプロバイダー: 'firebase' | 'supabase'
  provider: 'firebase',

  // デバッグモード（コンソールにログを出力）
  debug: false,

  // Firebase設定
  firebase: {
    // サービスアカウントJSON（環境変数から読み込み）
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT!,

    // Firebase Web API Key
    apiKey: process.env.FIREBASE_API_KEY!,

    // テストユーザーのUID
    uid: process.env.TEST_USER_UID!,
  },

  // 複数ユーザープロファイル（オプション）
  // profiles: {
  //   admin: { uid: process.env.ADMIN_UID },
  //   user: { uid: process.env.USER_UID },
  // },
});
