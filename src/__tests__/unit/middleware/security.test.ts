import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { securityHeaders } from '../../../middleware/security';
import { createMiddlewareTestContext, expectMiddlewareToCallNext } from '../../setup/middleware-test-utils';

describe('Security Headers Middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should set security headers and call next', async () => {
    const { req, res, next } = createMiddlewareTestContext();

    await securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
    expectMiddlewareToCallNext(next);
  });

  it('should handle missing setHeader method', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      res: {
        setHeader: undefined
      }
    });

    await securityHeaders(req, res, next);
    expectMiddlewareToCallNext(next);
  });
}); 