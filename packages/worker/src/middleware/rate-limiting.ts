/**
 * Worker-specific implementation of rate limiting
 * 
 * This file serves as a pass-through for the shared rate limiting
 * implementation but can be extended with Worker-specific functionality
 * when needed.
 */

import { 
  createRateLimiter,
  commonEmailRateLimiter,
  type CommonRateLimiter
} from 'shared/src/middleware/rate-limiting';

// Re-export the shared implementations
export {
  createRateLimiter,
  commonEmailRateLimiter,
  type CommonRateLimiter
};

// Export a Worker-specific rate limiter for email requests
export const emailRateLimiter = commonEmailRateLimiter; 