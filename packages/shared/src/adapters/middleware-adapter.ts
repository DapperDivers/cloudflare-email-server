import { CommonRequest, CommonResponse } from '@shared-adapters/request-response';
import { createErrorResponse, handleError } from '@shared-utils/error-handler';

/**
 * Common middleware type that works across environments
 * This allows for consistent middleware patterns regardless of underlying platform
 */
export type CommonMiddleware = (
  req: CommonRequest,
  res: CommonResponse,
  next: () => void
) => void | Promise<void>;

/**
 * Runs a chain of middleware functions in sequence
 * This provides a framework-agnostic way to execute middleware chains
 */
export async function runMiddlewareChain(
  req: CommonRequest,
  res: CommonResponse,
  middlewares: CommonMiddleware[]
): Promise<boolean> {
  let index = 0;

  async function next(): Promise<void> {
    if (index < middlewares.length) {
      const middleware = middlewares[index++];
      await middleware(req, res, next);
    }
  }

  try {
    await next();
    return !res.body; // If res.body is set, middleware chain has sent a response
  } catch (error) {
    // Create standardized error response
    const err = handleError(error);
    const errorResponse = createErrorResponse(err);

    // Send the response
    res.status(errorResponse.status).json(errorResponse.body);
    return true; // Response has been sent
  }
}
