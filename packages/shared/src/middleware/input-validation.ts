import { CommonRequest, CommonResponse } from '@adapters/request-response';
import { z } from 'zod';

export const EmailRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  message: z.string().min(1, 'Message is required')
});

/**
 * Express-specific middleware for validating email requests
 */
export const validateEmailRequest = async (req: CommonRequest, res: CommonResponse, next: () => void) => {
  try {
    await EmailRequestSchema.parseAsync(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid request data'
      });
    }
  }
};

/**
 * Environment-agnostic middleware for validating email requests
 * This works with our CommonRequest/CommonResponse types
 */
export const commonValidateEmailRequest = async (
  req: CommonRequest, 
  res: CommonResponse, 
  next: () => void
) => {
  try {
    await EmailRequestSchema.parseAsync(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid request data'
      });
    }
  }
};

/**
 * Generic schema validation middleware (environment-agnostic)
 * @param schema Zod schema to validate against
 */
export const createValidator = <T>(schema: z.ZodSchema<T>) => {
  return async (req: CommonRequest, res: CommonResponse, next: () => void) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: error.errors[0].message,
          error: {
            code: 'VALIDATION_ERROR',
            details: error.errors
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          error: {
            code: 'VALIDATION_ERROR'
          }
        });
      }
    }
  };
}; 