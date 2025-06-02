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

// Import database for cleanup
const database = require('../src/config/database');
const { securityEvents } = require('../src/utils/logger');

// Global test utilities
global.testUtils = {
  // Test helper functions will go here
};

// Global test cleanup to prevent Jest hanging
afterAll(async () => {
  try {
    // Clear security events timer if it exists
    securityEvents.clearTimer();
    
    // Close database connections
    await database.close();
    
    // Give some time for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.error('Error during test cleanup:', error);
  }
}); 