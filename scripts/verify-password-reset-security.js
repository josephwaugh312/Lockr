/**
 * Verify password_reset_tokens table security status
 */

const database = require('../src/config/database');

async function verifyPasswordResetSecurity() {
  try {
    const result = await database.query(`
      SELECT 
        id,
        ip_address::text as ip_address,
        user_agent,
        ip_hash,
        user_agent_hash,
        created_at
      FROM password_reset_tokens 
      ORDER BY created_at DESC
    `);
    
    console.log('🔍 Password Reset Tokens Security Status:');
    console.log('==========================================');
    
    for (const row of result.rows) {
      console.log(`\n📋 Entry: ${row.id}`);
      console.log(`   📅 Created: ${row.created_at}`);
      console.log(`   📍 IP Address: ${row.ip_address || 'NULL'}`);
      console.log(`   🌐 User Agent: ${row.user_agent ? row.user_agent.substring(0, 50) + '...' : 'NULL'}`);
      console.log(`   🔐 IP Hash: ${row.ip_hash ? row.ip_hash.substring(0, 16) + '...' : 'NULL'}`);
      console.log(`   🔐 User Agent Hash: ${row.user_agent_hash ? row.user_agent_hash.substring(0, 16) + '...' : 'NULL'}`);
      
      // Check security status
      const hasPlaintextIP = row.ip_address && row.ip_address.trim() !== '';
      const hasPlaintextUserAgent = row.user_agent && row.user_agent.trim() !== '';
      const hasIPHash = row.ip_hash && row.ip_hash.trim() !== '';
      const hasUserAgentHash = row.user_agent_hash && row.user_agent_hash.trim() !== '';
      
      if (hasPlaintextIP && !hasIPHash) {
        console.log(`   ⚠️  SECURITY ISSUE: Plaintext IP without hash`);
      } else if (hasPlaintextUserAgent && !hasUserAgentHash) {
        console.log(`   ⚠️  SECURITY ISSUE: Plaintext User Agent without hash`);
      } else {
        console.log(`   ✅ SECURE: Properly hashed or no sensitive data`);
      }
    }
    
    console.log('\n🎯 Summary:');
    console.log(`   Total entries: ${result.rows.length}`);
    
    const insecureEntries = result.rows.filter(row => {
      const hasPlaintextIP = row.ip_address && row.ip_address.trim() !== '';
      const hasPlaintextUserAgent = row.user_agent && row.user_agent.trim() !== '';
      const hasIPHash = row.ip_hash && row.ip_hash.trim() !== '';
      const hasUserAgentHash = row.user_agent_hash && row.user_agent_hash.trim() !== '';
      
      return (hasPlaintextIP && !hasIPHash) || (hasPlaintextUserAgent && !hasUserAgentHash);
    });
    
    console.log(`   Insecure entries: ${insecureEntries.length}`);
    
    if (insecureEntries.length === 0) {
      console.log('   🎉 ALL ENTRIES ARE SECURE!');
    } else {
      console.log('   ⚠️  Some entries need attention');
    }
    
  } catch (error) {
    console.error('❌ Error verifying security:', error);
  }
}

verifyPasswordResetSecurity()
  .then(() => {
    console.log('\n✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }); 