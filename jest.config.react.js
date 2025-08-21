/** @type {import('jest').Config} */
const config = {
  // Test environment configuration for React components
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/reactTestSetup.js'
  ],
  
  // Test match patterns for React components only
  testMatch: [
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/lockr-frontend/**/*.test.tsx',
    '<rootDir>/lockr-frontend/**/*.test.ts'
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
    '^.+\\.(ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
  
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // Test execution configuration
  maxWorkers: 1, // Use single worker to avoid timer conflicts
  testTimeout: 10000,
  verbose: false,
  
  // IMPORTANT: Don't use fake timers globally for React tests
  timers: 'real',
  
  // Additional Jest configuration for stability
  forceExit: true,
  detectOpenHandles: false,
  watchman: false,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Disable coverage for component tests
  collectCoverage: false,
  
  // Error handling
  errorOnDeprecated: false,
  bail: false,
}

module.exports = config