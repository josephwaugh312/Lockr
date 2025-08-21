/**
 * Example: Optimized Auth Tests using new test infrastructure
 * Demonstrates usage of test helpers, retry mechanisms, and performance optimizations
 */

const request = require('supertest');

describe('Optimized Auth Controller Tests', () => {
  let testContext = {};

  // Using optimized setup from global testUtils
  beforeAll(async () => {
    // Fast app and user setup with caching
    testContext = await testUtils.setupAuthTest({
      cache: true,
      maxAge: 120000 // Cache for 2 minutes
    });
  });

  describe('User Registration', () => {
    test('[FAST] should register new user successfully', async () => {
      const userData = testUtils.generateUser({
        email: 'new.user@example.com'
      });

      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/api/v1/auth/register')
          .send(userData);
      });

      expect(response.status).toBe(201);
      testUtils.validateResponse(response.body, testUtils.schemas.AUTH_RESPONSE);
      expect(response.body.user.email).toBe(userData.email);
    });

    test('[RELIABLE] should handle duplicate email registration', async () => {
      const userData = testUtils.generateUser();
      
      // Create user first
      await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/api/v1/auth/register')
          .send(userData);
      });

      // Attempt duplicate registration with retry for stability
      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/api/v1/auth/register')
          .send(userData);
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    test('[BATCH] should handle multiple registrations efficiently', async () => {
      const users = testUtils.helpers.generateMultipleUsers(5);
      
      // Sequential registration to avoid connection issues
      const responses = [];
      for (const userData of users) {
        const response = await request(testContext.app)
          .post('/api/v1/auth/register')
          .send(userData);
        responses.push(response);
      }

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
    });
  });

  describe('User Authentication', () => {
    let testUser;

    beforeEach(async () => {
      // Use cached user creation for speed
      testUser = await testUtils.performance.fastCreateUser();
    });

    test('[FAST] should authenticate valid user', async () => {
      const response = await testUtils.retryHttp(async () => {
        return request(testContext.app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.user.email,
            password: testUser.user.originalPassword
          });
      });

      expect(response.status).toBe(200);
      testUtils.validateResponse(response.body, testUtils.schemas.AUTH_RESPONSE);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
    });

    test('[STABLE] should reject invalid credentials with retry', async () => {
      // Use stable test wrapper for flaky scenarios
      await testUtils.retry.stableTest('invalid_credentials_test', async () => {
        const response = await request(testContext.app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.user.email,
            password: 'WrongPassword123!'
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('Invalid credentials');
      }, {
        retries: true,
        maxAttempts: 2
      });
    });

    test('[PERFORMANCE] should handle concurrent logins', async () => {
      // Create a completely unique user for this concurrent test
      const timestamp = Date.now();
      const uniqueUserData = {
        email: `concurrent-test-${timestamp}@example.com`,
        password: 'ConcurrentTest123!',
        masterPassword: 'ConcurrentMaster123!',
        name: 'Concurrent Test User'
      };
      
      // Register the user first
      const regResponse = await request(testContext.app)
        .post('/api/v1/auth/register')
        .send(uniqueUserData);
      
      expect(regResponse.status).toBe(201);
      
      // Use Promise.all for true concurrent requests
      const startTime = Date.now();
      const loginPromises = Array(10).fill(null).map(() => 
        request(testContext.app)
          .post('/api/v1/auth/login')
          .send({
            email: uniqueUserData.email,
            password: uniqueUserData.password
          })
      );
      
      const responses = await Promise.all(loginPromises);
      const duration = Date.now() - startTime;

      expect(responses).toHaveLength(10);
      responses.forEach((response, index) => {
        if (response.status !== 200) {
          console.log(`Concurrent login ${index} failed:`, response.status, response.body);
        }
        expect(response.status).toBe(200);
      });

      // Performance assertion
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      console.log(`Concurrent logins completed in ${duration}ms`);
    });
  });

  describe('Token Management', () => {
    let authenticatedUser;

    beforeEach(async () => {
      // Create a fresh user for each test to avoid cache pollution
      const uniqueEmail = `token.test.${Date.now()}@example.com`;
      authenticatedUser = await testUtils.performance.fastCreateUser({
        email: uniqueEmail
      });
      
      // Authenticate to get tokens
      const authResponse = await testUtils.helpers.authenticateUser(
        testContext.app, 
        authenticatedUser.user
      );
      
      if (authResponse.status !== 200 || !authResponse.body.tokens) {
        throw new Error(`Authentication failed: ${authResponse.status} - ${JSON.stringify(authResponse.body)}`);
      }
      
      authenticatedUser.tokens = authResponse.body.tokens;
    });

    test('[RELIABLE] should refresh tokens successfully', async () => {
      const response = await testUtils.retry.retryHttpRequest(async () => {
        return request(testContext.app)
          .post('/api/v1/auth/refresh')
          .send({
            refreshToken: authenticatedUser.tokens.refreshToken
          });
      });

      expect(response.status).toBe(200);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      
      // Verify new tokens are different
      expect(response.body.tokens.accessToken).not.toBe(authenticatedUser.tokens.accessToken);
    });

    test('[STABLE] should logout successfully', async () => {
      await testUtils.retry.stableTest('logout_test', async () => {
        const response = await request(testContext.app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${authenticatedUser.tokens.accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Logged out successfully');
      });
    });
  });

  describe('Database Operations', () => {
    test('[DB_OPTIMIZED] should handle database operations efficiently', async () => {
      // Batch database operations for performance
      const operations = [
        () => testUtils.helpers.verifyDatabaseState({ users: 0 }),
        () => testUtils.performance.fastCreateUser(),
        () => testUtils.helpers.verifyDatabaseState({ users: 1 }),
      ];

      const results = await testUtils.performance.batchDatabaseOperations(operations, {
        batchSize: 2
      });

      expect(results).toHaveLength(3);
      expect(results[1].user.email).toBeDefined();
    });

    test('[DB_RETRY] should handle database deadlocks gracefully', async () => {
      // Simulate potential deadlock scenario with retry
      await testUtils.retry.retryDatabaseOperation(async () => {
        // Create multiple users simultaneously to potentially trigger deadlock
        const users = testUtils.helpers.generateMultipleUsers(3);
        
        const createPromises = users.map(userData => 
          testUtils.helpers.createTestUser(userData)
        );
        
        const results = await Promise.all(createPromises);
        expect(results).toHaveLength(3);
        
        return results;
      }, {
        maxAttempts: 5,
        baseDelay: 500
      });
    });
  });

  // Cleanup with performance metrics
  afterAll(async () => {
    // Generate performance report for this test suite
    const report = testUtils.performance.generateReport();
    
    if (process.env.VERBOSE_TESTS) {
      console.log('\n📊 Auth Test Suite Performance Report:');
      console.log(`  Total Tests: ${report.summary.totalTests}`);
      console.log(`  Avg Duration: ${report.summary.avgTestDuration.toFixed(2)}ms`);
      console.log(`  Setup Time: ${report.summary.totalSetupTime.toFixed(2)}ms`);
      console.log(`  Cleanup Time: ${report.summary.totalCleanupTime.toFixed(2)}ms`);
    }
    
    // Clean up test context and ensure all connections are closed
    if (testContext.app) {
      // Close any server instances if they exist
      if (testContext.app.server) {
        await new Promise((resolve) => {
          testContext.app.server.close(resolve);
        });
      }
      testContext.app = null;
    }
    
    // Perform cleanup to close database connections
    if (testUtils.performance && typeof testUtils.performance.cleanup === 'function') {
      await testUtils.performance.cleanup();
    }
    
    // Cleanup any database connections
    if (testUtils.cleanup && typeof testUtils.cleanup === 'function') {
      await testUtils.cleanup();
    }
  });
});