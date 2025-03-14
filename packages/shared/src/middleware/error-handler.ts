/**
 * This file provides error handler middleware for both Express and environment-agnostic contexts
 */

import { CommonRequest, CommonResponse } from '@adapters/request-response';
import { handleError, createErrorResponse } from '@utils/error-handler';

/**
 * Environment-agnostic error handler middleware
 * Works with common request/response interfaces
 */
export const commonErrorHandler = (
  error: Error, 
  req: CommonRequest, 
  res: CommonResponse, 
  next: () => void
): void => {
  const err = handleError(error);
  const errorResponse = createErrorResponse(err);
  
  res.status(errorResponse.status).json(errorResponse.body);
};

/**
 * Utility to wrap async handlers with proper error handling
 * Works with common request/response interfaces
 */
export const asyncHandler = (
  handler: (req: CommonRequest, res: CommonResponse) => Promise<void>
) => {
  return async (req: CommonRequest, res: CommonResponse, next: () => void): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      const err = handleError(error);
      const errorResponse = createErrorResponse(err);
      res.status(errorResponse.status).json(errorResponse.body);
    }
  };
}; 