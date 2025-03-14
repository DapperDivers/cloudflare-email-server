import { z } from 'zod';

// Browser information schema
export const BrowserInfoSchema = z.object({
  userAgent: z.string().max(500, 'User agent string too long'),
  language: z.string().max(20, 'Language string too long'),
  platform: z.string().max(50, 'Platform string too long'),
  screenResolution: z.string().max(20, 'Screen resolution string too long'),
  windowSize: z.string().max(20, 'Window size string too long'),
  timeZone: z.string().max(50, 'Time zone string too long'),
  cookiesEnabled: z.boolean(),
  doNotTrack: z.string().nullable(),
  referrer: z.string().max(500, 'Referrer string too long'),
  connectionType: z.string().max(50, 'Connection type string too long').optional(),
  deviceMemory: z.string().max(20, 'Device memory string too long').optional(),
  devicePixelRatio: z.number().min(0).max(10),
  vendor: z.string().max(100, 'Vendor string too long'),
  renderingEngine: z.string().max(100, 'Rendering engine string too long'),
});

// Email request schema with strict validation
export const EmailRequestSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name can only contain letters, spaces, and basic punctuation')
    .transform((str) => str.trim()),

  email: z
    .string()
    .email('Invalid email format')
    .max(100, 'Email cannot exceed 100 characters')
    .transform((str) => str.toLowerCase().trim()),

  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message cannot exceed 1000 characters')
    .transform((str) => str.trim()),

  browserInfo: BrowserInfoSchema.optional(),
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
