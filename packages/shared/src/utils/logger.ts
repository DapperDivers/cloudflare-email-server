import { env } from '@shared-config/env';

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, error: Error, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
}

// Create a structured logger that works in both Node.js and Worker environments
export const createLogger = (): Logger => {
  return {
    info: (message: string, data?: Record<string, unknown>): void => {
      console.log(
        JSON.stringify({
          level: 'info',
          timestamp: new Date().toISOString(),
          message,
          ...data,
        })
      );
    },
    error: (message: string, error: Error, data?: Record<string, unknown>): void => {
      console.error(
        JSON.stringify({
          level: 'error',
          timestamp: new Date().toISOString(),
          message,
          error: {
            name: error.name,
            message: error.message,
            stack: env.NODE_ENV === 'development' ? error.stack : undefined,
          },
          ...data,
        })
      );
    },
    warn: (message: string, data?: Record<string, unknown>): void => {
      console.warn(
        JSON.stringify({
          level: 'warn',
          timestamp: new Date().toISOString(),
          message,
          ...data,
        })
      );
    },
  };
};

// Create a singleton instance for use throughout the application
export const logger = createLogger();
