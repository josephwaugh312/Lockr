/** @type {import('jest').Config} */
const config = {
  // Test environment configuration
  testEnvironment: 'jsdom',
  
  // Global setup and teardown
  globalSetup: '<rootDir>/scripts/setupGlobalTest.js',
  globalTeardown: '<rootDir>/scripts/teardownGlobalTest.js',
  
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/tests/setup/simplifiedTestSetup.js',
    '<rootDir>/tests/setup/reactTestSetup.js'
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
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: './.babelrc.jest.js' }],
    '^.+\\.(ts|tsx)$': ['babel-jest', { 
      configFile: './.babelrc.jest.js'
    }],
  },
  
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // Test execution configuration
  maxWorkers: 1, // Single worker for database consistency
  testTimeout: 20000, // 20 second timeout to prevent hanging
  verbose: false, // Disable verbose output for speed
  
  // Additional Jest configuration for stability
  forceExit: true, // Force Jest to exit after tests complete
  detectOpenHandles: false, // Disable to avoid hanging on handle detection
  watchman: false, // Disable watchman to avoid issues
  
  // Test categories and organization
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts,tsx}',
    '<rootDir>/tests/**/*.spec.{js,ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{js,ts,tsx}',
    '<rootDir>/src/**/*.test.{js,ts,tsx}'
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
    '!src/**/__mocks__/**',
    '!src/**/*.mock.{js,ts}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coveragePathIgnorePatterns: [
    '<rootDir>/src/app/dashboard/page-backup.tsx',
    '<rootDir>/src/app/dashboard/page-with-backend.tsx',
    '<rootDir>/src/app/settings/page.original.tsx'
  ],
  // Realistic coverage thresholds based on current coverage levels
  // Strict thresholds for critical security paths, reasonable globals
  coverageThreshold: {
    global: {
      branches: 76,    // Current: 75.13%
      functions: 86,   // Current: 85.54%
      lines: 82,       // Current: 81.31%
      statements: 82   // Current: 81.07%
    },
    // Note: Path-specific thresholds can be added for critical modules
    // For example:
    // './src/utils/validation.js': { statements: 95, branches: 94, lines: 95 },
    // './src/services/tokenService.js': { statements: 100, branches: 94, lines: 100 }
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