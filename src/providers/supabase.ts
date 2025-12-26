/**
 * Supabase authentication provider
 */

import type { Page } from '@playwright/test';
import type { AuthProvider, InjectOptions } from './base.js';
import type { SupabaseConfig } from '../types.js';
import { ConfigInvalidError } from '../errors.js';

/**
 * Supabase authentication provider implementation
 *
 * TODO: Implement Supabase authentication injection
 */
export class SupabaseAuthProvider implements AuthProvider<SupabaseConfig> {
  readonly name = 'supabase' as const;

  /**
   * Validate Supabase configuration
   */
  validateConfig(config: unknown): SupabaseConfig {
    if (!config || typeof config !== 'object') {
      throw new ConfigInvalidError('supabase config is required', 'supabase');
    }

    const c = config as Record<string, unknown>;

    if (!c.url || typeof c.url !== 'string') {
      throw new ConfigInvalidError('url must be a string', 'supabase.url');
    }

    if (!c.anonKey || typeof c.anonKey !== 'string') {
      throw new ConfigInvalidError('anonKey must be a string', 'supabase.anonKey');
    }

    if (!c.email || typeof c.email !== 'string') {
      throw new ConfigInvalidError('email must be a string', 'supabase.email');
    }

    if (!c.password || typeof c.password !== 'string') {
      throw new ConfigInvalidError('password must be a string', 'supabase.password');
    }

    return {
      url: c.url,
      anonKey: c.anonKey,
      email: c.email,
      password: c.password,
    };
  }

  /**
   * Inject Supabase authentication state into the browser
   */
  async inject(
    _page: Page,
    _config: SupabaseConfig,
    _options: InjectOptions = {}
  ): Promise<void> {
    throw new ConfigInvalidError(
      'Supabase is not yet implemented. Please use Firebase.',
      'provider'
    );
  }
}
