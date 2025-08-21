#!/usr/bin/env node

/**
 * Global Test Teardown
 * Runs after all Jest tests complete to clean up resources
 */

module.exports = async function globalTeardown() {
  console.log('🧹 Global test teardown starting...');
  const startTime = Date.now();
  
  try {
    // Get setup result if available
    const setupResult = global.__TEST_SETUP_RESULT__;
    
    if (setupResult) {
      console.log(`   Initial setup took ${setupResult.duration}ms`);
      console.log(`   Processed ${setupResult.tables?.length || 0} tables`);
    }
    
    // Close database connections
    try {
      const database = require('../src/config/database');
      await database.close();
      console.log('   Database connections closed');
    } catch (error) {
      // Database might not be initialized
      console.log('   Database already closed or not initialized');
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('   Garbage collection forced');
    }
    
    // Give time for any remaining async operations
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const duration = Date.now() - startTime;
    console.log(`✅ Global test teardown completed in ${duration}ms`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Global teardown failed after ${duration}ms:`, error.message);
    // Don't exit with error code - tests already completed
  }
};