/**
 * Firebase authentication logic
 */

import type { Page } from '@playwright/test';
import admin from 'firebase-admin';
import type { FirebaseConfig, FirebaseAuthUser, FirebaseTokenResponse } from './types.js';
import { AuthenticationError, TokenExchangeError, InjectionError } from './errors.js';

/** Firebase Admin SDK initialized flag */
let initialized = false;

/**
 * Initialize Firebase Admin SDK
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
      `Failed to initialize Firebase Admin SDK: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Create custom token
 */
async function createCustomToken(uid: string): Promise<string> {
  try {
    return await admin.auth().createCustomToken(uid);
  } catch (error) {
    throw new AuthenticationError(
      `Failed to create custom token (UID: ${uid}): ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Exchange custom token for ID token
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
        `Firebase REST API error: ${errorBody}`,
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
      `Token exchange request failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get user record
 */
async function getUserRecord(uid: string): Promise<admin.auth.UserRecord> {
  try {
    return await admin.auth().getUser(uid);
  } catch (error) {
    throw new AuthenticationError(
      `Failed to get user info (UID: ${uid}): ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Create auth data for IndexedDB injection
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
 * Create IndexedDB injection script
 */
function createInjectionScript(authData: { fbase_key: string; value: FirebaseAuthUser }): string {
  // Serialize for parsing inside the script
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
 * Execute Firebase authentication and inject into browser
 */
export async function injectFirebaseAuth(
  page: Page,
  config: FirebaseConfig,
  options: { debug?: boolean; waitAfter?: number } = {}
): Promise<void> {
  const { debug = false, waitAfter = 2000 } = options;

  if (debug) {
    console.log('[playwright-auth-injector] Starting Firebase authentication...');
  }

  // 1. Initialize Admin SDK
  initializeAdmin(config.serviceAccount);
  if (debug) console.log('[playwright-auth-injector] Admin SDK initialized');

  // 2. Create custom token
  const customToken = await createCustomToken(config.uid);
  if (debug) console.log('[playwright-auth-injector] Custom token created');

  // 3. Exchange for ID token
  const tokenResponse = await exchangeCustomToken(customToken, config.apiKey);
  if (debug) console.log('[playwright-auth-injector] Token exchange complete');

  // 4. Get user info
  const userRecord = await getUserRecord(config.uid);
  if (debug) console.log('[playwright-auth-injector] User info retrieved');

  // 5. Create auth data
  const authData = createAuthData(config.uid, config.apiKey, tokenResponse, userRecord);
  if (debug) console.log('[playwright-auth-injector] Auth data created');

  // 6. Add injection script
  const script = createInjectionScript(authData);
  try {
    await page.addInitScript(script);
    if (debug) console.log('[playwright-auth-injector] Injection script added');
  } catch (error) {
    throw new InjectionError(
      `Failed to add IndexedDB injection script: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined
    );
  }

  // 7. Navigate to page to apply auth
  try {
    await page.goto('/', { waitUntil: 'networkidle' });
    if (debug) console.log('[playwright-auth-injector] Page navigation complete');
  } catch (error) {
    // goto failure is not fatal (e.g., baseURL not configured)
    if (debug) {
      console.log('[playwright-auth-injector] Page navigation skipped:', error instanceof Error ? error.message : String(error));
    }
  }

  // 8. Wait for auth state to be applied
  await page.waitForTimeout(waitAfter);
  if (debug) console.log('[playwright-auth-injector] Firebase authentication complete');
}
