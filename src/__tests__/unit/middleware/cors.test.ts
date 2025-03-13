import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import cors from 'cors';
import { createMiddlewareTestContext, expectMiddlewareToCallNext } from '../../setup/middleware-test-utils';

describe('CORS Middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow requests from allowed origin', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        headers: {
          origin: 'http://localhost:3000'
        }
      }
    });

    const corsMiddleware = cors({
      origin: 'http://localhost:3000',
      credentials: true
    });

    await new Promise<void>((resolve) => {
      corsMiddleware(req, res, (err) => {
        if (err) {
          next(err);
        } else {
          next();
        }
        resolve();
      });
    });

    expectMiddlewareToCallNext(next);
  });

  it('should block requests from disallowed origin', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        headers: {
          origin: 'http://malicious-site.com'
        }
      }
    });

    const corsMiddleware = cors({
      origin: 'http://localhost:3000',
      credentials: true
    });

    await new Promise<void>((resolve) => {
      corsMiddleware(req, res, (err) => {
        if (err) {
          next(err);
        } else {
          next();
        }
        resolve();
      });
    });

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next as Mock).mock.calls[0][0].message).toBe('Not allowed by CORS');
  });

  it('should handle requests without origin header', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        headers: {}
      }
    });

    const corsMiddleware = cors({
      origin: 'http://localhost:3000',
      credentials: true
    });

    await new Promise<void>((resolve) => {
      corsMiddleware(req, res, (err) => {
        if (err) {
          next(err);
        } else {
          next();
        }
        resolve();
      });
    });

    expectMiddlewareToCallNext(next);
  });
}); 