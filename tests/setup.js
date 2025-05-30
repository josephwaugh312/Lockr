// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only';

// Suppress console logs during testing unless explicitly needed
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
}

// Global test utilities
global.testUtils = {
  // Test helper functions will go here
}; 