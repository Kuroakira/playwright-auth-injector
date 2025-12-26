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
import { FirebaseAuthProvider } from '../src/providers/firebase.js';
import { AuthenticationError, TokenExchangeError, ConfigInvalidError } from '../src/errors.js';

describe('FirebaseAuthProvider', () => {
  const provider = new FirebaseAuthProvider();

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

  describe('validateConfig', () => {
    it('should validate a valid config', () => {
      const result = provider.validateConfig(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should throw ConfigInvalidError when config is missing', () => {
      expect(() => provider.validateConfig(null)).toThrow(ConfigInvalidError);
      expect(() => provider.validateConfig(undefined)).toThrow(ConfigInvalidError);
    });

    it('should throw ConfigInvalidError when serviceAccount is missing', () => {
      const config = { apiKey: 'key', uid: 'uid' };
      expect(() => provider.validateConfig(config)).toThrow(ConfigInvalidError);
    });

    it('should throw ConfigInvalidError when apiKey is missing', () => {
      const config = { serviceAccount: '{}', uid: 'uid' };
      expect(() => provider.validateConfig(config)).toThrow(ConfigInvalidError);
    });

    it('should throw ConfigInvalidError when uid is missing', () => {
      const config = { serviceAccount: '{}', apiKey: 'key' };
      expect(() => provider.validateConfig(config)).toThrow(ConfigInvalidError);
    });
  });

  describe('inject', () => {
    it('should call addInitScript with function and auth data', async () => {
      await provider.inject(mockPage as Page, validConfig);

      expect(mockPage.addInitScript).toHaveBeenCalled();
      const [fn, arg] = vi.mocked(mockPage.addInitScript).mock.calls[0];
      expect(typeof fn).toBe('function');
      expect(arg).toHaveProperty('fbase_key');
      expect(arg).toHaveProperty('value');
    });

    it('should call Firebase Admin createCustomToken', async () => {
      await provider.inject(mockPage as Page, validConfig);

      const mockAuth = admin.auth();
      expect(mockAuth.createCustomToken).toHaveBeenCalledWith('test-uid');
    });

    it('should call Firebase REST API for token exchange', async () => {
      await provider.inject(mockPage as Page, validConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('identitytoolkit.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should call page.goto after injection', async () => {
      await provider.inject(mockPage as Page, validConfig);

      expect(mockPage.goto).toHaveBeenCalledWith('/', { waitUntil: 'networkidle' });
    });

    it('should wait after injection', async () => {
      await provider.inject(mockPage as Page, validConfig, { waitAfter: 3000 });

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(3000);
    });

    it('should use default waitAfter of 2000ms', async () => {
      await provider.inject(mockPage as Page, validConfig);

      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });
  });

  describe('error handling', () => {
    it('should throw AuthenticationError when createCustomToken fails', async () => {
      const mockAuth = admin.auth();
      vi.mocked(mockAuth.createCustomToken).mockRejectedValue(new Error('token error'));

      await expect(
        provider.inject(mockPage as Page, validConfig)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw TokenExchangeError when REST API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid token',
      });

      await expect(
        provider.inject(mockPage as Page, validConfig)
      ).rejects.toThrow(TokenExchangeError);
    });

    it('should throw AuthenticationError when getUser fails', async () => {
      const mockAuth = admin.auth();
      vi.mocked(mockAuth.getUser).mockRejectedValue(new Error('user not found'));

      await expect(
        provider.inject(mockPage as Page, validConfig)
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('debug mode', () => {
    it('should log messages when debug is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await provider.inject(mockPage as Page, validConfig, { debug: true });

      expect(consoleSpy).toHaveBeenCalled();
      const logMessages = consoleSpy.mock.calls.map(call => call[0]);
      expect(logMessages.some(msg => msg.includes('[playwright-auth-injector]'))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should not log when debug is false', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await provider.inject(mockPage as Page, validConfig, { debug: false });

      const logMessages = consoleSpy.mock.calls.map(call => call[0]);
      const authLogs = logMessages.filter(msg =>
        typeof msg === 'string' && msg.includes('[playwright-auth-injector]')
      );
      expect(authLogs.length).toBe(0);

      consoleSpy.mockRestore();
    });
  });
});

describe('injection auth data', () => {
  const provider = new FirebaseAuthProvider();

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

  it('should include correct IndexedDB database name in auth data key', async () => {
    await provider.inject(mockPage as Page, validConfig);

    const [, authData] = vi.mocked(mockPage.addInitScript).mock.calls[0];
    expect(authData.fbase_key).toContain('firebase:authUser:');
  });

  it('should include correct app name in auth data key', async () => {
    await provider.inject(mockPage as Page, validConfig);

    const [, authData] = vi.mocked(mockPage.addInitScript).mock.calls[0];
    expect(authData.fbase_key).toContain('[DEFAULT]');
  });

  it('should include user info in auth data value', async () => {
    await provider.inject(mockPage as Page, validConfig);

    const [, authData] = vi.mocked(mockPage.addInitScript).mock.calls[0];
    expect(authData.value).toHaveProperty('uid', 'test-uid');
    expect(authData.value).toHaveProperty('email', 'test@example.com');
    expect(authData.value).toHaveProperty('stsTokenManager');
  });
});
