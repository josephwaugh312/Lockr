#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Handles database setup, test execution, and cleanup
 */

const { spawn } = require('child_process');
const TestDatabaseInitializer = require('./initializeTestDatabase');

class TestRunner {
  constructor() {
    this.args = process.argv.slice(2);
    this.options = this.parseArguments();
  }

  parseArguments() {
    const options = {
      coverage: false,
      watch: false,
      integration: false,
      unit: false,
      ci: false,
      verbose: false,
      skipDbSetup: false,
      pattern: null,
      maxWorkers: null
    };

    for (const arg of this.args) {
      switch (arg) {
        case '--coverage':
          options.coverage = true;
          break;
        case '--watch':
          options.watch = true;
          break;
        case '--integration':
          options.integration = true;
          break;
        case '--unit':
          options.unit = true;
          break;
        case '--ci':
          options.ci = true;
          break;
        case '--verbose':
          options.verbose = true;
          break;
        case '--skip-db-setup':
          options.skipDbSetup = true;
          break;
        default:
          if (arg.startsWith('--pattern=')) {
            options.pattern = arg.split('=')[1];
          } else if (arg.startsWith('--maxWorkers=')) {
            options.maxWorkers = arg.split('=')[1];
          }
      }
    }

    return options;
  }

  async setupDatabase() {
    if (this.options.skipDbSetup) {
      console.log('⏭️  Skipping database setup (--skip-db-setup)');
      return true;
    }

    console.log('🔧 Setting up test database...');
    
    try {
      const initializer = new TestDatabaseInitializer();
      const result = await initializer.initialize({
        clean: !this.options.watch, // Don't clean in watch mode
        createBasicSchema: true,
        verbose: this.options.verbose
      });

      if (!result.success) {
        console.error('❌ Database setup failed:', result.error);
        
        if (result.troubleshooting) {
          console.error('\n💡 Troubleshooting tips:');
          result.troubleshooting.forEach((tip, i) => {
            console.error(`  ${i + 1}. ${tip}`);
          });
        }
        
        return false;
      }

      console.log(`✅ Database ready (${result.duration}ms)`);
      return true;
      
    } catch (error) {
      console.error('❌ Database setup error:', error.message);
      return false;
    }
  }

  buildJestCommand() {
    const jestArgs = ['jest'];

    // Test type selection
    if (this.options.integration) {
      jestArgs.push('tests/integration');
    } else if (this.options.unit) {
      jestArgs.push('tests/controllers', 'tests/services', 'tests/middleware', 'tests/utils');
    }

    // Coverage
    if (this.options.coverage) {
      jestArgs.push('--coverage');
    }

    // Watch mode
    if (this.options.watch) {
      jestArgs.push('--watch');
    }

    // CI mode
    if (this.options.ci) {
      jestArgs.push('--ci');
      jestArgs.push('--maxWorkers=2');
    } else if (this.options.maxWorkers) {
      jestArgs.push(`--maxWorkers=${this.options.maxWorkers}`);
    }

    // Verbose
    if (this.options.verbose) {
      jestArgs.push('--verbose');
    }

    // Pattern matching
    if (this.options.pattern) {
      jestArgs.push('--testNamePattern', this.options.pattern);
    }

    // Additional Jest options for stability
    if (!this.options.watch) {
      jestArgs.push('--forceExit');
      jestArgs.push('--detectOpenHandles');
    }

    return jestArgs;
  }

  async runTests() {
    const jestCommand = this.buildJestCommand();
    
    console.log('🧪 Running tests...');
    if (this.options.verbose) {
      console.log('Command:', jestCommand.join(' '));
    }

    return new Promise((resolve, reject) => {
      const jestProcess = spawn('npx', jestCommand, {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          ...(this.options.verbose && { VERBOSE_TESTS: 'true' })
        }
      });

      jestProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ All tests completed successfully');
          resolve(true);
        } else {
          console.error(`❌ Tests failed with exit code ${code}`);
          resolve(false);
        }
      });

      jestProcess.on('error', (error) => {
        console.error('❌ Error running tests:', error.message);
        reject(error);
      });
    });
  }

  async run() {
    const startTime = Date.now();
    
    console.log('🚀 Test Runner Starting');
    console.log('======================');
    
    if (this.options.verbose) {
      console.log('Options:', this.options);
    }

    try {
      // Step 1: Setup database (unless skipped or in watch mode after first run)
      const dbSetup = await this.setupDatabase();
      if (!dbSetup) {
        console.error('\n❌ Cannot proceed - database setup failed');
        process.exit(1);
      }

      // Step 2: Run tests
      const testSuccess = await this.runTests();
      
      // Step 3: Report results
      const duration = Date.now() - startTime;
      console.log('\n📊 Test Run Summary');
      console.log('==================');
      console.log(`Duration: ${duration}ms`);
      console.log(`Status: ${testSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (!testSuccess) {
        console.log('\n💡 Troubleshooting tips:');
        console.log('  1. Check database connection: npm run test:db:check');
        console.log('  2. Reinitialize database: npm run test:db:init');
        console.log('  3. Run with verbose output: npm run test -- --verbose');
        console.log('  4. Run specific test pattern: npm run test -- --pattern="pattern"');
      }

      process.exit(testSuccess ? 0 : 1);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ Test runner failed after ${duration}ms:`, error.message);
      process.exit(1);
    }
  }

  static showHelp() {
    console.log(`
Test Runner - Comprehensive test execution with database setup

Usage:
  node scripts/runTests.js [options]

Options:
  --coverage         Enable code coverage reporting
  --watch           Run tests in watch mode
  --integration     Run only integration tests
  --unit           Run only unit tests (controllers, services, etc.)
  --ci             Run in CI mode (reduced workers, no watch)
  --verbose        Enable verbose output
  --skip-db-setup  Skip database initialization
  --pattern=<pat>  Run tests matching pattern
  --maxWorkers=<n> Set maximum number of Jest workers

Examples:
  node scripts/runTests.js                    # Run all tests
  node scripts/runTests.js --coverage         # Run with coverage
  node scripts/runTests.js --integration      # Integration tests only
  node scripts/runTests.js --unit --watch     # Unit tests in watch mode
  node scripts/runTests.js --pattern="auth"   # Tests matching "auth"
  node scripts/runTests.js --ci               # CI mode
    `);
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    TestRunner.showHelp();
    process.exit(0);
  }

  const runner = new TestRunner();
  runner.run().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;