import { vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { logRequest, logResponse } from '@/middleware/logging';
import { createTestContext } from '@tests/setup/test-context';
import { expectMiddlewareToCallNext } from '@tests/setup/test-utils';

interface TestContext {
  req: Request;
  res: Response;
  next: NextFunction;
}

describe('Logging Middleware', () => {
  let context: TestContext;
  let req: Request;
  let res: Response;
  let next: NextFunction;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    context = createTestContext() as TestContext;
    req = context.req;
    res = context.res;
    next = context.next;
    consoleSpy = vi.spyOn(console, 'log');
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log request details and call next', async () => {
    Object.defineProperty(req, 'method', { value: 'POST' });
    Object.defineProperty(req, 'path', { value: '/api/test' });
    Object.defineProperty(req, 'body', { value: { test: 'data' } });

    await logRequest(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'request',
        method: 'POST',
        path: '/api/test',
        body: { test: 'data' }
      })
    );
    expectMiddlewareToCallNext(next);
  });

  it('should log response details and call next', async () => {
    Object.defineProperty(res, 'statusCode', { value: 200 });
    Object.defineProperty(res, 'body', { value: { success: true } });

    await logResponse(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        status: 200,
        body: { success: true }
      })
    );
    expectMiddlewareToCallNext(next);
  });

  it('should log error response details and call next', async () => {
    Object.defineProperty(res, 'statusCode', { value: 500 });
    Object.defineProperty(res, 'body', { value: { error: 'Internal Server Error' } });

    await logResponse(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        status: 500,
        body: { error: 'Internal Server Error' }
      })
    );
    expectMiddlewareToCallNext(next);
  });
}); 