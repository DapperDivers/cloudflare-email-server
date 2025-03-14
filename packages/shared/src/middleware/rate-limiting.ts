import { CommonRequest, CommonResponse } from '@adapters/request-response';
import { env } from '@config/env';
import { ErrorCode } from '@schema/api';

/**
 * Detects if the code is running in a Worker environment
 * This is checked at build time by Vite to tree-shake the appropriate code
 */
export const isWorkerEnvironment = typeof process === 'undefined';

/**
 * Email rate limiter map for tracking email-based rate limits
 * Uses the email address as the key
 */
const emailRateLimitMap = new Map<string, { count: number; timestamp: number }>();

/**
 * Common rate limiter implementation that works in both environments
 */
export class CommonRateLimiter {
  private windowMs: number;
  private max: number;
  private ipLimitMap: Map<string, { count: number; timestamp: number }>;

  constructor(windowMs: number, max: number) {
    this.windowMs = windowMs;
    this.max = max;
    this.ipLimitMap = new Map();
  }

  middleware(req: CommonRequest, res: CommonResponse, next: () => void): void {
    const ip = req.ip || '127.0.0.1';
    const now = Date.now();
    
    // Clean up old entries periodically
    if (now % (60 * 60 * 1000) < 1000) {
      this.ipLimitMap.clear();
    }
    
    const userData = this.ipLimitMap.get(ip);
    
    if (userData) {
      // Check if the window has expired
      if (now - userData.timestamp > this.windowMs) {
        this.ipLimitMap.set(ip, { count: 1, timestamp: now });
      } else if (userData.count >= this.max) {
        // Rate limit exceeded
        res.status(429).json({
          success: false,
          message: 'Too many requests',
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
          },
        });
        return;
      } else {
        // Increment request count
        this.ipLimitMap.set(ip, { count: userData.count + 1, timestamp: userData.timestamp });
      }
    } else {
      // First request from this IP
      this.ipLimitMap.set(ip, { count: 1, timestamp: now });
    }
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(this.max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, this.max - (userData?.count ?? 1))));
    res.set('X-RateLimit-Reset', String(Math.ceil((userData?.timestamp ?? now) + this.windowMs)));
    
    next();
  }
}

/**
 * Default rate limiter factory for Worker environment
 * In Express environment, this will be overridden in the express-server package
 */
export const createRateLimiter = (windowMs: number, max: number) => {
  const limiter = new CommonRateLimiter(windowMs, max);
  return limiter.middleware.bind(limiter);
};

/**
 * Common email rate limiter implementation for use with our adapter pattern
 * Works in both Express and Worker environments
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