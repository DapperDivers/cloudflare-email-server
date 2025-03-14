import { Request, Response, NextFunction } from 'express';
import { 
  CommonRequest, 
  CommonResponse, 
  ExpressRequestAdapter, 
  ExpressResponseAdapter 
} from './request-response.js';
import { logger } from '../utils/logger.js';
import { createErrorResponse, handleError } from '../utils/error-handler.js';

// Define middleware types for both environments
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type CommonMiddleware = (req: CommonRequest, res: CommonResponse, next: () => void) => void | Promise<void>;

/**
 * Adapts an Express middleware to work with our common request/response interfaces
 */
export function adaptExpressMiddleware(middleware: ExpressMiddleware): CommonMiddleware {
  return (req: CommonRequest, res: CommonResponse, next: () => void) => {
    // Get the original Express request/response if this is using Express adapters
    try {
      if (req instanceof ExpressRequestAdapter && res instanceof ExpressResponseAdapter) {
        const expressReq = req.getOriginalRequest();
        const expressRes = res.send();
        
        // Call the middleware with Express objects
        return middleware(expressReq, expressRes, next);
      } else {
        // Create mock Express objects
        // This is a simplified approach - in reality would need more work
        const mockReq = {
          method: req.method,
          url: req.url,
          path: req.path,
          ip: req.ip,
          headers: req.headers,
          body: req.body,
          query: req.query,
          params: req.params,
          get: req.get.bind(req),
        } as unknown as Request;
        
        const mockRes = {
          statusCode: res.statusCode,
          locals: { body: res.body },
          status: (code: number) => {
            res.status(code);
            return mockRes;
          },
          json: (data: any) => {
            res.json(data);
            return mockRes;
          },
          send: (data?: any) => {
            if (data) res.body = data;
            res.send();
            return mockRes;
          },
          set: (name: string | Record<string, string>, value?: string) => {
            if (typeof name === 'string' && value !== undefined) {
              res.set(name, value);
            } else if (typeof name === 'object') {
              res.set(name);
            }
            return mockRes;
          },
          getHeaders: () => res.headers,
          on: (event: string, callback: Function) => {
            res.on(event, callback);
            return mockRes;
          },
        } as unknown as Response;
        
        // Call the middleware with mock Express objects
        return middleware(mockReq, mockRes, next);
      }
    } catch (error) {
      logger.error('Error in middleware adapter', handleError(error));
      next();
    }
  };
}

/**
 * Runs a chain of middleware functions in sequence
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