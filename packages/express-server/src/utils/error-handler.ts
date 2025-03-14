import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from 'shared/src/schema/api';
import { handleError, createErrorResponse } from 'shared/src/utils/error-handler';

/**
 * Express-specific error handler middleware
 * This provides a standardized way to handle errors in Express routes
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

/**
 * Express-specific async handler wrapper
 * This wraps an async route handler to properly catch and handle Promise rejections
 */
export const asyncExpressHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response): void => {
    void fn(req, res).catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.error('Unhandled route error', err);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    });
  };
}; 