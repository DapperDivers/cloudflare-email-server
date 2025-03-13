import { beforeEach, afterEach } from 'vitest';
import { setupTestEnv, resetMocks } from './mocks';

// Initialize test environment before each test
beforeEach(() => {
  // Set up test environment with mocks and environment variables
  setupTestEnv();
});

// Clean up after each test
afterEach(() => {
  // Reset all mocks and clear any test state
  resetMocks();
}); 