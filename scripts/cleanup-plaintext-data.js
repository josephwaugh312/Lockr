/**
 * Plaintext Data Cleanup Script
 * 
 * This script safely removes plaintext data after encryption/hashing
 * to complete the privacy and security upgrades.
 * 
 * IMPORTANT: Only run this after verifying that encryption/hashing worked correctly!
 * 
 * Tables affected:
 * - master_password_reset_tokens (clear ip_address, user_agent)
 * - password_reset_tokens (clear ip_address, user_agent)
 * - notifications (clear title, message, data)
 */

const database = require('../src/config/database');
const logger = require('../src/utils/logger');

async function cleanupPlaintextData() {
  try {
    console.log('🧹 Starting plaintext data cleanup...');
    console.log('⚠️  WARNING: This will permanently remove plaintext data!');
    console.log('📋 Make sure encryption/hashing was completed successfully first.');
    
    // Verify that hashes/encryption exist before cleanup
    console.log('\n🔍 Verifying encryption/hashing completion...');
    
    // Check master_password_reset_tokens
    const masterTokenCheck = await database.query(`
      SELECT COUNT(*) as total,
             COUNT(ip_hash) as ip_hashed,
             COUNT(user_agent_hash) as ua_hashed
      FROM master_password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    // Check password_reset_tokens
    const passwordTokenCheck = await database.query(`
      SELECT COUNT(*) as total,
             COUNT(ip_hash) as ip_hashed,
             COUNT(user_agent_hash) as ua_hashed
      FROM password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    // Check notifications
    const notificationCheck = await database.query(`
      SELECT COUNT(*) as total,
             COUNT(encrypted_title) as titles_encrypted,
             COUNT(encrypted_message) as messages_encrypted,
             COUNT(notification_salt) as salts_generated
      FROM notifications 
      WHERE (title IS NOT NULL AND title != '') 
         OR (message IS NOT NULL AND message != '')
    `);
    
    console.log('Pre-cleanup verification:');
    console.log(`Master Password Reset Tokens: ${masterTokenCheck.rows[0].total} total, ${masterTokenCheck.rows[0].ip_hashed} IP hashed, ${masterTokenCheck.rows[0].ua_hashed} UA hashed`);
    console.log(`Password Reset Tokens: ${passwordTokenCheck.rows[0].total} total, ${passwordTokenCheck.rows[0].ip_hashed} IP hashed, ${passwordTokenCheck.rows[0].ua_hashed} UA hashed`);
    console.log(`Notifications: ${notificationCheck.rows[0].total} total, ${notificationCheck.rows[0].titles_encrypted} titles encrypted, ${notificationCheck.rows[0].messages_encrypted} messages encrypted`);
    
    // Verify that we have sufficient encryption/hashing before proceeding
    const totalTokens = parseInt(masterTokenCheck.rows[0].total) + parseInt(passwordTokenCheck.rows[0].total);
    const totalHashed = parseInt(masterTokenCheck.rows[0].ip_hashed) + parseInt(passwordTokenCheck.rows[0].ip_hashed);
    const notificationTotal = parseInt(notificationCheck.rows[0].total);
    const notificationEncrypted = parseInt(notificationCheck.rows[0].titles_encrypted) + parseInt(notificationCheck.rows[0].messages_encrypted);
    
    if (totalTokens > 0 && totalHashed === 0) {
      throw new Error('No IP/User Agent hashes found! Run the hashing script first.');
    }
    
    if (notificationTotal > 0 && notificationEncrypted === 0) {
      throw new Error('No encrypted notifications found! Run the encryption script first.');
    }
    
    console.log('\n✅ Verification passed. Proceeding with cleanup...');
    
    // Start transaction
    await database.query('BEGIN');
    
    // 1. Clear plaintext IP addresses and user agents from master_password_reset_tokens
    console.log('\n📋 Cleaning master_password_reset_tokens...');
    const masterResult = await database.query(`
      UPDATE master_password_reset_tokens 
      SET ip_address = NULL, 
          user_agent = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
      RETURNING id
    `);
    
    console.log(`  ✅ Cleared plaintext data from ${masterResult.rows.length} master password reset tokens`);
    
    // 2. Clear plaintext IP addresses and user agents from password_reset_tokens
    console.log('\n📋 Cleaning password_reset_tokens...');
    const passwordResult = await database.query(`
      UPDATE password_reset_tokens 
      SET ip_address = NULL, 
          user_agent = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
      RETURNING id
    `);
    
    console.log(`  ✅ Cleared plaintext data from ${passwordResult.rows.length} password reset tokens`);
    
    // 3. Clear plaintext notification content
    console.log('\n📋 Cleaning notifications...');
    const notificationResult = await database.query(`
      UPDATE notifications 
      SET title = '', 
          message = '',
          data = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE (title IS NOT NULL AND title != '') 
         OR (message IS NOT NULL AND message != '')
         OR (data IS NOT NULL AND data != '{}')
      RETURNING id
    `);
    
    console.log(`  ✅ Cleared plaintext data from ${notificationResult.rows.length} notifications`);
    
    // 4. Final verification - ensure no plaintext data remains
    console.log('\n🔍 Final verification...');
    
    const finalMasterCheck = await database.query(`
      SELECT COUNT(*) as remaining
      FROM master_password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    const finalPasswordCheck = await database.query(`
      SELECT COUNT(*) as remaining
      FROM password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    const finalNotificationCheck = await database.query(`
      SELECT COUNT(*) as remaining
      FROM notifications 
      WHERE (title IS NOT NULL AND title != '') 
         OR (message IS NOT NULL AND message != '')
    `);
    
    const remainingTotal = parseInt(finalMasterCheck.rows[0].remaining) + 
                          parseInt(finalPasswordCheck.rows[0].remaining) + 
                          parseInt(finalNotificationCheck.rows[0].remaining);
    
    console.log('Final verification results:');
    console.log(`  - Master password reset tokens with plaintext: ${finalMasterCheck.rows[0].remaining}`);
    console.log(`  - Password reset tokens with plaintext: ${finalPasswordCheck.rows[0].remaining}`);
    console.log(`  - Notifications with plaintext: ${finalNotificationCheck.rows[0].remaining}`);
    console.log(`  - Total remaining plaintext records: ${remainingTotal}`);
    
    if (remainingTotal > 0) {
      throw new Error(`Cleanup incomplete! ${remainingTotal} plaintext records still remain.`);
    }
    
    // Commit transaction
    await database.query('COMMIT');
    
    console.log('\n🎉 Plaintext data cleanup completed successfully!');
    console.log('✅ All sensitive data is now properly encrypted or hashed');
    console.log('🔐 Database privacy and security upgrades are complete');
    
    if (logger && logger.info) {
      logger.info('Plaintext data cleanup completed', {
        masterTokensCleaned: masterResult.rows.length,
        passwordTokensCleaned: passwordResult.rows.length,
        notificationsCleaned: notificationResult.rows.length,
        totalRecordsCleaned: masterResult.rows.length + passwordResult.rows.length + notificationResult.rows.length
      });
    }
    
  } catch (error) {
    // Rollback on error
    try {
      await database.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Error during rollback:', rollbackError.message);
    }
    console.error('❌ Error during cleanup:', error.message);
    if (logger && logger.error) {
      logger.error('Failed to cleanup plaintext data', { error: error.message });
    }
    throw error;
  }
}

// Run the script
if (require.main === module) {
  cleanupPlaintextData()
    .then(() => {
      console.log('🎉 Plaintext data cleanup script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupPlaintextData }; 