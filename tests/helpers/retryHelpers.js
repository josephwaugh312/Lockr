/**
 * Test Reliability Helpers
 * Provides retry mechanisms and stability utilities for flaky tests
 */

class RetryHelpers {
  constructor() {
    this.retryStats = new Map();
  }

  /**
   * Retry test with exponential backoff
   * @param {string} testName Name of the test for tracking
   * @param {function} testFn Test function to retry
   * @param {object} options Retry configuration
   * @returns {Promise} Test result
   */
  async retryTest(testName, testFn, options = {}) {
    const config = {
      maxAttempts: options.maxAttempts || 3,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 5000,
      retryCondition: options.retryCondition || this.defaultRetryCondition,
      onRetry: options.onRetry || null,
      ...options
    };

    const stats = {
      attempts: 0,
      errors: [],
      startTime: Date.now()
    };

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      stats.attempts = attempt;
      
      try {
        const result = await testFn();
        
        // Log success stats if there were retries
        if (attempt > 1) {
          stats.endTime = Date.now();
          stats.totalTime = stats.endTime - stats.startTime;
          this.retryStats.set(testName, stats);
          console.log(`✓ Test "${testName}" succeeded on attempt ${attempt}/${config.maxAttempts} (${stats.totalTime}ms)`);
        }
        
        return result;
      } catch (error) {
        stats.errors.push({
          attempt,
          error: error.message,
          timestamp: Date.now()
        });

        // Check if we should retry
        const shouldRetry = config.retryCondition(error, attempt, config.maxAttempts);
        
        if (!shouldRetry || attempt === config.maxAttempts) {
          stats.endTime = Date.now();
          stats.totalTime = stats.endTime - stats.startTime;
          this.retryStats.set(testName, stats);
          
          // Enhance error with retry information
          const retryInfo = `\nRetry Info: ${attempt}/${config.maxAttempts} attempts, ${stats.totalTime}ms total`;
          const errorHistory = stats.errors.map(e => `  Attempt ${e.attempt}: ${e.error}`).join('\n');
          error.message += retryInfo + '\nError History:\n' + errorHistory;
          
          throw error;
        }

        // Calculate delay for next retry
        const delay = Math.min(
          config.baseDelay * Math.pow(2, attempt - 1),
          config.maxDelay
        );

        console.log(`⚠ Test "${testName}" failed on attempt ${attempt}/${config.maxAttempts}, retrying in ${delay}ms...`);
        
        if (config.onRetry) {
          await config.onRetry(error, attempt, delay);
        }

        await this.sleep(delay);
      }
    }
  }

  /**
   * Default retry condition - retries on common flaky test errors
   * @param {Error} error The error that occurred
   * @param {number} attempt Current attempt number
   * @param {number} maxAttempts Maximum attempts allowed
   * @returns {boolean} True if should retry
   */
  defaultRetryCondition(error, attempt, maxAttempts) {
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'socket hang up',
      'Network Error',
      'deadlock detected',
      'connection terminated unexpectedly',
      'Connection lost',
      'Database connection',
      'Pool is closed',
      'timeout'
    ];

    const errorMessage = error.message.toLowerCase();
    const errorCode = error.code || '';
    
    const isRetryable = retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase()) || 
      errorCode === retryableError
    );

    return isRetryable && attempt < maxAttempts;
  }

  /**
   * Retry database operations specifically
   * @param {function} dbOperation Database operation function
   * @param {object} options Retry options
   * @returns {Promise} Operation result
   */
  async retryDatabaseOperation(dbOperation, options = {}) {
    return this.retryTest('Database Operation', dbOperation, {
      maxAttempts: 5,
      baseDelay: 500,
      retryCondition: (error) => {
        const dbErrors = ['40P01', 'deadlock', 'connection', 'pool', '08003', '08006'];
        return dbErrors.some(dbError => 
          error.message.toLowerCase().includes(dbError.toLowerCase()) ||
          error.code === dbError
        );
      },
      onRetry: async (error, attempt, delay) => {
        // Clear any pending transactions
        try {
          const database = require('../../src/config/database');
          await database.clearConnections?.();
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      },
      ...options
    });
  }

  /**
   * Retry HTTP requests with specific handling
   * @param {function} httpRequest HTTP request function
   * @param {object} options Retry options
   * @returns {Promise} Request result
   */
  async retryHttpRequest(httpRequest, options = {}) {
    return this.retryTest('HTTP Request', httpRequest, {
      maxAttempts: 3,
      baseDelay: 1000,
      retryCondition: (error, attempt, maxAttempts) => {
        // Retry on 5xx errors, timeouts, and connection issues
        const retryableStatuses = [500, 502, 503, 504];
        const hasRetryableStatus = error.status && retryableStatuses.includes(error.status);
        const hasConnectionError = this.defaultRetryCondition(error, attempt, maxAttempts);
        
        return (hasRetryableStatus || hasConnectionError) && attempt < maxAttempts;
      },
      ...options
    });
  }

  /**
   * Retry test setup operations
   * @param {function} setupFn Setup function
   * @param {object} options Retry options
   * @returns {Promise} Setup result
   */
  async retryTestSetup(setupFn, options = {}) {
    return this.retryTest('Test Setup', setupFn, {
      maxAttempts: 3,
      baseDelay: 2000,
      onRetry: async (error, attempt, delay) => {
        // Clean up any partial state before retry
        try {
          const testHelpers = require('./testHelpers');
          await testHelpers.cleanup({ waitTime: 500 });
        } catch (cleanupError) {
          console.warn('Setup retry cleanup failed:', cleanupError.message);
        }
      },
      ...options
    });
  }

  /**
   * Wait for condition with timeout
   * @param {function} condition Function that returns true when condition is met
   * @param {object} options Wait options
   * @returns {Promise} Resolves when condition is met
   */
  async waitForCondition(condition, options = {}) {
    const timeout = options.timeout || 10000;
    const interval = options.interval || 100;
    const errorMessage = options.errorMessage || 'Condition not met within timeout';
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) {
          return result;
        }
      } catch (error) {
        // Condition check failed, continue waiting
      }
      
      await this.sleep(interval);
    }
    
    throw new Error(`${errorMessage} (timeout: ${timeout}ms)`);
  }

  /**
   * Wait for database to be ready
   * @param {object} options Wait options
   * @returns {Promise} Resolves when database is ready
   */
  async waitForDatabase(options = {}) {
    return this.waitForCondition(async () => {
      try {
        // Try direct connection first
        const { Pool } = require('pg');
        const pool = new Pool({
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || 5432,
          database: process.env.DB_NAME || 'lockr_test',
          user: process.env.DB_USER || 'lockr_user', 
          password: process.env.DB_PASSWORD || 'lockr_test_password',
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 3000,
          max: 1 // Just one connection for testing
        });

        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        
        return true;
      } catch (error) {
        console.log(`Database connection attempt failed: ${error.message}`);
        return false;
      }
    }, {
      timeout: options.timeout || 30000,
      interval: options.interval || 2000, // Check every 2 seconds
      errorMessage: `Database not ready within timeout. Check connection to ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'lockr_test'}`
    });
  }

  /**
   * Wait for HTTP service to be ready
   * @param {string} url URL to check
   * @param {object} options Wait options
   * @returns {Promise} Resolves when service is ready
   */
  async waitForService(url, options = {}) {
    const request = require('supertest');
    
    return this.waitForCondition(async () => {
      try {
        const response = await request(url).get('/health').timeout(1000);
        return response.status === 200;
      } catch (error) {
        return false;
      }
    }, {
      timeout: options.timeout || 15000,
      interval: options.interval || 1000,
      errorMessage: `Service at ${url} not ready within timeout`
    });
  }

  /**
   * Stable test wrapper that includes common stability measures
   * @param {string} testName Test name for tracking
   * @param {function} testFn Test function
   * @param {object} options Stability options
   * @returns {Promise} Test result
   */
  async stableTest(testName, testFn, options = {}) {
    const stabilityOptions = {
      timeout: options.timeout || 30000,
      retries: options.retries !== false,
      cleanup: options.cleanup !== false,
      ...options
    };

    // Set test timeout
    if (stabilityOptions.timeout && typeof jest !== 'undefined') {
      jest.setTimeout(stabilityOptions.timeout);
    }

    // Wrap test function with stability measures
    const stableTestFn = async () => {
      let result;
      
      try {
        // Pre-test stability check
        if (stabilityOptions.checkDatabase !== false) {
          await this.waitForDatabase({ timeout: 5000 });
        }
        
        // Run the actual test
        result = await testFn();
        
        // Post-test cleanup if requested
        if (stabilityOptions.cleanup) {
          const testHelpers = require('./testHelpers');
          await testHelpers.cleanup({ waitTime: 100 });
        }
        
        return result;
      } catch (error) {
        // Enhanced error reporting for stability
        error.message = `[${testName}] ${error.message}`;
        throw error;
      }
    };

    // Apply retries if enabled
    if (stabilityOptions.retries) {
      return this.retryTest(testName, stableTestFn, {
        maxAttempts: stabilityOptions.maxAttempts || 2,
        baseDelay: stabilityOptions.baseDelay || 1000
      });
    } else {
      return stableTestFn();
    }
  }

  /**
   * Get retry statistics for analysis
   * @returns {object} Retry statistics
   */
  getRetryStats() {
    return {
      totalTests: this.retryStats.size,
      stats: Array.from(this.retryStats.entries()).map(([testName, stats]) => ({
        testName,
        ...stats
      }))
    };
  }

  /**
   * Clear retry statistics
   */
  clearStats() {
    this.retryStats.clear();
  }

  /**
   * Sleep utility
   * @param {number} ms Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RetryHelpers();