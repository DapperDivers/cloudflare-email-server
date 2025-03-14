// Re-export middleware components
import { Express, Request, Response, NextFunction } from 'express';

import { ExpressRequestAdapter, ExpressResponseAdapter } from '../adapters/request-response';

// Define the error handler middleware type since it's not in shared
export type ErrorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

// Re-export error handling middleware and other shared middleware
export * from 'shared/middleware';

// Express-specific middleware adapter pattern
export const adaptMiddleware = (
  middleware: (req: ExpressRequestAdapter, res: ExpressResponseAdapter) => Promise<void>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adaptedReq = new ExpressRequestAdapter(req);
      const adaptedRes = new ExpressResponseAdapter(res);

      await middleware(adaptedReq, adaptedRes);
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Express error handler middleware
export const errorHandler: ErrorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: {
      message,
      status,
    },
  });
};
