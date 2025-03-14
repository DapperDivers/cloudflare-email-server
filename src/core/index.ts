// Re-export core functionality from the shared package
// Import specific exports from the routes.ts file in the shared/core package
import type { RouteHandler } from 'shared/core/routes';
import {
  asyncHandler,
  healthCheckHandler,
  emailHandler,
  notFoundHandler,
  requestLoggingMiddleware,
} from 'shared/core/routes';

// Re-export what we imported
export type { RouteHandler };
export {
  asyncHandler,
  healthCheckHandler,
  emailHandler,
  notFoundHandler,
  requestLoggingMiddleware,
};

// Express-specific core functionality can be added here
export const SERVER_NAME = 'express-server';

// Re-export environment configuration
export { env } from '../config/env';
