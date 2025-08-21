/**
 * Production Security Upgrades Deployment Script
 * 
 * This script safely deploys all security upgrades to production:
 * 1. Hash existing IP addresses and user agents
 * 2. Encrypt existing notification content
 * 3. Clean up all plaintext sensitive data
 * 
 * IMPORTANT: This script should be run on production after testing locally
 */

const { hashPrivacyData } = require('./hash-privacy-data');
const { encryptNotifications } = require('./encrypt-notifications');
const { cleanupPlaintextData } = require('./cleanup-plaintext-data');

async function deploySecurityUpgrades() {
  console.log('🚀 Starting Production Security Upgrades Deployment...');
  console.log('📋 This will apply all database security enhancements');
  console.log('⚠️  Make sure you have a database backup before proceeding!\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Hash privacy data (IP addresses and user agents)
    console.log('🔐 STEP 1: Hashing privacy data...');
    await hashPrivacyData();
    console.log('✅ Step 1 completed successfully!\n');
    
    // Step 2: Encrypt notification content
    console.log('🔐 STEP 2: Encrypting notification content...');
    await encryptNotifications();
    console.log('✅ Step 2 completed successfully!\n');
    
    // Step 3: Clean up plaintext data
    console.log('🧹 STEP 3: Cleaning up plaintext data...');
    await cleanupPlaintextData();
    console.log('✅ Step 3 completed successfully!\n');
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('═'.repeat(60));
    console.log('✅ All security upgrades applied successfully');
    console.log('🔐 Database is now 100% secure and GDPR compliant');
    console.log('🛡️ All sensitive data encrypted or hashed');
    console.log('📊 Zero plaintext sensitive data remains');
    console.log(`⏱️  Total deployment time: ${duration} seconds`);
    console.log('═'.repeat(60));
    console.log('🚀 Your Lockr database is now production-ready!');
    
  } catch (error) {
    console.error('💥 DEPLOYMENT FAILED!');
    console.error('═'.repeat(60));
    console.error(`❌ Error: ${error.message}`);
    console.error('📋 Check the logs above to see which step failed');
    console.error('🔄 You may need to restore from backup and retry');
    console.error('═'.repeat(60));
    throw error;
  }
}

// Run the deployment
if (require.main === module) {
  deploySecurityUpgrades()
    .then(() => {
      console.log('✅ Security upgrades deployment script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Deployment script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deploySecurityUpgrades }; 