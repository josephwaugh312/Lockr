# Test Infrastructure Documentation

## Overview

This test infrastructure provides a comprehensive, optimized, and reliable testing environment for the Lockr password vault application. It includes helper functions, retry mechanisms, performance optimizations, and enhanced error handling.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Helpers](#test-helpers)
3. [Retry Mechanisms](#retry-mechanisms)
4. [Performance Optimizations](#performance-optimizations)
5. [Test Organization](#test-organization)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Performance Metrics](#performance-metrics)

## Quick Start

### Basic Test Setup

```javascript
describe('My Test Suite', () => {
  let testContext = {};

  beforeAll(async () => {
    // Fast setup with caching
    testContext = await testUtils.setupAuthTest();
  });

  test('should work reliably', async () => {
    const userData = testUtils.generateUser();
    
    const response = await testUtils.retryHttp(async () => {
      return request(testContext.app)
        .post('/auth/register')
        .send(userData);
    });

    expect(response.status).toBe(201);
    testUtils.validateResponse(response.body, testUtils.schemas.AUTH_RESPONSE);
  });
});
```

### Available Global Utils

The `testUtils` global object provides access to all helper functions:

```javascript
// Quick setup methods
await testUtils.setupAuthTest()
await testUtils.setupVaultTest()
await testUtils.setupFullTest()

// Data generation
testUtils.generateUser(overrides)
testUtils.generateEntry(overrides)
testUtils.generateKey()

// Retry mechanisms
testUtils.retryHttp(fn, options)
testUtils.retryDatabase(fn, options)
testUtils.retrySetup(fn, options)

// Performance optimizations
testUtils.batchDb(operations, options)
testUtils.batchHttp(requests, options)

// Validation helpers
testUtils.validateResponse(response, schema)
testUtils.schemas.AUTH_RESPONSE
```

## Test Helpers

### Data Generation

#### User Data Generation

```javascript
// Basic user
const user = testUtils.generateUser();

// User with overrides
const adminUser = testUtils.generateUser({
  role: 'admin',
  email: 'admin@example.com'
});

// Multiple users
const users = testUtils.helpers.generateMultipleUsers(5);
```

#### Vault Entry Generation

```javascript
// Basic entry
const entry = testUtils.generateEntry();

// Entry with specific category
const emailEntry = testUtils.generateEntry({
  category: 'Email',
  title: 'Gmail Account'
});

// Categorized entries
const entries = testUtils.helpers.generateCategorizedEntries();

// Special character testing
const specialEntry = testUtils.helpers.generateSpecialCharEntry();
const unicodeEntry = testUtils.helpers.generateUnicodeEntry();
```

#### Encryption Keys

```javascript
// Single key
const key = testUtils.generateKey();

// Multiple keys
const keys = testUtils.helpers.generateEncryptionKeys(3);

// Validate key format
const isValid = testUtils.helpers.isValidEncryptionKey(key);
```

### Application Setup

#### Fast App Creation

```javascript
// Auth-only app
const app = await testUtils.performance.fastSetupApp('auth');

// Vault app (includes auth)
const app = await testUtils.performance.fastSetupApp('vault');

// Full app with all routes
const app = await testUtils.performance.fastSetupApp('full');
```

#### User Creation and Authentication

```javascript
// Create user with tokens
const user = await testUtils.performance.fastCreateUser();

// Create specific user
const userData = testUtils.generateUser({ email: 'test@example.com' });
const user = await testUtils.helpers.createTestUser(userData);

// Authenticate existing user
const authResponse = await testUtils.helpers.authenticateUser(app, credentials);
```

### Database Operations

#### Fast Cleanup

```javascript
// Standard cleanup
await testUtils.helpers.cleanup();

// Fast cleanup with truncation
await testUtils.performance.fastCleanup({
  truncate: true,
  clearCache: true
});
```

#### State Verification

```javascript
// Verify database state
await testUtils.helpers.verifyDatabaseState({
  users: 1,
  vaultEntries: 3
});

// Get current state
const state = await testUtils.helpers.verifyDatabaseState();
console.log(`Users: ${state.users}, Entries: ${state.vaultEntries}`);
```

## Retry Mechanisms

### HTTP Request Retries

```javascript
// Basic HTTP retry
const response = await testUtils.retryHttp(async () => {
  return request(app).get('/api/endpoint');
});

// Custom retry options
const response = await testUtils.retryHttp(async () => {
  return request(app).post('/api/endpoint').send(data);
}, {
  maxAttempts: 5,
  baseDelay: 2000,
  retryCondition: (error) => error.status >= 500
});
```

### Database Operation Retries

```javascript
// Database operation with retry
await testUtils.retryDatabase(async () => {
  const user = await testUtils.helpers.createTestUser();
  return user;
});

// Custom database retry
await testUtils.retry.retryDatabaseOperation(async () => {
  // Complex database operation
}, {
  maxAttempts: 5,
  baseDelay: 500
});
```

### Stable Test Wrapper

```javascript
// Wrap flaky test with stability measures
await testUtils.retry.stableTest('my_flaky_test', async () => {
  // Test logic that might be flaky
}, {
  retries: true,
  maxAttempts: 3,
  timeout: 15000,
  cleanup: true
});
```

### Wait for Conditions

```javascript
// Wait for database
await testUtils.retry.waitForDatabase({ timeout: 30000 });

// Wait for service
await testUtils.retry.waitForService('http://localhost:3000');

// Wait for custom condition
await testUtils.retry.waitForCondition(async () => {
  const state = await getSystemState();
  return state.ready === true;
}, { timeout: 10000, interval: 500 });
```

## Performance Optimizations

### Batched Operations

#### HTTP Request Batching

```javascript
// Batch multiple HTTP requests
const requests = [
  () => request(app).get('/api/users/1'),
  () => request(app).get('/api/users/2'),
  () => request(app).get('/api/users/3')
];

const responses = await testUtils.batchHttp(requests, {
  batchSize: 2
});
```

#### Database Operation Batching

```javascript
// Batch database operations
const operations = [
  () => testUtils.helpers.createTestUser(),
  () => testUtils.helpers.createTestUser(),
  () => testUtils.helpers.verifyDatabaseState()
];

const results = await testUtils.batchDb(operations, {
  batchSize: 2
});
```

### Caching and Optimization

#### Setup Caching

```javascript
// Cached setup (reuses results for 2 minutes)
const user = await testUtils.performance.fastCreateUser(null, {
  cache: true,
  maxAge: 120000
});

// Cached app setup
const app = await testUtils.performance.fastSetupApp('auth', {
  cache: true,
  maxAge: 180000
});
```

#### Optimized Database Cleanup

```javascript
// Fast cleanup using TRUNCATE
await testUtils.performance.fastCleanup({
  truncate: true,      // Use TRUNCATE instead of DELETE
  clearCache: true,    // Clear token blacklists
  waitTime: 50        // Minimal wait time
});
```

### Parallel Test Execution

```javascript
// Run tests in parallel with concurrency control
const testFunctions = [
  async () => { /* test 1 */ },
  async () => { /* test 2 */ },
  async () => { /* test 3 */ }
];

const results = await testUtils.performance.runTestsInParallel(testFunctions, {
  concurrency: 2
});
```

## Test Organization

### Test Categories

Use descriptive test names with tags for organization:

```javascript
describe('Auth Controller', () => {
  test('[FAST] should register user quickly', async () => {
    // Fast, simple test
  });

  test('[RELIABLE] should handle network issues', async () => {
    // Test with retry mechanisms
  });

  test('[BATCH] should handle multiple operations', async () => {
    // Batched operations test
  });

  test('[PERFORMANCE] should complete within time limit', async () => {
    // Performance-focused test
  });

  test('[INTEGRATION] should work end-to-end', async () => {
    // Complex integration test
  });
});
```

### Test Structure

```javascript
describe('Feature Name', () => {
  let testContext = {};

  beforeAll(async () => {
    // Suite-level setup
    testContext = await testUtils.setupAuthTest();
  });

  describe('Subfeature', () => {
    beforeEach(async () => {
      // Test-level setup
    });

    test('[TAG] should do something', async () => {
      // Test implementation
    });

    afterEach(async () => {
      // Test-level cleanup (usually not needed)
    });
  });

  afterAll(async () => {
    // Performance reporting
    const report = testUtils.performance.generateReport();
    console.log(`Suite completed: ${report.summary.totalTests} tests`);
  });
});
```

## Best Practices

### 1. Use Appropriate Test Categories

- `[FAST]` - Simple, quick tests (< 1s)
- `[RELIABLE]` - Tests with retry mechanisms for stability
- `[BATCH]` - Tests that use batching for performance
- `[PERFORMANCE]` - Tests that measure execution time
- `[INTEGRATION]` - Complex end-to-end tests
- `[DB_OPTIMIZED]` - Tests optimized for database operations

### 2. Leverage Caching

```javascript
// Good: Use caching for expensive setup
const user = await testUtils.performance.fastCreateUser(null, { cache: true });

// Bad: Recreate expensive resources every time
const user = await testUtils.helpers.createTestUser();
```

### 3. Use Appropriate Retry Mechanisms

```javascript
// Good: Retry HTTP requests that might fail due to network
const response = await testUtils.retryHttp(() => request(app).get('/api/data'));

// Good: Retry database operations that might deadlock
await testUtils.retryDatabase(() => createComplexData());

// Bad: Don't retry tests that should consistently fail
// const response = await testUtils.retryHttp(() => request(app).get('/nonexistent'));
```

### 4. Batch Operations When Possible

```javascript
// Good: Batch multiple similar operations
const operations = users.map(user => () => createUserAccount(user));
const results = await testUtils.batchHttp(operations);

// Bad: Sequential operations
for (const user of users) {
  await createUserAccount(user);
}
```

### 5. Validate Response Schemas

```javascript
// Good: Validate response structure
testUtils.validateResponse(response.body, testUtils.schemas.AUTH_RESPONSE);

// Acceptable: Manual validation
expect(response.body.user).toBeDefined();
expect(response.body.tokens).toBeDefined();
```

### 6. Use Performance Monitoring

```javascript
afterAll(async () => {
  const report = testUtils.performance.generateReport();
  
  if (process.env.VERBOSE_TESTS) {
    console.log('Performance Report:', report.summary);
  }
  
  // Assert performance requirements
  expect(report.summary.avgTestDuration).toBeLessThan(5000);
});
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:** Ensure PostgreSQL is running and use retry mechanisms:

```javascript
await testUtils.retry.waitForDatabase({ timeout: 30000 });
```

#### 2. Test Timeouts

```
Error: Timeout - Async callback was not invoked within the 30000ms timeout
```

**Solutions:**
- Use retry mechanisms for flaky operations
- Increase timeout for complex tests
- Optimize test performance with batching

```javascript
// Increase timeout
jest.setTimeout(60000);

// Or use stable test wrapper
await testUtils.retry.stableTest('slow_test', testFn, { timeout: 60000 });
```

#### 3. Memory Leaks

```
Error: heap out of memory
```

**Solutions:**
- Use fast cleanup methods
- Enable garbage collection in CI
- Monitor memory usage

```javascript
// Fast cleanup
await testUtils.performance.fastCleanup({ truncate: true });

// Force garbage collection
if (global.gc) global.gc();
```

#### 4. Flaky Tests

**Symptoms:** Tests pass sometimes, fail other times

**Solutions:**
- Use retry mechanisms
- Add proper wait conditions
- Use stable test wrappers

```javascript
// Wrap flaky test
await testUtils.retry.stableTest('flaky_test', async () => {
  // Test logic
}, { retries: true, maxAttempts: 3 });
```

#### 5. Slow Test Execution

**Solutions:**
- Use caching for expensive setup
- Batch operations
- Use parallel execution
- Optimize database operations

```javascript
// Use caching
const app = await testUtils.performance.fastSetupApp('auth', { cache: true });

// Batch operations
await testUtils.batchHttp(requests, { batchSize: 5 });

// Fast cleanup
await testUtils.performance.fastCleanup({ truncate: true });
```

### Debug Mode

Enable verbose logging for detailed information:

```bash
VERBOSE_TESTS=true npm test
```

This will show:
- Individual test execution times
- Performance metrics
- Retry attempts
- Resource usage statistics

### Performance Analysis

Get detailed performance information:

```javascript
afterAll(async () => {
  const report = testUtils.performance.generateReport();
  const retryStats = testUtils.retry.getRetryStats();
  
  console.log('Performance Report:', report);
  console.log('Retry Statistics:', retryStats);
});
```

## Performance Metrics

### Execution Time Tracking

The infrastructure automatically tracks:
- Individual test execution times
- Setup and cleanup times
- Database operation times
- HTTP request times

### Resource Monitoring

Monitor resource usage:
- Memory consumption (heap, RSS)
- CPU usage
- Database connection counts
- Cache hit/miss rates

### Performance Assertions

Add performance requirements to tests:

```javascript
test('[PERFORMANCE] should complete quickly', async () => {
  const startTime = Date.now();
  
  // Test logic
  await performOperation();
  
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(1000); // Must complete within 1 second
});
```

### Benchmark Comparisons

Compare performance improvements:

```bash
# Before optimization
npm test 2>&1 | grep "Time:"
# Time: 610.936s

# After optimization
VERBOSE_TESTS=true npm test 2>&1 | grep "completed"
# Suite completed: 158 tests, avg 1.2s/test
```

## Migration Guide

### From Old Test Structure

**Before:**
```javascript
describe('Auth Tests', () => {
  let app;
  
  beforeEach(async () => {
    app = express();
    // Setup routes manually
    await userRepository.clear();
  });
  
  test('should register user', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send(userData);
    expect(response.status).toBe(201);
  });
});
```

**After:**
```javascript
describe('Auth Tests', () => {
  let testContext = {};
  
  beforeAll(async () => {
    testContext = await testUtils.setupAuthTest({ cache: true });
  });
  
  test('[FAST] should register user', async () => {
    const userData = testUtils.generateUser();
    
    const response = await testUtils.retryHttp(async () => {
      return request(testContext.app)
        .post('/auth/register')
        .send(userData);
    });
    
    expect(response.status).toBe(201);
    testUtils.validateResponse(response.body, testUtils.schemas.AUTH_RESPONSE);
  });
});
```

### Key Changes

1. **Setup:** Use `testUtils.setupAuthTest()` instead of manual setup
2. **Data:** Use `testUtils.generateUser()` instead of hardcoded data
3. **Reliability:** Wrap requests with `testUtils.retryHttp()`
4. **Validation:** Use `testUtils.validateResponse()` for schema validation
5. **Performance:** Use caching and batching where appropriate

This infrastructure provides a solid foundation for reliable, fast, and maintainable tests while maintaining the security and functionality of the Lockr application.