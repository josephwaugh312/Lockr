/**
 * Script to clear plaintext phone numbers from the database
 * This ensures all phone numbers are properly encrypted
 */

const database = require('../src/config/database');
const logger = require('../src/utils/logger');

async function clearPlaintextPhoneNumbers() {
  try {
    console.log('🔍 Checking for plaintext phone numbers...');
    
    // Find all users with plaintext phone numbers
    const result = await database.query(
      `SELECT id, email, phone_number 
       FROM users 
       WHERE phone_number IS NOT NULL 
       AND phone_number != ''`
    );

    if (result.rows.length === 0) {
      console.log('✅ No plaintext phone numbers found');
      return;
    }

    console.log(`📱 Found ${result.rows.length} users with plaintext phone numbers:`);
    
    for (const user of result.rows) {
      console.log(`  - ${user.email}: ${user.phone_number}`);
    }

    // Clear all plaintext phone numbers
    const clearResult = await database.query(
      `UPDATE users 
       SET phone_number = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE phone_number IS NOT NULL 
       AND phone_number != ''`
    );

    console.log(`✅ Cleared ${clearResult.rowCount} plaintext phone numbers`);
    
    // Verify they're cleared
    const verifyResult = await database.query(
      `SELECT COUNT(*) as count 
       FROM users 
       WHERE phone_number IS NOT NULL 
       AND phone_number != ''`
    );

    const remainingCount = parseInt(verifyResult.rows[0].count);
    if (remainingCount === 0) {
      console.log('✅ All plaintext phone numbers have been cleared');
    } else {
      console.log(`⚠️  Warning: ${remainingCount} plaintext phone numbers still remain`);
    }

  } catch (error) {
    console.error('❌ Error clearing plaintext phone numbers:', error.message);
    logger.error('Failed to clear plaintext phone numbers', { error: error.message });
  }
}

// Run the script
clearPlaintextPhoneNumbers(); 