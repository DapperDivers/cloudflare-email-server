import { env, setWorkerEnv, updateEnv } from './config/env.js';
import { securityMiddleware, createRateLimiter, emailRateLimiter } from './middleware/security.js';
import { EmailRequestSchema, type EmailRequest, type ApiResponse } from './schema/api.js';
import { EmailError } from './utils/errors.js';
import { corsHandler } from './middleware/cors-handler.js';
import { EmailService } from './services/email.service.js';

// Logger function for structured logging
const log = {
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

// Create simulated Express-like Request and Response classes for middleware
class WorkerRequest {
  method: string;
  url: string;
  path: string;
  ip: string;
  private _headers: Headers;
  body: any;
  query: Record<string, string>;
  params: Record<string, string>;
  private originalRequest: Request;
  headersObject: Record<string, string>; // Added for Express compatibility

  constructor(request: Request, body: any = null) {
    this.originalRequest = request;
    this.method = request.method;
    const url = new URL(request.url);
    this.url = request.url;
    this.path = url.pathname;
    this.ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    this._headers = request.headers;
    this.body = body;
    
    // Parse query parameters
    this.query = {};
    url.searchParams.forEach((value, key) => {
      this.query[key] = value;
    });
    
    this.params = {};
    
    // Convert Headers to Express-like headers object
    this.headersObject = {};
    request.headers.forEach((value, key) => {
      this.headersObject[key.toLowerCase()] = value;
    });
  }

  get(name: string): string | null {
    return this._headers.get(name);
  }

  // Express compatibility - read headers object, not Headers instance
  header(name: string): string | undefined {
    return this.headersObject[name.toLowerCase()];
  }
  
  // Add Express-compatible headers property access
  get headers(): Record<string, string> {
    return this.headersObject;
  }
  
  // Keep the original Headers object from fetch API
  get rawHeaders(): Headers {
    return this.originalRequest.headers;
  }
  
  // Ensure we can still use the set accessor for headers
  set headers(newHeaders: any) {
    if (newHeaders instanceof Headers) {
      // If it's a Headers object, convert to Record
      this.headersObject = {};
      newHeaders.forEach((value, key) => {
        this.headersObject[key.toLowerCase()] = value;
      });
    } else {
      // If it's already a Record, just use it
      this.headersObject = newHeaders;
    }
  }

  // Add other Express-like methods as needed
}

class WorkerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  private responseSent: boolean;
  private listeners: Record<string, Function[]>;

  constructor() {
    this.statusCode = 200;
    this.headers = {
      'Content-Type': 'application/json',
    };
    this.body = null;
    this.responseSent = false;
    this.listeners = {};
  }

  status(code: number): WorkerResponse {
    this.statusCode = code;
    return this;
  }

  json(data: any): WorkerResponse {
    this.body = data;
    this.headers['Content-Type'] = 'application/json';
    this.responseSent = true;
    this.emit('finish');
    return this;
  }

  set(name: string, value: string): WorkerResponse;
  set(headers: Record<string, string>): WorkerResponse;
  set(nameOrHeaders: string | Record<string, string>, value?: string): WorkerResponse {
    if (typeof nameOrHeaders === 'string' && value !== undefined) {
      this.headers[nameOrHeaders] = value;
    } else if (typeof nameOrHeaders === 'object') {
      this.headers = { ...this.headers, ...nameOrHeaders };
    }
    return this;
  }

  on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, ...args: any[]): void {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback(...args);
      }
    }
  }

  // Helper to convert to actual Cloudflare Response
  toResponse(): Response {
    return new Response(
      JSON.stringify(this.body),
      {
        status: this.statusCode,
        headers: this.headers,
      }
    );
  }
}

// Middleware adapter to convert Express middleware to Worker-compatible middleware
type ExpressMiddleware = (req: WorkerRequest, res: WorkerResponse, next: () => void) => void;
type AsyncExpressMiddleware = (req: WorkerRequest, res: WorkerResponse, next: () => void) => Promise<void>;

// Middleware adapter function - converts Express middleware to our WorkerRequest/Response format
function adaptMiddleware(middleware: any): ExpressMiddleware {
  return (req: WorkerRequest, res: WorkerResponse, next: () => void) => {
    // Call the original middleware with our adapted request/response
    try {
      middleware(req, res, (err?: any) => {
        if (err) {
          throw err;
        }
        next();
      });
    } catch (error) {
      // Handle synchronous errors
      next();
    }
  };
}

// Function to run a chain of middleware
async function runMiddlewareChain(
  req: WorkerRequest,
  res: WorkerResponse,
  middlewares: (ExpressMiddleware | AsyncExpressMiddleware)[]
): Promise<boolean> {
  let index = 0;
  
  async function next(): Promise<void> {
    if (index < middlewares.length) {
      const middleware = middlewares[index++];
      await middleware(req, res, next);
    }
  }
  
  try {
    await next();
    return !res.body; // If res.body is set, middleware chain has sent a response
  } catch (error) {
    // Handle errors similarly to Express error middleware
    console.error('Middleware error:', error);
    
    // Apply error handler middleware
    const errorHandlerMiddleware = (req: WorkerRequest, res: WorkerResponse) => {
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      // Simulate errorHandler middleware behavior
      if (error instanceof EmailError) {
        res.status(error.statusCode || 400).json({
          success: false,
          message: error.message,
        });
      } else {
        log.error('Unhandled middleware error', err);
        res.status(500).json({
          success: false,
          message: 'Internal Server Error',
        });
      }
    };
    
    errorHandlerMiddleware(req, res);
    return true;
  }
}

// Request logging middleware (native to Worker)
const requestLoggingMiddleware: ExpressMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Log request - safely handle potentially missing headers
  const origin = req.get('origin') || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  
  log.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    origin: origin,
    userAgent: userAgent,
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    log.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      origin: origin,
    });
  });

  next();
};

// Create a rate limiter adapter that works with our Worker Request/Response
const createWorkerRateLimiter = (windowMs: number, max: number): ExpressMiddleware => {
  const rateLimiter = createRateLimiter(windowMs, max);
  return adaptMiddleware(rateLimiter);
};

// Async handler wrapper (similar to the one in index.ts)
const asyncHandler = (fn: (req: WorkerRequest, res: WorkerResponse) => Promise<void>) => {
  return async (req: WorkerRequest, res: WorkerResponse, next: () => void): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      log.error('Unhandled route error', err);
      
      if (!res.body) {  // Only set response if not already sent
        res.status(500).json({
          success: false,
          message: 'Internal Server Error',
        });
      }
    }
  };
};

// Email endpoint handler using the same logic from index.ts
const handleEmail = asyncHandler(async (req: WorkerRequest, res: WorkerResponse): Promise<void> => {
  const startTime = Date.now();

  try {
    // Add CORS headers directly to ensure they're set
    const origin = req.get('origin') || req.header?.('origin');
    if (origin) {
      try {
        // Extract domains for comparison
        const originDomain = new URL(origin).hostname;
        
        // Handle various CORS_ORIGIN formats
        let configDomain = env.CORS_ORIGIN;
        if (configDomain.includes('://')) {
          configDomain = new URL(configDomain).hostname;
        }
        
        // Allow main domain and email subdomain to communicate
        const originWithoutPrefix = originDomain.replace(/^(?:email\.)?/, '');
        const configWithoutPrefix = configDomain.replace(/^(?:email\.)?/, '');
        
        if (originWithoutPrefix === configWithoutPrefix) {
          res.set('Access-Control-Allow-Origin', origin);
          res.set('Access-Control-Allow-Methods', 'POST');
          res.set('Access-Control-Allow-Headers', 'Content-Type');
        }
      } catch (e) {
        log.warn('Error parsing origin in email handler', { error: e });
      }
    }

    // Validate and sanitize input
    const validatedData = await EmailRequestSchema.parseAsync(req.body);
    
    // Create an email service instance and send the email
    const emailService = new EmailService();
    const result = await emailService.sendEmail(validatedData, req.ip, true);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error: unknown) {
    const errorInstance = error instanceof Error ? error : new Error('Unknown error occurred');
    log.error('Email sending failed', errorInstance, { ip: req.ip });
    throw new EmailError(errorInstance.message);
  }
});

// Not found handler
const notFoundHandler = (req: WorkerRequest, res: WorkerResponse) => {
  log.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: {
      code: 'NOT_FOUND',
    },
  });
};

// Cloudflare Worker handler
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      // Set worker environment variables to make them available across modules
      setWorkerEnv(env);
      updateEnv();
      
      // Log environment for debugging
      console.log(`[Worker] Environment variables:
        EMAIL_SERVICE: ${env.EMAIL_SERVICE || 'not set'}
        EMAIL_USER: ${env.EMAIL_USER || 'not set'}
        EMAIL_PROVIDER: ${env.EMAIL_PROVIDER || 'nodemailer'}
        OAUTH2_CLIENT_ID: ${env.OAUTH2_CLIENT_ID ? 'is set' : 'not set'}
        OAUTH2_CLIENT_SECRET: ${env.OAUTH2_CLIENT_SECRET ? 'is set' : 'not set'}
        OAUTH2_REFRESH_TOKEN: ${env.OAUTH2_REFRESH_TOKEN ? 'is set' : 'not set'}
        DKIM_PRIVATE_KEY: ${env.DKIM_PRIVATE_KEY ? 'is set' : 'not set'}
      `);
      
      // Headers needed for CORS
      const origin = request.headers.get('Origin');
      console.log(`[Worker] Request received from origin: ${origin || 'unknown'}`);
      
      // Handle OPTIONS preflight requests immediately
      if (request.method === 'OPTIONS') {
        console.log(`[Worker] Handling OPTIONS preflight for origin: ${origin || 'unknown'}`);
        
        // Get CORS_ORIGIN from environment
        const corsOrigin = env.CORS_ORIGIN || '*';
        console.log(`[Worker] CORS_ORIGIN from env: ${corsOrigin}`);
        
        // Allow domains to communicate based on environment variable
        let isAllowed = false;
        
        if (corsOrigin === '*') {
          isAllowed = true;
        } else if (origin && origin === corsOrigin) {
          isAllowed = true;
        } else if (origin) {
          try {
            // Parse domains from origins
            const originDomain = new URL(origin).hostname;
            
            // Handle CORS_ORIGIN with or without protocol
            const configDomain = corsOrigin.includes('://')
              ? new URL(corsOrigin).hostname
              : corsOrigin;
            
            // Remove email. prefix if present for comparison  
            const originWithoutPrefix = originDomain.replace(/^(?:email\.)?/, '');
            const configWithoutPrefix = configDomain.replace(/^(?:email\.)?/, '');
            
            // Allow communication between domain and its email subdomain
            isAllowed = (originWithoutPrefix === configWithoutPrefix);
            
            console.log(`[Worker] Comparing domains: ${originWithoutPrefix} vs ${configWithoutPrefix}, allowed: ${isAllowed}`);
          } catch (e) {
            console.log(`[Worker] Error parsing origin: ${e}`);
          }
        }
          
        console.log(`[Worker] Is origin allowed: ${isAllowed}`);
        
        if (isAllowed && origin) {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Max-Age': '86400',
            }
          });
        } else {
          // If not allowed, return 403 Forbidden
          return new Response(JSON.stringify({ error: 'CORS preflight failed' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
      }

      // If this is a POST request directly to the API endpoint, handle with nodemailer
      if (request.method === 'POST' && 
          (request.url.includes('/api/send-email') || request.url.includes('/api/email'))) {
        console.log(`[Worker] Direct API POST request detected`);
        
        let origin = request.headers.get('Origin');
        
        try {
          // Parse the request body
          const body = await request.json();
          console.log(`[Worker] Email request body:`, JSON.stringify(body));
          
          // Validate the request format using the schema
          // Type check the body properties
          if (!body || typeof body !== 'object') {
            throw new Error('Invalid request format: body must be an object');
          }
          
          const typedBody = body as Record<string, unknown>;
          const name = typedBody.name;
          const email = typedBody.email;
          const message = typedBody.message;
          
          if (!name || typeof name !== 'string' || 
              !email || typeof email !== 'string' || 
              !message || typeof message !== 'string') {
            throw new Error('Invalid request format: missing required fields or invalid types');
          }
          
          const startTime = Date.now();
          
          // Create email service and send email
          const emailService = new EmailService();
          const result = await emailService.sendEmail(
            { name, email, message }, 
            request.headers.get('CF-Connecting-IP') || 'unknown',
            true
          );
          
          console.log(`[Worker] Email sent successfully in ${result.duration}ms`);
          
          // Return success response with CORS headers
          return new Response(JSON.stringify({
            success: true,
            message: 'Email sent successfully',
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': origin || '*',
              'Access-Control-Allow-Methods': 'POST',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          });
        } catch (e) {
          console.error(`[Worker] Error processing email:`, e);
          
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
      
      // For other requests, continue with original middleware chain approach
      return await this.processRequest(request, env, ctx);
    } catch (error) {
      // Fallback error handling
      const err = error instanceof Error ? error : new Error('Unknown error in worker');
      console.error('Unhandled worker error:', err);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Internal Server Error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },

  // Helper method to process the request normally
  async processRequest(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      // Parse body if it's a POST/PUT request
      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        if (request.headers.get('Content-Type')?.includes('application/json')) {
          body = await request.json();
        }
      }
      
      // Create Express-like request and response objects
      const req = new WorkerRequest(request, body);
      const res = new WorkerResponse();

      // Log CORS origin for debugging
      log.info('CORS configuration', { 
        corsOrigin: env.CORS_ORIGIN,
        nodeEnv: env.NODE_ENV
      });

      // Adapt Express middleware for our Worker environment
      const adaptedCorsHandler = adaptMiddleware(corsHandler);
      const adaptedSecurityMiddleware = adaptMiddleware(securityMiddleware);
      const adaptedEmailRateLimiter = adaptMiddleware(emailRateLimiter);
      
      // Set up middleware chain (same order as in index.ts)
      const middlewares: (ExpressMiddleware | AsyncExpressMiddleware)[] = [
        adaptedCorsHandler,                            // CORS handling
        requestLoggingMiddleware,                      // Request logging
        adaptedSecurityMiddleware,                     // Security headers
        createWorkerRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX)  // General rate limiting
      ];
      
      // Run common middleware chain
      const responseHandled = await runMiddlewareChain(req, res, middlewares);
      if (responseHandled) {
        return res.toResponse();
      }
      
      // Handle OPTIONS requests (CORS preflight) - should be caught earlier but just in case
      if (req.method === 'OPTIONS') {
        return res.status(204).toResponse();
      }
      
      // URL-specific middleware and handlers
      if (req.path === '/api/health' && req.method === 'GET') {
        // Health check endpoint
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
        });
      } else if ((req.path === '/api/email' || req.path === '/api/send-email') && req.method === 'POST') {
        // Email endpoint with additional middleware
        const emailMiddlewares = [
          adaptedEmailRateLimiter,  // Email-specific rate limiting
          handleEmail               // Email handler
        ];
        
        await runMiddlewareChain(req, res, emailMiddlewares);
      } else {
        // Not found handler
        notFoundHandler(req, res);
      }
      
      return res.toResponse();
    } catch (error) {
      // Fallback error handling
      const err = error instanceof Error ? error : new Error('Unknown error in worker');
      log.error('Unhandled worker error', err);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Internal Server Error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }
}; 