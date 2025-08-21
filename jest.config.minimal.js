/** @type {import('jest').Config} */

// Minimal Jest configuration for debugging
const config = {
  // Test environment
  testEnvironment: 'node',
  
  // Only run specific stable tests
  testMatch: [
    '<rootDir>/tests/utils/validation.test.js',
    '<rootDir>/tests/utils/utils.test.js',
    '<rootDir>/tests/utils/debug.test.js',
  ],
  
  // No setup or teardown
  // globalSetup: undefined,
  // globalTeardown: undefined,
  // setupFilesAfterEnv: [],
  
  // Simple configuration
  maxWorkers: 1,
  testTimeout: 5000,
  detectOpenHandles: false,
  forceExit: true,
  verbose: true,
};

module.exports = config;