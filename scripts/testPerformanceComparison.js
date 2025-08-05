#!/usr/bin/env node

/**
 * Test Performance Comparison Script
 * Demonstrates before/after performance improvements
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class PerformanceComparison {
  constructor() {
    this.results = {
      before: null,
      after: null,
      comparison: null
    };
  }

  /**
   * Run test suite and capture performance metrics
   * @param {string} mode - 'before' or 'after'
   * @param {object} options - Test options
   * @returns {Promise<object>} Performance results
   */
  async runTestSuite(mode, options = {}) {
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      VERBOSE_TESTS: options.verbose ? 'true' : 'false'
    };

    if (mode === 'after') {
      // Enable optimizations
      env.USE_OPTIMIZED_TESTS = 'true';
      env.ENABLE_PERFORMANCE_TRACKING = 'true';
    }

    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    return new Promise((resolve, reject) => {
      const testProcess = spawn('npm', ['test', '--', '--passWithNoTests'], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        const results = this.parseTestResults(stdout, stderr, {
          totalTime: endTime - startTime,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
          },
          exitCode: code
        });

        resolve(results);
      });

      testProcess.on('error', (error) => {
        reject(error);
      });

      // Set timeout
      setTimeout(() => {
        testProcess.kill();
        reject(new Error('Test suite timeout'));
      }, options.timeout || 600000); // 10 minutes default
    });
  }

  /**
   * Parse test results from Jest output
   * @param {string} stdout - Standard output
   * @param {string} stderr - Standard error  
   * @param {object} metadata - Additional metadata
   * @returns {object} Parsed results
   */
  parseTestResults(stdout, stderr, metadata) {
    const results = {
      totalTime: metadata.totalTime,
      memoryDelta: metadata.memoryDelta,
      exitCode: metadata.exitCode,
      tests: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      testSuites: {
        total: 0,
        passed: 0,
        failed: 0
      },
      coverage: null,
      performance: null
    };

    // Parse Jest summary
    const summaryMatch = stdout.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (summaryMatch) {
      results.tests.passed = parseInt(summaryMatch[1]);
      results.tests.total = parseInt(summaryMatch[2]);
      results.tests.failed = results.tests.total - results.tests.passed;
    }

    // Parse test suites
    const suitesMatch = stdout.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (suitesMatch) {
      results.testSuites.passed = parseInt(suitesMatch[1]);
      results.testSuites.total = parseInt(suitesMatch[2]);
      results.testSuites.failed = results.testSuites.total - results.testSuites.passed;
    }

    // Parse execution time
    const timeMatch = stdout.match(/Time:\s+([\d.]+)s/);
    if (timeMatch) {
      results.jestExecutionTime = parseFloat(timeMatch[1]) * 1000; // Convert to ms
    }

    // Parse coverage if available
    const coverageMatch = stdout.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      results.coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
    }

    // Parse performance metrics from custom output
    const performanceMatch = stdout.match(/📊.*?avg ([\d.]+)ms\/test/);
    if (performanceMatch) {
      results.performance = {
        avgTestDuration: parseFloat(performanceMatch[1])
      };
    }

    // Parse retry statistics
    const retryMatch = stdout.match(/🔄 Retry Stats: (\d+)\/(\d+) tests required retries/);
    if (retryMatch) {
      results.retries = {
        retriedTests: parseInt(retryMatch[1]),
        totalTests: parseInt(retryMatch[2]),
        retryRate: (parseInt(retryMatch[1]) / parseInt(retryMatch[2])) * 100
      };
    }

    return results;
  }

  /**
   * Generate comparison report
   * @param {object} before - Before results
   * @param {object} after - After results
   * @returns {object} Comparison report
   */
  generateComparison(before, after) {
    const comparison = {
      executionTime: {
        before: before.totalTime,
        after: after.totalTime,
        improvement: before.totalTime - after.totalTime,
        improvementPercent: ((before.totalTime - after.totalTime) / before.totalTime) * 100
      },
      testReliability: {
        before: {
          passRate: (before.tests.passed / before.tests.total) * 100,
          retryRate: before.retries?.retryRate || 0
        },
        after: {
          passRate: (after.tests.passed / after.tests.total) * 100,
          retryRate: after.retries?.retryRate || 0
        }
      },
      memoryUsage: {
        before: before.memoryDelta.heapUsed,
        after: after.memoryDelta.heapUsed,
        improvement: before.memoryDelta.heapUsed - after.memoryDelta.heapUsed,
        improvementPercent: ((before.memoryDelta.heapUsed - after.memoryDelta.heapUsed) / before.memoryDelta.heapUsed) * 100
      },
      avgTestDuration: {
        before: before.performance?.avgTestDuration || 0,
        after: after.performance?.avgTestDuration || 0,
        improvement: (before.performance?.avgTestDuration || 0) - (after.performance?.avgTestDuration || 0),
        improvementPercent: before.performance?.avgTestDuration 
          ? (((before.performance.avgTestDuration - (after.performance?.avgTestDuration || 0)) / before.performance.avgTestDuration) * 100)
          : 0
      }
    };

    return comparison;
  }

  /**
   * Display results in a formatted table
   * @param {object} comparison - Comparison results
   */
  displayResults(comparison) {
    console.log('\n🔍 Test Infrastructure Performance Comparison\n');
    console.log('=' .repeat(80));

    // Execution Time
    console.log('\n📊 EXECUTION TIME');
    console.log('-'.repeat(40));
    console.log(`Before:      ${(comparison.executionTime.before / 1000).toFixed(2)}s`);
    console.log(`After:       ${(comparison.executionTime.after / 1000).toFixed(2)}s`);
    console.log(`Improvement: ${(comparison.executionTime.improvement / 1000).toFixed(2)}s (${comparison.executionTime.improvementPercent.toFixed(1)}%)`);

    // Test Reliability  
    console.log('\n🎯 TEST RELIABILITY');
    console.log('-'.repeat(40));
    console.log(`Pass Rate Before:  ${comparison.testReliability.before.passRate.toFixed(1)}%`);
    console.log(`Pass Rate After:   ${comparison.testReliability.after.passRate.toFixed(1)}%`);
    console.log(`Retry Rate Before: ${comparison.testReliability.before.retryRate.toFixed(1)}%`);
    console.log(`Retry Rate After:  ${comparison.testReliability.after.retryRate.toFixed(1)}%`);

    // Memory Usage
    console.log('\n💾 MEMORY USAGE');
    console.log('-'.repeat(40));
    console.log(`Before:      ${(comparison.memoryUsage.before / 1024 / 1024).toFixed(2)}MB`);
    console.log(`After:       ${(comparison.memoryUsage.after / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Improvement: ${(comparison.memoryUsage.improvement / 1024 / 1024).toFixed(2)}MB (${comparison.memoryUsage.improvementPercent.toFixed(1)}%)`);

    // Average Test Duration
    if (comparison.avgTestDuration.before > 0) {
      console.log('\n⚡ AVERAGE TEST DURATION');
      console.log('-'.repeat(40));
      console.log(`Before:      ${comparison.avgTestDuration.before.toFixed(2)}ms`);
      console.log(`After:       ${comparison.avgTestDuration.after.toFixed(2)}ms`);
      console.log(`Improvement: ${comparison.avgTestDuration.improvement.toFixed(2)}ms (${comparison.avgTestDuration.improvementPercent.toFixed(1)}%)`);
    }

    // Summary
    console.log('\n✨ SUMMARY');
    console.log('-'.repeat(40));
    
    const totalImprovementTime = comparison.executionTime.improvementPercent;
    const reliabilityImprovement = comparison.testReliability.after.passRate - comparison.testReliability.before.passRate;
    
    if (totalImprovementTime > 0) {
      console.log(`✅ ${totalImprovementTime.toFixed(1)}% faster execution time`);
    }
    
    if (reliabilityImprovement > 0) {
      console.log(`✅ ${reliabilityImprovement.toFixed(1)}% improvement in test reliability`);
    }
    
    if (comparison.memoryUsage.improvementPercent > 0) {
      console.log(`✅ ${comparison.memoryUsage.improvementPercent.toFixed(1)}% reduction in memory usage`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Save results to file
   * @param {object} results - All results
   * @param {string} filename - Output filename
   */
  async saveResults(results, filename = 'test-performance-comparison.json') {
    const outputPath = path.join(process.cwd(), filename);
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`📄 Results saved to: ${outputPath}`);
  }

  /**
   * Main execution function
   */
  async run() {
    console.log('🚀 Starting Test Performance Comparison...\n');

    try {
      // Run baseline tests (before optimization)
      console.log('1️⃣  Running baseline tests (before optimization)...');
      const beforeResults = await this.runTestSuite('before', { verbose: false });

      // Run optimized tests (after optimization)  
      console.log('2️⃣  Running optimized tests (after optimization)...');
      const afterResults = await this.runTestSuite('after', { verbose: true });

      // Generate comparison
      console.log('3️⃣  Generating comparison report...');
      const comparison = this.generateComparison(beforeResults, afterResults);

      // Display results
      this.displayResults(comparison);

      // Save results
      const fullResults = {
        timestamp: new Date().toISOString(),
        before: beforeResults,
        after: afterResults,
        comparison
      };

      await this.saveResults(fullResults);

      // Exit with success if improvements are significant
      const significantImprovement = (
        comparison.executionTime.improvementPercent > 10 ||
        comparison.testReliability.after.passRate > comparison.testReliability.before.passRate + 5
      );

      process.exit(significantImprovement ? 0 : 1);

    } catch (error) {
      console.error('❌ Performance comparison failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const comparison = new PerformanceComparison();
  comparison.run();
}

module.exports = PerformanceComparison;