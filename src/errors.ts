/**
 * Error class definitions
 */

/** Error codes */
export type AuthErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'AUTH_FAILED'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'INJECTION_FAILED';

/** Base authentication error class */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AuthError';

    // Fix prototype chain for ES5 compatibility
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/** Config file not found error */
export class ConfigNotFoundError extends AuthError {
  constructor(searchPaths: string[]) {
    super(
      `Config file not found. Searched paths:\n${searchPaths.map(p => `  - ${p}`).join('\n')}`,
      'CONFIG_NOT_FOUND'
    );
    this.name = 'ConfigNotFoundError';
    Object.setPrototypeOf(this, ConfigNotFoundError.prototype);
  }
}

/** Invalid config error */
export class ConfigInvalidError extends AuthError {
  constructor(message: string, public readonly field?: string) {
    super(
      field ? `Config error [${field}]: ${message}` : `Config error: ${message}`,
      'CONFIG_INVALID'
    );
    this.name = 'ConfigInvalidError';
    Object.setPrototypeOf(this, ConfigInvalidError.prototype);
  }
}

/** Authentication failed error */
export class AuthenticationError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTH_FAILED', cause);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/** Token exchange failed error */
export class TokenExchangeError extends AuthError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, 'TOKEN_EXCHANGE_FAILED', cause);
    this.name = 'TokenExchangeError';
    Object.setPrototypeOf(this, TokenExchangeError.prototype);
  }
}

/** Injection failed error */
export class InjectionError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'INJECTION_FAILED', cause);
    this.name = 'InjectionError';
    Object.setPrototypeOf(this, InjectionError.prototype);
  }
}
