/**
 * Config file loading
 */

import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuthConfig } from './types.js';
import { ConfigNotFoundError, ConfigInvalidError } from './errors.js';

/** Config file candidate paths */
const CONFIG_FILE_NAMES = [
  'playwright-auth.config.ts',
  'playwright-auth.config.js',
  'playwright-auth.config.mjs',
];

/** Cached config */
let cachedConfig: AuthConfig | null = null;

/**
 * Find config file path
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
 * Load config
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<AuthConfig> {
  // Return cached config if available
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
    // Import as ESM
    const configUrl = pathToFileURL(configPath).href;
    const module = await import(configUrl);
    const config = module.default as AuthConfig;

    // Validate
    validateConfig(config);

    cachedConfig = config;
    return config;
  } catch (error) {
    if (error instanceof ConfigNotFoundError || error instanceof ConfigInvalidError) {
      throw error;
    }
    throw new ConfigInvalidError(
      `Failed to load config file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate config
 */
function validateConfig(config: unknown): asserts config is AuthConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigInvalidError('Config must be an object');
  }

  const c = config as Record<string, unknown>;

  // provider is required
  if (!c.provider) {
    throw new ConfigInvalidError('provider is required', 'provider');
  }

  if (c.provider !== 'firebase' && c.provider !== 'supabase') {
    throw new ConfigInvalidError(
      `provider must be 'firebase' or 'supabase'. Got: ${c.provider}`,
      'provider'
    );
  }

  // Validate provider-specific config
  if (c.provider === 'firebase') {
    validateFirebaseConfig(c.firebase);
  } else if (c.provider === 'supabase') {
    validateSupabaseConfig(c.supabase);
  }
}

/**
 * Validate Firebase config
 */
function validateFirebaseConfig(firebase: unknown): void {
  if (!firebase || typeof firebase !== 'object') {
    throw new ConfigInvalidError('firebase config is required', 'firebase');
  }

  const f = firebase as Record<string, unknown>;

  if (!f.serviceAccount || typeof f.serviceAccount !== 'string') {
    throw new ConfigInvalidError(
      'serviceAccount must be a string',
      'firebase.serviceAccount'
    );
  }

  if (!f.apiKey || typeof f.apiKey !== 'string') {
    throw new ConfigInvalidError(
      'apiKey must be a string',
      'firebase.apiKey'
    );
  }

  if (!f.uid || typeof f.uid !== 'string') {
    throw new ConfigInvalidError(
      'uid must be a string',
      'firebase.uid'
    );
  }
}

/**
 * Validate Supabase config
 */
function validateSupabaseConfig(supabase: unknown): void {
  if (!supabase || typeof supabase !== 'object') {
    throw new ConfigInvalidError('supabase config is required', 'supabase');
  }

  const s = supabase as Record<string, unknown>;

  if (!s.url || typeof s.url !== 'string') {
    throw new ConfigInvalidError('url must be a string', 'supabase.url');
  }

  if (!s.anonKey || typeof s.anonKey !== 'string') {
    throw new ConfigInvalidError('anonKey must be a string', 'supabase.anonKey');
  }

  if (!s.email || typeof s.email !== 'string') {
    throw new ConfigInvalidError('email must be a string', 'supabase.email');
  }

  if (!s.password || typeof s.password !== 'string') {
    throw new ConfigInvalidError('password must be a string', 'supabase.password');
  }
}

/**
 * Clear config cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
