/**
 * 設定ファイル読み込み
 */

import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuthConfig } from './types.js';
import { ConfigNotFoundError, ConfigInvalidError } from './errors.js';

/** 設定ファイルの候補パス */
const CONFIG_FILE_NAMES = [
  'playwright-auth.config.ts',
  'playwright-auth.config.js',
  'playwright-auth.config.mjs',
];

/** キャッシュされた設定 */
let cachedConfig: AuthConfig | null = null;

/**
 * 設定ファイルのパスを探す
 */
function findConfigPath(cwd: string = process.cwd()): string | null {
  for (const fileName of CONFIG_FILE_NAMES) {
    const fullPath = resolve(cwd, fileName);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * 設定を読み込む
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<AuthConfig> {
  // キャッシュがあれば返す
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = findConfigPath(cwd);

  if (!configPath) {
    throw new ConfigNotFoundError(
      CONFIG_FILE_NAMES.map(name => resolve(cwd, name))
    );
  }

  try {
    // ESMとしてインポート
    const configUrl = pathToFileURL(configPath).href;
    const module = await import(configUrl);
    const config = module.default as AuthConfig;

    // バリデーション
    validateConfig(config);

    cachedConfig = config;
    return config;
  } catch (error) {
    if (error instanceof ConfigNotFoundError || error instanceof ConfigInvalidError) {
      throw error;
    }
    throw new ConfigInvalidError(
      `設定ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 設定をバリデーション
 */
function validateConfig(config: unknown): asserts config is AuthConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigInvalidError('設定はオブジェクトである必要があります');
  }

  const c = config as Record<string, unknown>;

  // provider必須
  if (!c.provider) {
    throw new ConfigInvalidError('provider は必須です', 'provider');
  }

  if (c.provider !== 'firebase' && c.provider !== 'supabase') {
    throw new ConfigInvalidError(
      `provider は 'firebase' または 'supabase' である必要があります。受け取った値: ${c.provider}`,
      'provider'
    );
  }

  // プロバイダー固有の設定をバリデーション
  if (c.provider === 'firebase') {
    validateFirebaseConfig(c.firebase);
  } else if (c.provider === 'supabase') {
    validateSupabaseConfig(c.supabase);
  }
}

/**
 * Firebase設定をバリデーション
 */
function validateFirebaseConfig(firebase: unknown): void {
  if (!firebase || typeof firebase !== 'object') {
    throw new ConfigInvalidError('firebase 設定が必要です', 'firebase');
  }

  const f = firebase as Record<string, unknown>;

  if (!f.serviceAccount || typeof f.serviceAccount !== 'string') {
    throw new ConfigInvalidError(
      'serviceAccount は文字列である必要があります',
      'firebase.serviceAccount'
    );
  }

  if (!f.apiKey || typeof f.apiKey !== 'string') {
    throw new ConfigInvalidError(
      'apiKey は文字列である必要があります',
      'firebase.apiKey'
    );
  }

  if (!f.uid || typeof f.uid !== 'string') {
    throw new ConfigInvalidError(
      'uid は文字列である必要があります',
      'firebase.uid'
    );
  }
}

/**
 * Supabase設定をバリデーション
 */
function validateSupabaseConfig(supabase: unknown): void {
  if (!supabase || typeof supabase !== 'object') {
    throw new ConfigInvalidError('supabase 設定が必要です', 'supabase');
  }

  const s = supabase as Record<string, unknown>;

  if (!s.url || typeof s.url !== 'string') {
    throw new ConfigInvalidError('url は文字列である必要があります', 'supabase.url');
  }

  if (!s.anonKey || typeof s.anonKey !== 'string') {
    throw new ConfigInvalidError('anonKey は文字列である必要があります', 'supabase.anonKey');
  }

  if (!s.email || typeof s.email !== 'string') {
    throw new ConfigInvalidError('email は文字列である必要があります', 'supabase.email');
  }

  if (!s.password || typeof s.password !== 'string') {
    throw new ConfigInvalidError('password は文字列である必要があります', 'supabase.password');
  }
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
