#!/usr/bin/env node

/**
 * Production Data Encryption Script
 * Encrypts existing 2FA secrets and phone numbers in production
 */

const database = require('../src/config/database');
const systemEncryption = require('../src/services/systemEncryptionService');

async function encryptProductionData() {
  console.log('🔐 Starting production data encryption...\n');
  
  if (!systemEncryption.isAvailable()) {
    console.error('❌ System encryption not available. Check SYSTEM_ENCRYPTION_KEY');
    process.exit(1);
  }
  
  try {
    await database.connect();
    
    // Check for unencrypted data
    const checkResult = await database.query(`
      SELECT COUNT(*) as count
      FROM users 
      WHERE (two_factor_secret IS NOT NULL AND encrypted_two_factor_secret IS NULL)
         OR (phone_number IS NOT NULL AND encrypted_phone_number IS NULL)
    `);
    
    const unencryptedCount = parseInt(checkResult.rows[0].count);
    
    if (unencryptedCount === 0) {
      console.log('✅ No unencrypted data found. All sensitive data is already encrypted!');
      await database.close();
      return;
    }
    
    console.log(`Found ${unencryptedCount} users with unencrypted data to migrate.\n`);
    
    // Get users with unencrypted data
    const usersResult = await database.query(`
      SELECT id, email, two_factor_secret, phone_number
      FROM users 
      WHERE (two_factor_secret IS NOT NULL AND encrypted_two_factor_secret IS NULL)
         OR (phone_number IS NOT NULL AND encrypted_phone_number IS NULL)
      LIMIT 100
    `);
    
    console.log(`Processing ${usersResult.rows.length} users...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of usersResult.rows) {
      try {
        const updates = [];
        const values = [user.id];
        let paramCount = 1;
        
        // Encrypt 2FA secret if present
        if (user.two_factor_secret && user.two_factor_secret.trim()) {
          const encrypted = systemEncryption.encrypt2FASecret(user.two_factor_secret);
          updates.push(`
            encrypted_two_factor_secret = $${++paramCount},
            two_factor_secret_iv = $${++paramCount},
            two_factor_secret_salt = $${++paramCount}
          `);
          values.push(encrypted.encrypted, encrypted.iv, encrypted.salt);
        }
        
        // Encrypt phone number if present
        if (user.phone_number && user.phone_number.trim()) {
          const encrypted = systemEncryption.encryptPhoneNumber(user.phone_number);
          updates.push(`
            encrypted_phone_number = $${++paramCount},
            phone_number_iv = $${++paramCount},
            phone_number_salt = $${++paramCount}
          `);
          values.push(encrypted.encrypted, encrypted.iv, encrypted.salt);
        }
        
        if (updates.length > 0) {
          await database.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $1`,
            values
          );
          
          console.log(`✓ Encrypted data for user: ${user.email}`);
          successCount++;
        }
      } catch (error) {
        console.error(`✗ Failed to encrypt data for user ${user.email}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('ENCRYPTION SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully encrypted: ${successCount} users`);
    if (errorCount > 0) {
      console.log(`❌ Failed: ${errorCount} users`);
    }
    
    // Final check
    const finalCheck = await database.query(`
      SELECT COUNT(*) as count
      FROM users 
      WHERE (two_factor_secret IS NOT NULL AND encrypted_two_factor_secret IS NULL)
         OR (phone_number IS NOT NULL AND encrypted_phone_number IS NULL)
    `);
    
    const remaining = parseInt(finalCheck.rows[0].count);
    if (remaining > 0) {
      console.log(`\n⚠️  Still ${remaining} users with unencrypted data.`);
      console.log('Run this script again to process more users.');
    } else {
      console.log('\n🎉 All sensitive data is now encrypted!');
      console.log('\nYou can now safely run migration 027 to remove plain text columns:');
      console.log('  psql $DATABASE_URL -f migrations/027_remove_legacy_plaintext_columns.sql');
    }
    
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Run if called directly
if (require.main === module) {
  encryptProductionData();
}

module.exports = encryptProductionData;