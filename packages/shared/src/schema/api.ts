import { z } from 'zod';

// Browser information schema
export const BrowserInfoSchema = z
  .object({
    userAgent: z.string().max(500, 'User agent string too long').optional(),
    language: z.string().max(20, 'Language string too long').optional(),
    platform: z.string().max(50, 'Platform string too long').optional(),
    screenResolution: z.string().max(20, 'Screen resolution string too long').optional(),
    windowSize: z.string().max(20, 'Window size string too long').optional(),
    timeZone: z.string().max(50, 'Time zone string too long').optional(),
    cookiesEnabled: z.boolean().optional(),
    doNotTrack: z.string().nullable().optional(),
    referrer: z.string().max(500, 'Referrer string too long').optional(),
    connectionType: z.string().max(50, 'Connection type string too long').optional(),
    deviceMemory: z.string().max(20, 'Device memory string too long').optional(),
    devicePixelRatio: z.number().min(0).max(10).optional(),
    vendor: z.string().max(100, 'Vendor string too long').optional(),
    renderingEngine: z.string().max(100, 'Rendering engine string too long').optional(),
  })
  .catchall(z.unknown())
  .transform((data) => {
    // Helper function to validate a field with a schema
    const validateField = (value: unknown, schema: z.ZodType) => {
      const result = schema.safeParse(value);
      return result.success ? value : undefined;
    };

    // Create a new object with only valid fields
    const cleanedData: Record<string, unknown> = {};

    // Process known fields with their schemas
    if (data.userAgent !== undefined)
      cleanedData.userAgent = validateField(data.userAgent, z.string().max(500));
    if (data.language !== undefined)
      cleanedData.language = validateField(data.language, z.string().max(20));
    if (data.platform !== undefined)
      cleanedData.platform = validateField(data.platform, z.string().max(50));
    if (data.screenResolution !== undefined)
      cleanedData.screenResolution = validateField(data.screenResolution, z.string().max(20));
    if (data.windowSize !== undefined)
      cleanedData.windowSize = validateField(data.windowSize, z.string().max(20));
    if (data.timeZone !== undefined)
      cleanedData.timeZone = validateField(data.timeZone, z.string().max(50));
    if (data.cookiesEnabled !== undefined)
      cleanedData.cookiesEnabled = validateField(data.cookiesEnabled, z.boolean());
    if (data.doNotTrack !== undefined)
      cleanedData.doNotTrack = validateField(data.doNotTrack, z.string().nullable());
    if (data.referrer !== undefined)
      cleanedData.referrer = validateField(data.referrer, z.string().max(500));
    if (data.connectionType !== undefined)
      cleanedData.connectionType = validateField(data.connectionType, z.string().max(50));
    if (data.deviceMemory !== undefined)
      cleanedData.deviceMemory = validateField(data.deviceMemory, z.string().max(20));
    if (data.devicePixelRatio !== undefined)
      cleanedData.devicePixelRatio = validateField(
        data.devicePixelRatio,
        z.number().min(0).max(10)
      );
    if (data.vendor !== undefined)
      cleanedData.vendor = validateField(data.vendor, z.string().max(100));
    if (data.renderingEngine !== undefined)
      cleanedData.renderingEngine = validateField(data.renderingEngine, z.string().max(100));

    // Add any unknown fields as-is
    Object.entries(data).forEach(([key, value]) => {
      if (!(key in cleanedData)) {
        cleanedData[key] = value;
      }
    });

    return cleanedData;
  });

// Export the type for use in other files
export type BrowserInfo = z.infer<typeof BrowserInfoSchema>;

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
