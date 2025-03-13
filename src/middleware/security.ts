import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { RateLimitError } from '../utils/errors.js';
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

// Security headers configuration
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Set Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  next();
};

// List of allowed headers
const allowedHeaders = [
  'Accept',
  'Accept-Language',
  'Content-Language',
  'Content-Type',
  'Origin',
  'X-Requested-With'
];

export const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Set security headers
  Object.entries(securityHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  // Validate request headers
  const requestHeaders = Object.keys(req.headers);
  const invalidHeaders = requestHeaders.filter(header => !allowedHeaders.includes(header));

  if (invalidHeaders.length > 0) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
      error: {
        code: ErrorCode.FORBIDDEN,
        message: 'Request contains unsupported headers'
      }
    });
  }

  next();
};
