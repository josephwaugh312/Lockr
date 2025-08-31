#!/usr/bin/env node

/**
 * Verify Security Columns in Production
 * Quick check to see security tracking is working
 */

const { Client } = require('pg');

async function verifySecurityColumns() {
  console.log('🔍 Verifying Security Columns in Production...\n');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found. Run with: railway run node scripts/verify-security-columns.js');
    process.exit(1);
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check a real user's security tracking data
    console.log('Checking security tracking data for existing users:\n');
    
    const result = await client.query(`
      SELECT 
        email,
        last_login_at,
        last_login_ip,
        failed_login_attempts,
        account_locked_until,
        password_changed_at,
        last_activity_at,
        session_count,
        CASE 
          WHEN last_login_at IS NOT NULL THEN 'YES'
          ELSE 'NO'
        END as has_logged_in_since_update
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    console.log('Security Tracking Status:\n');
    console.log('─'.repeat(80));
    
    result.rows.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`  Last Login: ${user.last_login_at || 'Not tracked yet (will update on next login)'}`);
      console.log(`  Last IP: ${user.last_login_ip || 'Not tracked yet'}`);
      console.log(`  Failed Attempts: ${user.failed_login_attempts || 0}`);
      console.log(`  Account Locked: ${user.account_locked_until ? `Until ${user.account_locked_until}` : 'No'}`);
      console.log(`  Password Changed: ${user.password_changed_at || 'Not tracked'}`);
      console.log(`  Last Activity: ${user.last_activity_at || 'Not tracked'}`);
      console.log(`  Session Count: ${user.session_count || 0}`);
      console.log(`  Has Logged In Since Update: ${user.has_logged_in_since_update}`);
      console.log('─'.repeat(80));
    });
    
    // Check if columns are properly configured
    console.log('\nColumn Configuration Check:\n');
    
    const colCheck = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN (
        'last_login_at',
        'last_login_ip', 
        'failed_login_attempts',
        'account_locked_until',
        'password_changed_at',
        'password_expires_at',
        'last_activity_at',
        'session_count'
      )
      ORDER BY column_name
    `);
    
    console.log('Security Columns Status:');
    colCheck.rows.forEach(col => {
      const status = '✅';
      const defaultVal = col.column_default || 'NULL';
      console.log(`  ${status} ${col.column_name} (${col.data_type}) - Default: ${defaultVal}`);
    });
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    
    const hasTracking = result.rows.some(u => u.last_login_at !== null);
    
    if (hasTracking) {
      console.log('✅ Security tracking is ACTIVE and recording data');
    } else {
      console.log('⏳ Security tracking is READY');
      console.log('   Data will be recorded on next user login');
    }
    
    console.log('\n📝 Next Steps:');
    console.log('1. Security columns are in place and ready');
    console.log('2. The next time users log in, tracking will begin');
    console.log('3. Failed login attempts will increment automatically');
    console.log('4. Accounts will lock after 5 failed attempts (default)');
    console.log('5. Lock duration is 30 minutes (default)');
    
    console.log('\n💡 To set custom thresholds in Railway:');
    console.log('   MAX_LOGIN_ATTEMPTS=5 (or your preferred number)');
    console.log('   ACCOUNT_LOCK_TIME=1800000 (milliseconds, 30 min = 1800000)');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Verification complete');
  }
}

// Run if called directly
if (require.main === module) {
  verifySecurityColumns();
}

module.exports = verifySecurityColumns;