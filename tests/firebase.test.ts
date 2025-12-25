import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from '@playwright/test';

// Mock firebase-admin
vi.mock('firebase-admin', () => {
  const mockAuth = {
    createCustomToken: vi.fn(),
    getUser: vi.fn(),
  };

  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn(),
      },
      auth: vi.fn(() => mockAuth),
    },
  };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import admin from 'firebase-admin';
import { injectFirebaseAuth } from '../src/firebase.js';
import { AuthenticationError, TokenExchangeError } from '../src/errors.js';

describe('injectFirebaseAuth', () => {
  const mockPage: Partial<Page> = {
    addInitScript: vi.fn(),
    goto: vi.fn(),
    waitForTimeout: vi.fn(),
  };

  const validConfig = {
    serviceAccount: JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test.iam.gserviceaccount.com',
    }),
    apiKey: 'test-api-key',
    uid: 'test-uid',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Configure firebase-admin mock
    const mockAuth = admin.auth();
    vi.mocked(mockAuth.createCustomToken).mockResolvedValue('mock-custom-token');
    vi.mocked(mockAuth.getUser).mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: true,
      providerData: [],
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: new Date().toISOString(),
        toJSON: () => ({}),
      },
      disabled: false,
      toJSON: () => ({}),
    } as any);

    // Configure fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: '3600',
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call addInitScript with injection script', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    expect(mockPage.addInitScript).toHaveBeenCalled();
    const scriptArg = vi.mocked(mockPage.addInitScript).mock.calls[0][0];
    expect(typeof scriptArg).toBe('string');
    expect(scriptArg).toContain('indexedDB');
    expect(scriptArg).toContain('firebaseLocalStorageDb');
  });

  it('should call Firebase Admin createCustomToken', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    const mockAuth = admin.auth();
    expect(mockAuth.createCustomToken).toHaveBeenCalledWith('test-uid');
  });

  it('should call Firebase REST API for token exchange', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('identitytoolkit.googleapis.com'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should call page.goto after injection', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    expect(mockPage.goto).toHaveBeenCalledWith('/', { waitUntil: 'networkidle' });
  });

  it('should wait after injection', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig, { waitAfter: 3000 });

    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(3000);
  });

  it('should use default waitAfter of 2000ms', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
  });

  describe('error handling', () => {
    it('should throw AuthenticationError when createCustomToken fails', async () => {
      const mockAuth = admin.auth();
      vi.mocked(mockAuth.createCustomToken).mockRejectedValue(new Error('token error'));

      await expect(
        injectFirebaseAuth(mockPage as Page, validConfig)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw TokenExchangeError when REST API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid token',
      });

      await expect(
        injectFirebaseAuth(mockPage as Page, validConfig)
      ).rejects.toThrow(TokenExchangeError);
    });

    it('should throw AuthenticationError when getUser fails', async () => {
      const mockAuth = admin.auth();
      vi.mocked(mockAuth.getUser).mockRejectedValue(new Error('user not found'));

      await expect(
        injectFirebaseAuth(mockPage as Page, validConfig)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('debug mode', () => {
    it('should log messages when debug is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await injectFirebaseAuth(mockPage as Page, validConfig, { debug: true });

      expect(consoleSpy).toHaveBeenCalled();
      const logMessages = consoleSpy.mock.calls.map(call => call[0]);
      expect(logMessages.some(msg => msg.includes('[playwright-auth-injector]'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should not log when debug is false', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await injectFirebaseAuth(mockPage as Page, validConfig, { debug: false });

      const logMessages = consoleSpy.mock.calls.map(call => call[0]);
      const authLogs = logMessages.filter(msg =>
        typeof msg === 'string' && msg.includes('[playwright-auth-injector]')
      );
      expect(authLogs.length).toBe(0);

      consoleSpy.mockRestore();
    });
  });
});

describe('injection script content', () => {
  const mockPage: Partial<Page> = {
    addInitScript: vi.fn(),
    goto: vi.fn(),
    waitForTimeout: vi.fn(),
  };

  const validConfig = {
    serviceAccount: JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test.iam.gserviceaccount.com',
    }),
    apiKey: 'test-api-key',
    uid: 'test-uid',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockAuth = admin.auth();
    vi.mocked(mockAuth.createCustomToken).mockResolvedValue('mock-custom-token');
    vi.mocked(mockAuth.getUser).mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: true,
      providerData: [],
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: new Date().toISOString(),
        toJSON: () => ({}),
      },
      disabled: false,
      toJSON: () => ({}),
    } as any);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: '3600',
      }),
    });
  });

  it('should include correct IndexedDB database name', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    const script = vi.mocked(mockPage.addInitScript).mock.calls[0][0] as string;
    expect(script).toContain('firebaseLocalStorageDb');
  });

  it('should include correct object store name', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    const script = vi.mocked(mockPage.addInitScript).mock.calls[0][0] as string;
    expect(script).toContain('firebaseLocalStorage');
  });

  it('should include Firebase auth key format', async () => {
    await injectFirebaseAuth(mockPage as Page, validConfig);

    const script = vi.mocked(mockPage.addInitScript).mock.calls[0][0] as string;
    expect(script).toContain('firebase:authUser:');
    expect(script).toContain('[DEFAULT]');
  });
});
