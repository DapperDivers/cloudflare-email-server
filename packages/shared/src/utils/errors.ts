import { ErrorCode } from '@shared-schema/api';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: ErrorCode, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack;
    }
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('Validation failed', ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

/**
 * Custom error types for the email server
 */

/**
 * Base error class for email-related errors
 */
export class EmailError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = 'EMAIL_ERROR', status = 500) {
    super(message);
    this.name = 'EmailError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Error thrown when email validation fails
 */
export class EmailValidationError extends EmailError {
  constructor(message: string) {
    super(message, 'EMAIL_VALIDATION_ERROR', 400);
    this.name = 'EmailValidationError';
  }
}

/**
 * Error thrown when email sending fails
 */
export class EmailSendError extends EmailError {
  constructor(message: string) {
    super(message, 'EMAIL_SEND_ERROR', 500);
    this.name = 'EmailSendError';
  }
}

/**
 * Error thrown when email rate limit is exceeded
 */
export class EmailRateLimitError extends EmailError {
  constructor(message = 'Email rate limit exceeded') {
    super(message, 'EMAIL_RATE_LIMIT_ERROR', 429);
    this.name = 'EmailRateLimitError';
  }
}
