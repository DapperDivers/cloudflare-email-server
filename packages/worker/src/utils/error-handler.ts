import { CommonRequest, CommonResponse } from 'shared/src/adapters/request-response';
import { handleError, createErrorResponse } from 'shared/src/utils/error-handler';

/**
 * Worker-specific error handler middleware
 * This provides a standardized way to handle errors in Worker routes
 */
export const workerErrorHandler = (
  err: Error,
  req: CommonRequest,
  res: CommonResponse
): void => {
  const error = handleError(err);
  const errorResponse = createErrorResponse(error);
  
  res.status(errorResponse.status).json(errorResponse.body);
};

/**
 * Worker-specific async handler wrapper
 * This wraps an async route handler to properly catch and handle Promise rejections
 */
export const asyncWorkerHandler = (
  fn: (req: CommonRequest, res: CommonResponse) => Promise<void>
) => {
  return async (req: CommonRequest, res: CommonResponse): Promise<void> => {
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
 * Re-export common error handling utilities
 */
export { handleError, createErrorResponse }; 