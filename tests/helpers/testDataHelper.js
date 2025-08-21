/**
 * Test Data Helper
 * Generates unique test data to prevent conflicts between test suites
 */

const crypto = require('crypto');
const { CryptoService } = require('../../src/services/cryptoService');

class TestDataHelper {
  constructor(suiteName = 'default') {
    this.suiteName = suiteName;
    this.cryptoService = new CryptoService();
    this.uniqueId = this.generateUniqueId();
  }

  /**
   * Generate a unique identifier for this test run
   */
  generateUniqueId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}_${random}`;
  }

  /**
   * Generate unique email address for test user
   */
  generateUniqueEmail(prefix = 'test') {
    return `${prefix}_${this.suiteName}_${this.uniqueId}@example.com`;
  }

  /**
   * Generate unique username
   */
  generateUniqueUsername(prefix = 'user') {
    return `${prefix}_${this.suiteName}_${this.uniqueId}`;
  }

  /**
   * Generate unique name
   */
  generateUniqueName(prefix = 'Test User') {
    return `${prefix} ${this.suiteName} ${this.uniqueId}`;
  }

  /**
   * Generate unique vault entry name
   */
  generateUniqueVaultEntryName(prefix = 'Test Entry') {
    return `${prefix} ${this.suiteName} ${this.uniqueId}`;
  }

  /**
   * Generate unique notification title/message
   */
  generateUniqueNotification(prefix = 'Test Notification') {
    return {
      title: `${prefix} Title ${this.uniqueId}`,
      message: `${prefix} Message ${this.suiteName} ${this.uniqueId}`,
      type: 'info'
    };
  }

  /**
   * Create a standard test user with unique data
   */
  async createUniqueTestUser(overrides = {}) {
    const baseUserData = {
      email: this.generateUniqueEmail('testuser'),
      password: 'SecureTestPassword123!',
      name: this.generateUniqueName('Test User'),
      ...overrides
    };

    // Hash the password
    const passwordHash = await this.cryptoService.hashPassword(baseUserData.password);
    const userData = {
      ...baseUserData,
      passwordHash
    };
    delete userData.password;

    return userData;
  }

  /**
   * Create unique vault entry data
   */
  createUniqueVaultEntry(category = 'login', overrides = {}) {
    const baseEntry = {
      name: this.generateUniqueVaultEntryName(),
      category,
      username: this.generateUniqueUsername(),
      password: 'TestPassword123!',
      website: `https://test-${this.uniqueId}.example.com`,
      notes: `Test notes for ${this.suiteName} ${this.uniqueId}`,
      ...overrides
    };

    return baseEntry;
  }

  /**
   * Create unique notification data
   */
  createUniqueNotificationData(overrides = {}) {
    const notification = this.generateUniqueNotification();
    return {
      ...notification,
      read: false,
      priority: 'medium',
      ...overrides
    };
  }

  /**
   * Generate unique database constraint-safe strings
   * Useful for testing unique constraints without conflicts
   */
  generateUniqueConstraintValue(prefix = 'unique', maxLength = 50) {
    const value = `${prefix}_${this.suiteName}_${this.uniqueId}`;
    return value.length > maxLength ? value.substring(0, maxLength) : value;
  }

  /**
   * Create multiple unique users for testing
   */
  async createMultipleUniqueUsers(count = 2, baseOverrides = {}) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const userData = await this.createUniqueTestUser({
        email: this.generateUniqueEmail(`user${i}`),
        name: this.generateUniqueName(`User ${i}`),
        ...baseOverrides
      });
      users.push(userData);
    }
    return users;
  }

  /**
   * Get cleanup pattern for this test suite
   * Use this pattern in cleanup queries to only remove data from this suite
   */
  getCleanupPattern() {
    return `%${this.suiteName}_${this.uniqueId}%`;
  }

  /**
   * Get a less specific cleanup pattern for the suite (without unique ID)
   * Useful for cleaning up data from all runs of this suite
   */
  getSuiteCleanupPattern() {
    return `%${this.suiteName}%`;
  }
}

/**
 * Factory function to create test data helper for a specific suite
 */
function createTestDataHelper(suiteName) {
  return new TestDataHelper(suiteName);
}

/**
 * Convenience function to set up test data patterns for a test suite
 * Usage:
 * 
 * const { setupTestData } = require('../helpers/testDataHelper');
 * 
 * describe('My Test Suite', () => {
 *   const testData = setupTestData('myTestSuite');
 *   
 *   test('my test', async () => {
 *     const user = await testData.createUniqueTestUser();
 *     // Test code here
 *   });
 * });
 */
function setupTestData(suiteName) {
  return new TestDataHelper(suiteName);
}

module.exports = {
  TestDataHelper,
  createTestDataHelper,
  setupTestData
};
