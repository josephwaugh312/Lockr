#!/usr/bin/env node

/**
 * Hotfix: Add security tracking columns to the ACTUAL users table
 * 
 * This fixes the schema mismatch where migrations created columns
 * in lockr_schema.users but the app uses public.users
 */

// Use direct pg client for Railway deployment
const { Client } = require('pg');

async function applyHotfix() {
  console.log('🔧 Applying Security Columns Hotfix...\n');
  
  // Use DATABASE_URL for Railway deployment
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found. Are you connected to Railway?');
    process.exit(1);
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to Railway database\n');
    
    // First, let's be EXPLICIT about which table we're updating
    console.log('Target: public.users table (the one your app actually uses)\n');
    
    // Check current state
    const currentColumns = await client.query(`
      SELECT column_name 
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
    `);
    
    const existingCols = currentColumns.rows.map(r => r.column_name);
    console.log('Existing security columns:', existingCols.length ? existingCols : 'None');
    
    // Define columns to add
    const columnsToAdd = [
      { name: 'last_login_at', definition: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'last_login_ip', definition: 'VARCHAR(45)' },
      { name: 'failed_login_attempts', definition: 'INTEGER DEFAULT 0' },
      { name: 'account_locked_until', definition: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'password_changed_at', definition: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'password_expires_at', definition: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'last_activity_at', definition: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'session_count', definition: 'INTEGER DEFAULT 0' }
    ];
    
    // Add missing columns
    console.log('\nAdding missing columns...');
    for (const col of columnsToAdd) {
      if (!existingCols.includes(col.name)) {
        try {
          await client.query(`
            ALTER TABLE public.users 
            ADD COLUMN IF NOT EXISTS ${col.name} ${col.definition}
          `);
          console.log(`✅ Added ${col.name}`);
        } catch (error) {
          console.log(`❌ Failed to add ${col.name}: ${error.message}`);
        }
      } else {
        console.log(`✓ ${col.name} already exists`);
      }
    }
    
    // Add indexes for performance
    console.log('\nAdding indexes...');
    const indexes = [
      {
        name: 'idx_users_last_login_at',
        definition: 'CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON public.users(last_login_at DESC) WHERE last_login_at IS NOT NULL'
      },
      {
        name: 'idx_users_account_locked',
        definition: 'CREATE INDEX IF NOT EXISTS idx_users_account_locked ON public.users(account_locked_until) WHERE account_locked_until IS NOT NULL'
      },
      {
        name: 'idx_users_failed_logins',
        definition: 'CREATE INDEX IF NOT EXISTS idx_users_failed_logins ON public.users(failed_login_attempts) WHERE failed_login_attempts > 0'
      }
    ];
    
    for (const idx of indexes) {
      try {
        await client.query(idx.definition);
        console.log(`✅ Index ${idx.name} created`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`✓ Index ${idx.name} already exists`);
        } else {
          console.log(`❌ Failed to create ${idx.name}: ${error.message}`);
        }
      }
    }
    
    // Verify the fix
    console.log('\n📊 Verification:');
    const finalCheck = await client.query(`
      SELECT COUNT(*) as col_count
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
    `);
    
    console.log(`Security columns in public.users: ${finalCheck.rows[0].col_count}/8`);
    
    if (finalCheck.rows[0].col_count === '8') {
      console.log('\n✅ Hotfix complete! All security tracking columns are now in place.');
      console.log('Your app can now use the security features properly.');
    } else {
      console.log('\n⚠️  Some columns may be missing. Check logs above for errors.');
    }
    
    // Clean up the duplicate table (optional - commented out for safety)
    console.log('\n💡 Note: There\'s still a duplicate users table in lockr_schema.');
    console.log('This can be cleaned up later if needed, but it\'s not causing harm.');
    
  } catch (error) {
    console.error('❌ Hotfix failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the hotfix
applyHotfix();