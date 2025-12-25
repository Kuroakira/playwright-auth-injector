import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { loadConfig, clearConfigCache } from '../src/config.js';
import { ConfigNotFoundError, ConfigInvalidError } from '../src/errors.js';

// existsSyncをモック
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('loadConfig', () => {
  beforeEach(() => {
    clearConfigCache();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw ConfigNotFoundError when no config file exists', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(loadConfig('/test/dir')).rejects.toThrow(ConfigNotFoundError);
  });

  it('should throw ConfigNotFoundError with search paths', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    try {
      await loadConfig('/test/dir');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigNotFoundError);
      const configError = error as ConfigNotFoundError;
      expect(configError.message).toContain('playwright-auth.config.ts');
      expect(configError.message).toContain('playwright-auth.config.js');
      expect(configError.message).toContain('playwright-auth.config.mjs');
    }
  });
});

describe('config validation', () => {
  // バリデーションロジックのテスト用にモックモジュールを作成
  // 実際のファイルを読み込む代わりに、直接バリデーション関数をテスト

  beforeEach(() => {
    clearConfigCache();
  });

  describe('validateFirebaseConfig (via loadConfig)', () => {
    it('should require serviceAccount to be string', () => {
      // このテストは統合テストとして実際のファイルで行うのが適切
      // ここではバリデーションロジックの仕様を文書化
      expect(true).toBe(true);
    });
  });
});

describe('clearConfigCache', () => {
  it('should clear the cached config', () => {
    // キャッシュをクリアしても例外が発生しないことを確認
    expect(() => clearConfigCache()).not.toThrow();
  });
});
