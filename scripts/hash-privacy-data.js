/**
 * Privacy Data Hashing Script
 * 
 * This script hashes existing plaintext IP addresses and user agents
 * across all token tables to ensure GDPR compliance.
 * 
 * Tables affected:
 * - master_password_reset_tokens
 * - password_reset_tokens
 * - notifications (doesn't have IP/UA fields, but included for completeness)
 */

const database = require('../src/config/database');
const logger = require('../src/utils/logger');
const crypto = require('crypto');

// Simple hash function for IP addresses and user agents
function hashData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function hashPrivacyData() {
  try {
    console.log('🔐 Starting privacy data hashing...');
    
    // Start transaction
    await database.query('BEGIN');
    
    // 1. Hash master_password_reset_tokens
    console.log('\n📋 Processing master_password_reset_tokens...');
    const masterTokensResult = await database.query(`
      SELECT id, ip_address::text as ip_address, user_agent 
      FROM master_password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    console.log(`Found ${masterTokensResult.rows.length} master password reset tokens to process`);
    
    for (const row of masterTokensResult.rows) {
      const updates = [];
      const values = [];
      let valueIndex = 1;
      
      if (row.ip_address && row.ip_address.trim() !== '') {
        const ipHash = hashData(row.ip_address);
        updates.push(`ip_hash = $${valueIndex++}`);
        values.push(ipHash);
        console.log(`  - Hashing IP: ${row.ip_address} -> ${ipHash.substring(0, 16)}...`);
      }
      
      if (row.user_agent && row.user_agent.trim() !== '') {
        const uaHash = hashData(row.user_agent);
        updates.push(`user_agent_hash = $${valueIndex++}`);
        values.push(uaHash);
        console.log(`  - Hashing UA: ${row.user_agent.substring(0, 50)}... -> ${uaHash.substring(0, 16)}...`);
      }
      
      if (updates.length > 0) {
        values.push(row.id);
        await database.query(`
          UPDATE master_password_reset_tokens 
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${valueIndex}
        `, values);
      }
    }
    
    // 2. Hash password_reset_tokens
    console.log('\n📋 Processing password_reset_tokens...');
    const passwordTokensResult = await database.query(`
      SELECT id, ip_address::text as ip_address, user_agent 
      FROM password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    console.log(`Found ${passwordTokensResult.rows.length} password reset tokens to process`);
    
    for (const row of passwordTokensResult.rows) {
      const updates = [];
      const values = [];
      let valueIndex = 1;
      
      if (row.ip_address && row.ip_address.trim() !== '') {
        const ipHash = hashData(row.ip_address);
        updates.push(`ip_hash = $${valueIndex++}`);
        values.push(ipHash);
        console.log(`  - Hashing IP: ${row.ip_address} -> ${ipHash.substring(0, 16)}...`);
      }
      
      if (row.user_agent && row.user_agent.trim() !== '') {
        const uaHash = hashData(row.user_agent);
        updates.push(`user_agent_hash = $${valueIndex++}`);
        values.push(uaHash);
        console.log(`  - Hashing UA: ${row.user_agent.substring(0, 50)}... -> ${uaHash.substring(0, 16)}...`);
      }
      
      if (updates.length > 0) {
        values.push(row.id);
        await database.query(`
          UPDATE password_reset_tokens 
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${valueIndex}
        `, values);
      }
    }
    
    // 3. Verify all hashes were created
    console.log('\n🔍 Verifying hash completion...');
    
    const masterVerify = await database.query(`
      SELECT COUNT(*) as total,
             COUNT(ip_hash) as ip_hashed,
             COUNT(user_agent_hash) as ua_hashed
      FROM master_password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    const passwordVerify = await database.query(`
      SELECT COUNT(*) as total,
             COUNT(ip_hash) as ip_hashed,
             COUNT(user_agent_hash) as ua_hashed
      FROM password_reset_tokens 
      WHERE ip_address IS NOT NULL 
         OR (user_agent IS NOT NULL AND user_agent != '')
    `);
    
    console.log('Master Password Reset Tokens:');
    console.log(`  - Total records: ${masterVerify.rows[0].total}`);
    console.log(`  - IP addresses hashed: ${masterVerify.rows[0].ip_hashed}`);
    console.log(`  - User agents hashed: ${masterVerify.rows[0].ua_hashed}`);
    
    console.log('Password Reset Tokens:');
    console.log(`  - Total records: ${passwordVerify.rows[0].total}`);
    console.log(`  - IP addresses hashed: ${passwordVerify.rows[0].ip_hashed}`);
    console.log(`  - User agents hashed: ${passwordVerify.rows[0].ua_hashed}`);
    
    // Commit transaction
    await database.query('COMMIT');
    
    console.log('\n✅ Privacy data hashing completed successfully!');
    console.log('📝 Next step: Run the cleanup script to remove plaintext data');
    
    if (logger && logger.info) {
      logger.info('Privacy data hashing completed', {
        masterTokensProcessed: masterTokensResult.rows.length,
        passwordTokensProcessed: passwordTokensResult.rows.length
      });
    }
    
  } catch (error) {
    // Rollback on error
    try {
      await database.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Error during rollback:', rollbackError.message);
    }
    console.error('❌ Error hashing privacy data:', error.message);
    if (logger && logger.error) {
      logger.error('Failed to hash privacy data', { error: error.message });
    }
    throw error;
  }
}

// Run the script
if (require.main === module) {
  hashPrivacyData()
    .then(() => {
      console.log('🎉 Privacy data hashing script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { hashPrivacyData }; 