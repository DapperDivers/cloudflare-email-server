import { ErrorCode } from '../schema/api.js';

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

export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests, please try again later', ErrorCode.RATE_LIMIT_EXCEEDED, 429);
  }
}

export class EmailError extends AppError {
  constructor(details?: unknown) {
    super('Failed to send email', ErrorCode.EMAIL_SEND_FAILED, 500, details);
  }
}
