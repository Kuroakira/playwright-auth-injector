/**
 * playwright-auth-injector
 *
 * Playwright E2Eテストで認証UIをスキップし、認証状態を直接注入する
 */

import type { Page } from '@playwright/test';
import type { AuthConfig, InjectAuthOptions } from './types.js';
import { loadConfig } from './config.js';
import { injectFirebaseAuth } from './firebase.js';
import { ConfigInvalidError } from './errors.js';

// 型をre-export
export type {
  AuthConfig,
  FirebaseConfig,
  SupabaseConfig,
  InjectAuthOptions,
  Provider,
  ProfileOverride,
} from './types.js';

// エラーをre-export
export {
  AuthError,
  AuthErrorCode,
  ConfigNotFoundError,
  ConfigInvalidError,
  AuthenticationError,
  TokenExchangeError,
  InjectionError,
} from './errors.js';

/**
 * 設定ファイルの型安全なヘルパー
 *
 * @example
 * ```typescript
 * // playwright-auth.config.ts
 * import { defineConfig } from 'playwright-auth-injector';
 *
 * export default defineConfig({
 *   provider: 'firebase',
 *   firebase: {
 *     serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT!,
 *     apiKey: process.env.FIREBASE_API_KEY!,
 *     uid: process.env.TEST_USER_UID!,
 *   },
 * });
 * ```
 */
export function defineConfig(config: AuthConfig): AuthConfig {
  return config;
}

/**
 * 認証状態をブラウザに注入する
 *
 * @param page - Playwright Page オブジェクト
 * @param options - オプション設定
 * @throws AuthError - 認証失敗時
 *
 * @example
 * ```typescript
 * // e2e/tests/auth.setup.ts
 * import { test as setup } from '@playwright/test';
 * import { injectAuth } from 'playwright-auth-injector';
 *
 * setup('authenticate', async ({ page }) => {
 *   await injectAuth(page);
 *   await page.context().storageState({ path: 'e2e/.auth/user.json' });
 * });
 * ```
 *
 * @example
 * ```typescript
 * // プロファイル指定
 * await injectAuth(page, { profile: 'admin' });
 * ```
 */
export async function injectAuth(
  page: Page,
  options: InjectAuthOptions = {}
): Promise<void> {
  // 設定を読み込む
  const config = await loadConfig();

  // プロファイルが指定されている場合、設定をオーバーライド
  let effectiveConfig = config;
  if (options.profile && config.profiles?.[options.profile]) {
    const profileOverride = config.profiles[options.profile];
    effectiveConfig = {
      ...config,
      firebase: config.firebase
        ? { ...config.firebase, ...profileOverride }
        : undefined,
      supabase: config.supabase
        ? { ...config.supabase, ...profileOverride }
        : undefined,
    };
  }

  // プロバイダーに応じて認証を実行
  switch (effectiveConfig.provider) {
    case 'firebase':
      if (!effectiveConfig.firebase) {
        throw new ConfigInvalidError('firebase 設定が必要です', 'firebase');
      }
      await injectFirebaseAuth(page, effectiveConfig.firebase, {
        debug: effectiveConfig.debug,
        waitAfter: options.waitAfter,
      });
      break;

    case 'supabase':
      // TODO: Supabase実装
      throw new ConfigInvalidError(
        'Supabase はまだ実装されていません。Firebase を使用してください。',
        'provider'
      );

    default:
      throw new ConfigInvalidError(
        `未対応のプロバイダー: ${effectiveConfig.provider}`,
        'provider'
      );
  }
}
