// Global test setup for express-server package
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '4000';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  process.env.EMAIL_SERVICE = 'test';
  process.env.EMAIL_USER = 'test@example.com';
  process.env.EMAIL_PASS = 'testpassword';
  process.env.RATE_LIMIT_WINDOW_MS = '900000'; // 15 minutes
  process.env.RATE_LIMIT_MAX = '50';
});

// Reset mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
