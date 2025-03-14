import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { Request, Response } from 'express';
import { createTestContext, TestContext } from '@tests/setup/test-context';
import { EmailRequestSchema } from '@/schema/email';
import { createRateLimiter } from '@/middleware/rate-limiting';

describe('Rate Limiter Integration Tests', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = createTestContext();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow requests within rate limit', async () => {
    testContext.setEmailHandler(async (req: Request, res: Response) => {
      await EmailRequestSchema.parseAsync(req.body);
      res.json({ success: true, message: 'Email sent successfully' });
    });

    const response = await request(testContext.app)
      .post('/api/send-email')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Email sent successfully'
    });
  });

  it('should block requests exceeding rate limit', async () => {
    testContext.setEmailHandler(async (req: Request, res: Response) => {
      await EmailRequestSchema.parseAsync(req.body);
      res.json({ success: true, message: 'Email sent successfully' });
    });

    const responses = await Promise.all(
      Array(6).fill(null).map(() =>
        request(testContext.app)
          .post('/api/send-email')
          .send({
            name: 'Test User',
            email: 'test@example.com',
            message: 'Test message'
          })
      )
    );

    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body).toMatchObject({
      success: false,
      message: 'Rate limit exceeded'
    });
  });

  it('should track rate limits per email address', async () => {
    testContext.setEmailHandler(async (req: Request, res: Response) => {
      await EmailRequestSchema.parseAsync(req.body);
      res.json({ success: true, message: 'Email sent successfully' });
    });

    // Send requests with different email addresses
    const firstResponses = await Promise.all(
      Array(5).fill(null).map((_, i) =>
        request(testContext.app)
          .post('/api/send-email')
          .send({
            name: 'Test User',
            email: `test${i}@example.com`,
            message: 'Test message'
          })
      )
    );

    // All requests should succeed since they're from different emails
    firstResponses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Email sent successfully'
      });
    });

    // Send another request with a new email
    const lastResponse = await request(testContext.app)
      .post('/api/send-email')
      .send({
        name: 'Test User',
        email: 'test6@example.com',
        message: 'Test message'
      });

    // This should succeed since it's a new email
    expect(lastResponse.status).toBe(200);
    expect(lastResponse.body).toMatchObject({
      success: true,
      message: 'Email sent successfully'
    });
  });
}); 