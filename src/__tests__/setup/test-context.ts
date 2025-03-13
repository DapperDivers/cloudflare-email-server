import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { vi } from 'vitest';
import { EmailRequestSchema } from '@/schema/email';
import { logRequest, logResponse } from '@/middleware/logging';
import { rateLimiter } from '@/middleware/rate-limit';
import { applySecurityHeaders, securityMiddleware } from '@/middleware/security';
import { mockNodemailer } from './mocks';

export class TestContext {
  public app: express.Application;
  public req: Request;
  public res: Response;
  public next: NextFunction;
  private emailHandler: ((req: Request, res: Response) => Promise<void>) | null = null;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }));
    this.app.use(rateLimiter);
    
    // Apply security middleware (which will call applySecurityHeaders internally)
    this.app.use(securityMiddleware);
    
    this.app.use(logRequest);
    this.app.use(logResponse);

    // Create mock request, response, and next function
    this.req = express.request;
    this.res = express.response;
    this.next = vi.fn();

    // Email endpoint
    this.app.post('/api/send-email', async (req: Request, res: Response, next: NextFunction) => {
      if (!this.emailHandler) {
        return res.status(500).json({
          success: false,
          message: 'Email handler not configured'
        });
      }
      try {
        await this.emailHandler(req, res);
      } catch (error) {
        next(error);
      }
    });

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(JSON.stringify({
        type: 'error',
        error: {
          message: err.message,
          stack: err.stack
        }
      }));

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    });
  }

  setEmailHandler(handler: (req: Request, res: Response) => Promise<void>) {
    this.emailHandler = handler;
  }

  get expressApp() {
    return this.app;
  }
}

export const createTestContext = (): TestContext => {
  return new TestContext();
};

export default createTestContext(); 