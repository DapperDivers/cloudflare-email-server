/**
 * Shared types
 */

// Email request type
export interface EmailRequest {
  name: string;
  email: string;
  message: string;
}

// API response type
export interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

// Error codes
export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  EMAIL_FAILED = 'EMAIL_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
}
