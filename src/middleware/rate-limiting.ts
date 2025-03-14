import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '@config/env';
import { ErrorCode } from '@schema/api';
import { CommonRequest, CommonResponse } from '@adapters/request-response';

/**
 * Interface for email request body
 */
interface EmailRequestBody {
  email: string;
  [key: string]: unknown;
}

/**
 * Creates an Express-specific rate limiter middleware
 */
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
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
        },
      });
    },
  });

/**
 * Email rate limiter map for tracking email-based rate limits
 * Uses the email address as the key
 */
const emailRateLimitMap = new Map<string, { count: number; timestamp: number }>();

/**
 * Express-specific middleware for email rate limiting
 * Limits the number of requests per email address within a time window
 */
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
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
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

/**
 * Environment-agnostic email rate limiter for use with our adapter pattern
 */
export const commonEmailRateLimiter = (
  req: CommonRequest,
  res: CommonResponse,
  next: () => void
): void => {
  if (!req.body || typeof req.body !== 'object') {
    next();
    return;
  }

  const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase() : null;
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
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
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