import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { ErrorCode } from '../schema/api.js';

interface EmailRequestBody {
  email: string;
  [key: string]: unknown;
}

// Rate limiting configuration
export const createRateLimiter = (windowMs: number, max: number): ReturnType<typeof rateLimit> =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response): void => {
      res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
    },
  });

// Email rate limiter - configurable requests per day per email
const emailRateLimitMap = new Map<string, { count: number; timestamp: number }>();

export const emailRateLimiter = (
  req: Request<unknown, unknown, Partial<EmailRequestBody>>,
  res: Response,
  next: NextFunction
): void => {
  const email = req.body.email?.toLowerCase();
  if (!email) {
    next();
    return;
  }

  const now = Date.now();
  const userData = emailRateLimitMap.get(email);

  // Clean up old entries every hour
  if (now % (60 * 60 * 1000) < 1000) {
    emailRateLimitMap.clear();
  }

  if (userData) {
    // Check if the window has expired
    if (now - userData.timestamp > env.EMAIL_RATE_LIMIT_WINDOW_MS) {
      emailRateLimitMap.set(email, { count: 1, timestamp: now });
    } else if (userData.count >= env.EMAIL_RATE_LIMIT_MAX) {
      res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
      return;
    } else {
      emailRateLimitMap.set(email, { count: userData.count + 1, timestamp: userData.timestamp });
    }
  } else {
    emailRateLimitMap.set(email, { count: 1, timestamp: now });
  }

  next();
};

// Security header definitions
const securityHeadersMap = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Apply security headers - separated function
export const applySecurityHeaders = (res: Response): void => {
  // Set security headers from the map
  Object.entries(securityHeadersMap).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
};

// List of allowed headers for request validation
const allowedHeaders = [
  'accept',
  'accept-language',
  'content-language',
  'content-type',
  'origin',
  'x-requested-with',
  'user-agent',
  'host',
  'connection',
  'referer'
];

export const securityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Apply security headers
  applySecurityHeaders(res);

  // Skip header validation for OPTIONS requests (needed for CORS preflight)
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  // Validate request headers (lowercase for consistency)
  const requestHeaders = Object.keys(req.headers).map(h => h.toLowerCase());
  const invalidHeaders = requestHeaders.filter(
    header => !allowedHeaders.includes(header) && !header.startsWith('sec-')
  );

  if (invalidHeaders.length > 0) {
    res.status(403).json({
      success: false,
      message: 'Forbidden',
      error: {
        code: ErrorCode.FORBIDDEN,
        message: 'Request contains unsupported headers'
      }
    });
    return;
  }

  next();
};
