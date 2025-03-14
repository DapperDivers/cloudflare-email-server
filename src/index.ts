import express, { json, Request, Response } from 'express';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { securityMiddleware, createRateLimiter, emailRateLimiter } from './middleware/security.js';
import { corsHandler } from './middleware/cors-handler.js';
import { EmailService } from './services/email.service.js';
import { logger } from './utils/logger.js';
import { expressErrorHandler } from './utils/error-handler.js';
import { ExpressRequestAdapter, ExpressResponseAdapter } from './adapters/request-response.js';
import { adaptExpressMiddleware } from './adapters/middleware-adapter.js';
import { 
  healthCheckHandler, 
  emailHandler, 
  notFoundHandler,
  requestLoggingMiddleware 
} from './core/routes.js';

const app = express();

// Log CORS origin for debugging
logger.info('CORS configuration', { 
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV
});

// All routes should use the CORS handler middleware first
// This ensures OPTIONS preflight requests are handled correctly
app.use(corsHandler);

// JSON body parser
app.use(json({ limit: '10kb' }));

// Request logging middleware - using shared implementation
app.use((req: Request, res: Response, next) => {
  const adaptedReq = new ExpressRequestAdapter(req);
  const adaptedRes = new ExpressResponseAdapter(res);
  requestLoggingMiddleware(adaptedReq, adaptedRes, next);
});

// Apply security middleware (this will also set security headers)
app.use(securityMiddleware);

// Rate limiting - configurable requests per window per IP (general protection)
app.use(createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX));

// Global email service instance
let emailService: EmailService;

// Use OAuth2 if client id and refresh token are available, otherwise use password auth
const setupEmailTransport = async () => {
  try {
    emailService = new EmailService();
    await emailService.initialize();
    
    logger.info('Email service configured');
  } catch (error) {
    const errorInstance =
      error instanceof Error ? error : new Error('Unknown email configuration error');
    logger.error('Email service configuration failed', errorInstance);
    process.exit(1);
  }
};

// Initialize email transport
setupEmailTransport();

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
  emailRateLimiter,
  asyncExpressHandler(async (req: Request, res: Response): Promise<void> => {
    const adaptedReq = new ExpressRequestAdapter(req);
    const adaptedRes = new ExpressResponseAdapter(res);
    await emailHandler(adaptedReq, adaptedRes);
  })
);

// Error handling
app.use(expressErrorHandler);

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

// Start server
const port = env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
