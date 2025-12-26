/**
 * Config file loading
 */

import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuthConfig } from './types.js';
import { ConfigNotFoundError, ConfigInvalidError } from './errors.js';
import { getProvider } from './providers/index.js';

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
 * Validate config using provider-specific validation
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

  // Use provider's validateConfig method
  const provider = getProvider(c.provider);
  provider.validateConfig(c[c.provider]);
}

/**
 * Clear config cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
