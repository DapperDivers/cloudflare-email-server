/**
 * Worker-specific implementation of security and CORS middleware
 * 
 * This file provides Worker-friendly implementations of security
 * and CORS handling middleware.
 */

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
 * with coordinated behavior for Workers
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
   * CORS middleware for Workers
   */
  const corsMiddleware = (
    req: CommonRequest, 
    res: CommonResponse, 
    next: () => void
  ): void => {
    // Mark if preflight is being handled
    if (req.method === 'OPTIONS') {
      context.preflightHandled = true;
    }
    
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
          allowedOrigins: corsOptions.origin 
        });
        res.status(403).json({
          success: false,
          message: 'CORS not allowed for this origin',
          error: {
            code: ErrorCode.FORBIDDEN
          }
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
  };

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
   * Security middleware for Worker environments
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
    
    // Apply security headers manually
    Object.entries(securityHeadersMap).forEach(([header, value]) => {
      res.set(header, value);
    });
    
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
  
  // Return both middleware functions
  return {
    corsMiddleware,
    securityMiddleware
  };
} 