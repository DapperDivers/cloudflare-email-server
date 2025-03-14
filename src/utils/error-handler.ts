import { ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ErrorCode, ApiResponse } from '../schema/api.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';
import { env } from '../config/env.js';

/**
 * Standard error response format for the API
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error: {
    code: ErrorCode;
    details?: unknown;
  };
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(err: Error): { status: number; body: ErrorResponse } {
  // Log the error
  logger.error('Request error', err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Validation failed',
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          details: err.errors,
        },
      }
    };
  }

  // Handle known application errors
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: {
        success: false,
        message: err.message,
        error: {
          code: err.code,
          details: err.details,
        },
      }
    };
  }

  // Handle unknown errors
  return {
    status: 500,
    body: {
      success: false,
      message: 'Internal server error',
      error: {
        code: ErrorCode.SERVER_ERROR,
        details: env.NODE_ENV === 'development' ? err.message : undefined,
      },
    }
  };
}

/**
 * Converts any error to a proper Error object
 */
export function handleError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Express-specific error handler middleware
 */
export const expressErrorHandler = (
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void => {
  const error = handleError(err);
  const errorResponse = createErrorResponse(error);
  
  res.status(errorResponse.status).json(errorResponse.body);
}; 