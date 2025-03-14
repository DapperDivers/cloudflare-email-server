import { CommonRequest, CommonResponse } from '../adapters/request-response.js';
import { CommonMiddleware, runMiddlewareChain } from '../adapters/middleware-adapter.js';
import { EmailService } from '../services/email.service.js';
import { EmailRequestSchema } from '../schema/api.js';
import { EmailError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { createErrorResponse, handleError } from '../utils/error-handler.js';

/**
 * Type for route handlers with common request/response
 */
export type RouteHandler = (req: CommonRequest, res: CommonResponse) => Promise<void>;

/**
 * Helper function to create an async route handler
 */
export const asyncHandler = (fn: RouteHandler): CommonMiddleware => {
  return async (req: CommonRequest, res: CommonResponse, next: () => void): Promise<void> => {
    try {
      await fn(req, res);
    } catch (error) {
      const err = handleError(error);
      const errorResponse = createErrorResponse(err);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  };
};

/**
 * Health check route handler
 */
export const healthCheckHandler: RouteHandler = async (req: CommonRequest, res: CommonResponse) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Email sending route handler
 */
export const emailHandler: RouteHandler = async (req: CommonRequest, res: CommonResponse) => {
  const startTime = Date.now();

  try {
    // Log incoming email request
    logger.info('Processing email request', {
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    // Validate and sanitize input (use zod schema)
    const validatedData = await EmailRequestSchema.parseAsync(req.body);
    
    // Create an email service instance and send the email
    const emailService = new EmailService();
    const result = await emailService.sendEmail(
      validatedData, 
      req.ip, 
      // Detect if we're in a worker environment (no server property in req)
      !('server' in req.getOriginalRequest())
    );
    
    const duration = Date.now() - startTime;
    logger.info('Email sent successfully', {
      recipientEmail: validatedData.email,
      duration,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error: unknown) {
    const errorInstance = error instanceof Error ? error : new Error('Unknown error occurred');
    logger.error('Email sending failed', errorInstance, { ip: req.ip });
    throw new EmailError(errorInstance.message);
  }
};

/**
 * Route not found handler
 */
export const notFoundHandler: RouteHandler = async (req: CommonRequest, res: CommonResponse) => {
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: {
      code: 'NOT_FOUND',
    },
  });
};

/**
 * Request logging middleware
 */
export const requestLoggingMiddleware: CommonMiddleware = (req: CommonRequest, res: CommonResponse, next: () => void) => {
  const startTime = Date.now();

  // Log request - safely handle potentially missing headers
  const origin = req.get('origin') || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    origin: origin,
    userAgent: userAgent,
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      origin: origin,
    });
  });

  next();
};

/**
 * Handles CORS preflight requests
 */
export function handleCorsPreflightRequest(req: CommonRequest, origin: string | null, corsOrigin: string): Response | null {
  if (req.method !== 'OPTIONS') {
    return null;
  }
  
  logger.info(`Handling OPTIONS preflight for origin: ${origin || 'unknown'}`);
  
  // Allow domains to communicate based on environment variable
  let isAllowed = false;
  
  if (corsOrigin === '*') {
    isAllowed = true;
  } else if (origin && origin === corsOrigin) {
    isAllowed = true;
  } else if (origin) {
    try {
      // Parse domains from origins
      const originDomain = new URL(origin).hostname;
      
      // Handle CORS_ORIGIN with or without protocol
      const configDomain = corsOrigin.includes('://')
        ? new URL(corsOrigin).hostname
        : corsOrigin;
      
      // Remove email. prefix if present for comparison  
      const originWithoutPrefix = originDomain.replace(/^(?:email\.)?/, '');
      const configWithoutPrefix = configDomain.replace(/^(?:email\.)?/, '');
      
      // Allow communication between domain and its email subdomain
      isAllowed = (originWithoutPrefix === configWithoutPrefix);
      
      logger.info(`Comparing domains: ${originWithoutPrefix} vs ${configWithoutPrefix}, allowed: ${isAllowed}`);
    } catch (e) {
      logger.warn(`Error parsing origin: ${e}`);
    }
  }
    
  logger.info(`Is origin allowed: ${isAllowed}`);
  
  if (isAllowed && origin) {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  } else {
    // If not allowed, return 403 Forbidden
    return new Response(JSON.stringify({ error: 'CORS preflight failed' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 