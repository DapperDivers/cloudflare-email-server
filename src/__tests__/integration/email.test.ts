import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTestContext } from '@tests/setup/test-context';
import { EmailService } from '@services/email.service';
import { mockNodemailer } from '@tests/setup/mocks';

describe('Email API', () => {
  let testContext: ReturnType<typeof createTestContext>;
  let emailService: EmailService;

  beforeEach(() => {
    vi.resetAllMocks();
    testContext = createTestContext();
    emailService = new EmailService();
    testContext.setEmailHandler(async (req, res) => {
      const result = await emailService.sendEmail(req.body);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/send-email', () => {
    const validEmailData = {
      name: 'Test User',
      email: 'test@example.com',
      message: 'Test message'
    };

    it('should successfully send an email', async () => {
      mockNodemailer.createTransport.mockReturnValue({
        sendMail: vi.fn().mockResolvedValueOnce({
          messageId: 'test-message-id',
          response: 'OK'
        })
      } as any);

      const response = await request(testContext.expressApp)
        .post('/api/send-email')
        .send(validEmailData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        messageId: 'test-message-id',
        message: 'Email sent successfully'
      });
    });

    it('should handle email sending failure', async () => {
      const error = new Error('Failed to send email');
      mockNodemailer.createTransport.mockReturnValue({
        sendMail: vi.fn().mockRejectedValueOnce(error)
      } as any);

      const response = await request(testContext.expressApp)
        .post('/api/send-email')
        .send(validEmailData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to send email'
      });
    });

    it('should validate email data', async () => {
      const invalidEmailData = {
        name: 'Test User',
        email: 'invalid-email',
        message: 'Test message'
      };

      const response = await request(testContext.expressApp)
        .post('/api/send-email')
        .send(invalidEmailData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid email format'
      });
      expect(mockNodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      const incompleteEmailData = {
        name: 'Test User'
      };

      const response = await request(testContext.expressApp)
        .post('/api/send-email')
        .send(incompleteEmailData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields'
      });
      expect(mockNodemailer.createTransport).not.toHaveBeenCalled();
    });
  });
}); 