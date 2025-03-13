import express, { json, Request, Response } from 'express';
import { createTransport, Transporter } from 'nodemailer';

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

const app = express();

// Log CORS origin for debugging
log.info('CORS configuration', { 
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV
});

// All routes should use the CORS handler middleware first
// This ensures OPTIONS preflight requests are handled correctly
app.use(corsHandler);

// JSON body parser
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

// Apply security middleware (this will also set security headers)
app.use(securityMiddleware);

// Rate limiting - configurable requests per window per IP (general protection)
app.use(createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX));

// Create email transporter based on configuration
let transporter: Transporter;

// Use OAuth2 if client id and refresh token are available, otherwise use password auth
const setupEmailTransport = async () => {
  try {
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

    // Verify email configuration
    await transporter.verify();
    log.info('Email service configured', {
      service: env.EMAIL_SERVICE,
      user: env.EMAIL_USER,
      authType: env.OAUTH2_CLIENT_ID ? 'OAuth2' : 'Password',
    });
  } catch (error) {
    const errorInstance =
      error instanceof Error ? error : new Error('Unknown email configuration error');
    log.error('Email service configuration failed', errorInstance, {
      service: env.EMAIL_SERVICE,
      user: env.EMAIL_USER,
    });
    process.exit(1);
  }
};

// Initialize email transport
setupEmailTransport();

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
