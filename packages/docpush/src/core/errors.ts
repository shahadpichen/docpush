/**
 * Base error class for DocPush
 */
export class DocPushError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'DocPushError';
  }
}

/**
 * Configuration error
 */
export class ConfigError extends DocPushError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Authentication error
 */
export class AuthError extends DocPushError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

/**
 * Draft not found error
 */
export class DraftNotFoundError extends DocPushError {
  constructor(draftId: string) {
    super(`Draft not found: ${draftId}`, 'DRAFT_NOT_FOUND');
    this.name = 'DraftNotFoundError';
  }
}

/**
 * Document not found error
 */
export class DocNotFoundError extends DocPushError {
  constructor(path: string) {
    super(`Document not found: ${path}`, 'DOC_NOT_FOUND');
    this.name = 'DocNotFoundError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends DocPushError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Environment variable missing error
 */
export class EnvError extends DocPushError {
  constructor(variable: string) {
    super(`Missing required environment variable: ${variable}`, 'ENV_ERROR');
    this.name = 'EnvError';
  }
}
