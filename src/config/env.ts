import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Environment schema with validation
const envSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('3001'),

  // Email configuration
  EMAIL_SERVICE: z.enum(['gmail', 'outlook', 'yahoo', 'zoho']),
  EMAIL_USER: z.string().email('Invalid email format for EMAIL_USER'),
  EMAIL_PASS: z.string().min(8, 'EMAIL_PASS must be at least 8 characters').optional(),
  
  // OAuth2 configuration
  OAUTH2_CLIENT_ID: z.string().optional(),
  OAUTH2_CLIENT_SECRET: z.string().optional(),
  OAUTH2_REFRESH_TOKEN: z.string().optional(),
  OAUTH2_ACCESS_TOKEN: z.string().optional(),
  
  // CORS configuration
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('50'),

  // Email rate limiting
  EMAIL_RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('86400000'), // 24 hours
  EMAIL_RATE_LIMIT_MAX: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('2'),
});

// Validate environment variables
const validateEnv = (): z.infer<typeof envSchema> => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

// Export validated environment variables
export const env = validateEnv();

// Type definition for environment variables
export type Env = z.infer<typeof envSchema>;
