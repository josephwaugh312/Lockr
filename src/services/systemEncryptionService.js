const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * System-level encryption service for encrypting sensitive data at rest
 * Uses a system-wide key (not user-specific) for background processes
 * This is used for data that needs to be accessed without user passwords
 * (e.g., SMS sending, scheduled tasks, admin operations)
 */
class SystemEncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.saltLength = 32;
    this.tagLength = 16;
    
    // Get system key from environment
    this.systemKey = process.env.SYSTEM_ENCRYPTION_KEY;
    
    // Validate system key on initialization
    if (!this.systemKey) {
      logger.warn('SYSTEM_ENCRYPTION_KEY not set. System encryption will not be available.');
    } else if (this.systemKey.length !== 64) { // 32 bytes = 64 hex chars
      logger.warn('SYSTEM_ENCRYPTION_KEY should be 32 bytes (64 hex characters)');
    }
  }

  /**
   * Check if system encryption is available
   * @returns {boolean} - Whether system encryption can be used
   */
  isAvailable() {
    return Boolean(this.systemKey && this.systemKey.length === 64);
  }

  /**
   * Derive key from system key and salt
   * @param {string} salt - Salt for key derivation
   * @returns {Buffer} - Derived key
   */
  deriveKey(salt) {
    if (!this.isAvailable()) {
      throw new Error('System encryption not available');
    }
    
    return crypto.pbkdf2Sync(
      this.systemKey,
      salt,
      100000,
      this.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt data using system key
   * @param {string} text - Text to encrypt
   * @returns {Object} - Encrypted data with IV and salt
   */
  encrypt(text) {
    try {
      if (!this.isAvailable()) {
        throw new Error('System encryption not available');
      }

      if (!text) {
        throw new Error('No text provided for encryption');
      }

      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive key from system key and salt
      const key = this.deriveKey(salt);
      
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
      logger.error('System encryption failed', { error: error.message });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with system key
   * @param {string} encryptedData - The encrypted data
   * @param {string} iv - The initialization vector
   * @param {string} salt - The salt used for key derivation
   * @returns {string} - Decrypted text
   */
  decrypt(encryptedData, iv, salt) {
    try {
      if (!this.isAvailable()) {
        throw new Error('System encryption not available');
      }

      if (!encryptedData || !iv || !salt) {
        throw new Error('Missing required decryption parameters');
      }

      // Convert from storage format
      const ivBuffer = Buffer.from(iv, 'base64');
      const saltBuffer = Buffer.from(salt, 'hex');
      const combinedBuffer = Buffer.from(encryptedData, 'base64');
      
      // Extract encrypted data and auth tag
      const encrypted = combinedBuffer.slice(0, -this.tagLength);
      const authTag = combinedBuffer.slice(-this.tagLength);
      
      // Derive key from system key and salt
      const key = this.deriveKey(saltBuffer);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, ivBuffer);
      decipher.setAuthTag(authTag);
      
      // Decrypt the text
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('System decryption failed', { error: error.message });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt phone number for storage
   * @param {string} phoneNumber - Phone number to encrypt
   * @returns {Object} - Encrypted phone data
   */
  encryptPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      throw new Error('No phone number provided');
    }
    
    return this.encrypt(phoneNumber);
  }

  /**
   * Decrypt phone number from storage
   * @param {string} encryptedPhone - Encrypted phone number
   * @param {string} iv - Initialization vector
   * @param {string} salt - Salt
   * @returns {string} - Decrypted phone number
   */
  decryptPhoneNumber(encryptedPhone, iv, salt) {
    return this.decrypt(encryptedPhone, iv, salt);
  }

  /**
   * Encrypt 2FA secret for storage
   * @param {string} secret - 2FA secret to encrypt
   * @returns {Object} - Encrypted secret data
   */
  encrypt2FASecret(secret) {
    if (!secret) {
      throw new Error('No 2FA secret provided');
    }
    
    return this.encrypt(secret);
  }

  /**
   * Decrypt 2FA secret from storage
   * @param {string} encryptedSecret - Encrypted 2FA secret
   * @param {string} iv - Initialization vector
   * @param {string} salt - Salt
   * @returns {string} - Decrypted 2FA secret
   */
  decrypt2FASecret(encryptedSecret, iv, salt) {
    return this.decrypt(encryptedSecret, iv, salt);
  }

  /**
   * Verify encryption/decryption is working
   * @returns {boolean} - Whether encryption is working
   */
  verify() {
    try {
      if (!this.isAvailable()) {
        return false;
      }

      const testData = 'test_encryption_' + Date.now();
      const { encrypted, iv, salt } = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted, iv, salt);
      
      return decrypted === testData;
    } catch (error) {
      logger.error('System encryption verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * Generate a new system encryption key
   * @returns {string} - New 32-byte hex key
   */
  static generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Export singleton instance
module.exports = new SystemEncryptionService();