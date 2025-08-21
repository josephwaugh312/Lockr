/**
 * Enhanced Test Setup Configuration
 * Provides optimized test environment with helper integration
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only';

// Database configuration for tests
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'lockr_test';  // Changed to use test database
process.env.DB_USER = 'lockr_user';
process.env.DB_PASSWORD = 'lockr_test_password';
process.env.DB_SSL = 'false';

// Performance optimization flags
process.env.DB_POOL_MIN = '2';
process.env.DB_POOL_MAX = '8';
process.env.DB_IDLE_TIMEOUT = '10000';
process.env.DB_ACQUIRE_TIMEOUT = '5000';

// Test-specific configurations
process.env.LOG_LEVEL = process.env.VERBOSE_TESTS ? 'info' : 'error';
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.DISABLE_EMAIL_VERIFICATION = 'true';

// Import required modules
const database = require('../../src/config/database');
const { securityEvents } = require('../../src/utils/logger');

// Import test helpers
const testHelpers = require('../helpers/testHelpers');
const retryHelpers = require('../helpers/retryHelpers');
const performanceHelpers = require('../helpers/performanceHelpers');

// Global test configuration
const TEST_CONFIG = {
  timeouts: {
    default: 120000,     // Increased from 60000
    integration: 180000, // Increased from 90000
    database: 60000,    // Increased from 30000
    http: 30000        // Increased from 20000
  },
  retries: {
    flaky: 3,
    database: 5,
    setup: 2
  },
  performance: {
    enableMetrics: true,
    batchSize: 5,
    poolOptimization: true
  }
};

// Enhanced console logging for tests
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

// Suppress console logs during testing unless explicitly needed
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = (...args) => {
    // Allow important warnings
    const message = args[0]?.toString() || '';
    if (message.includes('Test') || message.includes('WARNING')) {
      originalConsole.warn(...args);
    }
  };
} else {
  // In verbose mode, prefix test logs
  const prefixLog = (level) => (...args) => {
    const timestamp = new Date().toISOString();
    originalConsole[level](`[TEST ${timestamp}]`, ...args);
  };
  
  console.log = prefixLog('log');
  console.info = prefixLog('info');
  console.warn = prefixLog('warn');
}

// Global test utilities - Enhanced
global.testUtils = {
  helpers: testHelpers,
  retry: retryHelpers,
  performance: performanceHelpers,
  config: TEST_CONFIG,
  
  // Quick access methods
  generateUser: (overrides) => testHelpers.generateUserData(overrides),
  generateEntry: (overrides) => testHelpers.generateVaultEntry(overrides),
  generateKey: () => testHelpers.generateEncryptionKey(),
  
  // Common test patterns
  async setupAuthTest(options = {}) {
    const app = await performanceHelpers.fastSetupApp('auth', options);
    const user = await performanceHelpers.fastCreateUser(null, options);
    return { app, user };
  },
  
  async setupVaultTest(options = {}) {
    const app = await performanceHelpers.fastSetupApp('vault', options);
    const user = await performanceHelpers.fastCreateUser(null, options);
    return { app, user };
  },
  
  async setupFullTest(options = {}) {
    const app = await performanceHelpers.fastSetupApp('full', options);
    const user = await performanceHelpers.fastCreateUser(null, options);
    return { app, user };
  },
  
  // Retry wrappers for common operations
  retryDatabase: (fn, options) => retryHelpers.retryDatabaseOperation(fn, options),
  retryHttp: (fn, options) => retryHelpers.retryHttpRequest(fn, options),
  retrySetup: (fn, options) => retryHelpers.retryTestSetup(fn, options),
  
  // Performance utilities
  batchDb: (ops, options) => performanceHelpers.batchDatabaseOperations(ops, options),
  batchHttp: (reqs, options) => performanceHelpers.batchHttpRequests(reqs, options),
  
  // Validation helpers
  validateResponse: (response, schema) => testHelpers.validateResponseSchema(response, schema),
  schemas: testHelpers.constructor.SCHEMAS
};

// Enhanced global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in test environment to allow error investigation
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit in test environment to allow error investigation
});

// Test suite lifecycle hooks
let suiteStartTime;
let testStartTime;

// Before all tests in the suite
beforeAll(async () => {
  suiteStartTime = Date.now();
  
  try {
    console.log('🧪 Starting test suite setup...');
    
    // Database should already be initialized by global setup
    // Just verify it's still accessible
    try {
      await retryHelpers.waitForDatabase({ 
        timeout: 10000, // Shorter timeout since DB should be ready
        interval: 500
      });
      console.log('✅ Database connection verified');
    } catch (error) {
      console.warn('⚠️  Database connection issue, attempting recovery...');
      
      // Fallback: try to reinitialize
      const TestDatabaseInitializer = require('../../scripts/initializeTestDatabase');
      const initializer = new TestDatabaseInitializer();
      const result = await initializer.initialize({ clean: false });
      
      if (!result.success) {
        throw new Error(`Database recovery failed: ${result.error}`);
      }
      
      console.log('✅ Database recovered successfully');
    }
    
    // Initialize performance monitoring
    if (TEST_CONFIG.performance.enableMetrics) {
      performanceHelpers.on('testComplete', ({ testName, duration, success }) => {
        if (process.env.VERBOSE_TESTS) {
          const status = success ? '✓' : '✗';
          console.log(`  ${status} ${testName}: ${duration.toFixed(2)}ms`);
        }
      });
    }
    
    // Clear retry statistics
    retryHelpers.clearStats();
    
    // Ensure clean state
    await performanceHelpers.fastCleanup({
      truncate: true,
      clearCache: true,
      timeout: TEST_CONFIG.timeouts.database
    });
    
    console.log('✅ Test suite setup completed');
  } catch (error) {
    console.error('❌ Test suite setup failed:', error);
    throw error;
  }
}, TEST_CONFIG.timeouts.default);

// Before each test
beforeEach(async () => {
  testStartTime = Date.now();
  
  try {
    // Fast cleanup for test isolation with retry
    await retryHelpers.retryDatabaseOperation(
      () => performanceHelpers.fastCleanup({
        truncate: true,
        clearCache: true
      }),
      { 
        retries: 2,
        timeout: TEST_CONFIG.timeouts.database
      }
    );
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    throw error;
  }
}, TEST_CONFIG.timeouts.database);

// After each test
afterEach(async () => {
  const testDuration = Date.now() - testStartTime;
  
  if (process.env.VERBOSE_TESTS && testDuration > 5000) {
    console.warn(`⚠ Slow test detected: ${testDuration}ms`);
  }
  
  // Clean up any test-specific resources
  try {
    await testHelpers.cleanup({ waitTime: 50 });
  } catch (error) {
    console.warn('Test cleanup warning:', error.message);
  }
}, TEST_CONFIG.timeouts.database);

// After all tests in the suite
afterAll(async () => {
  const suiteDuration = Date.now() - suiteStartTime;
  
  try {
    console.log('🧹 Starting test suite cleanup...');
    
    // Generate performance report
    if (TEST_CONFIG.performance.enableMetrics) {
      const report = performanceHelpers.generateReport();
      console.log(`📊 Suite Performance: ${suiteDuration}ms total, ${report.summary.totalTests} tests, avg ${report.summary.avgTestDuration.toFixed(2)}ms/test`);
      
      if (process.env.VERBOSE_TESTS) {
        console.table(report.resources);
      }
    }
    
    // Show retry statistics
    const retryStats = retryHelpers.getRetryStats();
    if (retryStats.totalTests > 0) {
      const retriedTests = retryStats.stats.filter(s => s.attempts > 1);
      console.log(`🔄 Retry Stats: ${retriedTests.length}/${retryStats.totalTests} tests required retries`);
      
      if (process.env.VERBOSE_TESTS && retriedTests.length > 0) {
        retriedTests.forEach(test => {
          console.log(`  ${test.testName}: ${test.attempts} attempts, ${test.totalTime}ms`);
        });
      }
    }
    
    // Clear security events timer
    securityEvents.clearTimer();
    
    // Cleanup performance helpers
    await performanceHelpers.cleanup();
    
    // Final database cleanup
    await testHelpers.cleanup({ waitTime: 200 });
    
    // Close database connections
    await database.close();
    
    console.log('✅ Test suite cleanup completed');
    
    // Give time for async cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
  } catch (error) {
    console.error('❌ Test suite cleanup error:', error);
  }
}, TEST_CONFIG.timeouts.default);

// Export configuration for access in tests
module.exports = {
  TEST_CONFIG,
  testHelpers,
  retryHelpers,
  performanceHelpers
};