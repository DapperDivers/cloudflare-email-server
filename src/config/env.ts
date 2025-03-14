import { config } from 'dotenv';
import { z } from 'zod';

// Global variable to store worker environment for access across modules
let workerEnv: Record<string, any> | null = null;

// Function to set worker environment (called from worker.ts)
export function setWorkerEnv(env: Record<string, any>): void {
  workerEnv = env;
}

// Load environment variables from .env file in Node.js environments
// In Cloudflare Workers, environment variables are injected differently
if (typeof process !== 'undefined' && process.env) {
  config();
}

// Helper to access environment variables that works in both Node.js and Cloudflare Workers
const getEnvVar = (key: string): string | undefined => {
  // First check if we have worker environment
  if (workerEnv && key in workerEnv) {
    return workerEnv[key];
  }
  
  // Then check if we're in Cloudflare Worker environment
  if (typeof process === 'undefined' || !process.env) {
    // Use the globalThis object which works in both browser and worker contexts
    return (globalThis as any)[key];
  }
  
  return process.env[key];
};

// Environment schema with validation
const envSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('3001'),

  // Email configuration
  EMAIL_SERVICE: z.enum(['gmail', 'outlook', 'yahoo', 'zoho']).default('gmail'),
  EMAIL_USER: z.string().default('test@example.com'),
  EMAIL_PASS: z.string().optional(),
  
  // OAuth2 configuration
  OAUTH2_CLIENT_ID: z.string().optional(),
  OAUTH2_CLIENT_SECRET: z.string().optional(),
  OAUTH2_REFRESH_TOKEN: z.string().optional(),
  OAUTH2_ACCESS_TOKEN: z.string().optional(),
  
  // Email provider configuration
  EMAIL_PROVIDER: z.enum(['nodemailer', 'mailchannels']).default('nodemailer'),
  DKIM_PRIVATE_KEY: z.string().optional(),
  MAILCHANNELS_API_KEY: z.string().optional(),
  MAILCHANNELS_SENDER_DOMAIN: z.string().optional(),
  MAILCHANNELS_SENDER_EMAIL: z.string().optional(),
  
  // CORS configuration
  CORS_ORIGIN: z.string().default('*'),

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
    // Create an object to store our environment variables
    const envVars: Record<string, string | undefined> = {};
    
    // Extract all the keys from the schema
    const keys = Object.keys(envSchema.shape);
    
    // Get values for all keys
    keys.forEach((key) => {
      envVars[key] = getEnvVar(key);
    });
    
    // Parse with our schema
    return envSchema.parse(envVars);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      
      // In Cloudflare Workers, we don't want to exit the process
      if (typeof process !== 'undefined' && process.exit) {
        process.exit(1);
      } else {
        throw new Error(`Environment validation failed: ${error.message}`);
      }
    }
    throw error;
  }
};

// Export validated environment variables
export const env = validateEnv();

// Function to update environment after it's been set initially
// This is useful for Cloudflare Worker environment where env is passed to fetch
export function updateEnv(): void {
  // Re-validate with potentially new worker environment
  Object.assign(env, validateEnv());
}

// Type definition for environment variables
export type Env = z.infer<typeof envSchema>;
