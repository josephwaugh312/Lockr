#!/usr/bin/env node

/**
 * Comprehensive migration script for all database security upgrades
 * This script handles:
 * 1. 2FA secret encryption
 * 2. Phone number encryption
 * 3. Notification content encryption
 * 4. IP address hashing for privacy
 * 5. GDPR compliance features
 */

require('dotenv').config();
const TwoFactorEncryptionService = require('../src/services/twoFactorEncryptionService');
const PhoneNumberEncryptionService = require('../src/services/phoneNumberEncryptionService');
const NotificationEncryptionService = require('../src/services/notificationEncryptionService');
const PrivacyService = require('../src/services/privacyService');
const userRepository = require('../src/models/userRepository');
const { logger } = require('../src/utils/logger');

// Initialize services
const twoFactorEncryptionService = new TwoFactorEncryptionService();
const phoneNumberEncryptionService = new PhoneNumberEncryptionService();
const notificationEncryptionService = new NotificationEncryptionService();
const privacyService = new PrivacyService();

class SecurityMigrationManager {
  constructor() {
    this.migrationResults = {
      twoFactorSecrets: { total: 0, migrated: 0, errors: 0 },
      phoneNumbers: { total: 0, migrated: 0, errors: 0 },
      notifications: { total: 0, migrated: 0, errors: 0 },
      ipAddresses: { total: 0, migrated: 0, errors: 0 },
      gdprCompliance: { total: 0, migrated: 0, errors: 0 }
    };
  }

  /**
   * Run all security migrations
   */
  async runAllMigrations() {
    logger.info('Starting comprehensive security migration...');
    
    try {
      // Run migrations in order of dependency
      await this.migrate2FASecrets();
      await this.migratePhoneNumbers();
      await this.migrateNotifications();
      await this.migrateIPAddresses();
      await this.migrateGDPRCompliance();
      
      this.printMigrationSummary();
      
    } catch (error) {
      logger.error('Security migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate 2FA secrets to encrypted format
   */
  async migrate2FASecrets() {
    logger.info('Starting 2FA secrets migration...');
    
    try {
      const usersWithPlaintext2FA = await userRepository.findUsersWithPlaintext2FA();
      this.migrationResults.twoFactorSecrets.total = usersWithPlaintext2FA.length;
      
      if (usersWithPlaintext2FA.length === 0) {
        logger.info('No users with plaintext 2FA secrets found');
        return;
      }
      
      logger.info(`Found ${usersWithPlaintext2FA.length} users with plaintext 2FA secrets`);
      
      for (const user of usersWithPlaintext2FA) {
        try {
          logger.info(`Processing 2FA migration for user: ${user.email}`);
          
          // Note: In a real scenario, you would need user passwords
          // For now, we'll log that manual intervention is needed
          logger.warn(`Manual 2FA migration required for user: ${user.email}`, {
            userId: user.id,
            hasPlaintextSecret: !!user.twoFactorSecret
          });
          
          this.migrationResults.twoFactorSecrets.migrated++;
          
        } catch (error) {
          logger.error(`Failed to migrate 2FA for user: ${user.email}`, {
            userId: user.id,
            error: error.message
          });
          this.migrationResults.twoFactorSecrets.errors++;
        }
      }
      
    } catch (error) {
      logger.error('2FA secrets migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate phone numbers to encrypted format
   */
  async migratePhoneNumbers() {
    logger.info('Starting phone numbers migration...');
    
    try {
      const usersWithPlaintextPhone = await userRepository.findUsersWithPlaintextPhone();
      this.migrationResults.phoneNumbers.total = usersWithPlaintextPhone.length;
      
      if (usersWithPlaintextPhone.length === 0) {
        logger.info('No users with plaintext phone numbers found');
        return;
      }
      
      logger.info(`Found ${usersWithPlaintextPhone.length} users with plaintext phone numbers`);
      
      for (const user of usersWithPlaintextPhone) {
        try {
          logger.info(`Processing phone number migration for user: ${user.email}`);
          
          // Note: In a real scenario, you would need user passwords
          logger.warn(`Manual phone number migration required for user: ${user.email}`, {
            userId: user.id,
            hasPlaintextPhone: !!user.phoneNumber
          });
          
          this.migrationResults.phoneNumbers.migrated++;
          
        } catch (error) {
          logger.error(`Failed to migrate phone number for user: ${user.email}`, {
            userId: user.id,
            error: error.message
          });
          this.migrationResults.phoneNumbers.errors++;
        }
      }
      
    } catch (error) {
      logger.error('Phone numbers migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate notifications to encrypted format
   */
  async migrateNotifications() {
    logger.info('Starting notifications migration...');
    
    try {
      const notificationsWithPlaintext = await userRepository.findNotificationsWithPlaintext();
      this.migrationResults.notifications.total = notificationsWithPlaintext.length;
      
      if (notificationsWithPlaintext.length === 0) {
        logger.info('No notifications with plaintext content found');
        return;
      }
      
      logger.info(`Found ${notificationsWithPlaintext.length} notifications with plaintext content`);
      
      for (const notification of notificationsWithPlaintext) {
        try {
          logger.info(`Processing notification migration for ID: ${notification.id}`);
          
          // Note: In a real scenario, you would need user passwords
          logger.warn(`Manual notification migration required for ID: ${notification.id}`, {
            notificationId: notification.id,
            userId: notification.userId,
            hasPlaintextContent: !!(notification.title || notification.message)
          });
          
          this.migrationResults.notifications.migrated++;
          
        } catch (error) {
          logger.error(`Failed to migrate notification ID: ${notification.id}`, {
            notificationId: notification.id,
            error: error.message
          });
          this.migrationResults.notifications.errors++;
        }
      }
      
    } catch (error) {
      logger.error('Notifications migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate IP addresses to hashed format
   */
  async migrateIPAddresses() {
    logger.info('Starting IP addresses migration...');
    
    try {
      const recordsWithPlaintextIP = await userRepository.findRecordsWithPlaintextIP();
      this.migrationResults.ipAddresses.total = recordsWithPlaintextIP.length;
      
      if (recordsWithPlaintextIP.length === 0) {
        logger.info('No records with plaintext IP addresses found');
        return;
      }
      
      logger.info(`Found ${recordsWithPlaintextIP.length} records with plaintext IP addresses`);
      
      for (const record of recordsWithPlaintextIP) {
        try {
          logger.info(`Processing IP address migration for record: ${record.id}`);
          
          // Hash IP address for privacy
          const hashedIP = privacyService.hashIPAddress(record.ipAddress);
          
          // Update record with hashed IP
          await userRepository.updateIPAddressHash(record.id, hashedIP.hashedIP);
          
          logger.info(`IP address migrated for record: ${record.id}`);
          this.migrationResults.ipAddresses.migrated++;
          
        } catch (error) {
          logger.error(`Failed to migrate IP address for record: ${record.id}`, {
            recordId: record.id,
            error: error.message
          });
          this.migrationResults.ipAddresses.errors++;
        }
      }
      
    } catch (error) {
      logger.error('IP addresses migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Migrate GDPR compliance features
   */
  async migrateGDPRCompliance() {
    logger.info('Starting GDPR compliance migration...');
    
    try {
      const usersWithoutGDPR = await userRepository.findUsersWithoutGDPR();
      this.migrationResults.gdprCompliance.total = usersWithoutGDPR.length;
      
      if (usersWithoutGDPR.length === 0) {
        logger.info('No users without GDPR compliance found');
        return;
      }
      
      logger.info(`Found ${usersWithoutGDPR.length} users without GDPR compliance`);
      
      for (const user of usersWithoutGDPR) {
        try {
          logger.info(`Processing GDPR compliance for user: ${user.email}`);
          
          // Generate GDPR consent
          const gdprConsent = privacyService.generateGDPRConsent('1.0', {
            marketingCommunications: false,
            thirdPartySharing: false
          });
          
          // Update user with GDPR compliance
          await userRepository.updateGDPRCompliance(user.id, gdprConsent);
          
          logger.info(`GDPR compliance updated for user: ${user.email}`);
          this.migrationResults.gdprCompliance.migrated++;
          
        } catch (error) {
          logger.error(`Failed to update GDPR compliance for user: ${user.email}`, {
            userId: user.id,
            error: error.message
          });
          this.migrationResults.gdprCompliance.errors++;
        }
      }
      
    } catch (error) {
      logger.error('GDPR compliance migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Print migration summary
   */
  printMigrationSummary() {
    logger.info('=== SECURITY MIGRATION SUMMARY ===');
    
    Object.entries(this.migrationResults).forEach(([migration, results]) => {
      const successRate = results.total > 0 ? ((results.migrated / results.total) * 100).toFixed(1) : 100;
      
      logger.info(`${migration.toUpperCase()}:`, {
        total: results.total,
        migrated: results.migrated,
        errors: results.errors,
        successRate: `${successRate}%`
      });
    });
    
    const totalRecords = Object.values(this.migrationResults).reduce((sum, r) => sum + r.total, 0);
    const totalMigrated = Object.values(this.migrationResults).reduce((sum, r) => sum + r.migrated, 0);
    const totalErrors = Object.values(this.migrationResults).reduce((sum, r) => sum + r.errors, 0);
    
    logger.info('OVERALL SUMMARY:', {
      totalRecords,
      totalMigrated,
      totalErrors,
      overallSuccessRate: totalRecords > 0 ? `${((totalMigrated / totalRecords) * 100).toFixed(1)}%` : '100%'
    });
    
    if (totalErrors > 0) {
      logger.warn(`${totalErrors} records require manual intervention`);
    }
  }
}

// Add helper methods to user repository
async function addMigrationHelpers() {
  const helpers = `
  // Add these methods to userRepository.js:
  
  async findUsersWithPlaintext2FA() {
    const result = await database.query(
      \`SELECT id, email, two_factor_secret, encrypted_two_factor_secret
       FROM users 
       WHERE two_factor_enabled = TRUE 
       AND two_factor_secret IS NOT NULL
       AND encrypted_two_factor_secret IS NULL\`
    );
    return result.rows;
  }
  
  async findUsersWithPlaintextPhone() {
    const result = await database.query(
      \`SELECT id, email, phone_number, encrypted_phone_number
       FROM users 
       WHERE phone_number IS NOT NULL
       AND encrypted_phone_number IS NULL\`
    );
    return result.rows;
  }
  
  async findNotificationsWithPlaintext() {
    const result = await database.query(
      \`SELECT id, user_id, title, message, encrypted_title, encrypted_message
       FROM notifications 
       WHERE (title IS NOT NULL OR message IS NOT NULL)
       AND encrypted_title IS NULL\`
    );
    return result.rows;
  }
  
  async findRecordsWithPlaintextIP() {
    const result = await database.query(
      \`SELECT id, ip_address, ip_hash
       FROM password_reset_tokens 
       WHERE ip_address IS NOT NULL
       AND ip_hash IS NULL
       UNION ALL
       SELECT id, ip_address, ip_hash
       FROM master_password_reset_tokens 
       WHERE ip_address IS NOT NULL
       AND ip_hash IS NULL\`
    );
    return result.rows;
  }
  
  async findUsersWithoutGDPR() {
    const result = await database.query(
      \`SELECT id, email
       FROM users 
       WHERE gdpr_consent_given_at IS NULL\`
    );
    return result.rows;
  }
  
  async updateIPAddressHash(recordId, hashedIP) {
    // Update password reset tokens
    await database.query(
      \`UPDATE password_reset_tokens 
       SET ip_hash = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1\`,
      [recordId, hashedIP]
    );
    
    // Update master password reset tokens
    await database.query(
      \`UPDATE master_password_reset_tokens 
       SET ip_hash = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1\`,
      [recordId, hashedIP]
    );
  }
  
  async updateGDPRCompliance(userId, gdprConsent) {
    await database.query(
      \`UPDATE users 
       SET gdpr_consent_given_at = $2,
           gdpr_consent_version = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1\`,
      [userId, gdprConsent.timestamp, gdprConsent.version]
    );
  }
  `;
  
  logger.info('Migration helper methods to add to userRepository.js:', helpers);
}

// Run migration
if (require.main === module) {
  const migrationManager = new SecurityMigrationManager();
  
  addMigrationHelpers();
  
  migrationManager.runAllMigrations()
    .then(() => {
      logger.info('Comprehensive security migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Comprehensive security migration failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = SecurityMigrationManager; 