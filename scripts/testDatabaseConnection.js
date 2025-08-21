#!/usr/bin/env node

/**
 * Database Connection Diagnostic Script
 * Tests database connectivity before running the full test suite
 */

const { Pool } = require('pg');

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  // Use the same configuration as tests
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'lockr_test',
    user: process.env.DB_USER || 'lockr_user',
    password: process.env.DB_PASSWORD || 'lockr_test_password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000, // 5 second timeout
    max: 2 // Minimal pool for testing
  };

  console.log('Database config:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl
  });

  const pool = new Pool(config);
  
  try {
    console.log('Attempting connection...');
    const startTime = Date.now();
    
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    
    console.log(`✅ Connected in ${connectTime}ms`);
    
    // Test basic query
    const queryStart = Date.now();
    const result = await client.query('SELECT NOW() as current_time, version()');
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executed in ${queryTime}ms`);
    console.log('Database version:', result.rows[0].version.split(' ').slice(0, 2).join(' '));
    console.log('Current time:', result.rows[0].current_time);
    
    // Test table access
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log(`✅ Found ${tablesResult.rows.length} tables:`);
      tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    } catch (tableError) {
      console.warn('⚠️  Could not query tables:', tableError.message);
    }
    
    client.release();
    
    // Test connection pool
    console.log('Testing connection pool...');
    const poolStart = Date.now();
    
    const promises = Array(5).fill(null).map(async (_, i) => {
      const client = await pool.connect();
      await client.query('SELECT $1 as test_value', [i]);
      client.release();
      return i;
    });
    
    await Promise.all(promises);
    const poolTime = Date.now() - poolStart;
    
    console.log(`✅ Pool test completed in ${poolTime}ms`);
    
    await pool.end();
    
    console.log('🎉 Database connection test passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('  1. Is PostgreSQL running?');
      console.error('  2. Is it listening on the correct port?');
      console.error('  3. Check: sudo systemctl status postgresql (Linux) or brew services list (Mac)');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed:');
      console.error('  1. Check username and password');
      console.error('  2. Verify user has access to the database');
    } else if (error.code === '3D000') {
      console.error('\n💡 Database does not exist:');
      console.error('  1. Create the test database');
      console.error('  2. Run: CREATE DATABASE lockr_test;');
    }
    
    await pool.end().catch(() => {}); // Ignore cleanup errors
    return false;
  }
}

// Run the test
if (require.main === module) {
  testDatabaseConnection()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = testDatabaseConnection;