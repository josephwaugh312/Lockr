/**
 * Comprehensive Test Helper Functions
 * Provides reusable utilities for test setup, data generation, and verification
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const { CryptoService } = require('../../src/services/cryptoService');
const { __tokenService } = require('../../src/middleware/auth');
const userRepository = require('../../src/models/userRepository');
const vaultRepository = require('../../src/models/vaultRepository');
const database = require('../../src/config/database');

class TestHelpers {
  constructor() {
    this.cryptoService = new CryptoService();
    this.tokenService = __tokenService;
    this.apps = new Map(); // Track created apps for cleanup
    this.activeConnections = new Set(); // Track database connections
  }

  /**
   * ENCRYPTION & KEY MANAGEMENT
   */
  
  /**
   * Generate a secure 256-bit encryption key for testing
   * @returns {string} Base64 encoded encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Generate multiple encryption keys for testing scenarios
   * @param {number} count Number of keys to generate
   * @returns {string[]} Array of base64 encoded keys
   */
  generateEncryptionKeys(count = 2) {
    return Array.from({ length: count }, () => this.generateEncryptionKey());
  }

  /**
   * Validate encryption key format
   * @param {string} key Encryption key to validate
   * @returns {boolean} True if valid base64 format
   */
  isValidEncryptionKey(key) {
    return /^[A-Za-z0-9+/=]+$/.test(key) && key.length >= 44; // 32 bytes = 44 chars base64
  }

  /**
   * USER DATA GENERATION
   */

  /**
   * Generate test user data with realistic values
   * @param {object} overrides Custom field values
   * @returns {object} User test data
   */
  generateUserData(overrides = {}) {
    const timestamp = Date.now();
    return {
      email: `test.user.${timestamp}@example.com`,
      password: 'SecureTestPassword123!',
      masterPassword: 'MasterTestKey456!',
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    };
  }

  /**
   * Generate multiple unique users for testing
   * @param {number} count Number of users to generate
   * @param {object} baseOverrides Base overrides for all users
   * @returns {object[]} Array of user data objects
   */
  generateMultipleUsers(count = 3, baseOverrides = {}) {
    return Array.from({ length: count }, (_, index) => 
      this.generateUserData({
        ...baseOverrides,
        email: `test.user.${Date.now()}.${index}@example.com`
      })
    );
  }

  /**
   * VAULT ENTRY DATA GENERATION
   */

  /**
   * Generate test vault entry data
   * @param {object} overrides Custom field values
   * @returns {object} Vault entry test data
   */
  generateVaultEntry(overrides = {}) {
    const timestamp = Date.now();
    return {
      title: `Test Entry ${timestamp}`,
      username: `testuser${timestamp}@example.com`,
      password: 'TestPassword123!',
      website: 'https://example.com',
      notes: 'Generated test entry notes',
      category: 'Email',
      favorite: false,
      ...overrides
    };
  }

  /**
   * Generate vault entries for different categories
   * @returns {object[]} Array of vault entries for different categories
   */
  generateCategorizedEntries() {
    const categories = ['Email', 'Social', 'Banking', 'Work', 'Personal'];
    return categories.map(category => this.generateVaultEntry({ 
      category,
      title: `${category} Account`,
      website: `https://${category.toLowerCase()}.example.com`
    }));
  }

  /**
   * Generate vault entry with special characters for testing
   * @returns {object} Vault entry with special characters
   */
  generateSpecialCharEntry() {
    return this.generateVaultEntry({
      title: 'Entry with special chars: !@#$%^&*()',
      username: 'user+test@example.com',
      password: 'P@ssw0rd!#$%',
      notes: 'Notes with "quotes" and <tags> & symbols'
    });
  }

  /**
   * Generate vault entry with unicode characters
   * @returns {object} Vault entry with unicode characters
   */
  generateUnicodeEntry() {
    return this.generateVaultEntry({
      title: 'Entry with unicode: 测试 テスト 테스트',
      username: 'тест@example.com',
      notes: 'Unicode notes: 🔒🔑 Émojis & spéciàl chârs'
    });
  }

  /**
   * APPLICATION SETUP HELPERS
   */

  /**
   * Create an Express app with common middleware for testing
   * @param {object} options Configuration options
   * @returns {object} Express app instance
   */
  createTestApp(options = {}) {
    const app = express();
    
    // Basic middleware
    app.use(express.json({ limit: options.jsonLimit || '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: options.urlencodedLimit || '10mb' }));
    
    // Add request ID for tracking
    app.use((req, res, next) => {
      req.testId = crypto.randomUUID();
      next();
    });

    // Store app for cleanup
    this.apps.set(app, Date.now());
    
    return app;
  }

  /**
   * Setup authentication routes on an app
   * @param {object} app Express app instance
   * @returns {object} App with auth routes configured
   */
  setupAuthRoutes(app) {
    const authController = require('../../src/controllers/authController');
    const { authMiddleware } = require('../../src/middleware/auth');

    app.post('/auth/register', authController.register);
    app.post('/auth/login', authController.login);
    app.post('/auth/logout', authMiddleware, authController.logout);
    app.post('/auth/refresh', authController.refresh);
    app.get('/auth/me', authMiddleware, authController.getProfile);
    app.put('/auth/change-password', authMiddleware, authController.changePassword);
    app.delete('/auth/delete-account', authMiddleware, authController.deleteAccount);
    
    // 2FA routes
    app.post('/auth/2fa/setup', authMiddleware, authController.setup2FA);
    app.post('/auth/2fa/enable', authMiddleware, authController.enable2FA);
    app.post('/auth/2fa/disable', authMiddleware, authController.disable2FA);
    app.get('/auth/2fa/status', authMiddleware, authController.get2FAStatus);
    app.post('/auth/2fa/verify', authController.verify2FA);

    return app;
  }

  /**
   * Setup vault routes on an app
   * @param {object} app Express app instance
   * @returns {object} App with vault routes configured
   */
  setupVaultRoutes(app) {
    const vaultRoutes = require('../../src/routes/vault');
    app.use('/vault', vaultRoutes);
    return app;
  }

  /**
   * USER & AUTH HELPERS
   */

  /**
   * Create a test user and return user data with tokens
   * @param {object} userData User data (optional)
   * @param {object} options Creation options
   * @returns {object} User data with tokens and metadata
   */
  async createTestUser(userData = null, options = {}) {
    const user = userData || this.generateUserData();
    
    // Hash password
    const hashedPassword = await this.cryptoService.hashPassword(user.password);
    
    // Create user in database
    const createdUser = await userRepository.create({
      email: user.email,
      passwordHash: hashedPassword,
      firstName: user.firstName,
      lastName: user.lastName,
      role: options.role || 'user'
    });

    // Generate tokens if requested
    let tokens = null;
    if (options.generateTokens !== false) {
      const userForToken = {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role
      };
      
      const accessToken = await this.tokenService.generateAccessToken(userForToken);
      const refreshToken = await this.tokenService.generateRefreshToken(userForToken);
      
      tokens = { accessToken, refreshToken };
    }

    return {
      user: createdUser,
      userData: user, // Original data with plaintext password
      tokens,
      encryptionKey: this.generateEncryptionKey()
    };
  }

  /**
   * Create multiple test users
   * @param {number} count Number of users to create
   * @param {object} options Creation options
   * @returns {object[]} Array of user data with tokens
   */
  async createMultipleTestUsers(count = 3, options = {}) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser(null, options);
      users.push(user);
    }
    return users;
  }

  /**
   * Authenticate user and return tokens
   * @param {object} app Express app
   * @param {object} credentials User credentials
   * @returns {object} Authentication response with tokens
   */
  async authenticateUser(app, credentials) {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: credentials.email,
        password: credentials.password
      });
    
    if (response.status !== 200) {
      throw new Error(`Authentication failed: ${response.body.error || 'Unknown error'}`);
    }
    
    return response.body;
  }

  /**
   * VAULT HELPERS  
   */

  /**
   * Create a vault entry for a user
   * @param {object} app Express app
   * @param {string} accessToken User's access token
   * @param {string} encryptionKey User's encryption key
   * @param {object} entryData Entry data (optional)
   * @returns {object} Created entry response
   */
  async createVaultEntry(app, accessToken, encryptionKey, entryData = null) {
    const entry = entryData || this.generateVaultEntry();
    
    const response = await request(app)
      .post('/vault/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        ...entry,
        encryptionKey
      });
    
    if (response.status !== 201) {
      throw new Error(`Vault entry creation failed: ${response.body.error || 'Unknown error'}`);
    }
    
    return response.body;
  }

  /**
   * Create multiple vault entries for a user
   * @param {object} app Express app
   * @param {string} accessToken User's access token
   * @param {string} encryptionKey User's encryption key
   * @param {number} count Number of entries to create
   * @returns {object[]} Array of created entries
   */
  async createMultipleVaultEntries(app, accessToken, encryptionKey, count = 3) {
    const entries = [];
    const categorizedEntries = this.generateCategorizedEntries();
    
    for (let i = 0; i < count; i++) {
      const entryData = categorizedEntries[i % categorizedEntries.length];
      const entry = await this.createVaultEntry(app, accessToken, encryptionKey, entryData);
      entries.push(entry);
    }
    
    return entries;
  }

  /**
   * DATABASE HELPERS
   */

  /**
   * Clean database with retry mechanism for deadlock handling
   * @param {object} options Cleanup options
   * @returns {Promise} Cleanup promise
   */
  async cleanDatabase(options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await vaultRepository.clear();
        await userRepository.clear();
        
        // Clear token blacklist
        this.tokenService.clearBlacklist();
        
        return; // Success
      } catch (error) {
        if (error.code === '40P01' && attempt < maxRetries) {
          // Deadlock detected, wait and retry
          await this.sleep(retryDelay * attempt);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Verify database state
   * @param {object} expected Expected state
   * @returns {object} Actual database state
   */
  async verifyDatabaseState(expected = {}) {
    const userCount = await userRepository.count();
    const vaultCount = await vaultRepository.count();
    
    const actual = {
      users: userCount,
      vaultEntries: vaultCount
    };
    
    if (expected.users !== undefined && actual.users !== expected.users) {
      throw new Error(`Expected ${expected.users} users, found ${actual.users}`);
    }
    
    if (expected.vaultEntries !== undefined && actual.vaultEntries !== expected.vaultEntries) {
      throw new Error(`Expected ${expected.vaultEntries} vault entries, found ${actual.vaultEntries}`);
    }
    
    return actual;
  }

  /**
   * UTILITY HELPERS
   */

  /**
   * Sleep utility for timing control
   * @param {number} ms Milliseconds to sleep
   * @returns {Promise} Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   * @param {function} fn Function to retry
   * @param {object} options Retry options
   * @returns {Promise} Function result
   */
  async retry(fn, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    const baseDelay = options.baseDelay || 1000;
    const maxDelay = options.maxDelay || 5000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Generate random string for testing
   * @param {number} length String length
   * @param {string} charset Character set to use
   * @returns {string} Random string
   */
  generateRandomString(length = 10, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * CLEANUP & TEARDOWN
   */

  /**
   * Complete cleanup for test suite
   * @param {object} options Cleanup options
   */
  async cleanup(options = {}) {
    try {
      // Clean database
      await this.cleanDatabase(options);
      
      // Clear any cached data
      this.apps.clear();
      this.activeConnections.clear();
      
      // Give time for async cleanup
      if (options.waitTime !== false) {
        await this.sleep(options.waitTime || 100);
      }
    } catch (error) {
      console.error('Test cleanup error:', error);
      throw error;
    }
  }

  /**
   * VALIDATION HELPERS
   */

  /**
   * Validate API response structure
   * @param {object} response Response object
   * @param {object} schema Expected schema
   * @returns {boolean} True if valid
   */
  validateResponseSchema(response, schema) {
    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in response)) {
        throw new Error(`Missing required field: ${key}`);
      }
      
      if (typeof response[key] !== expectedType) {
        throw new Error(`Field ${key} should be ${expectedType}, got ${typeof response[key]}`);
      }
    }
    return true;
  }

  /**
   * Common response schemas for validation
   */
  static get SCHEMAS() {
    return {
      AUTH_RESPONSE: {
        user: 'object',
        tokens: 'object',
        message: 'string'
      },
      VAULT_ENTRY: {
        id: 'string',
        title: 'string',
        category: 'string',
        createdAt: 'string',
        updatedAt: 'string'
      },
      ERROR_RESPONSE: {
        error: 'string',
        timestamp: 'string'
      }
    };
  }
}

// Export singleton instance
module.exports = new TestHelpers();