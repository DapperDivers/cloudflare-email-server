import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailService } from '../../../services/email.service';
import { mockNodemailer } from '../../setup/mocks';

describe('EmailService', () => {
  let emailService: EmailService;
  const mockTransporter = {
    sendMail: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockNodemailer.createTransport.mockReturnValue(mockTransporter as any);
    emailService = new EmailService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendEmail', () => {
    const validEmailData = {
      name: 'Test User',
      email: 'test@example.com',
      message: 'Test message'
    };

    it('should successfully send an email', async () => {
      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'test-message-id',
        response: 'OK'
      });

      const result = await emailService.sendEmail(validEmailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: expect.any(String),
        subject: expect.any(String),
        text: expect.stringContaining(validEmailData.message),
        html: expect.stringContaining(validEmailData.message)
      });
    });

    it('should handle email sending failure', async () => {
      const error = new Error('Failed to send email');
      mockTransporter.sendMail.mockRejectedValueOnce(error);

      const result = await emailService.sendEmail(validEmailData);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error.message);
    });

    it('should validate email data before sending', async () => {
      const invalidEmailData = {
        name: 'Test User',
        email: 'invalid-email',
        message: 'Test message'
      };

      const result = await emailService.sendEmail(invalidEmailData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email format');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      const incompleteEmailData = {
        name: 'Test User'
      };

      const result = await emailService.sendEmail(incompleteEmailData as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required fields');
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });
}); 