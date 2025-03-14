/**
 * Main entry point for the Cloudflare Worker
 * This file works as both the Vite development entry point and the Worker handler
 */

import { runMiddlewareChain } from 'shared/src/adapters/middleware-adapter';
import { setWorkerEnv, updateEnv } from 'shared/src/config/env';
import {
  healthCheckHandler,
  emailHandler,
  notFoundHandler,
  requestLoggingMiddleware,
} from 'shared/src/core/routes';
import { logger } from 'shared/src/utils/logger';

import { WorkerRequestAdapter, WorkerResponseAdapter } from './adapters/request-response';
import { createSecurityMiddleware, commonValidateEmailRequest } from './middleware';
import { createRateLimiter, commonEmailRateLimiter } from './middleware/rate-limiting';
import { handleError, createErrorResponse } from './utils/error-handler';

// Create a rate limiter that works with our Worker interfaces
const createWorkerRateLimiter = (windowMs: number, max: number) => {
  return createRateLimiter(windowMs, max);
};

// Create coordinated security and CORS middleware
const { corsMiddleware, securityMiddleware } = createSecurityMiddleware();

const workerHandler = {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      // Update global env with worker env and initialize logging
      setWorkerEnv(env);

      // Make environment variables available
      updateEnv();

      // Store important environment variables in the logger for debugging
      logger.info('Worker configuration', {
        NODE_ENV: env.NODE_ENV || 'production',
        CORS_ORIGIN: env.CORS_ORIGIN || '*',
        EMAIL_SERVICE: env.EMAIL_SERVICE || 'mailchannels',
      });

      // Extract key info from request
      const url = new URL(request.url);
      const { pathname } = url;
      const method = request.method;
      const origin = request.headers.get('Origin');

      // Convert headers to a format that can be logged
      const headersObj: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headersObj[key] = value;
      });

      logger.info(`Worker received ${method} request to ${pathname}`, {
        origin: origin ?? 'none',
        headers: JSON.stringify(headersObj),
      });

      // If this is a POST request directly to the API endpoint, handle with simplified logic
      if (
        request.method === 'POST' &&
        (request.url.includes('/api/send-email') || request.url.includes('/api/email'))
      ) {
        logger.info(`Direct API POST request detected`);

        try {
          // Parse the request body
          const body = await request.json();

          // Create a WorkerRequest and WorkerResponse for the core route handler
          const req = new WorkerRequestAdapter(request, body);
          const res = new WorkerResponseAdapter();

          // Run core middleware first
          const middlewares = [
            corsMiddleware, // Coordinated CORS handling
            securityMiddleware, // Coordinated security headers
            commonEmailRateLimiter, // Environment-agnostic email rate limiting
            commonValidateEmailRequest, // Environment-agnostic validation
          ];

          const middlewareHandled = await runMiddlewareChain(req, res, middlewares);
          if (!middlewareHandled) {
            // Run email handler
            await emailHandler(req, res);
          }

          // Return the response
          return res.send();
        } catch (e) {
          logger.error(`Error processing email:`, e instanceof Error ? e : new Error(String(e)));

          // Return error response with CORS headers
          return new Response(
            JSON.stringify({
              success: false,
              message:
                'Failed to send email: ' + (e instanceof Error ? e.message : 'Unknown error'),
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': origin ?? '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type',
              },
            }
          );
        }
      }

      // For other requests, continue with middleware chain approach
      return await this.processRequest(request, env, ctx);
    } catch (error) {
      // Create standardized error response
      const err = handleError(error);
      const errorResponse = createErrorResponse(err);

      // Return error response
      return new Response(JSON.stringify(errorResponse.body), {
        status: errorResponse.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  },

  // Helper method to process the request using middleware chain
  async processRequest(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      // Parse body if it's a POST/PUT request
      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        if (request.headers.get('Content-Type')?.includes('application/json')) {
          body = await request.json();
        }
      }

      // Create Request and Response adapters
      const req = new WorkerRequestAdapter(request, body);
      const res = new WorkerResponseAdapter();

      // Log CORS origin for debugging
      logger.info('CORS configuration', {
        corsOrigin: env.CORS_ORIGIN,
        nodeEnv: env.NODE_ENV,
      });

      // Set up middleware chain (using environment-agnostic middleware)
      const middlewares = [
        corsMiddleware, // Coordinated CORS handling
        requestLoggingMiddleware, // Request logging
        securityMiddleware, // Coordinated security headers
        createWorkerRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX), // General rate limiting
      ];

      // Run common middleware chain
      const responseHandled = await runMiddlewareChain(req, res, middlewares);
      if (responseHandled) {
        return res.send();
      }

      // Handle OPTIONS requests (CORS preflight) - should be caught earlier but just in case
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
      }

      // URL-specific middleware and handlers
      if (req.path === '/api/health' && req.method === 'GET') {
        // Health check endpoint
        await healthCheckHandler(req, res);
      } else if (
        (req.path === '/api/email' || req.path === '/api/send-email') &&
        req.method === 'POST'
      ) {
        // Email endpoint with additional middleware
        const emailMiddlewares = [
          commonEmailRateLimiter, // Environment-agnostic email rate limiting
          commonValidateEmailRequest, // Environment-agnostic validation
        ];

        const rateLimitHandled = await runMiddlewareChain(req, res, emailMiddlewares);
        if (!rateLimitHandled) {
          await emailHandler(req, res);
        }
      } else {
        // Not found handler
        await notFoundHandler(req, res);
      }

      return res.send();
    } catch (error) {
      // Create standardized error response
      const err = handleError(error);
      const errorResponse = createErrorResponse(err);

      // Return error response
      return new Response(JSON.stringify(errorResponse.body), {
        status: errorResponse.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  },
};

// For hot module replacement during development
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    logger.info('HMR: Worker code updated, restarting...');
  });
}

// Export the worker handler as default
export default workerHandler;
