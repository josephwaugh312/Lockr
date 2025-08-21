#!/usr/bin/env node

/**
 * Global Test Setup
 * Runs before all Jest tests to initialize the database and test environment
 */

const TestDatabaseInitializer = require('./initializeTestDatabase');

module.exports = async function globalSetup() {
  console.log('🚀 Global test setup starting...');
  const startTime = Date.now();
  
  try {
    // Initialize the test database
    const initializer = new TestDatabaseInitializer();
    const result = await initializer.initialize({
      clean: true, // Clean existing data
      createBasicSchema: true, // Create basic schema if none exists
      verbose: process.env.VERBOSE_TESTS === 'true'
    });
    
    if (!result.success) {
      console.error('❌ Global setup failed - Database initialization failed');
      console.error('Error:', result.error);
      
      if (result.troubleshooting) {
        console.error('\nTroubleshooting tips:');
        result.troubleshooting.forEach((tip, i) => {
          console.error(`  ${i + 1}. ${tip}`);
        });
      }
      
      process.exit(1);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Global test setup completed in ${duration}ms`);
    console.log(`   Database ready with ${result.tables?.length || 0} tables`);
    
    // Store setup result for teardown
    global.__TEST_SETUP_RESULT__ = result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Global setup failed after ${duration}ms:`, error.message);
    
    // Provide helpful error context
    console.error('\n🔍 Setup failure context:');
    console.error('  - Check that PostgreSQL is running');
    console.error('  - Verify database credentials in environment variables');
    console.error('  - Ensure test database exists and is accessible');
    console.error('  - Run: node scripts/testDatabaseConnection.js');
    
    process.exit(1);
  }
};