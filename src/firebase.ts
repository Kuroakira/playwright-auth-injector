/**
 * Firebase認証ロジック
 */

import type { Page } from '@playwright/test';
import admin from 'firebase-admin';
import type { FirebaseConfig, FirebaseAuthUser, FirebaseTokenResponse } from './types.js';
import { AuthenticationError, TokenExchangeError, InjectionError } from './errors.js';

/** Firebase Admin SDK 初期化済みフラグ */
let initialized = false;

/**
 * Firebase Admin SDK を初期化
 */
function initializeAdmin(serviceAccountJson: string): void {
  if (initialized) return;

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
  } catch (error) {
    throw new AuthenticationError(
      `Firebase Admin SDK の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * カスタムトークンを生成
 */
async function createCustomToken(uid: string): Promise<string> {
  try {
    return await admin.auth().createCustomToken(uid);
  } catch (error) {
    throw new AuthenticationError(
      `カスタムトークンの生成に失敗しました (UID: ${uid}): ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * カスタムトークンをIDトークンに交換
 */
async function exchangeCustomToken(
  customToken: string,
  apiKey: string
): Promise<FirebaseTokenResponse> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new TokenExchangeError(
        `Firebase REST API エラー: ${errorBody}`,
        response.status
      );
    }

    const data = await response.json() as FirebaseTokenResponse;
    return data;
  } catch (error) {
    if (error instanceof TokenExchangeError) {
      throw error;
    }
    throw new TokenExchangeError(
      `トークン交換リクエストに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * ユーザー情報を取得
 */
async function getUserRecord(uid: string): Promise<admin.auth.UserRecord> {
  try {
    return await admin.auth().getUser(uid);
  } catch (error) {
    throw new AuthenticationError(
      `ユーザー情報の取得に失敗しました (UID: ${uid}): ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * IndexedDBに注入する認証データを作成
 */
function createAuthData(
  uid: string,
  apiKey: string,
  tokenResponse: FirebaseTokenResponse,
  userRecord: admin.auth.UserRecord
): { fbase_key: string; value: FirebaseAuthUser } {
  const now = Date.now();
  const expiresIn = parseInt(tokenResponse.expiresIn, 10) * 1000;

  return {
    fbase_key: `firebase:authUser:${apiKey}:[DEFAULT]`,
    value: {
      uid,
      email: userRecord.email || null,
      emailVerified: userRecord.emailVerified || false,
      isAnonymous: false,
      providerData: (userRecord.providerData || []).map(provider => ({
        providerId: provider.providerId,
        uid: provider.uid,
        displayName: provider.displayName || null,
        email: provider.email || null,
        phoneNumber: provider.phoneNumber || null,
        photoURL: provider.photoURL || null,
      })),
      stsTokenManager: {
        accessToken: tokenResponse.idToken,
        refreshToken: tokenResponse.refreshToken,
        expirationTime: now + expiresIn,
      },
      createdAt: userRecord.metadata.creationTime
        ? new Date(userRecord.metadata.creationTime).getTime().toString()
        : now.toString(),
      lastLoginAt: now.toString(),
      apiKey,
      appName: '[DEFAULT]',
    },
  };
}

/**
 * IndexedDB注入スクリプトを生成
 */
function createInjectionScript(authData: { fbase_key: string; value: FirebaseAuthUser }): string {
  // スクリプト内でJSONをパースするためにシリアライズ
  const serializedData = JSON.stringify(authData);

  return `
    (function(dataStr) {
      const data = JSON.parse(dataStr);
      const request = indexedDB.open('firebaseLocalStorageDb', 1);

      request.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
          db.createObjectStore('firebaseLocalStorage');
        }
      };

      request.onsuccess = function(event) {
        const db = event.target.result;
        const tx = db.transaction(['firebaseLocalStorage'], 'readwrite');
        const store = tx.objectStore('firebaseLocalStorage');
        store.put(data.value, data.fbase_key);
      };

      request.onerror = function(event) {
        console.error('IndexedDB open error:', event.target.error);
      };
    })(${JSON.stringify(serializedData)});
  `;
}

/**
 * Firebase認証を実行してブラウザに注入
 */
export async function injectFirebaseAuth(
  page: Page,
  config: FirebaseConfig,
  options: { debug?: boolean; waitAfter?: number } = {}
): Promise<void> {
  const { debug = false, waitAfter = 2000 } = options;

  if (debug) {
    console.log('[playwright-auth-injector] Firebase認証を開始...');
  }

  // 1. Admin SDK 初期化
  initializeAdmin(config.serviceAccount);
  if (debug) console.log('[playwright-auth-injector] Admin SDK 初期化完了');

  // 2. カスタムトークン生成
  const customToken = await createCustomToken(config.uid);
  if (debug) console.log('[playwright-auth-injector] カスタムトークン生成完了');

  // 3. IDトークンに交換
  const tokenResponse = await exchangeCustomToken(customToken, config.apiKey);
  if (debug) console.log('[playwright-auth-injector] トークン交換完了');

  // 4. ユーザー情報取得
  const userRecord = await getUserRecord(config.uid);
  if (debug) console.log('[playwright-auth-injector] ユーザー情報取得完了');

  // 5. 認証データ作成
  const authData = createAuthData(config.uid, config.apiKey, tokenResponse, userRecord);
  if (debug) console.log('[playwright-auth-injector] 認証データ作成完了');

  // 6. 注入スクリプトを追加
  const script = createInjectionScript(authData);
  try {
    await page.addInitScript(script);
    if (debug) console.log('[playwright-auth-injector] 注入スクリプト追加完了');
  } catch (error) {
    throw new InjectionError(
      `IndexedDB注入スクリプトの追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }

  // 7. ページに移動して認証を反映
  try {
    await page.goto('/', { waitUntil: 'networkidle' });
    if (debug) console.log('[playwright-auth-injector] ページ遷移完了');
  } catch (error) {
    // goto失敗は致命的ではない（baseURLが設定されていない場合など）
    if (debug) {
      console.log('[playwright-auth-injector] ページ遷移をスキップ:', error instanceof Error ? error.message : String(error));
    }
  }

  // 8. 認証状態が反映されるまで待機
  await page.waitForTimeout(waitAfter);
  if (debug) console.log('[playwright-auth-injector] Firebase認証完了');
}
