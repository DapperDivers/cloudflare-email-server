/**
 * Central export file for all Express-specific middleware
 * 
 * This file consolidates all the Express middleware in one place,
 * making imports cleaner throughout the application
 */

// Rate limiting middleware
export {
  createRateLimiter,
  emailRateLimiter,
  commonEmailRateLimiter
} from './rate-limiting';

// Security and CORS middleware
export {
  createSecurityMiddleware,
  isOriginAllowed,
  type CorsOptions
} from './security';

// Validation middleware
export {
  validateBody,
  validateEmailRequest,
  commonValidateEmailRequest
} from './validation';

// Error handling middleware 
export { 
  expressErrorHandler,
  asyncExpressHandler 
} from '../utils/error-handler'; 