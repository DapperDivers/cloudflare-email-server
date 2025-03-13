import { createTransport } from 'nodemailer';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityMiddleware, createRateLimiter, emailRateLimiter } from './middleware/security.js';
import { EmailRequestSchema, type EmailRequest, type ApiResponse } from './schema/api.js';
import { EmailError } from './utils/errors.js';
import { corsHandler } from './middleware/cors-handler.js';
import { createOAuth2Transport } from './utils/oauth2.js';

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
  headers: Headers;
  body: any;
  query: Record<string, string>;
  params: Record<string, string>;
  private originalRequest: Request;

  constructor(request: Request, body: any = null) {
    this.originalRequest = request;
    this.method = request.method;
    const url = new URL(request.url);
    this.url = request.url;
    this.path = url.pathname;
    this.ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    this.headers = request.headers;
    this.body = body;
    
    // Parse query parameters
    this.query = {};
    url.searchParams.forEach((value, key) => {
      this.query[key] = value;
    });
    
    this.params = {};
  }

  get(name: string): string | null {
    return this.headers.get(name);
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

  // Log request
  log.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    origin: req.get('origin'),
    userAgent: req.get('user-agent'),
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
      origin: req.get('origin'),
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
    // Log incoming email request
    log.info('Processing email request', {
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Validate and sanitize input
    const validatedData = await EmailRequestSchema.parseAsync(req.body);
    const { name, email, message } = validatedData;

    log.info('Email validation passed', {
      recipientEmail: email,
      timestamp: new Date().toISOString(),
    });

    // Set up email transport
    let transporter;
    if (env.OAUTH2_CLIENT_ID && env.OAUTH2_CLIENT_SECRET && env.OAUTH2_REFRESH_TOKEN) {
      log.info('Setting up email transport with OAuth2');
      transporter = await createOAuth2Transport();
    } else {
      log.info('Setting up email transport with password auth');
      transporter = createTransport({
        service: env.EMAIL_SERVICE,
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS,
        },
      });
    }

    const mailOptions = {
      from: env.EMAIL_USER,
      to: env.EMAIL_USER,
      subject: `New Contact Form Submission from ${name}`,
      text: `
Name: ${name}
Email: ${email}
Message: ${message}
      `,
      replyTo: email,
    };

    await transporter.sendMail(mailOptions);

    const duration = Date.now() - startTime;
    log.info('Email sent successfully', {
      recipientEmail: email,
      duration,
      timestamp: new Date().toISOString(),
    });

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
      
      // Handle OPTIONS requests (CORS preflight)
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
  },
}; 