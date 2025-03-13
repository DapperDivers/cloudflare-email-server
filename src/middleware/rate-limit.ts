import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 5; // requests per window
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (req.path !== '/api/send-email' || req.method !== 'POST') {
    return next();
  }

  const email = req.body.email;
  if (!email) {
    return next();
  }

  const now = Date.now();
  const entry = rateLimitMap.get(email);

  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(email, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return next();
  }

  if (entry.count >= RATE_LIMIT) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded'
    });
  }

  entry.count++;
  return next();
}; 