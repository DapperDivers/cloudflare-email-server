import { env, setWorkerEnv, updateEnv } from './config/env.js';
import { securityMiddleware, createRateLimiter, emailRateLimiter } from './middleware/security.js';
import { corsHandler } from './middleware/cors-handler.js';
import { logger } from './utils/logger.js';
import { WorkerRequestAdapter, WorkerResponseAdapter } from './adapters/request-response.js';
import { adaptExpressMiddleware, runMiddlewareChain } from './adapters/middleware-adapter.js';
import { 
  healthCheckHandler, 
  emailHandler, 
  notFoundHandler,
  requestLoggingMiddleware,
  handleCorsPreflightRequest
} from './core/routes.js';
import { createErrorResponse, handleError } from './utils/error-handler.js';

// Create a rate limiter adapter that works with our Worker Request/Response
const createWorkerRateLimiter = (windowMs: number, max: number) => {
  const rateLimiter = createRateLimiter(windowMs, max);
  return adaptExpressMiddleware(rateLimiter);
};

// Cloudflare Worker handler
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      // Set worker environment variables to make them available across modules
      setWorkerEnv(env);
      updateEnv();
      
      // Log environment for debugging
      logger.info('Worker environment', {
        EMAIL_SERVICE: env.EMAIL_SERVICE || 'not set',
        EMAIL_USER: env.EMAIL_USER || 'not set',
        EMAIL_PROVIDER: env.EMAIL_PROVIDER || 'nodemailer',
        OAUTH2_CLIENT_ID: env.OAUTH2_CLIENT_ID ? 'is set' : 'not set',
        OAUTH2_CLIENT_SECRET: env.OAUTH2_CLIENT_SECRET ? 'is set' : 'not set',
        OAUTH2_REFRESH_TOKEN: env.OAUTH2_REFRESH_TOKEN ? 'is set' : 'not set',
        DKIM_PRIVATE_KEY: env.DKIM_PRIVATE_KEY ? 'is set' : 'not set'
      });
      
      // Get Origin header
      const origin = request.headers.get('Origin');
      logger.info(`Request received from origin: ${origin || 'unknown'}`);
      
      // Handle OPTIONS preflight requests immediately
      if (request.method === 'OPTIONS') {
        const corsOrigin = env.CORS_ORIGIN || '*';
        const corsResponse = handleCorsPreflightRequest(
          new WorkerRequestAdapter(request),
          origin,
          corsOrigin
        );
        
        if (corsResponse) {
          return corsResponse;
        }
      }

      // If this is a POST request directly to the API endpoint, handle with simplified logic
      if (request.method === 'POST' && 
          (request.url.includes('/api/send-email') || request.url.includes('/api/email'))) {
        logger.info(`Direct API POST request detected`);
        
        try {
          // Parse the request body
          const body = await request.json();
          
          // Create a WorkerRequest and WorkerResponse for the core route handler
          const req = new WorkerRequestAdapter(request, body);
          const res = new WorkerResponseAdapter();
          
          // Run email handler
          await emailHandler(req, res);
          
          // Return the response
          return res.send();
        } catch (e) {
          logger.error(`Error processing email:`, e as Error);
          
          // Return error response with CORS headers
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'Failed to send email: ' + (e instanceof Error ? e.message : 'Unknown error')
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin || '*',
              'Access-Control-Allow-Methods': 'POST',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          });
        }
      }
      
      // For other requests, continue with middleware chain approach
      return await this.processRequest(request, env, ctx);
    } catch (error) {
      // Create standardized error response
      const err = handleError(error);
      const errorResponse = createErrorResponse(err);
      
      // Return error response
      return new Response(
        JSON.stringify(errorResponse.body),
        {
          status: errorResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
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
        nodeEnv: env.NODE_ENV
      });

      // Adapt Express middleware for our Worker environment
      const adaptedCorsHandler = adaptExpressMiddleware(corsHandler);
      const adaptedSecurityMiddleware = adaptExpressMiddleware(securityMiddleware);
      const adaptedEmailRateLimiter = adaptExpressMiddleware(emailRateLimiter);
      
      // Set up middleware chain (same order as in index.ts)
      const middlewares = [
        adaptedCorsHandler,                            // CORS handling
        requestLoggingMiddleware,                      // Request logging
        adaptedSecurityMiddleware,                     // Security headers
        createWorkerRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX)  // General rate limiting
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
      } else if ((req.path === '/api/email' || req.path === '/api/send-email') && req.method === 'POST') {
        // Email endpoint with additional middleware
        const emailMiddlewares = [
          adaptedEmailRateLimiter  // Email-specific rate limiting
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
      return new Response(
        JSON.stringify(errorResponse.body),
        {
          status: errorResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }
}; 