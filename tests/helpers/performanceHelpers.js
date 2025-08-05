/**
 * Test Performance Optimization Helpers
 * Provides utilities for optimizing test execution speed and resource usage
 */

const EventEmitter = require('events');

class PerformanceHelpers extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.setupMetrics = new Map();
    this.connectionPools = new Map();
    this.teardownQueue = [];
    this.parallelLimits = {
      database: 5,    // Max parallel DB operations
      http: 10,       // Max parallel HTTP requests
      crypto: 3       // Max parallel crypto operations
    };
  }

  /**
   * CONNECTION POOL MANAGEMENT
   */

  /**
   * Get or create optimized database connection pool
   * @param {string} poolName Pool identifier
   * @param {object} options Pool configuration
   * @returns {object} Database pool
   */
  async getOptimizedDbPool(poolName = 'default', options = {}) {
    if (this.connectionPools.has(poolName)) {
      return this.connectionPools.get(poolName);
    }

    const database = require('../../src/config/database');
    
    // Set environment variables for pool optimization
    process.env.DB_POOL_MIN = options.min || '2';
    process.env.DB_POOL_MAX = options.max || '8';
    process.env.DB_IDLE_TIMEOUT = options.idleTimeout || '10000';
    process.env.DB_ACQUIRE_TIMEOUT = options.acquireTimeout || '5000';
    
    // Connect to database
    await database.connect();
    
    this.connectionPools.set(poolName, database);
    
    // Schedule cleanup
    this.teardownQueue.push(async () => {
      if (this.connectionPools.has(poolName)) {
        await database.close();
        this.connectionPools.delete(poolName);
      }
    });

    return database;
  }

  /**
   * BATCHING UTILITIES
   */

  /**
   * Batch database operations to reduce connection overhead
   * @param {function[]} operations Array of database operations
   * @param {object} options Batching options
   * @returns {Promise[]} Results array
   */
  async batchDatabaseOperations(operations, options = {}) {
    const batchSize = options.batchSize || this.parallelLimits.database;
    const results = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(op => this.wrapDatabaseOperation(op, options))
      );
      
      results.push(...batchResults.map(result => {
        if (result.status === 'rejected') {
          throw result.reason;
        }
        return result.value;
      }));
    }
    
    return results;
  }

  /**
   * Wrap database operation with optimizations
   * @param {function} operation Database operation
   * @param {object} options Operation options
   * @returns {Promise} Operation result
   */
  async wrapDatabaseOperation(operation, options = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      const pool = await this.getOptimizedDbPool(options.poolName);
      const result = await operation(pool);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to ms
      
      this.recordMetric('database_operation', duration);
      
      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      this.recordMetric('database_operation_error', duration);
      throw error;
    }
  }

  /**
   * Batch HTTP requests with concurrency control
   * @param {function[]} requests Array of HTTP request functions
   * @param {object} options Batching options
   * @returns {Promise[]} Results array
   */
  async batchHttpRequests(requests, options = {}) {
    const batchSize = options.batchSize || this.parallelLimits.http;
    const results = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch.map(fn => fn()));
      
      results.push(...batchResults.map(result => {
        if (result.status === 'rejected') {
          throw result.reason;
        }
        return result.value;
      }));
    }
    
    return results;
  }

  /**
   * SETUP OPTIMIZATION
   */

  /**
   * Optimized test setup with caching
   * @param {string} setupKey Unique key for this setup
   * @param {function} setupFn Setup function
   * @param {object} options Setup options
   * @returns {Promise} Setup result
   */
  async optimizedSetup(setupKey, setupFn, options = {}) {
    const cacheKey = `${setupKey}_${JSON.stringify(options)}`;
    
    // Check if setup is cached and still valid
    if (options.cache !== false && this.setupMetrics.has(cacheKey)) {
      const cached = this.setupMetrics.get(cacheKey);
      const age = Date.now() - cached.timestamp;
      const maxAge = options.maxAge || 30000; // 30 seconds default
      
      if (age < maxAge && cached.success) {
        this.recordMetric('setup_cache_hit', 0);
        return cached.result;
      }
    }

    const startTime = process.hrtime.bigint();
    
    try {
      const result = await setupFn();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // Cache successful setup
      if (options.cache !== false) {
        this.setupMetrics.set(cacheKey, {
          result,
          timestamp: Date.now(),
          duration,
          success: true
        });
      }
      
      this.recordMetric('setup_duration', duration);
      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // Cache failed setup to avoid immediate retry
      if (options.cacheErrors !== false) {
        this.setupMetrics.set(cacheKey, {
          error,
          timestamp: Date.now(),
          duration,
          success: false
        });
      }
      
      this.recordMetric('setup_error', duration);
      throw error;
    }
  }

  /**
   * Fast user creation with minimal overhead
   * @param {object} userData User data
   * @param {object} options Creation options
   * @returns {Promise} User data
   */
  async fastCreateUser(userData = null, options = {}) {
    return this.optimizedSetup(
      `user_${userData?.email || 'default'}`,
      async () => {
        const testHelpers = require('./testHelpers');
        return testHelpers.createTestUser(userData, options);
      },
      { cache: options.cache, maxAge: options.maxAge || 60000 }
    );
  }

  /**
   * Fast app setup with route caching
   * @param {string} appType Type of app (auth, vault, etc.)
   * @param {object} options App options
   * @returns {Promise} Express app
   */
  async fastSetupApp(appType, options = {}) {
    return this.optimizedSetup(
      `app_${appType}`,
      async () => {
        const testHelpers = require('./testHelpers');
        const app = testHelpers.createTestApp(options);
        
        switch (appType) {
          case 'auth':
            return testHelpers.setupAuthRoutes(app);
          case 'vault':
            testHelpers.setupAuthRoutes(app);
            return testHelpers.setupVaultRoutes(app);
          case 'full':
            testHelpers.setupAuthRoutes(app);
            testHelpers.setupVaultRoutes(app);
            return app;
          default:
            return app;
        }
      },
      { cache: options.cache, maxAge: options.maxAge || 120000 }
    );
  }

  /**
   * CLEANUP OPTIMIZATION
   */

  /**
   * Fast database cleanup with minimal operations
   * @param {object} options Cleanup options
   * @returns {Promise} Cleanup result
   */
  async fastCleanup(options = {}) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Use truncate instead of delete for speed
      if (options.truncate !== false) {
        await this.truncateTables(['vault_entries', 'users'], options);
      } else {
        const testHelpers = require('./testHelpers');
        await testHelpers.cleanDatabase(options);
      }
      
      // Clear caches
      if (options.clearCache !== false) {
        const testHelpers = require('./testHelpers');
        testHelpers.tokenService.clearBlacklist();
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      this.recordMetric('cleanup_duration', duration);
      
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      this.recordMetric('cleanup_error', duration);
      throw error;
    }
  }

  /**
   * Truncate tables for fast cleanup
   * @param {string[]} tables Table names to truncate
   * @param {object} options Truncate options
   * @returns {Promise} Truncate result
   */
  async truncateTables(tables, options = {}) {
    const database = await this.getOptimizedDbPool(options.poolName);
    
    try {
      // Disable triggers temporarily
      await database.query('SET session_replication_role = replica;');
      
      // Truncate tables
      for (const table of tables) {
        await database.query(`TRUNCATE TABLE ${table} CASCADE;`);
      }
      
      // Re-enable triggers
      await database.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.error('Error truncating tables:', error);
      throw error;
    }
  }

  /**
   * PARALLEL TEST EXECUTION
   */

  /**
   * Run tests in parallel with resource limits
   * @param {function[]} tests Array of test functions
   * @param {object} options Parallel execution options
   * @returns {Promise[]} Test results
   */
  async runTestsInParallel(tests, options = {}) {
    const concurrency = options.concurrency || Math.min(tests.length, 4);
    const results = [];
    
    for (let i = 0; i < tests.length; i += concurrency) {
      const batch = tests.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((test, index) => this.wrapTestExecution(test, i + index, options))
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Wrap test execution with performance monitoring
   * @param {function} testFn Test function
   * @param {number} index Test index
   * @param {object} options Execution options
   * @returns {Promise} Test result
   */
  async wrapTestExecution(testFn, index, options = {}) {
    const startTime = process.hrtime.bigint();
    const testName = testFn.name || `test_${index}`;
    
    try {
      const result = await testFn();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      this.recordMetric(`test_${testName}`, duration);
      this.emit('testComplete', { testName, duration, success: true });
      
      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      this.recordMetric(`test_${testName}_error`, duration);
      this.emit('testComplete', { testName, duration, success: false, error });
      
      throw error;
    }
  }

  /**
   * METRICS & MONITORING
   */

  /**
   * Record performance metric
   * @param {string} metric Metric name
   * @param {number} value Metric value
   */
  recordMetric(metric, value) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    
    this.metrics.get(metric).push({
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Get performance statistics
   * @param {string} metric Specific metric name (optional)
   * @returns {object} Performance statistics
   */
  getPerformanceStats(metric = null) {
    if (metric) {
      const data = this.metrics.get(metric) || [];
      return this.calculateStats(data);
    }
    
    const stats = {};
    for (const [metricName, data] of this.metrics.entries()) {
      stats[metricName] = this.calculateStats(data);
    }
    
    return stats;
  }

  /**
   * Calculate statistics for metric data
   * @param {object[]} data Metric data points
   * @returns {object} Statistics
   */
  calculateStats(data) {
    if (data.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, total: 0 };
    }
    
    const values = data.map(d => d.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: data.length,
      avg: sum / data.length,
      min: Math.min(...values),
      max: Math.max(...values),
      total: sum,
      median: this.calculateMedian(values)
    };
  }

  /**
   * Calculate median value
   * @param {number[]} values Array of values
   * @returns {number} Median value
   */
  calculateMedian(values) {
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Get resource usage statistics
   * @returns {object} Resource usage stats
   */
  getResourceStats() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      connections: {
        active: this.connectionPools.size,
        pools: Array.from(this.connectionPools.keys())
      }
    };
  }

  /**
   * CLEANUP
   */

  /**
   * Clean up all performance optimization resources
   * @returns {Promise} Cleanup promise
   */
  async cleanup() {
    const startTime = Date.now();
    
    // Run all scheduled teardown operations
    await Promise.allSettled(this.teardownQueue.map(fn => fn()));
    this.teardownQueue.length = 0;
    
    // Clear metrics and caches
    this.metrics.clear();
    this.setupMetrics.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const duration = Date.now() - startTime;
    console.log(`Performance helpers cleanup completed in ${duration}ms`);
  }

  /**
   * Generate performance report
   * @returns {object} Performance report
   */
  generateReport() {
    const stats = this.getPerformanceStats();
    const resources = this.getResourceStats();
    
    return {
      timestamp: new Date().toISOString(),
      metrics: stats,
      resources,
      summary: {
        totalTests: Object.keys(stats).filter(k => k.startsWith('test_')).length,
        avgTestDuration: this.calculateAverageTestDuration(stats),
        totalSetupTime: stats.setup_duration?.total || 0,
        totalCleanupTime: stats.cleanup_duration?.total || 0
      }
    };
  }

  /**
   * Calculate average test duration across all tests
   * @param {object} stats Performance statistics
   * @returns {number} Average duration in ms
   */
  calculateAverageTestDuration(stats) {
    const testMetrics = Object.entries(stats).filter(([key]) => 
      key.startsWith('test_') && !key.includes('_error')
    );
    
    if (testMetrics.length === 0) return 0;
    
    const totalDuration = testMetrics.reduce((sum, [, metric]) => sum + metric.total, 0);
    const totalTests = testMetrics.reduce((sum, [, metric]) => sum + metric.count, 0);
    
    return totalTests > 0 ? totalDuration / totalTests : 0;
  }
}

module.exports = new PerformanceHelpers();