/**
 * Main entry point for the server application
 * This file works as both the Vite development entry point and the Express server
 */

import {
  healthCheckHandler,
  emailHandler,
  notFoundHandler,
  requestLoggingMiddleware,
} from '@core/routes';
import { env } from '@shared/src/config/env';
import { logger } from '@shared/src/utils/logger';
import express, { json, Request, Response, NextFunction } from 'express';

import { ExpressRequestAdapter, ExpressResponseAdapter } from '@adapters/request-response';
import {
  commonErrorHandler,
  createSecurityMiddleware,
  createRateLimiter,
  commonEmailRateLimiter,
} from '@middleware/index';

// Create Express application
const app = express();

// Log CORS origin for debugging
logger.info('CORS configuration', {
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV,
});

// Create coordinated CORS and security middleware
const { corsMiddleware, securityMiddleware } = createSecurityMiddleware();

// Apply CORS middleware first
app.use((req: Request, res: Response, next) => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  corsMiddleware(adaptedReq, adaptedRes, next);
});

// JSON body parser
app.use(json({ limit: '10kb' }));

// Request logging middleware - using shared implementation
app.use((req: Request, res: Response, next) => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  requestLoggingMiddleware(adaptedReq, adaptedRes, next);
});

// Apply security middleware
app.use((req: Request, res: Response, next) => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  securityMiddleware(adaptedReq, adaptedRes, next);
});

// Rate limiting - configurable requests per window per IP (general protection)
app.use((req: Request, res: Response, next) => {
  // Since createRateLimiter returns an Express middleware,
  // we need a different approach here - we'll use the middleware directly
  createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX)(req, res, next);
});

// Health check endpoint - using shared implementation
app.get('/api/health', (req: Request, res: Response) => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  void healthCheckHandler(adaptedReq, adaptedRes);
});

// Wrap async route handler to handle promise rejections
const asyncExpressHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response): void => {
    void fn(req, res).catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error('Unknown error');
      logger.error('Unhandled route error', err);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    });
  };
};

// Email endpoint with validation - using shared implementation
app.post(
  '/api/send-email',
  (req: Request, res: Response, next) => {
    const adaptedReq = new ExpressRequestAdapter(req);
    const adaptedRes = new ExpressResponseAdapter(res);
    commonEmailRateLimiter(adaptedReq, adaptedRes, next);
  },
  asyncExpressHandler(async (req: Request, res: Response): Promise<void> => {
    const adaptedReq = new ExpressRequestAdapter(req);
    const adaptedRes = new ExpressResponseAdapter(res);
    await emailHandler(adaptedReq, adaptedRes);
  })
);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  commonErrorHandler(err, adaptedReq, adaptedRes, next);
});

// Handle unhandled routes - using shared implementation
app.use('*', (req: Request, res: Response): void => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  void notFoundHandler(adaptedReq, adaptedRes);
});

// Handle unhandled rejections
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled rejection', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

// Start server (but only if we're not in a hot reload context)
const startServer = () => {
  const port = env.PORT || 3000;
  app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
  });
};

// For production and direct execution with Node
if (!import.meta.hot) {
  startServer();
}

// For hot module replacement during development with Vite
if (import.meta.hot) {
  // Clear any existing server
  import.meta.hot.dispose(() => {
    logger.info('HMR: Disposing server...');
    // Any cleanup can go here
  });

  import.meta.hot.accept(() => {
    logger.info('HMR: Server code updated, restarting...');
    // Re-initialize when accepted (already handled by Vite reloading the module)
  });

  // Start server in development mode
  startServer();
}

// Export for testing or programmatic usage
export { app };
