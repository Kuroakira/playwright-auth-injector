/**
 * Firebase authentication provider
 */

import type { Page } from '@playwright/test';
import admin from 'firebase-admin';
import type { AuthProvider, InjectOptions } from './base.js';
import type { FirebaseConfig, FirebaseAuthUser, FirebaseTokenResponse } from '../types.js';
import {
  ConfigInvalidError,
  AuthenticationError,
  TokenExchangeError,
  InjectionError,
} from '../errors.js';

/**
 * Browser API type declarations for injection script
 * These are used in browser context, not Node.js
 */
declare const indexedDB: {
  open(name: string, version?: number): IDBOpenDBRequest;
};

interface IDBOpenDBRequest {
  result: IDBDatabase;
  error: DOMException | null;
  onupgradeneeded: ((event: { target: IDBOpenDBRequest }) => void) | null;
  onsuccess: ((event: { target: IDBOpenDBRequest }) => void) | null;
  onerror: ((event: { target: IDBOpenDBRequest }) => void) | null;
}

interface IDBDatabase {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): void;
  transaction(storeNames: string[], mode: string): IDBTransaction;
}

interface IDBTransaction {
  objectStore(name: string): IDBObjectStore;
}

interface IDBObjectStore {
  put(value: unknown, key: string): void;
}

/** Firebase Admin SDK initialized flag */
let adminInitialized = false;

/**
 * Firebase authentication provider implementation
 */
export class FirebaseAuthProvider implements AuthProvider<FirebaseConfig> {
  readonly name = 'firebase' as const;

  /**
   * Validate Firebase configuration
   */
  validateConfig(config: unknown): FirebaseConfig {
    if (!config || typeof config !== 'object') {
      throw new ConfigInvalidError('firebase config is required', 'firebase');
    }

    const c = config as Record<string, unknown>;

    if (!c.serviceAccount || typeof c.serviceAccount !== 'string') {
      throw new ConfigInvalidError(
        'serviceAccount must be a string',
        'firebase.serviceAccount'
      );
    }

    if (!c.apiKey || typeof c.apiKey !== 'string') {
      throw new ConfigInvalidError(
        'apiKey must be a string',
        'firebase.apiKey'
      );
    }

    if (!c.uid || typeof c.uid !== 'string') {
      throw new ConfigInvalidError(
        'uid must be a string',
        'firebase.uid'
      );
    }

    return {
      serviceAccount: c.serviceAccount,
      apiKey: c.apiKey,
      uid: c.uid,
    };
  }

  /**
   * Inject Firebase authentication state into the browser
   */
  async inject(
    page: Page,
    config: FirebaseConfig,
    options: InjectOptions = {}
  ): Promise<void> {
    const { debug = false, waitAfter = 2000 } = options;

    if (debug) {
      console.log('[playwright-auth-injector] Starting Firebase authentication...');
    }

    // 1. Initialize Admin SDK
    this.initializeAdmin(config.serviceAccount);
    if (debug) console.log('[playwright-auth-injector] Admin SDK initialized');

    // 2. Create custom token
    const customToken = await this.createCustomToken(config.uid);
    if (debug) console.log('[playwright-auth-injector] Custom token created');

    // 3. Exchange for ID token
    const tokenResponse = await this.exchangeCustomToken(customToken, config.apiKey);
    if (debug) console.log('[playwright-auth-injector] Token exchange complete');

    // 4. Get user info
    const userRecord = await this.getUserRecord(config.uid);
    if (debug) console.log('[playwright-auth-injector] User info retrieved');

    // 5. Create auth data
    const authData = this.createAuthData(config.uid, config.apiKey, tokenResponse, userRecord);
    if (debug) console.log('[playwright-auth-injector] Auth data created');

    // 6. Add injection script
    try {
      await page.addInitScript(this.injectionScript, authData);
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

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeAdmin(serviceAccountJson: string): void {
    if (adminInitialized) return;

    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      adminInitialized = true;
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
  private async createCustomToken(uid: string): Promise<string> {
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
  private async exchangeCustomToken(
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
  private async getUserRecord(uid: string): Promise<admin.auth.UserRecord> {
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
  private createAuthData(
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
   * Injection script to be executed in browser context
   * This function is passed to page.addInitScript() for type-safe browser injection
   */
  private injectionScript(authData: { fbase_key: string; value: FirebaseAuthUser }): void {
    const request = indexedDB.open('firebaseLocalStorageDb', 1);

    request.onupgradeneeded = (event: { target: IDBOpenDBRequest }) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
        db.createObjectStore('firebaseLocalStorage');
      }
    };

    request.onsuccess = (event: { target: IDBOpenDBRequest }) => {
      const db = event.target.result;
      const tx = db.transaction(['firebaseLocalStorage'], 'readwrite');
      const store = tx.objectStore('firebaseLocalStorage');
      store.put(authData.value, authData.fbase_key);
    };

    request.onerror = (event: { target: IDBOpenDBRequest }) => {
      console.error('IndexedDB open error:', event.target.error);
    };
  }
}

/**
 * Reset admin initialization state (for testing)
 */
export function resetAdminInitialization(): void {
  adminInitialized = false;
}
