import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { ApiResponse, ErrorCode } from '../schema/api.js';
import { AppError } from '../utils/errors.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): Response<ApiResponse> => {
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        details: err.errors,
      },
    });
  }

  // Handle known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
        details: err.details,
      },
    });
  }

  // Handle unknown errors
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: {
      code: ErrorCode.SERVER_ERROR,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
  });
};
