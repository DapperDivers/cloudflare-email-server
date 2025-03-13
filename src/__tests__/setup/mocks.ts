import { vi } from 'vitest';

// Mock console methods to filter out request/response logs
const originalConsoleLog = console.log;
vi.spyOn(console, 'log').mockImplementation((...args) => {
  if (!args[0]?.includes('Request:') && !args[0]?.includes('Response:')) {
    originalConsoleLog(...args);
  }
});

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-message-id' });
const mockTransport = {
  sendMail: mockSendMail,
  verify: vi.fn().mockResolvedValue(true)
};

export const mockNodemailer = {
  createTransport: vi.fn().mockReturnValue(mockTransport),
  getTestMessageUrl: vi.fn()
};

vi.mock('nodemailer', () => mockNodemailer);

// Mock environment variables
vi.stubEnv('SMTP_HOST', 'test-smtp-host');
vi.stubEnv('SMTP_PORT', '587');
vi.stubEnv('SMTP_USER', 'test-user');
vi.stubEnv('SMTP_PASS', 'test-password');
vi.stubEnv('SMTP_FROM', 'test@example.com');
vi.stubEnv('SMTP_TO', 'recipient@example.com');

// Mock rate limiter map
export const rateLimiterMap = new Map<string, { count: number; timestamp: number }>();

// Reset all mocks and state
export const resetMocks = () => {
  vi.clearAllMocks();
  rateLimiterMap.clear();
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('SMTP_')) {
      delete process.env[key];
    }
  });
};

// Setup test environment
export const setupTestEnv = () => {
  resetMocks();
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('SMTP_')) {
      process.env[key] = process.env[key];
    }
  });
};

// Export mock functions for use in tests
export { rateLimiterMap }; 