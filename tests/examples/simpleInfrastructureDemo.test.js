/**
 * Simple Infrastructure Demo
 * Demonstrates the test infrastructure without requiring database
 */

// Mock database for this demo
jest.mock('../../src/config/database', () => ({
  testConnection: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(true),
  createPool: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    destroy: jest.fn().mockResolvedValue(true)
  })
}));

// Mock repositories
jest.mock('../../src/models/userRepository', () => ({
  clear: jest.fn().mockResolvedValue(true),
  count: jest.fn().mockResolvedValue(0),
  create: jest.fn().mockImplementation((userData) => ({
    id: 'user-123',
    email: userData.email,
    role: userData.role || 'user',
    createdAt: new Date(),
    updatedAt: new Date()
  }))
}));

jest.mock('../../src/models/vaultRepository', () => ({
  clear: jest.fn().mockResolvedValue(true),
  count: jest.fn().mockResolvedValue(0)
}));

describe('Test Infrastructure Demo', () => {
  describe('Data Generation Helpers', () => {
    test('[FAST] should generate user data', () => {
      const user = testUtils.generateUser();
      
      expect(user.email).toMatch(/test\.user\.\d+@example\.com/);
      expect(user.password).toBe('SecureTestPassword123!');
      expect(user.firstName).toBe('Test');
      expect(user.lastName).toBe('User');
    });

    test('[FAST] should generate user with overrides', () => {
      const user = testUtils.generateUser({
        email: 'custom@example.com',
        role: 'admin'
      });
      
      expect(user.email).toBe('custom@example.com');
      expect(user.role).toBe('admin');
      expect(user.password).toBe('SecureTestPassword123!'); // Default preserved
    });

    test('[FAST] should generate multiple users', () => {
      const users = testUtils.helpers.generateMultipleUsers(3);
      
      expect(users).toHaveLength(3);
      users.forEach(user => {
        expect(user.email).toMatch(/test\.user\.\d+\.\d+@example\.com/);
      });
      
      // Verify emails are unique
      const emails = users.map(u => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(3);
    });

    test('[FAST] should generate vault entries', () => {
      const entry = testUtils.generateEntry();
      
      expect(entry.title).toMatch(/Test Entry \d+/);
      expect(entry.username).toMatch(/testuser\d+@example\.com/);
      expect(entry.password).toBe('TestPassword123!');
      expect(entry.website).toBe('https://example.com');
      expect(entry.category).toBe('Email');
    });

    test('[FAST] should generate categorized vault entries', () => {
      const entries = testUtils.helpers.generateCategorizedEntries();
      
      expect(entries).toHaveLength(5);
      
      const categories = entries.map(e => e.category);
      expect(categories).toEqual(['Email', 'Social', 'Banking', 'Work', 'Personal']);
      
      entries.forEach(entry => {
        expect(entry.title).toBe(`${entry.category} Account`);
        expect(entry.website).toBe(`https://${entry.category.toLowerCase()}.example.com`);
      });
    });

    test('[FAST] should generate special character entries', () => {
      const entry = testUtils.helpers.generateSpecialCharEntry();
      
      expect(entry.title).toBe('Entry with special chars: !@#$%^&*()');
      expect(entry.username).toBe('user+test@example.com');
      expect(entry.password).toBe('P@ssw0rd!#$%');
      expect(entry.notes).toBe('Notes with "quotes" and <tags> & symbols');
    });

    test('[FAST] should generate unicode entries', () => {
      const entry = testUtils.helpers.generateUnicodeEntry();
      
      expect(entry.title).toBe('Entry with unicode: 测试 テスト 테스트');
      expect(entry.username).toBe('тест@example.com');
      expect(entry.notes).toBe('Unicode notes: 🔒🔑 Émojis & spéciàl chârs');
    });
  });

  describe('Encryption Key Helpers', () => {
    test('[FAST] should generate encryption keys', () => {
      const key = testUtils.generateKey();
      
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(testUtils.helpers.isValidEncryptionKey(key)).toBe(true);
    });

    test('[FAST] should generate multiple unique keys', () => {
      const keys = testUtils.helpers.generateEncryptionKeys(5);
      
      expect(keys).toHaveLength(5);
      
      keys.forEach(key => {
        expect(testUtils.helpers.isValidEncryptionKey(key)).toBe(true);
      });
      
      // Verify uniqueness
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(5);
    });

    test('[FAST] should validate encryption key format', () => {
      const validKey = testUtils.generateKey();
      const invalidKeys = [
        'invalid-key!',
        'short',
        '12345',
        'special@chars#not$allowed',
        ''
      ];
      
      expect(testUtils.helpers.isValidEncryptionKey(validKey)).toBe(true);
      
      invalidKeys.forEach(key => {
        expect(testUtils.helpers.isValidEncryptionKey(key)).toBe(false);
      });
    });
  });

  describe('Utility Helpers', () => {
    test('[FAST] should generate random strings', () => {
      const str1 = testUtils.helpers.generateRandomString(10);
      const str2 = testUtils.helpers.generateRandomString(10);
      
      expect(str1).toHaveLength(10);
      expect(str2).toHaveLength(10);
      expect(str1).not.toBe(str2); // Should be random
    });

    test('[FAST] should generate custom length strings', () => {
      const shortStr = testUtils.helpers.generateRandomString(5);
      const longStr = testUtils.helpers.generateRandomString(20);
      
      expect(shortStr).toHaveLength(5);
      expect(longStr).toHaveLength(20);
    });

    test('[FAST] should use custom charset', () => {
      const numericStr = testUtils.helpers.generateRandomString(10, '0123456789');
      
      expect(numericStr).toHaveLength(10);
      expect(/^\d+$/.test(numericStr)).toBe(true);
    });
  });

  describe('Retry Mechanisms Demo', () => {
    test('[RELIABLE] should retry flaky operations', async () => {
      let attempts = 0;
      
      const flakyOperation = async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Temporary failure');
          error.code = 'ECONNRESET'; // Make it retryable
          throw error;
        }
        return 'success';
      };
      
      const result = await testUtils.retry.retryTest('flaky_demo', flakyOperation, {
        maxAttempts: 5,
        baseDelay: 10 // Fast for demo
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('[RELIABLE] should handle retry conditions', async () => {
      const result = await testUtils.retry.retryTest('condition_demo', async () => {
        return 'immediate_success';
      }, {
        maxAttempts: 3,
        retryCondition: () => false // Never retry
      });
      
      expect(result).toBe('immediate_success');
    });

    test('[STABLE] should use stable test wrapper', async () => {
      const result = await testUtils.retry.stableTest('stable_demo', async () => {
        return { message: 'Test completed successfully' };
      }, {
        retries: false, // Disable retries for this demo
        cleanup: false  // Skip cleanup for demo
      });
      
      expect(result.message).toBe('Test completed successfully');
    });
  });

  describe('Performance Helpers Demo', () => {
    test('[PERFORMANCE] should track execution time', async () => {
      const startTime = Date.now();
      
      // Simulate some work
      await testUtils.helpers.sleep(50);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(45); // Account for timing variance
    });

    test('[BATCH] should handle batched operations', async () => {
      const operations = [
        async () => 'result1',
        async () => 'result2', 
        async () => 'result3'
      ];
      
      const results = await testUtils.performance.batchHttpRequests(operations, {
        batchSize: 2
      });
      
      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    test('[METRICS] should record performance metrics', () => {
      // Record some demo metrics
      testUtils.performance.recordMetric('demo_operation', 150);
      testUtils.performance.recordMetric('demo_operation', 200);
      testUtils.performance.recordMetric('demo_operation', 100);
      
      const stats = testUtils.performance.getPerformanceStats('demo_operation');
      
      expect(stats.count).toBe(3);
      expect(stats.avg).toBe(150);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(200);
    });
  });

  describe('Schema Validation Demo', () => {
    test('[VALIDATION] should validate response schemas', () => {
      const validAuthResponse = {
        user: { id: '123', email: 'test@example.com' },
        tokens: { accessToken: 'token123', refreshToken: 'refresh123' },
        message: 'Success'
      };
      
      expect(() => {
        testUtils.validateResponse(validAuthResponse, testUtils.schemas.AUTH_RESPONSE);
      }).not.toThrow();
    });

    test('[VALIDATION] should detect invalid schemas', () => {
      const invalidResponse = {
        user: { id: '123' },
        // Missing tokens and message
      };
      
      expect(() => {
        testUtils.validateResponse(invalidResponse, testUtils.schemas.AUTH_RESPONSE);
      }).toThrow('Missing required field: tokens');
    });

    test('[VALIDATION] should check field types', () => {
      const wrongTypeResponse = {
        user: 'not-an-object',
        tokens: { accessToken: 'token' },
        message: 'Success'
      };
      
      expect(() => {
        testUtils.validateResponse(wrongTypeResponse, testUtils.schemas.AUTH_RESPONSE);
      }).toThrow('Field user should be object, got string');
    });
  });

  // Performance reporting
  afterAll(async () => {
    const report = testUtils.performance.generateReport();
    
    if (process.env.VERBOSE_TESTS) {
      console.log('\n📊 Infrastructure Demo Performance Report:');
      console.log(`  Total Tests: ${report.summary.totalTests}`);
      console.log(`  Avg Duration: ${report.summary.avgTestDuration.toFixed(2)}ms`);
      console.log(`  Memory Usage: ${report.resources.memory.heapUsed}MB`);
    }
    
    // Verify we have reasonable performance
    expect(report.summary.avgTestDuration).toBeLessThan(1000); // Tests should be fast
  });
});