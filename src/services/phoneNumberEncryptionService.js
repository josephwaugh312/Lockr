const crypto = require('crypto');
const { logger } = require('../utils/logger');

class PhoneNumberEncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 12;  // 96 bits for GCM
    this.saltLength = 16; // 128 bits for salt (16 bytes = 32 hex chars)
    this.tagLength = 16;  // 128 bits for auth tag
  }

  /**
   * Derive encryption key from user password and salt
   * @param {string} userPassword - User's login password
   * @param {string} salt - Random salt for key derivation
   * @returns {Buffer} - Derived encryption key
   */
  deriveKeyFromPassword(userPassword, salt) {
    try {
      // Use PBKDF2 to derive key from user password
      const key = crypto.pbkdf2Sync(
        userPassword,
        salt,
        100000, // 100k iterations
        this.keyLength,
        'sha256'
      );
      
      return key;
    } catch (error) {
      logger.error('Failed to derive phone number encryption key', { error: error.message });
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Generate a random salt for key derivation
   * @returns {string} - Base64 encoded salt
   */
  generateSalt() {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      return salt.toString('hex'); // 16 bytes = 32 hex characters
    } catch (error) {
      logger.error('Failed to generate salt for phone number encryption', { error: error.message });
      throw new Error('Failed to generate salt');
    }
  }

  /**
   * Encrypt phone number using user password
   * @param {string} phoneNumber - Phone number in E.164 format
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt for key derivation (optional, will generate if not provided)
   * @returns {object} - Encrypted data with IV and salt
   */
  encryptPhoneNumber(phoneNumber, userPassword, salt = null) {
    try {
      // Validate phone number format (basic E.164 validation)
      if (!phoneNumber || !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Generate salt if not provided
      const encryptionSalt = salt || this.generateSalt();
      
      // Derive encryption key from user password
      const key = this.deriveKeyFromPassword(userPassword, encryptionSalt);
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Encrypt the phone number
      let encrypted = cipher.update(phoneNumber, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV and auth tag with encrypted data
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
      
      logger.info('Phone number encrypted successfully', {
        phoneNumberLength: phoneNumber.length,
        encryptedLength: combined.length
      });
      
      return {
        encryptedData: combined.toString('base64'),
        salt: encryptionSalt
      };
    } catch (error) {
      logger.error('Failed to encrypt phone number', { error: error.message });
      throw new Error('Failed to encrypt phone number');
    }
  }

  /**
   * Decrypt phone number using user password
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt used for encryption
   * @returns {string} - Decrypted phone number
   */
  decryptPhoneNumber(encryptedData, userPassword, salt) {
    try {
      // Derive encryption key from user password
      const key = this.deriveKeyFromPassword(userPassword, salt);
      
      // Decode encrypted data
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract IV, auth tag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the phone number
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      // Validate decrypted phone number format
      if (!/^\+?[1-9]\d{1,14}$/.test(decrypted)) {
        throw new Error('Decrypted phone number format is invalid');
      }
      
      logger.info('Phone number decrypted successfully', {
        decryptedLength: decrypted.length
      });
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt phone number', { error: error.message });
      throw new Error('Failed to decrypt phone number');
    }
  }

  /**
   * Migrate existing plaintext phone number to encrypted format
   * @param {string} plaintextPhoneNumber - Current plaintext phone number
   * @param {string} userPassword - User's login password
   * @returns {object} - Encrypted data ready for database storage
   */
  migratePlaintextPhoneNumber(plaintextPhoneNumber, userPassword) {
    try {
      logger.info('Migrating plaintext phone number to encrypted format');
      
      const encrypted = this.encryptPhoneNumber(plaintextPhoneNumber, userPassword);
      
      return {
        encryptedPhoneNumber: encrypted.encryptedData,
        phoneNumberSalt: encrypted.salt,
        phoneNumberIv: null // Not needed for GCM, but keeping for compatibility
      };
    } catch (error) {
      logger.error('Failed to migrate phone number', { error: error.message });
      throw new Error('Failed to migrate phone number');
    }
  }

  /**
   * Verify encrypted phone number can be decrypted
   * @param {string} encryptedData - Encrypted phone number
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt used for encryption
   * @returns {boolean} - True if decryption succeeds
   */
  verifyEncryptedPhoneNumber(encryptedData, userPassword, salt) {
    try {
      const decrypted = this.decryptPhoneNumber(encryptedData, userPassword, salt);
      
      // Verify it's a valid E.164 phone number
      return /^\+?[1-9]\d{1,14}$/.test(decrypted);
    } catch (error) {
      logger.warn('Failed to verify encrypted phone number', { error: error.message });
      return false;
    }
  }

  /**
   * Clear sensitive data from memory
   * @param {Buffer} buffer - Buffer to clear
   */
  clearMemory(buffer) {
    if (buffer && buffer.fill) {
      buffer.fill(0);
    }
  }
}

module.exports = PhoneNumberEncryptionService; 