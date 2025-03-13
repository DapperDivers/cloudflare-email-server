import cors from 'cors';
import express, { json, Request, Response } from 'express';
import { createTransport } from 'nodemailer';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityMiddleware, createRateLimiter, emailRateLimiter } from './middleware/security.js';
import { EmailRequestSchema, type EmailRequest, type ApiResponse } from './schema/api.js';
import { EmailError } from './utils/errors.js';

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

// CORS Configuration
const allowedOrigins = [env.CORS_ORIGIN];

// Allow the main site to access the API on a subdomain
// e.g., saraengland.com should be able to access email.saraengland.com
if (env.CORS_ORIGIN && env.CORS_ORIGIN.includes('://')) {
  const mainDomain = env.CORS_ORIGIN.split('://')[1];
  // Don't add email subdomain for localhost in development
  if (!mainDomain.includes('localhost')) {
    const emailSubdomain = `https://email.${mainDomain}`;
    allowedOrigins.push(emailSubdomain);
  }
}

// Add development origins if in development mode
if (env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:5050');
}

log.info('CORS configuration', { allowedOrigins });

// Helper function to generate CORS headers
const getCorsHeaders = (origin: string | undefined): Record<string, string> => {
  // Only set the Access-Control-Allow-Origin header if the origin is allowed
  if (!origin || !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
};

const app = express();

// CORS middleware with strict origin checking
app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ): void => {
      // For security, we log requests with no origin
      if (!origin) {
        log.warn('Request received with no origin');
        return callback(new Error('Not allowed by CORS - no origin'), false);
      }

      // Check if origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        log.info('Request allowed from origin', { origin });
        return callback(null, true);
      }

      log.warn('Request blocked - unauthorized origin', { origin });
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204,
  })
);

// Specialized middleware to handle OPTIONS requests and CORS for Cloudflare Workers
app.use((req: Request, res: Response, next): Response | void => {
  const origin = req.get('origin');

  // Handle OPTIONS requests (preflight) specifically
  if (req.method === 'OPTIONS') {
    // Only allow preflight requests from allowed origins
    if (!origin || !allowedOrigins.includes(origin)) {
      log.warn('Preflight request blocked - unauthorized origin', { origin });
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied - unauthorized origin for preflight',
        },
      });
    }

    // Add CORS headers to the preflight response
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.header(key, value);
    });

    // Respond to the preflight request
    return res.status(204).end();
  }

  // For regular requests, verify the origin
  if (!origin || !allowedOrigins.includes(origin)) {
    log.warn('Request blocked - unauthorized origin', {
      origin,
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied - unauthorized origin',
      },
    });
  }

  // Add CORS headers to all responses
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.header(key, value);
  });

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");

  next();
});

app.use(json({ limit: '10kb' }));

// Request logging middleware
app.use((req: Request, res: Response, next): void => {
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
});

// Apply security middleware
app.use(securityMiddleware);

// Rate limiting - configurable requests per window per IP (general protection)
app.use(createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX));

// Create email transporter
const transporter = createTransport({
  service: env.EMAIL_SERVICE,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

// Verify email configuration on startup
transporter
  .verify()
  .then(() => {
    log.info('Email service configured', {
      service: env.EMAIL_SERVICE,
      user: env.EMAIL_USER,
    });
  })
  .catch((error: unknown) => {
    const errorInstance =
      error instanceof Error ? error : new Error('Unknown email configuration error');
    log.error('Email service configuration failed', errorInstance, {
      service: env.EMAIL_SERVICE,
      user: env.EMAIL_USER,
    });
    process.exit(1);
  });

// Wrap async route handler to handle promise rejections
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response): void => {
    void fn(req, res).catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error('Unknown error');
      void log.error('Unhandled route error', err);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    });
  };
};

// Email endpoint with validation
app.post(
  '/api/send-email',
  emailRateLimiter,
  asyncHandler(
    async (
      req: Request<object, object, EmailRequest>,
      res: Response<ApiResponse>
    ): Promise<void> => {
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
    }
  )
);

// Error handling
app.use(errorHandler);

// Handle unhandled routes
app.use('*', (req: Request, res: Response): void => {
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
});

// Handle unhandled rejections
process.on('unhandledRejection', (error: Error) => {
  void log.error('Unhandled rejection', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  void log.error('Uncaught exception', error);
  process.exit(1);
});

// Start server
const port = env.PORT || 3000;
app.listen(port, () => {
  log.info(`Server is running on port ${port}`);
});
