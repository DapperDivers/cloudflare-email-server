/**
 * Central export file for all middleware
 * This allows for cleaner imports throughout the application
 * 
 * Example:
 * import { securityMiddleware, emailRateLimiter } from './middleware';
 * Instead of multiple imports from different files
 */

/**
 * Worker-specific middleware exports
 */

export * from './rate-limiting';

// Coordinated security and CORS middleware (recommended)
export {
  createSecurityMiddleware,
  type CorsOptions as SecurityCorsOptions,
  isOriginAllowed
} from './security-cors';

// Error handling
export { 
  errorHandler,
  commonErrorHandler,
  asyncHandler
} from './error-handler';

// Input validation
export { 
  validateEmailRequest,
  commonValidateEmailRequest,
  createValidator,
  EmailRequestSchema
} from './input-validation'; 