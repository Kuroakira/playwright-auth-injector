import { describe, it, expect } from 'vitest';
import {
  AuthError,
  ConfigNotFoundError,
  ConfigInvalidError,
  AuthenticationError,
  TokenExchangeError,
  InjectionError,
} from '../src/errors.js';

describe('AuthError', () => {
  it('should create an error with message and code', () => {
    const error = new AuthError('test message', 'AUTH_FAILED');

    expect(error.message).toBe('test message');
    expect(error.code).toBe('AUTH_FAILED');
    expect(error.name).toBe('AuthError');
    expect(error.cause).toBeUndefined();
  });

  it('should include cause when provided', () => {
    const cause = new Error('original error');
    const error = new AuthError('wrapped message', 'CONFIG_INVALID', cause);

    expect(error.cause).toBe(cause);
  });

  it('should be instanceof Error', () => {
    const error = new AuthError('test', 'AUTH_FAILED');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AuthError);
  });
});

describe('ConfigNotFoundError', () => {
  it('should create error with search paths', () => {
    const paths = ['/path/to/config1.ts', '/path/to/config2.ts'];
    const error = new ConfigNotFoundError(paths);

    expect(error.code).toBe('CONFIG_NOT_FOUND');
    expect(error.name).toBe('ConfigNotFoundError');
    expect(error.message).toContain('/path/to/config1.ts');
    expect(error.message).toContain('/path/to/config2.ts');
  });

  it('should be instanceof AuthError', () => {
    const error = new ConfigNotFoundError([]);

    expect(error).toBeInstanceOf(AuthError);
  });
});

describe('ConfigInvalidError', () => {
  it('should create error with message only', () => {
    const error = new ConfigInvalidError('invalid format');

    expect(error.code).toBe('CONFIG_INVALID');
    expect(error.message).toBe('Config error: invalid format');
    expect(error.field).toBeUndefined();
  });

  it('should create error with field', () => {
    const error = new ConfigInvalidError('is required', 'firebase.apiKey');

    expect(error.message).toBe('Config error [firebase.apiKey]: is required');
    expect(error.field).toBe('firebase.apiKey');
  });
});

describe('AuthenticationError', () => {
  it('should create error with message', () => {
    const error = new AuthenticationError('user not found');

    expect(error.code).toBe('AUTH_FAILED');
    expect(error.name).toBe('AuthenticationError');
  });

  it('should include cause', () => {
    const cause = new Error('network error');
    const error = new AuthenticationError('failed', cause);

    expect(error.cause).toBe(cause);
  });
});

describe('TokenExchangeError', () => {
  it('should create error with status code', () => {
    const error = new TokenExchangeError('invalid token', 401);

    expect(error.code).toBe('TOKEN_EXCHANGE_FAILED');
    expect(error.statusCode).toBe(401);
  });

  it('should work without status code', () => {
    const error = new TokenExchangeError('network error');

    expect(error.statusCode).toBeUndefined();
  });
});

describe('InjectionError', () => {
  it('should create error', () => {
    const error = new InjectionError('IndexedDB failed');

    expect(error.code).toBe('INJECTION_FAILED');
    expect(error.name).toBe('InjectionError');
  });
});
