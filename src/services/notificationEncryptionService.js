const crypto = require('crypto');
const { logger } = require('../utils/logger');

class NotificationEncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 12;  // 96 bits for GCM
    this.saltLength = 32; // 256 bits for salt
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
      logger.error('Failed to derive notification encryption key', { error: error.message });
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
      return salt.toString('base64');
    } catch (error) {
      logger.error('Failed to generate salt for notification encryption', { error: error.message });
      throw new Error('Failed to generate salt');
    }
  }

  /**
   * Encrypt notification content using user password
   * @param {object} notificationData - Object containing title, message, and data
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt for key derivation (optional, will generate if not provided)
   * @returns {object} - Encrypted data with IV and salt
   */
  encryptNotificationContent(notificationData, userPassword, salt = null) {
    try {
      const { title, message, data } = notificationData;
      
      // Validate required fields
      if (!title || !message) {
        throw new Error('Title and message are required for notification encryption');
      }

      // Generate salt if not provided
      const encryptionSalt = salt || this.generateSalt();
      
      // Derive encryption key from user password
      const key = this.deriveKeyFromPassword(userPassword, encryptionSalt);
      
      // Encrypt each field separately
      const encryptedTitle = this.encryptField(title, key);
      const encryptedMessage = this.encryptField(message, key);
      const encryptedData = data ? this.encryptField(JSON.stringify(data), key) : null;
      
      logger.info('Notification content encrypted successfully', {
        titleLength: title.length,
        messageLength: message.length,
        hasData: !!data
      });
      
      return {
        encryptedTitle,
        encryptedMessage,
        encryptedData,
        salt: encryptionSalt
      };
    } catch (error) {
      logger.error('Failed to encrypt notification content', { error: error.message });
      throw new Error('Failed to encrypt notification content');
    }
  }

  /**
   * Decrypt notification content using user password
   * @param {object} encryptedData - Object containing encrypted title, message, and data
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt used for encryption
   * @returns {object} - Decrypted notification content
   */
  decryptNotificationContent(encryptedData, userPassword, salt) {
    try {
      const { encryptedTitle, encryptedMessage, encryptedData } = encryptedData;
      
      // Derive encryption key from user password
      const key = this.deriveKeyFromPassword(userPassword, salt);
      
      // Decrypt each field
      const title = this.decryptField(encryptedTitle, key);
      const message = this.decryptField(encryptedMessage, key);
      const data = encryptedData ? JSON.parse(this.decryptField(encryptedData, key)) : null;
      
      logger.info('Notification content decrypted successfully', {
        titleLength: title.length,
        messageLength: message.length,
        hasData: !!data
      });
      
      return { title, message, data };
    } catch (error) {
      logger.error('Failed to decrypt notification content', { error: error.message });
      throw new Error('Failed to decrypt notification content');
    }
  }

  /**
   * Encrypt a single field
   * @param {string} plaintext - Text to encrypt
   * @param {Buffer} key - Encryption key
   * @returns {string} - Base64 encoded encrypted data
   */
  encryptField(plaintext, key) {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV and auth tag with encrypted data
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
      
      return combined.toString('base64');
    } catch (error) {
      logger.error('Failed to encrypt notification field', { error: error.message });
      throw new Error('Failed to encrypt field');
    }
  }

  /**
   * Decrypt a single field
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {Buffer} key - Decryption key
   * @returns {string} - Decrypted text
   */
  decryptField(encryptedData, key) {
    try {
      // Decode encrypted data
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract IV, auth tag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt notification field', { error: error.message });
      throw new Error('Failed to decrypt field');
    }
  }

  /**
   * Migrate existing plaintext notification to encrypted format
   * @param {object} plaintextNotification - Current plaintext notification
   * @param {string} userPassword - User's login password
   * @returns {object} - Encrypted data ready for database storage
   */
  migratePlaintextNotification(plaintextNotification, userPassword) {
    try {
      logger.info('Migrating plaintext notification to encrypted format');
      
      const encrypted = this.encryptNotificationContent(plaintextNotification, userPassword);
      
      return {
        encryptedTitle: encrypted.encryptedTitle,
        encryptedMessage: encrypted.encryptedMessage,
        encryptedData: encrypted.encryptedData,
        notificationSalt: encrypted.salt,
        notificationIv: null // Not needed for GCM, but keeping for compatibility
      };
    } catch (error) {
      logger.error('Failed to migrate notification', { error: error.message });
      throw new Error('Failed to migrate notification');
    }
  }

  /**
   * Verify encrypted notification can be decrypted
   * @param {object} encryptedData - Encrypted notification data
   * @param {string} userPassword - User's login password
   * @param {string} salt - Salt used for encryption
   * @returns {boolean} - True if decryption succeeds
   */
  verifyEncryptedNotification(encryptedData, userPassword, salt) {
    try {
      const decrypted = this.decryptNotificationContent(encryptedData, userPassword, salt);
      
      // Verify required fields are present and valid
      return !!(decrypted.title && decrypted.message);
    } catch (error) {
      logger.warn('Failed to verify encrypted notification', { error: error.message });
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

module.exports = NotificationEncryptionService; 