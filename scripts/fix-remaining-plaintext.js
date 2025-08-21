/**
 * Fix remaining plaintext data in password_reset_tokens table
 * This script hashes any remaining plaintext IP addresses and user agents
 */

const database = require('../src/config/database');
const crypto = require('crypto');

async function hashRemainingPlaintextData() {
  let client;
  
  try {
    client = await database.connect();
    console.log('🔍 Checking for remaining plaintext data in password_reset_tokens...');
    
    // Find entries with plaintext IP/user agent but empty hash fields
    // Cast ip_address to text to handle inet type properly
    const result = await client.query(`
      SELECT id, ip_address::text as ip_address, user_agent 
      FROM password_reset_tokens 
      WHERE (ip_address IS NOT NULL AND ip_address::text != '' AND (ip_hash IS NULL OR ip_hash = ''))
         OR (user_agent IS NOT NULL AND user_agent != '' AND (user_agent_hash IS NULL OR user_agent_hash = ''))
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ No remaining plaintext data found!');
      return;
    }
    
    console.log(`📊 Found ${result.rows.length} entries with plaintext data to hash`);
    
    for (const row of result.rows) {
      console.log(`🔐 Processing entry ${row.id}...`);
      
      let ipHash = null;
      let userAgentHash = null;
      
      // Hash IP address if present
      if (row.ip_address && row.ip_address.trim() !== '') {
        ipHash = crypto.createHash('sha256').update(row.ip_address.trim()).digest('hex');
        console.log(`  📍 IP: ${row.ip_address.substring(0, 15)}... → ${ipHash.substring(0, 16)}...`);
      }
      
      // Hash user agent if present
      if (row.user_agent && row.user_agent.trim() !== '') {
        userAgentHash = crypto.createHash('sha256').update(row.user_agent.trim()).digest('hex');
        console.log(`  🌐 User Agent: ${row.user_agent.substring(0, 30)}... → ${userAgentHash.substring(0, 16)}...`);
      }
      
      // Update the database
      await client.query(`
        UPDATE password_reset_tokens 
        SET ip_hash = $1, user_agent_hash = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [ipHash, userAgentHash, row.id]);
      
      console.log(`  ✅ Entry ${row.id} updated successfully`);
    }
    
    console.log('🎉 All remaining plaintext data has been hashed!');
    
  } catch (error) {
    console.error('❌ Error hashing remaining plaintext data:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the script
hashRemainingPlaintextData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 