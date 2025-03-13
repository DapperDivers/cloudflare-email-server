import { Request, Response, NextFunction } from 'express';
import { vi, expect } from 'vitest';

// Base request and response mocks
export interface MockRequest extends Partial<Request> {
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  ip?: string;
}

export interface MockResponse extends Partial<Response> {
  statusCode?: number;
  body?: any;
  json: (body: any) => Response;
  status: (code: number) => Response;
  setHeader: (name: string, value: string | number | readonly string[]) => Response;
}

export const createMockRequest = (overrides: MockRequest = {}): MockRequest => ({
  body: {},
  headers: {},
  query: {},
  params: {},
  ip: '127.0.0.1',
  ...overrides,
});

export const createMockResponse = (overrides: Partial<MockResponse> = {}): MockResponse => {
  const res: MockResponse = {
    statusCode: 200,
    body: {},
    json: vi.fn((body) => {
      res.body = body;
      return res as unknown as Response;
    }),
    status: vi.fn((code) => {
      res.statusCode = code;
      return res as unknown as Response;
    }),
    setHeader: vi.fn((name, value) => {
      return res as unknown as Response;
    }),
    ...overrides,
  };
  return res;
};

export const createNextFunction = () => vi.fn();

// Middleware test utilities
export interface MiddlewareTestContext {
  req: Request;
  res: Response;
  next: NextFunction;
}

export interface MiddlewareTestContextOverrides {
  req?: Partial<Request>;
  res?: Partial<Response>;
  next?: NextFunction;
}

export const createMiddlewareTestContext = (overrides: MiddlewareTestContextOverrides = {}): MiddlewareTestContext => {
  const mockReq = createMockRequest(overrides.req as MockRequest);
  const mockRes = createMockResponse(overrides.res as Partial<MockResponse>);
  const mockNext = overrides.next || createNextFunction();

  return {
    req: mockReq as unknown as Request,
    res: mockRes as unknown as Response,
    next: mockNext,
  };
};

// Middleware test assertions
export const expectMiddlewareToCallNext = (next: NextFunction) => {
  expect(next).toHaveBeenCalled();
  expect(next).not.toHaveBeenCalledWith(expect.any(Error));
};

export const expectMiddlewareToCallNextWithError = (next: NextFunction, error: Error) => {
  expect(next).toHaveBeenCalledWith(error);
};

export const expectMiddlewareToSendResponse = (res: Response, status: number, body: any) => {
  expect(res.status).toHaveBeenCalledWith(status);
  expect(res.json).toHaveBeenCalledWith(body);
};

export const mockConsole = () => {
  const consoleSpy = {
    log: vi.spyOn(console, 'log'),
    error: vi.spyOn(console, 'error'),
    warn: vi.spyOn(console, 'warn'),
  };
  return consoleSpy;
}; 