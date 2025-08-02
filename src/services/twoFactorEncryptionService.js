const crypto = require('crypto');
const { logger } = require('../utils/logger');

class TwoFactorEncryptionService {
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
      logger.error('Failed to derive 2FA encryption key', { error: error.message });
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
      logger.error('Failed to generate salt', { error: error.message });
      throw new Error('Failed to generate salt');
    }
  }

  /**
   * Encrypt 2FA secret using user password
   * @param {string} twoFactorSecret - Base32 encoded TOTP secret
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt for key derivation (optional, will generate if not provided)
   * @returns {object} - Encrypted data with IV and salt
   */
  encryptTwoFactorSecret(twoFactorSecret, userPassword, salt = null) {
    try {
      // Generate salt if not provided
      const encryptionSalt = salt || this.generateSalt();
      
      // Derive encryption key from user password
      const key = this.deriveKeyFromPassword(userPassword, encryptionSalt);
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Encrypt the 2FA secret
      let encrypted = cipher.update(twoFactorSecret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV and auth tag with encrypted data
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
      
      logger.info('2FA secret encrypted successfully', {
        secretLength: twoFactorSecret.length,
        encryptedLength: combined.length
      });
      
      return {
        encryptedData: combined.toString('base64'),
        salt: encryptionSalt
      };
    } catch (error) {
      logger.error('Failed to encrypt 2FA secret', { error: error.message });
      throw new Error('Failed to encrypt 2FA secret');
    }
  }

  /**
   * Decrypt 2FA secret using user password
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt used for encryption
   * @returns {string} - Decrypted base32 TOTP secret
   */
  decryptTwoFactorSecret(encryptedData, userPassword, salt) {
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
      
      // Decrypt the 2FA secret
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      logger.info('2FA secret decrypted successfully', {
        decryptedLength: decrypted.length
      });
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt 2FA secret', { error: error.message });
      throw new Error('Failed to decrypt 2FA secret');
    }
  }

  /**
   * Migrate existing plaintext 2FA secret to encrypted format
   * @param {string} plaintextSecret - Current plaintext 2FA secret
   * @param {string} userPassword - User's login password
   * @returns {object} - Encrypted data ready for database storage
   */
  migratePlaintextSecret(plaintextSecret, userPassword) {
    try {
      logger.info('Migrating plaintext 2FA secret to encrypted format');
      
      const encrypted = this.encryptTwoFactorSecret(plaintextSecret, userPassword);
      
      return {
        encryptedTwoFactorSecret: encrypted.encryptedData,
        twoFactorSecretSalt: encrypted.salt,
        twoFactorSecretIv: null // Not needed for GCM, but keeping for compatibility
      };
    } catch (error) {
      logger.error('Failed to migrate 2FA secret', { error: error.message });
      throw new Error('Failed to migrate 2FA secret');
    }
  }

  /**
   * Verify encrypted 2FA secret can be decrypted
   * @param {string} encryptedData - Encrypted 2FA secret
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt used for encryption
   * @returns {boolean} - True if decryption succeeds
   */
  verifyEncryptedSecret(encryptedData, userPassword, salt) {
    try {
      const decrypted = this.decryptTwoFactorSecret(encryptedData, userPassword, salt);
      
      // Verify it's a valid base32 string (TOTP secret format)
      const base32Regex = /^[A-Z2-7]+=*$/;
      return base32Regex.test(decrypted) && decrypted.length >= 16;
    } catch (error) {
      logger.warn('Failed to verify encrypted 2FA secret', { error: error.message });
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

module.exports = TwoFactorEncryptionService; 