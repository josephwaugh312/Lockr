/** @type {import('jest').Config} */
const baseConfig = require('./jest.config.js');

// Backend-only Jest configuration
const config = {
  ...baseConfig,
  
  // Only run backend tests
  testMatch: [
    '<rootDir>/tests/controllers/**/*.test.js',
    '<rootDir>/tests/services/**/*.test.js',
    '<rootDir>/tests/models/**/*.test.js',
    '<rootDir>/tests/utils/**/*.test.js',
    '<rootDir>/tests/middleware/**/*.test.js',
    '<rootDir>/tests/routes/**/*.test.js',
    '<rootDir>/tests/server.test.js',
  ],
  
  // Explicitly ignore all React/TypeScript tests
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns,
    '\\.tsx$',
    '/tests/components/',
    '/tests/app/',
    '/tests/integration/',  // Temporarily skip integration tests
    '/tests/examples/',     // Temporarily skip example tests
    '/src/',
    '/lockr-frontend/',
  ],
  
  // Faster execution for backend tests
  maxWorkers: 2,
  testTimeout: 5000,
  detectOpenHandles: false,
  forceExit: true,
};

module.exports = config;