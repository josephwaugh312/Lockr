#!/usr/bin/env node

/**
 * Remove Plaintext Secrets
 * Clears plaintext 2FA secrets and phone numbers from the database
 * This is a security measure since encrypted versions already exist
 */

const { Client } = require('pg');

async function removePlaintextSecrets() {
  console.log('🔒 Removing Plaintext Secrets for Security...\n');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found');
    console.log('Run with: railway run node scripts/remove-plaintext-secrets.js');
    process.exit(1);
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // First, check current status
    console.log('📊 Current Status:');
    const beforeResult = await client.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN two_factor_secret IS NOT NULL THEN 1 END) as with_plaintext_2fa,
        COUNT(CASE WHEN encrypted_two_factor_secret IS NOT NULL THEN 1 END) as with_encrypted_2fa,
        COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as with_plaintext_phone,
        COUNT(CASE WHEN encrypted_phone_number IS NOT NULL THEN 1 END) as with_encrypted_phone
      FROM users
    `);
    
    const before = beforeResult.rows[0];
    console.log(`  Users with plaintext 2FA: ${before.with_plaintext_2fa}`);
    console.log(`  Users with encrypted 2FA: ${before.with_encrypted_2fa}`);
    console.log(`  Users with plaintext phone: ${before.with_plaintext_phone}`);
    console.log(`  Users with encrypted phone: ${before.with_encrypted_phone}`);
    console.log('');
    
    // Show which users will be affected
    if (before.with_plaintext_2fa > 0) {
      const affectedResult = await client.query(`
        SELECT email, 
               CASE WHEN encrypted_two_factor_secret IS NOT NULL THEN 'YES' ELSE 'NO' END as has_encrypted
        FROM users 
        WHERE two_factor_secret IS NOT NULL
      `);
      
      console.log('⚠️  Users with plaintext 2FA secrets:');
      affectedResult.rows.forEach(user => {
        console.log(`  - ${user.email} (Has encrypted: ${user.has_encrypted})`);
      });
      console.log('');
    }
    
    // Safety check - only proceed if encrypted versions exist
    const safetyCheck = await client.query(`
      SELECT COUNT(*) as unsafe_count
      FROM users 
      WHERE two_factor_secret IS NOT NULL 
        AND encrypted_two_factor_secret IS NULL
    `);
    
    if (parseInt(safetyCheck.rows[0].unsafe_count) > 0) {
      console.error('❌ SAFETY CHECK FAILED!');
      console.error(`   Found ${safetyCheck.rows[0].unsafe_count} users with plaintext but NO encrypted 2FA`);
      console.error('   Cannot remove plaintext without encrypted backup!');
      process.exit(1);
    }
    
    // Clear plaintext 2FA secrets
    console.log('🔧 Clearing plaintext 2FA secrets...');
    const clear2FAResult = await client.query(`
      UPDATE users 
      SET two_factor_secret = NULL 
      WHERE two_factor_secret IS NOT NULL
      RETURNING email
    `);
    
    if (clear2FAResult.rows.length > 0) {
      console.log(`  ✅ Cleared plaintext 2FA for ${clear2FAResult.rows.length} users:`);
      clear2FAResult.rows.forEach(user => {
        console.log(`     - ${user.email}`);
      });
    } else {
      console.log('  ℹ️  No plaintext 2FA secrets to clear');
    }
    
    // Clear plaintext phone numbers
    console.log('\n🔧 Clearing plaintext phone numbers...');
    const clearPhoneResult = await client.query(`
      UPDATE users 
      SET phone_number = NULL 
      WHERE phone_number IS NOT NULL
      RETURNING email
    `);
    
    if (clearPhoneResult.rows.length > 0) {
      console.log(`  ✅ Cleared plaintext phone for ${clearPhoneResult.rows.length} users`);
    } else {
      console.log('  ℹ️  No plaintext phone numbers to clear');
    }
    
    // Final verification
    console.log('\n📊 Final Status:');
    const afterResult = await client.query(`
      SELECT 
        COUNT(CASE WHEN two_factor_secret IS NOT NULL THEN 1 END) as remaining_plaintext_2fa,
        COUNT(CASE WHEN phone_number IS NOT NULL THEN 1 END) as remaining_plaintext_phone,
        COUNT(CASE WHEN encrypted_two_factor_secret IS NOT NULL THEN 1 END) as encrypted_2fa_count
      FROM users
    `);
    
    const after = afterResult.rows[0];
    console.log(`  Remaining plaintext 2FA: ${after.remaining_plaintext_2fa}`);
    console.log(`  Remaining plaintext phones: ${after.remaining_plaintext_phone}`);
    console.log(`  Users with encrypted 2FA: ${after.encrypted_2fa_count}`);
    
    if (after.remaining_plaintext_2fa === '0' && after.remaining_plaintext_phone === '0') {
      console.log('\n✅ SUCCESS! All plaintext secrets have been removed.');
      console.log('🔒 Your database is now more secure.');
      console.log('\n📝 Next steps:');
      console.log('1. Test 2FA login to ensure it still works');
      console.log('2. Consider dropping the legacy columns entirely');
      console.log('   Run: node scripts/drop-legacy-columns.js');
    } else {
      console.log('\n⚠️  Some plaintext data remains. Check logs above.');
    }
    
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  removePlaintextSecrets();
}

module.exports = removePlaintextSecrets;