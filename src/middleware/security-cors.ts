/**
 * Combined middleware for CORS and security headers
 * This file provides a coordinated approach to CORS and security
 */

import { CommonRequest, CommonResponse } from '@adapters/request-response';
import { env } from '@config/env';
import { logger } from '@utils/logger';
import { ErrorCode } from '@schema/api';

// Security header definitions
const securityHeadersMap = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
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
 * Standard CORS origin check following the spec
 * @param origin The origin to check
 * @param allowedOrigin The allowed origin configuration (from CORS options)
 * @returns Whether the origin is allowed
 */
export function isOriginAllowed(origin: string | undefined | null, allowedOrigin: string | string[] | boolean): boolean {
  // No origin means same-origin request - always allowed
  if (!origin) {
    logger.info('CORS: No origin header (same-origin request) - allowed');
    return true;
  }
  
  logger.info(`CORS: Checking origin "${origin}" against config "${allowedOrigin}"`);
  
  // Boolean true or "*" means allow any origin
  if (allowedOrigin === true || allowedOrigin === '*') {
    logger.info('CORS: Wildcard origin - allowed');
    return true;
  }
  
  // Boolean false means block all origins
  if (allowedOrigin === false) {
    logger.info('CORS: All origins blocked by configuration');
    return false;
  }
  
  // For array of origins, check if origin is in the list
  if (Array.isArray(allowedOrigin)) {
    const allowed = allowedOrigin.includes(origin);
    logger.info(`CORS: Origin in allowed list? ${allowed}`);
    return allowed;
  }
  
  // For string, check exact match
  const allowed = allowedOrigin === origin;
  logger.info(`CORS: Exact origin match? ${allowed}`);
  return allowed;
}

/**
 * Factory function that creates both CORS and security middleware
 * with coordinated behavior
 */
export function createSecurityMiddleware() {
  // Create a shared context for middleware communication
  const context = {
    corsEnabled: true,
    preflightHandled: false
  };
  
  // Default CORS options
  const corsOptions: CorsOptions = {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: false,
    maxAge: 3600
  };
  
  /**
   * CORS handling middleware
   */
  const corsMiddleware = (
    req: CommonRequest, 
    res: CommonResponse, 
    next: () => void
  ): void => {
    const requestOrigin = req.get('Origin');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      if (isOriginAllowed(requestOrigin, corsOptions.origin)) {
        // Set appropriate Access-Control-Allow-Origin header
        if (corsOptions.origin === '*' || corsOptions.origin === true) {
          // For wildcard, we can use *
          res.set('Access-Control-Allow-Origin', '*');
        } else {
          // For specific origins, echo back the requesting origin
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
        
        // Mark that preflight has been handled
        context.preflightHandled = true;
        
        // Apply security headers that are safe for CORS preflight
        applyCorsCompatibleSecurityHeaders(res);
        
        // Respond to preflight request
        res.status(204).body = null;
        return;
      } else {
        // Origin not allowed
        logger.warn('CORS: Origin not allowed', { 
          origin: requestOrigin, 
          allowedOrigins: corsOptions.origin 
        });
        res.status(403).json({
          success: false,
          message: 'CORS not allowed for this origin'
        });
        return;
      }
    }
    
    // Handle actual requests (not OPTIONS)
    if (isOriginAllowed(requestOrigin, corsOptions.origin)) {
      // Set appropriate Access-Control-Allow-Origin header
      if (corsOptions.origin === '*' || corsOptions.origin === true) {
        // For wildcard, we can use *
        res.set('Access-Control-Allow-Origin', '*');
      } else {
        // For specific origins, echo back the requesting origin
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
  };

  /**
   * Security headers middleware
   */
  const securityMiddleware = (
    req: CommonRequest,
    res: CommonResponse,
    next: () => void
  ): void => {
    // If it's an OPTIONS request and preflight was already handled,
    // skip additional security headers that might interfere
    if (req.method === 'OPTIONS' && context.preflightHandled) {
      next();
      return;
    }
    
    // Apply all security headers for non-OPTIONS requests
    applyAllSecurityHeaders(res);

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
  
  /**
   * Apply all security headers to a response
   */
  function applyAllSecurityHeaders(res: CommonResponse): void {
    Object.entries(securityHeadersMap).forEach(([header, value]) => {
      res.set(header, value);
    });
  }
  
  /**
   * Apply only CORS-compatible security headers
   * This skips any headers that might interfere with CORS preflight
   */
  function applyCorsCompatibleSecurityHeaders(res: CommonResponse): void {
    // Apply all headers except CSP which might be more restrictive
    Object.entries(securityHeadersMap)
      .filter(([header]) => header !== 'Content-Security-Policy')
      .forEach(([header, value]) => {
        res.set(header, value);
      });
      
    // Apply a more permissive CSP for OPTIONS requests
    res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  }
  
  // Return both middleware functions
  return {
    corsMiddleware,
    securityMiddleware
  };
} 