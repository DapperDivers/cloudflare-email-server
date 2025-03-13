import { z } from 'zod';

// Email request schema with strict validation
export const EmailRequestSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name can only contain letters, spaces, and basic punctuation')
    .transform(str => str.trim()),

  email: z
    .string()
    .email('Invalid email format')
    .max(100, 'Email cannot exceed 100 characters')
    .transform(str => str.toLowerCase().trim()),

  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message cannot exceed 1000 characters')
    .transform(str => str.trim()),
});

export type EmailRequest = z.infer<typeof EmailRequestSchema>;

// API Response types
export interface ApiResponse<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
  };
}

// Error types
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  FORBIDDEN = 'FORBIDDEN',
}
