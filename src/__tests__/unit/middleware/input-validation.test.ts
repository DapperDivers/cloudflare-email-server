import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEmailRequest } from '../../../middleware/input-validation';
import { createMiddlewareTestContext, expectMiddlewareToCallNext, expectMiddlewareToSendResponse } from '../../setup/middleware-test-utils';

describe('Input Validation Middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should validate valid email request', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        body: {
          name: 'Test User',
          email: 'test@example.com',
          message: 'Test message'
        }
      }
    });

    await validateEmailRequest(req, res, next);
    expectMiddlewareToCallNext(next);
  });

  it('should reject invalid email format', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        body: {
          name: 'Test User',
          email: 'invalid-email',
          message: 'Test message'
        }
      }
    });

    await validateEmailRequest(req, res, next);
    expectMiddlewareToSendResponse(res, 400, {
      success: false,
      message: 'Invalid email format'
    });
  });

  it('should reject missing required fields', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        body: {
          name: 'Test User'
        }
      }
    });

    await validateEmailRequest(req, res, next);
    expectMiddlewareToSendResponse(res, 400, {
      success: false,
      message: 'Missing required fields'
    });
  });

  it('should handle empty request body', async () => {
    const { req, res, next } = createMiddlewareTestContext({
      req: {
        body: {}
      }
    });

    await validateEmailRequest(req, res, next);
    expectMiddlewareToSendResponse(res, 400, {
      success: false,
      message: 'Missing required fields'
    });
  });
}); 