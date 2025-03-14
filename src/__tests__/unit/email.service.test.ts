import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService } from '../../services/email.service.js';
import { EmailError } from '../../utils/errors.js';

// Mock nodemailer
vi.mock('nodemailer', () => {
  return {
    default: {
      createTransport: vi.fn(() => ({
        verify: vi.fn().mockResolvedValue(true),
        sendMail: vi.fn().mockImplementation((mailOptions) => {
          return Promise.resolve({
            messageId: 'test-message-id',
            envelope: {},
            accepted: [mailOptions.to],
          });
        }),
        close: vi.fn(),
      })),
    },
  };
});

// Mock OAuth2 transport
vi.mock('../../utils/oauth2.js', () => ({
  createOAuth2Transport: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
    sendMail: vi.fn().mockImplementation((mailOptions) => {
      return Promise.resolve({
        messageId: 'test-oauth2-message-id',
        envelope: {},
        accepted: [mailOptions.to],
      });
    }),
    close: vi.fn(),
  })),
}));

// Mock environment
vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    EMAIL_SERVICE: 'gmail',
    EMAIL_USER: 'test@example.com',
    EMAIL_PASS: 'test-password',
    OAUTH2_CLIENT_ID: '',
    OAUTH2_CLIENT_SECRET: '',
    OAUTH2_REFRESH_TOKEN: '',
  },
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('EmailService', () => {
  let emailService: EmailService;
  
  beforeEach(() => {
    emailService = new EmailService();
    // Mock console methods to prevent noise in test output
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.clearAllMocks();
  });
  
  it('should initialize successfully', async () => {
    await emailService.initialize();
    expect(nodemailer.createTransport).toHaveBeenCalled();
  });
  
  it('should send an email successfully', async () => {
    const testData = {
      name: 'Test User',
      email: 'user@example.com',
      message: 'This is a test message'
    };
    
    await emailService.initialize();
    const result = await emailService.sendEmail(testData);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id');
    expect(result.message).toBe('Email sent successfully');
  });
  
  it('should work with worker environment flag', async () => {
    const testData = {
      name: 'Test User',
      email: 'user@example.com',
      message: 'This is a test message'
    };
    
    // No need to initialize when using worker environment
    const result = await emailService.sendEmail(testData, '127.0.0.1', true);
    
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id');
    expect(result.message).toBe('Email sent successfully');
  });
  
  it('should throw EmailError when sending fails', async () => {
    // Make the sendMail method fail
    const mockTransport = nodemailer.createTransport();
    mockTransport.sendMail = vi.fn().mockRejectedValue(new Error('Sending failed'));
    
    const testData = {
      name: 'Test User',
      email: 'user@example.com',
      message: 'This is a test message'
    };
    
    await emailService.initialize();
    
    await expect(emailService.sendEmail(testData)).rejects.toThrow(EmailError);
    await expect(emailService.sendEmail(testData)).rejects.toThrow('Sending failed');
  });
  
  it('should close transporter correctly', async () => {
    await emailService.initialize();
    await emailService.close();
    
    // Try to re-initialize
    await emailService.initialize();
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
  });
}); 