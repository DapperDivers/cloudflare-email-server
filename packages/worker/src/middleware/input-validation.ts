/**
 * Worker-specific implementation of input validation middleware
 * 
 * This file provides Worker-friendly implementations of validation
 * middleware for request inputs.
 */

import { CommonRequest, CommonResponse } from 'shared/src/adapters/request-response';
import { ErrorCode } from 'shared/src/schema/api';
import { logger } from 'shared/src/utils/logger';
import { ZodSchema, ZodError, z } from 'zod';

/**
 * Email request schema for validation
 */
export const EmailRequestSchema = z.object({
  email: z.string().email().min(5).max(100),
  name: z.string().min(2).max(100),
  message: z.string().min(10).max(1000)
});

/**
 * Worker-specific middleware to validate request body against a Zod schema
 */
export function createValidator<T>(schema: ZodSchema<T>) {
  return (req: CommonRequest, res: CommonResponse, next: () => void): void => {
    try {
      // Validate incoming data against schema
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed', { 
          path: req.path, 
          body: req.body, 
          errors: error.errors 
        });
        
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            details: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message
            }))
          }
        });
      } else {
        logger.error('Unexpected validation error', error instanceof Error ? error : new Error(String(error)));
        next();
      }
    }
  };
}

/**
 * Worker-specific middleware to validate email request
 * This handles validation for the contact form submissions
 */
export function validateEmailRequest(req: CommonRequest, res: CommonResponse, next: () => void) {
  const validator = createValidator(EmailRequestSchema);
  validator(req, res, next);
}

/**
 * Common middleware for email validation that works with our adapter pattern
 */
export function commonValidateEmailRequest(
  req: CommonRequest, 
  res: CommonResponse, 
  next: () => void
): void {
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({
      success: false,
      message: 'Invalid request body',
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request body must be a JSON object'
      }
    });
    return;
  }
  
  const { email, name, message } = req.body;
  
  // Basic validation
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({
      success: false,
      message: 'Invalid email address',
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Please provide a valid email address'
      }
    });
    return;
  }
  
  if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
    res.status(400).json({
      success: false,
      message: 'Invalid name',
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Name must be between 2 and 100 characters'
      }
    });
    return;
  }
  
  if (!message || typeof message !== 'string' || message.length < 10 || message.length > 1000) {
    res.status(400).json({
      success: false,
      message: 'Invalid message',
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Message must be between 10 and 1000 characters'
      }
    });
    return;
  }
  
  // Sanitize inputs
  if (typeof req.body === 'object') {
    req.body.email = email.trim().toLowerCase();
    req.body.name = name.trim();
    req.body.message = message.trim();
  }
  
  next();
} 