/**
 * Base interface for authentication providers
 *
 * To add a new provider:
 * 1. Create a new class implementing AuthProvider<YourConfig>
 * 2. Implement validateConfig() to validate provider-specific config
 * 3. Implement inject() to handle the authentication injection
 * 4. Register in src/providers/index.ts
 */

import type { Page } from '@playwright/test';
import type { Provider } from '../types.js';

/** Options passed to inject method */
export interface InjectOptions {
  debug?: boolean;
  waitAfter?: number;
}

/**
 * Authentication provider interface
 *
 * @typeParam TConfig - Provider-specific configuration type
 */
export interface AuthProvider<TConfig> {
  /** Provider identifier */
  readonly name: Provider;

  /**
   * Validate provider-specific configuration
   *
   * @param config - Raw config object to validate
   * @returns Validated and typed config
   * @throws ConfigInvalidError if validation fails
   */
  validateConfig(config: unknown): TConfig;

  /**
   * Inject authentication state into the browser
   *
   * @param page - Playwright Page object
   * @param config - Validated provider config
   * @param options - Injection options
   */
  inject(page: Page, config: TConfig, options: InjectOptions): Promise<void>;
}
