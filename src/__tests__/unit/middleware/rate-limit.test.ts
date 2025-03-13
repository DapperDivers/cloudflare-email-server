import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimiter } from '../../../middleware/rate-limit';
import { createMiddlewareTestContext, expectMiddlewareToCallNext, expectMiddlewareToSendResponse } from '../../setup/middleware-test-utils';

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow requests within rate limit', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': '127.0.0.1'
        }
      }
    });

    await rateLimiter(req, res, next);
    expectMiddlewareToCallNext(next);
  });

  it('should block requests exceeding rate limit', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': '127.0.0.1'
        }
      }
    });

    // Simulate multiple requests
    for (let i = 0; i < 6; i++) {
      await rateLimiter(req, res, next);
    }

    expectMiddlewareToSendResponse(res, 429, {
      success: false,
      message: 'Rate limit exceeded'
    });
  });

  it('should track rate limits per IP address', async () => {
    const ip1 = '127.0.0.1';
    const ip2 = '127.0.0.2';

    // Send requests from first IP
    for (let i = 0; i < 5; i++) {
      const { req, res, next } = createMiddlewareTestContext({
        req: {
          ip: ip1,
          headers: {
            'x-forwarded-for': ip1
          }
        }
      });
      await rateLimiter(req, res, next);
      expectMiddlewareToCallNext(next);
    }

    // Send request from second IP
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        ip: ip2,
        headers: {
          'x-forwarded-for': ip2
        }
      }
    });
    await rateLimiter(req, res, next);
    expectMiddlewareToCallNext(next);
  });

  it('should handle missing IP address', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        headers: {}
      }
    });

    await rateLimiter(req, res, next);
    expectMiddlewareToCallNext(next);
  });
}); 