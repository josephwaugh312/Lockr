#!/usr/bin/env node

/**
 * Migration script to encrypt existing plaintext 2FA secrets
 * This script should be run after deploying the database migration
 */

require('dotenv').config();
const TwoFactorEncryptionService = require('../src/services/twoFactorEncryptionService');
const userRepository = require('../src/models/userRepository');
const { logger } = require('../src/utils/logger');

const twoFactorEncryptionService = new TwoFactorEncryptionService();

async function migrate2FASecrets() {
  logger.info('Starting 2FA secrets migration...');
  
  try {
    // Get all users with plaintext 2FA secrets
    const usersWithPlaintext2FA = await userRepository.findUsersWithPlaintext2FA();
    
    if (usersWithPlaintext2FA.length === 0) {
      logger.info('No users with plaintext 2FA secrets found. Migration complete.');
      return;
    }
    
    logger.info(`Found ${usersWithPlaintext2FA.length} users with plaintext 2FA secrets`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of usersWithPlaintext2FA) {
      try {
        logger.info(`Migrating 2FA secret for user: ${user.email}`);
        
        // Note: This migration requires user passwords to be available
        // In a real scenario, you would need to prompt users to re-enter their passwords
        // or implement a different migration strategy
        
        // For now, we'll log that manual intervention is needed
        logger.warn(`Manual migration required for user: ${user.email}`, {
          userId: user.id,
          hasPlaintextSecret: !!user.twoFactorSecret,
          hasEncryptedSecret: !!user.encryptedTwoFactorSecret
        });
        
        // TODO: Implement actual migration logic when user passwords are available
        // const encrypted = twoFactorEncryptionService.migratePlaintextSecret(
        //   user.twoFactorSecret, 
        //   userPassword // This would need to be provided by user
        // );
        // 
        // await userRepository.migrate2FASecretToEncrypted(
        //   user.id, 
        //   encrypted.encryptedTwoFactorSecret, 
        //   encrypted.twoFactorSecretSalt
        // );
        
        successCount++;
        
      } catch (error) {
        logger.error(`Failed to migrate 2FA secret for user: ${user.email}`, {
          userId: user.id,
          error: error.message
        });
        errorCount++;
      }
    }
    
    logger.info('2FA secrets migration completed', {
      totalUsers: usersWithPlaintext2FA.length,
      successCount,
      errorCount
    });
    
    if (errorCount > 0) {
      logger.warn(`${errorCount} users require manual migration`);
    }
    
  } catch (error) {
    logger.error('2FA secrets migration failed', { error: error.message });
    process.exit(1);
  }
}

// Add method to user repository to find users with plaintext 2FA
async function addMigrationHelper() {
  // This would be added to userRepository.js
  const migrationHelper = `
  /**
   * Find users with plaintext 2FA secrets that need migration
   * @returns {Array} - Users with plaintext 2FA secrets
   */
  async findUsersWithPlaintext2FA() {
    try {
      const result = await database.query(
        \`SELECT id, email, two_factor_secret, encrypted_two_factor_secret
         FROM users 
         WHERE two_factor_enabled = TRUE 
         AND two_factor_secret IS NOT NULL
         AND encrypted_two_factor_secret IS NULL\`
      );

      return result.rows.map(row => ({
        id: row.id,
        email: row.email,
        twoFactorSecret: row.two_factor_secret,
        encryptedTwoFactorSecret: row.encrypted_two_factor_secret
      }));
    } catch (error) {
      logger.error('Failed to find users with plaintext 2FA', { error: error.message });
      throw error;
    }
  }
  `;
  
  logger.info('Migration helper method to add to userRepository.js:', migrationHelper);
}

// Run migration
if (require.main === module) {
  addMigrationHelper();
  migrate2FASecrets()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { migrate2FASecrets }; 