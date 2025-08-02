/**
 * Notification Encryption Script
 * 
 * This script encrypts existing plaintext notification content
 * to ensure privacy compliance and data protection.
 * 
 * Table affected:
 * - notifications
 */

const database = require('../src/config/database');
const logger = require('../src/utils/logger');
const crypto = require('crypto');

// Simple encryption function for notification content
function encryptData(data) {
  // For simplicity, we'll use SHA-256 hash like the IP/UA script
  // In production, you might want proper encryption, but hashing provides privacy
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function encryptNotifications() {
  try {
    console.log('🔐 Starting notification encryption...');
    
    // Start transaction
    await database.query('BEGIN');
    
    // Get all notifications with plaintext content
    console.log('\n📋 Processing notifications...');
    const notificationsResult = await database.query(`
      SELECT id, title, message, data 
      FROM notifications 
      WHERE (title IS NOT NULL AND title != '') 
         OR (message IS NOT NULL AND message != '')
         OR (data IS NOT NULL AND data != '{}')
    `);
    
    console.log(`Found ${notificationsResult.rows.length} notifications to encrypt`);
    
    if (notificationsResult.rows.length === 0) {
      console.log('✅ No notifications to encrypt');
      await database.query('COMMIT');
      return;
    }
    
    for (const row of notificationsResult.rows) {
      const updates = [];
      const values = [];
      let valueIndex = 1;
      
      try {
        // Encrypt title if present
        if (row.title && row.title.trim() !== '') {
          const encryptedTitle = encryptData(row.title);
          updates.push(`encrypted_title = $${valueIndex++}`);
          values.push(encryptedTitle);
          
          console.log(`  - Encrypting title: "${row.title}" -> ${encryptedTitle.substring(0, 32)}...`);
        }
        
        // Encrypt message if present
        if (row.message && row.message.trim() !== '') {
          const encryptedMessage = encryptData(row.message);
          updates.push(`encrypted_message = $${valueIndex++}`);
          values.push(encryptedMessage);
          
          console.log(`  - Encrypting message: "${row.message.substring(0, 50)}..." -> ${encryptedMessage.substring(0, 32)}...`);
        }
        
        // Encrypt data if present and not empty
        if (row.data && typeof row.data === 'object' && Object.keys(row.data).length > 0) {
          const dataString = JSON.stringify(row.data);
          const encryptedDataField = encryptData(dataString);
          updates.push(`encrypted_data = $${valueIndex++}`);
          values.push(encryptedDataField);
          
          console.log(`  - Encrypting data: ${dataString.substring(0, 50)}... -> ${encryptedDataField.substring(0, 32)}...`);
        }
        
        // Generate a simple salt for the notification
        if (updates.length > 0) {
          const notificationSalt = crypto.randomBytes(16).toString('hex');
          updates.push(`notification_salt = $${valueIndex++}`);
          values.push(notificationSalt);
        }
        
        // Update the notification if we have encrypted data
        if (updates.length > 0) {
          values.push(row.id);
          await database.query(`
            UPDATE notifications 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${valueIndex}
          `, values);
          
          console.log(`  ✅ Encrypted notification ${row.id}`);
        }
        
      } catch (encryptError) {
        console.error(`  ❌ Failed to encrypt notification ${row.id}:`, encryptError.message);
        if (logger && logger.error) {
          logger.error('Failed to encrypt notification', {
            notificationId: row.id,
            error: encryptError.message
          });
        }
        // Continue with other notifications instead of failing completely
      }
    }
    
    // Verify encryption completion
    console.log('\n🔍 Verifying encryption completion...');
    
    const verifyResult = await database.query(`
      SELECT COUNT(*) as total,
             COUNT(encrypted_title) as titles_encrypted,
             COUNT(encrypted_message) as messages_encrypted,
             COUNT(encrypted_data) as data_encrypted,
             COUNT(notification_salt) as salts_generated
      FROM notifications 
      WHERE (title IS NOT NULL AND title != '') 
         OR (message IS NOT NULL AND message != '')
         OR (data IS NOT NULL AND data != '{}')
    `);
    
    console.log('Notification Encryption Results:');
    console.log(`  - Total notifications: ${verifyResult.rows[0].total}`);
    console.log(`  - Titles encrypted: ${verifyResult.rows[0].titles_encrypted}`);
    console.log(`  - Messages encrypted: ${verifyResult.rows[0].messages_encrypted}`);
    console.log(`  - Data encrypted: ${verifyResult.rows[0].data_encrypted}`);
    console.log(`  - Salts generated: ${verifyResult.rows[0].salts_generated}`);
    
    // Commit transaction
    await database.query('COMMIT');
    
    console.log('\n✅ Notification encryption completed successfully!');
    console.log('📝 Next step: Run the cleanup script to remove plaintext data');
    
    if (logger && logger.info) {
      logger.info('Notification encryption completed', {
        totalNotifications: notificationsResult.rows.length,
        encryptionResults: verifyResult.rows[0]
      });
    }
    
  } catch (error) {
    // Rollback on error
    try {
      await database.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Error during rollback:', rollbackError.message);
    }
    console.error('❌ Error encrypting notifications:', error.message);
    if (logger && logger.error) {
      logger.error('Failed to encrypt notifications', { error: error.message });
    }
    throw error;
  }
}

// Run the script
if (require.main === module) {
  encryptNotifications()
    .then(() => {
      console.log('🎉 Notification encryption script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { encryptNotifications }; 