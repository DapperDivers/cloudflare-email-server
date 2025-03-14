import { Request, Response, NextFunction } from 'express';
import { 
  CommonRequest, 
  CommonResponse
} from 'shared/src/adapters/request-response';
import { logger } from 'shared/src/utils/logger';

import { ExpressRequestAdapter, ExpressResponseAdapter } from './request-response';

/**
 * Express-specific middleware type
 * Represents a standard Express middleware function
 */
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

/**
 * Common middleware type that works across environments
 * Imported from shared package for type compatibility
 */
export type { CommonMiddleware } from 'shared/src/adapters/middleware-adapter';

/**
 * Adapts an Express middleware to work with our common request/response interfaces
 * This allows Express middleware to be used in a common middleware chain
 */
export function adaptExpressMiddleware(middleware: ExpressMiddleware): (req: CommonRequest, res: CommonResponse, next: () => void) => void | Promise<void> {
  return (req: CommonRequest, res: CommonResponse, next: () => void) => {
    // Get the original Express request/response if this is using Express adapters
    try {
      if (req instanceof ExpressRequestAdapter && res instanceof ExpressResponseAdapter) {
        const expressReq = req.getOriginalRequest();
        const expressRes = res.send();
        
        // Call the middleware with Express objects
        return middleware(expressReq, expressRes, next as unknown as NextFunction);
      } else {
        // Create mock Express objects
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
        return middleware(mockReq, mockRes, next as unknown as NextFunction);
      }
    } catch (error) {
      logger.error('Error in middleware adapter', error instanceof Error ? error : new Error(String(error)));
      next();
    }
  };
} 