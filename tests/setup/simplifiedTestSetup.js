/**
 * Simplified Test Setup Configuration
 * Provides essential test environment setup with better error handling
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only';

// Database configuration for tests
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'lockr_test';
process.env.DB_USER = 'lockr_user';
process.env.DB_PASSWORD = 'lockr_test_password';
process.env.DB_SSL = 'false';

// Optimize for test performance
process.env.DB_POOL_MIN = '1';
process.env.DB_POOL_MAX = '3';
process.env.DB_IDLE_TIMEOUT = '5000';
process.env.DB_ACQUIRE_TIMEOUT = '3000';

// Test-specific configurations
process.env.LOG_LEVEL = 'error';

// Import enhanced test utilities for examples
const enhancedTestUtils = require('../helpers/testUtils');
const request = require('supertest');

// Make request available globally for examples
global.request = request;
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.DISABLE_EMAIL_VERIFICATION = 'true';

// Suppress console output during tests
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
}

// Import required modules
const { Pool } = require('pg');

// Database connection pool
let dbPool = null;

// Test utilities
global.testUtils = {
  // Database operations with proper error handling
  async getDbPool() {
    if (!dbPool) {
      dbPool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 3,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 3000
      });
    }
    return dbPool;
  },

  // Safe cleanup with foreign key constraint handling
  async cleanDatabase() {
    const pool = await this.getDbPool();
    const client = await pool.connect();
    
    try {
      // Disable foreign key checks temporarily at the session level
      await client.query('SET session_replication_role = replica');
      
      // Clean tables in order that avoids FK constraints
      const tables = ['notifications', 'password_reset_tokens', 'user_settings', 'vault_entries', 'users'];
      
      for (const table of tables) {
        try {
          await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        } catch (error) {
          // Table might not exist, continue
          if (process.env.VERBOSE_TESTS) {
            console.warn(`Warning truncating ${table}:`, error.message);
          }
        }
      }
    } catch (error) {
      if (process.env.VERBOSE_TESTS) {
        console.error('Database cleanup failed:', error.message);
      }
      throw error;
    } finally {
      // Always attempt to restore replication role regardless of failures
      try {
        await client.query('SET session_replication_role = DEFAULT');
      } catch (_) {
        // ignore
      }
      client.release();
    }
  },

  // Generate test user data
  generateUser(overrides = {}) {
    return {
      email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
      password: 'SecurePassword123!',
      masterPassword: 'MasterKey456!',
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    };
  },

  // Generate test vault entry
  generateVaultEntry(overrides = {}) {
    return {
      title: `Test Entry ${Date.now()}`,
      username: 'testuser',
      password: 'testpassword',
      website: 'https://example.com',
      notes: 'Test notes',
      category: 'Test',
      ...overrides
    };
  },

  // Create test user in database
  async createTestUser(userData = {}) {
    const pool = await this.getDbPool();
    const client = await pool.connect();
    const argon2 = require('argon2');
    
    try {
      const user = this.generateUser(userData);
      const passwordHash = await argon2.hash(user.password);
      
      const result = await client.query(`
        INSERT INTO users (email, password_hash, name, role, email_verified)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, role, email_verified, created_at
      `, [
        user.email,
        passwordHash,
        `${user.firstName} ${user.lastName}`,
        'user',
        true
      ]);
      
      const dbResult = result.rows[0];
      return { 
        ...dbResult, 
        originalPassword: user.password,
        name: dbResult.name || `${user.firstName} ${user.lastName}`
      };
    } finally {
      client.release();
    }
  },

  // Simple retry function
  async retry(fn, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  },

  // Enhanced methods for examples tests - override basic methods
  generateUser: enhancedTestUtils.generateUser.bind(enhancedTestUtils),
  generateEntry: enhancedTestUtils.generateEntry.bind(enhancedTestUtils),
  generatePassword: enhancedTestUtils.generatePassword.bind(enhancedTestUtils),
  generateKey: enhancedTestUtils.generateKey.bind(enhancedTestUtils),
  validateResponse: enhancedTestUtils.validateResponse.bind(enhancedTestUtils),
  createTestUser: enhancedTestUtils.createTestUser.bind(enhancedTestUtils),
  setupAuthTest: enhancedTestUtils.setupAuthTest.bind(enhancedTestUtils),
  setupVaultTest: enhancedTestUtils.setupVaultTest.bind(enhancedTestUtils),
  retryHttp: enhancedTestUtils.retryHttp.bind(enhancedTestUtils),
  sleep: enhancedTestUtils.sleep.bind(enhancedTestUtils),
  
  // Getter properties
  get schemas() { return enhancedTestUtils.schemas; },
  get helpers() { return enhancedTestUtils.helpers; },
  get retry() { return enhancedTestUtils.retry; },
  get performance() { return enhancedTestUtils.performance; }
};

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  if (process.env.VERBOSE_TESTS) {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

process.on('uncaughtException', (error) => {
  if (process.env.VERBOSE_TESTS) {
    console.error('Uncaught Exception:', error);
  }
});

// Shorter timeouts for faster test execution
jest.setTimeout(30000); // 30 seconds instead of 120

// Global setup and teardown
beforeEach(async () => {
  // Clean database before each test
  try {
    await global.testUtils.cleanDatabase();
  } catch (error) {
    if (process.env.VERBOSE_TESTS) {
      console.error('Database cleanup failed:', error.message);
    }
    throw error;
  }
}, 10000); // 10 second timeout for cleanup

afterAll(async () => {
  // Close database connections
  if (dbPool) {
    try {
      await dbPool.end();
      dbPool = null;
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}, 5000);

module.exports = {
  testUtils: global.testUtils
};