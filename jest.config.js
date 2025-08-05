/** @type {import('jest').Config} */
const config = {
  // Test environment configuration
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/tests/setup/testSetup.js'
  ],
  
  // Path configuration
  testPathIgnorePatterns: [
    '<rootDir>/.next/', 
    '<rootDir>/node_modules/',
    '<rootDir>/tests/helpers/',
    '<rootDir>/tests/setup/'
  ],
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // Test execution configuration
  maxWorkers: '50%', // Use half of available CPU cores
  testTimeout: 30000, // 30 second default timeout
  verbose: process.env.VERBOSE_TESTS === 'true',
  
  // Test categories and organization
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts}',
    '<rootDir>/tests/**/*.spec.{js,ts}'
  ],
  
  // Performance optimizations
  clearMocks: true,
  resetMocks: false, // Don't reset mocks between tests for performance
  restoreMocks: false,
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,ts}',
    '!src/**/*.config.{js,ts}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  
  // Error handling
  errorOnDeprecated: true,
  bail: false, // Don't bail on first test failure
  
  // Global configuration
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // Optimize for CI/CD environments
  ...(process.env.CI && {
    maxWorkers: 2,
    coverage: true
  })
}

module.exports = config 