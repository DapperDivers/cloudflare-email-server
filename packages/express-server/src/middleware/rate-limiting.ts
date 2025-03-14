import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from 'shared/src/config/env';
import {
  CommonRateLimiter,
  commonEmailRateLimiter,
  isWorkerEnvironment,
} from 'shared/src/middleware/rate-limiting';
import { ErrorCode } from 'shared/src/schema/api';

/**
 * Interface for email request body
 */
interface EmailRequestBody {
  email: string;
  name: string;
  message: string;
}

// Map to track request count for each email
const emailRateLimitMap = new Map<string, { count: number; timestamp: number }>();

/**
 * Creates a rate limiter middleware for Express routes
 * Overrides the implementation from the shared package with Express-specific one
 */
export function createRateLimiter(windowMs: number, max: number) {
  if (isWorkerEnvironment) {
    // This shouldn't happen, but just in case we're in a Worker environment
    const limiter = new CommonRateLimiter(windowMs, max);
    return limiter.middleware.bind(limiter);
  }

  // Express-specific implementation
  return rateLimit({
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
}

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
 * Re-export the common email rate limiter for use with our adapter pattern
 */
export { commonEmailRateLimiter };
