/**
 * エラークラス定義
 */

/** エラーコード */
export type AuthErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'AUTH_FAILED'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'INJECTION_FAILED';

/** 認証エラー基底クラス */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AuthError';

    // ES5互換のためプロトタイプチェーンを修正
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/** 設定が見つからないエラー */
export class ConfigNotFoundError extends AuthError {
  constructor(searchPaths: string[]) {
    super(
      `設定ファイルが見つかりません。以下のパスを探しました:\n${searchPaths.map(p => `  - ${p}`).join('\n')}`,
      'CONFIG_NOT_FOUND'
    );
    this.name = 'ConfigNotFoundError';
    Object.setPrototypeOf(this, ConfigNotFoundError.prototype);
  }
}

/** 設定が無効なエラー */
export class ConfigInvalidError extends AuthError {
  constructor(message: string, public readonly field?: string) {
    super(
      field ? `設定エラー [${field}]: ${message}` : `設定エラー: ${message}`,
      'CONFIG_INVALID'
    );
    this.name = 'ConfigInvalidError';
    Object.setPrototypeOf(this, ConfigInvalidError.prototype);
  }
}

/** 認証失敗エラー */
export class AuthenticationError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUTH_FAILED', cause);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/** トークン交換失敗エラー */
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

/** 注入失敗エラー */
export class InjectionError extends AuthError {
  constructor(message: string, cause?: Error) {
    super(message, 'INJECTION_FAILED', cause);
    this.name = 'InjectionError';
    Object.setPrototypeOf(this, InjectionError.prototype);
  }
}
