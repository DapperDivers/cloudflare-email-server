import cors from 'cors';
import { NextFunction } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import hpp from 'hpp';
import { CommonRequest, CommonResponse } from 'shared/src/adapters/request-response';
import { env } from 'shared/src/config/env';
import { ErrorCode } from 'shared/src/schema/api';
import { logger } from 'shared/src/utils/logger';

/**
 * Interface for CORS options
 */
export interface CorsOptions {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Check if an origin is allowed by the CORS configuration
 */
export function isOriginAllowed(
  requestOrigin: string | undefined,
  allowedOrigin: string | string[] | boolean
): boolean {
  // If no request origin, reject
  if (!requestOrigin) {
    return false;
  }

  // Allow all origins
  if (allowedOrigin === '*' || allowedOrigin === true) {
    return true;
  }

  // Allow specific origin
  if (typeof allowedOrigin === 'string') {
    return requestOrigin === allowedOrigin;
  }

  // Allow array of origins
  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(requestOrigin);
  }

  return false;
}

/**
 * Factory function that creates both CORS and security middleware
 * with coordinated behavior for Express
 */
export function createSecurityMiddleware() {
  // Create a shared context for middleware communication
  const context = {
    corsEnabled: true,
    preflightHandled: false,
  };

  // Default CORS options
  const corsOptions: CorsOptions = {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: false,
    maxAge: 3600,
  };

  // Create Express CORS middleware
  const expressCorsMw = cors({
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    allowedHeaders: corsOptions.allowedHeaders,
    exposedHeaders: corsOptions.exposedHeaders,
    credentials: corsOptions.credentials,
    maxAge: corsOptions.maxAge,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  /**
   * Adapter for CORS middleware to work with our common interfaces
   */
  const corsMiddleware = (req: CommonRequest, res: CommonResponse, next: () => void): void => {
    // Mark if preflight is being handled
    if (req.method === 'OPTIONS') {
      context.preflightHandled = true;
    }

    // Delegate to Express cors middleware
    if (req.getOriginalRequest && res.send) {
      expressCorsMw(req.getOriginalRequest(), res.send(), next as NextFunction);
    } else {
      // Fallback manual implementation
      const requestOrigin = req.get('Origin');

      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        if (isOriginAllowed(requestOrigin, corsOptions.origin)) {
          // Set appropriate Access-Control-Allow-Origin header
          if (corsOptions.origin === '*' || corsOptions.origin === true) {
            res.set('Access-Control-Allow-Origin', '*');
          } else {
            res.set('Access-Control-Allow-Origin', requestOrigin || '');
          }

          // Set other CORS headers for preflight
          if (corsOptions.methods && corsOptions.methods.length > 0) {
            res.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
          }

          if (corsOptions.allowedHeaders && corsOptions.allowedHeaders.length > 0) {
            res.set('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
          }

          if (corsOptions.maxAge) {
            res.set('Access-Control-Max-Age', corsOptions.maxAge.toString());
          }

          if (corsOptions.credentials) {
            res.set('Access-Control-Allow-Credentials', 'true');
          }

          // Respond to preflight request
          res.status(204).body = null;
          return;
        } else {
          // Origin not allowed
          logger.warn('CORS: Origin not allowed', {
            origin: requestOrigin,
            allowedOrigins: corsOptions.origin,
          });
          res.status(403).json({
            success: false,
            message: 'CORS not allowed for this origin',
            error: {
              code: ErrorCode.FORBIDDEN,
            },
          });
          return;
        }
      }

      // Handle actual requests (not OPTIONS)
      if (isOriginAllowed(requestOrigin, corsOptions.origin)) {
        // Set appropriate Access-Control-Allow-Origin header
        if (corsOptions.origin === '*' || corsOptions.origin === true) {
          res.set('Access-Control-Allow-Origin', '*');
        } else {
          res.set('Access-Control-Allow-Origin', requestOrigin || '');
        }

        if (corsOptions.exposedHeaders && corsOptions.exposedHeaders.length > 0) {
          res.set('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));
        }

        if (corsOptions.credentials) {
          res.set('Access-Control-Allow-Credentials', 'true');
        }
      }

      next();
    }
  };

  // Security header definitions
  const securityHeadersMap = {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
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
    'referer',
  ];

  // Create Express helmet middleware for security headers
  const helmetMw = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  // Create Express mongo sanitize middleware to prevent NoSQL injection
  const mongoSanitizeMw = mongoSanitize();

  // Create Express hpp middleware to prevent HTTP Parameter Pollution
  const hppMw = hpp();

  /**
   * Adapter for security middleware to work with our common interfaces
   */
  const securityMiddleware = (req: CommonRequest, res: CommonResponse, next: () => void): void => {
    // If it's an OPTIONS request and preflight was already handled,
    // skip additional security headers that might interfere
    if (req.method === 'OPTIONS' && context.preflightHandled) {
      next();
      return;
    }

    // Apply security headers if we have direct Express objects
    if (req.getOriginalRequest && res.send) {
      const expressReq = req.getOriginalRequest();
      const expressRes = res.send();

      // Apply security middleware chain
      helmetMw(expressReq, expressRes, () => {
        mongoSanitizeMw(expressReq, expressRes, () => {
          hppMw(expressReq, expressRes, () => {
            // Skip header validation for OPTIONS requests (needed for CORS preflight)
            if (req.method === 'OPTIONS') {
              next();
              return;
            }

            // Validate request headers (lowercase for consistency)
            const requestHeaders = Object.keys(req.headers).map((h) => h.toLowerCase());
            const invalidHeaders = requestHeaders.filter(
              (header) => !allowedHeaders.includes(header) && !header.startsWith('sec-')
            );

            if (invalidHeaders.length > 0) {
              res.status(403).json({
                success: false,
                message: 'Forbidden',
                error: {
                  code: ErrorCode.FORBIDDEN,
                  message: 'Request contains unsupported headers',
                },
              });
              return;
            }

            next();
          });
        });
      });
    } else {
      // Apply security headers manually if we don't have direct Express objects
      Object.entries(securityHeadersMap).forEach(([header, value]) => {
        res.set(header, value);
      });

      // Skip header validation for OPTIONS requests
      if (req.method === 'OPTIONS') {
        next();
        return;
      }

      // Validate request headers (lowercase for consistency)
      const requestHeaders = Object.keys(req.headers).map((h) => h.toLowerCase());
      const invalidHeaders = requestHeaders.filter(
        (header) => !allowedHeaders.includes(header) && !header.startsWith('sec-')
      );

      if (invalidHeaders.length > 0) {
        res.status(403).json({
          success: false,
          message: 'Forbidden',
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'Request contains unsupported headers',
          },
        });
        return;
      }

      next();
    }
  };

  // Return both middleware functions
  return {
    corsMiddleware,
    securityMiddleware,
  };
}
