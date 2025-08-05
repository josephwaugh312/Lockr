/**
 * Example: Optimized Vault Tests using new test infrastructure
 * Demonstrates advanced usage patterns for vault operations
 */

describe('Optimized Vault Controller Tests', () => {
  let testContext = {};

  beforeAll(async () => {
    // Setup vault test environment with optimizations
    testContext = await testUtils.setupVaultTest({
      cache: true,
      maxAge: 180000 // Cache for 3 minutes
    });
  });

  describe('Vault Entry Management', () => {
    test('[FAST] should create vault entry with generated data', async () => {
      const entryData = testUtils.generateEntry({
        category: 'Email',
        title: 'Test Gmail Account'
      });

      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/vault/entries')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            ...entryData,
            encryptionKey: testContext.user.encryptionKey
          });
      });

      expect(response.status).toBe(201);
      expect(response.body.entry.title).toBe(entryData.title);
      expect(response.body.entry.category).toBe(entryData.category);
    });

    test('[BATCH] should create multiple entries efficiently', async () => {
      const entries = testUtils.helpers.generateCategorizedEntries();
      
      // Batch create operations for performance
      const createOperations = entries.map(entryData => () =>
        testUtils.helpers.createVaultEntry(
          testContext.app,
          testContext.user.tokens.accessToken,
          testContext.user.encryptionKey,
          entryData
        )
      );

      const startTime = Date.now();
      const results = await testUtils.performance.batchHttpRequests(createOperations, {
        batchSize: 3
      });
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(entries.length);
      results.forEach(result => {
        expect(result.entry.id).toBeDefined();
      });

      console.log(`Batch created ${entries.length} entries in ${duration}ms`);
    });

    test('[SPECIAL_CHARS] should handle special characters correctly', async () => {
      const specialEntry = testUtils.helpers.generateSpecialCharEntry();

      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/vault/entries')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            ...specialEntry,
            encryptionKey: testContext.user.encryptionKey
          });
      });

      expect(response.status).toBe(201);
      expect(response.body.entry.title).toBe(specialEntry.title);
      expect(response.body.entry.username).toBe(specialEntry.username);
      expect(response.body.entry.notes).toBe(specialEntry.notes);
    });

    test('[UNICODE] should handle unicode characters correctly', async () => {
      const unicodeEntry = testUtils.helpers.generateUnicodeEntry();

      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/vault/entries')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            ...unicodeEntry,
            encryptionKey: testContext.user.encryptionKey
          });
      });

      expect(response.status).toBe(201);
      expect(response.body.entry.title).toBe(unicodeEntry.title);
      expect(response.body.entry.username).toBe(unicodeEntry.username);
    });
  });

  describe('Vault Entry Retrieval', () => {
    let createdEntries = [];

    beforeEach(async () => {
      // Create test entries for retrieval tests
      createdEntries = await testUtils.helpers.createMultipleVaultEntries(
        testContext.app,
        testContext.user.tokens.accessToken,
        testContext.user.encryptionKey,
        3
      );
    });

    test('[FAST] should retrieve all entries', async () => {
      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/vault/entries/list')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            encryptionKey: testContext.user.encryptionKey
          });
      });

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(3);
      
      // Verify user isolation
      response.body.entries.forEach(entry => {
        expect(entry.userId).toBe(testContext.user.user.id);
      });
    });

    test('[PAGINATION] should handle pagination correctly', async () => {
      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/vault/entries/list')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            encryptionKey: testContext.user.encryptionKey,
            page: 1,
            limit: 2
          });
      });

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    test('[SEARCH] should search entries by category', async () => {
      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/vault/search')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            encryptionKey: testContext.user.encryptionKey,
            category: 'Email'
          });
      });

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      
      // Verify all results match the category
      response.body.results.forEach(entry => {
        expect(entry.category).toBe('Email');
      });
    });
  });

  describe('Vault Entry Updates', () => {
    let testEntry;

    beforeEach(async () => {
      const entryData = testUtils.generateEntry();
      testEntry = await testUtils.helpers.createVaultEntry(
        testContext.app,
        testContext.user.tokens.accessToken,
        testContext.user.encryptionKey,
        entryData
      );
    });

    test('[FAST] should update entry successfully', async () => {
      const updateData = {
        title: 'Updated Entry Title',
        username: 'updated@example.com',
        encryptionKey: testContext.user.encryptionKey
      };

      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .put(`/vault/entries/${testEntry.entry.id}`)
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send(updateData);
      });

      expect(response.status).toBe(200);
      expect(response.body.entry.title).toBe(updateData.title);
      expect(response.body.entry.username).toBe(updateData.username);
    });

    test('[PARTIAL_UPDATE] should preserve non-updated fields', async () => {
      const originalTitle = testEntry.entry.title;
      const originalWebsite = testEntry.entry.website;
      
      const partialUpdate = {
        username: 'newusername@example.com',
        encryptionKey: testContext.user.encryptionKey
      };

      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .put(`/vault/entries/${testEntry.entry.id}`)
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send(partialUpdate);
      });

      expect(response.status).toBe(200);
      expect(response.body.entry.username).toBe(partialUpdate.username);
      expect(response.body.entry.title).toBe(originalTitle); // Preserved
      expect(response.body.entry.website).toBe(originalWebsite); // Preserved
    });
  });

  describe('Encryption Key Management', () => {
    test('[KEY_VALIDATION] should validate encryption key format', async () => {
      const entryData = testUtils.generateEntry();

      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/vault/entries')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            ...entryData,
            encryptionKey: 'invalid-key-format!'
          });
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid encryption key format');
    });

    test('[KEY_GENERATION] should generate valid encryption keys', async () => {
      const keys = testUtils.helpers.generateEncryptionKeys(5);

      keys.forEach(key => {
        expect(testUtils.helpers.isValidEncryptionKey(key)).toBe(true);
      });

      // Verify keys are unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    test('[MASTER_PASSWORD_CHANGE] should handle master password change', async () => {
      // Create entry first
      const entryData = testUtils.generateEntry();
      await testUtils.helpers.createVaultEntry(
        testContext.app,
        testContext.user.tokens.accessToken,
        testContext.user.encryptionKey,
        entryData
      );

      const newEncryptionKey = testUtils.generateKey();

      const response = await testUtils.retry.stableTest('master_password_change', async () => {
        return request(testContext.app)
          .post('/vault/change-master-password')
          .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
          .send({
            currentEncryptionKey: testContext.user.encryptionKey,
            newEncryptionKey: newEncryptionKey
          });
      }, {
        retries: true,
        maxAttempts: 3
      });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Master password changed successfully');
    });
  });

  describe('Performance & Reliability', () => {
    test('[STRESS] should handle multiple concurrent operations', async () => {
      const operations = [];
      
      // Mix of different operations
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          // Create operation
          operations.push(() => {
            const entryData = testUtils.generateEntry({ title: `Stress Test Entry ${i}` });
            return testUtils.helpers.createVaultEntry(
              testContext.app,
              testContext.user.tokens.accessToken,
              testContext.user.encryptionKey,
              entryData
            );
          });
        } else if (i % 3 === 1) {
          // List operation
          operations.push(() =>
            request(testContext.app)
              .post('/vault/entries/list')
              .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
              .send({
                encryptionKey: testContext.user.encryptionKey,
                limit: 10
              })
          );
        } else {
          // Search operation
          operations.push(() =>
            request(testContext.app)
              .post('/vault/search')
              .set('Authorization', `Bearer ${testContext.user.tokens.accessToken}`)
              .send({
                encryptionKey: testContext.user.encryptionKey,
                query: 'test'
              })
          );
        }
      }

      const startTime = Date.now();
      const results = await testUtils.performance.runTestsInParallel(operations, {
        concurrency: 4
      });
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      expect(failures).toHaveLength(0);

      console.log(`Stress test completed: ${operations.length} operations in ${duration}ms`);
    });

    test('[DB_RELIABILITY] should handle database connection issues', async () => {
      // Test with retry mechanism for database operations
      await testUtils.retry.retryDatabaseOperation(async () => {
        // Verify database state
        const state = await testUtils.helpers.verifyDatabaseState();
        expect(typeof state.users).toBe('number');
        expect(typeof state.vaultEntries).toBe('number');
        
        return state;
      }, {
        maxAttempts: 5,
        baseDelay: 1000
      });
    });
  });

  // Cleanup and performance reporting
  afterAll(async () => {
    const report = testUtils.performance.generateReport();
    
    if (process.env.VERBOSE_TESTS) {
      console.log('\n📊 Vault Test Suite Performance Report:');
      console.log(`  Total Tests: ${report.summary.totalTests}`);
      console.log(`  Avg Duration: ${report.summary.avgTestDuration.toFixed(2)}ms`);
      console.log(`  Memory Usage: ${report.resources.memory.heapUsed}MB`);
      
      // Show slowest operations
      const metrics = testUtils.performance.getPerformanceStats();
      const slowestOps = Object.entries(metrics)
        .filter(([key]) => key.includes('test_'))
        .sort(([,a], [,b]) => b.max - a.max)
        .slice(0, 3);
      
      if (slowestOps.length > 0) {
        console.log('  Slowest Operations:');
        slowestOps.forEach(([op, stats]) => {
          console.log(`    ${op}: ${stats.max.toFixed(2)}ms max, ${stats.avg.toFixed(2)}ms avg`);
        });
      }
    }
  });
});