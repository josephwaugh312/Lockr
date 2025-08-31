#!/usr/bin/env node

/**
 * Migration script to encrypt existing plaintext 2FA secrets and phone numbers
 * This script should be run after deploying the database migrations 024 and 025
 * 
 * IMPORTANT: This script requires administrative access and should be run
 * in a maintenance window. It will:
 * 1. Identify users with plain text sensitive data
 * 2. Encrypt the data using system-level encryption (not user password based)
 * 3. Update the database with encrypted values
 * 4. Clear the plain text columns
 */

require('dotenv').config();
const crypto = require('crypto');
const { Pool } = require('pg');
const { logger } = require('../src/utils/logger');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// System-level encryption key (should be stored securely, e.g., in environment variables or key management service)
const SYSTEM_ENCRYPTION_KEY = process.env.SYSTEM_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

class SystemEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.saltLength = 32;
    this.tagLength = 16;
  }

  /**
   * Encrypts data using system-level encryption
   * @param {string} text - The text to encrypt
   * @returns {Object} - Encrypted data with iv and salt
   */
  encrypt(text) {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive key from system key and salt
      const key = crypto.pbkdf2Sync(SYSTEM_ENCRYPTION_KEY, salt, 100000, this.keyLength, 'sha256');
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine encrypted data with auth tag
      const combined = Buffer.concat([
        Buffer.from(encrypted, 'base64'),
        authTag
      ]).toString('base64');
      
      return {
        encrypted: combined,
        iv: iv.toString('base64'),
        salt: salt.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Decrypts data encrypted with system-level encryption
   * @param {string} encryptedData - The encrypted data
   * @param {string} iv - The initialization vector
   * @param {string} salt - The salt used for key derivation
   * @returns {string} - Decrypted text
   */
  decrypt(encryptedData, iv, salt) {
    try {
      // Convert from storage format
      const ivBuffer = Buffer.from(iv, 'base64');
      const saltBuffer = Buffer.from(salt, 'hex');
      const combinedBuffer = Buffer.from(encryptedData, 'base64');
      
      // Extract encrypted data and auth tag
      const encrypted = combinedBuffer.slice(0, -this.tagLength);
      const authTag = combinedBuffer.slice(-this.tagLength);
      
      // Derive key from system key and salt
      const key = crypto.pbkdf2Sync(SYSTEM_ENCRYPTION_KEY, saltBuffer, 100000, this.keyLength, 'sha256');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, ivBuffer);
      decipher.setAuthTag(authTag);
      
      // Decrypt the text
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw error;
    }
  }
}

async function migrateData() {
  const encryption = new SystemEncryption();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting data migration to encrypted columns...');
    
    // Step 1: Migrate 2FA secrets
    logger.info('Migrating 2FA secrets...');
    const usersWithPlaintext2FA = await client.query(`
      SELECT id, email, two_factor_secret 
      FROM users 
      WHERE two_factor_secret IS NOT NULL 
        AND two_factor_secret != ''
        AND encrypted_two_factor_secret IS NULL
    `);
    
    let twoFactorMigrated = 0;
    for (const user of usersWithPlaintext2FA.rows) {
      try {
        const { encrypted, iv, salt } = encryption.encrypt(user.two_factor_secret);
        
        await client.query(`
          UPDATE users 
          SET encrypted_two_factor_secret = $1,
              two_factor_secret_iv = $2,
              two_factor_secret_salt = $3
          WHERE id = $4
        `, [encrypted, iv, salt, user.id]);
        
        twoFactorMigrated++;
        logger.info(`Migrated 2FA secret for user: ${user.email}`);
      } catch (error) {
        logger.error(`Failed to migrate 2FA secret for user ${user.email}:`, error);
      }
    }
    
    logger.info(`Migrated ${twoFactorMigrated} 2FA secrets`);
    
    // Step 2: Migrate phone numbers
    logger.info('Migrating phone numbers...');
    const usersWithPlaintextPhone = await client.query(`
      SELECT id, email, phone_number 
      FROM users 
      WHERE phone_number IS NOT NULL 
        AND phone_number != ''
        AND encrypted_phone_number IS NULL
    `);
    
    let phonesMigrated = 0;
    for (const user of usersWithPlaintextPhone.rows) {
      try {
        const { encrypted, iv, salt } = encryption.encrypt(user.phone_number);
        
        await client.query(`
          UPDATE users 
          SET encrypted_phone_number = $1,
              phone_number_iv = $2,
              phone_number_salt = $3
          WHERE id = $4
        `, [encrypted, iv, salt, user.id]);
        
        phonesMigrated++;
        logger.info(`Migrated phone number for user: ${user.email}`);
      } catch (error) {
        logger.error(`Failed to migrate phone number for user ${user.email}:`, error);
      }
    }
    
    logger.info(`Migrated ${phonesMigrated} phone numbers`);
    
    // Step 3: Clear plain text columns (optional - can be done in a separate migration)
    const clearPlainText = process.env.CLEAR_PLAINTEXT === 'true';
    if (clearPlainText) {
      logger.info('Clearing plain text columns...');
      
      await client.query(`
        UPDATE users 
        SET two_factor_secret = NULL 
        WHERE encrypted_two_factor_secret IS NOT NULL
      `);
      
      await client.query(`
        UPDATE users 
        SET phone_number = NULL 
        WHERE encrypted_phone_number IS NOT NULL
      `);
      
      logger.info('Plain text columns cleared');
    } else {
      logger.info('Plain text columns retained (set CLEAR_PLAINTEXT=true to clear)');
    }
    
    await client.query('COMMIT');
    
    // Step 4: Verify migration
    const verificationResults = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE two_factor_secret IS NOT NULL AND encrypted_two_factor_secret IS NULL) as unmigrated_2fa,
        COUNT(*) FILTER (WHERE phone_number IS NOT NULL AND encrypted_phone_number IS NULL) as unmigrated_phones,
        COUNT(*) FILTER (WHERE encrypted_two_factor_secret IS NOT NULL) as migrated_2fa,
        COUNT(*) FILTER (WHERE encrypted_phone_number IS NOT NULL) as migrated_phones
      FROM users
    `);
    
    const stats = verificationResults.rows[0];
    logger.info('Migration Statistics:', {
      unmigrated2FA: stats.unmigrated_2fa,
      unmigratedPhones: stats.unmigrated_phones,
      migrated2FA: stats.migrated_2fa,
      migratedPhones: stats.migrated_phones
    });
    
    if (stats.unmigrated_2fa > 0 || stats.unmigrated_phones > 0) {
      logger.warn('Some records were not migrated. Please review and run migration again if needed.');
    } else {
      logger.info('All sensitive data successfully migrated to encrypted columns!');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Verification function to test encryption/decryption
async function verifyEncryption() {
  const encryption = new SystemEncryption();
  const testData = 'TEST_SECRET_12345';
  
  try {
    const { encrypted, iv, salt } = encryption.encrypt(testData);
    const decrypted = encryption.decrypt(encrypted, iv, salt);
    
    if (decrypted === testData) {
      logger.info('Encryption verification successful');
      return true;
    } else {
      logger.error('Encryption verification failed: decrypted data does not match original');
      return false;
    }
  } catch (error) {
    logger.error('Encryption verification error:', error);
    return false;
  }
}

// Main execution
async function main() {
  try {
    logger.info('Starting encrypted columns migration...');
    logger.info('Using system encryption key:', SYSTEM_ENCRYPTION_KEY.substring(0, 8) + '...');
    
    // Verify encryption is working
    const encryptionValid = await verifyEncryption();
    if (!encryptionValid) {
      logger.error('Encryption verification failed. Aborting migration.');
      process.exit(1);
    }
    
    // Run migration
    await migrateData();
    
    logger.info('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { SystemEncryption, migrateData };