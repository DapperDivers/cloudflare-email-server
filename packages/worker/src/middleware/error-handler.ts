/**
 * This file provides error handler middleware for Worker environments
 */

import { CommonRequest, CommonResponse } from 'shared/src/adapters/request-response';

import { 
  workerErrorHandler, 
  asyncWorkerHandler,
  handleError, 
  createErrorResponse 
} from '../utils/error-handler';

/**
 * Re-export the Worker-specific error handler
 */
export const errorHandler = workerErrorHandler;

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
 * Re-export the Worker-specific async handler
 */
export const asyncHandler = asyncWorkerHandler; 