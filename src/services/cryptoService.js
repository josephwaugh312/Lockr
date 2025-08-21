const argon2 = require('argon2');
const crypto = require('crypto');

class CryptoService {
  constructor() {
    this.argonConfig = {
      type: argon2.argon2id,
      memoryCost: parseInt(process.env.ARGON2_MEMORY_COST) || 65536, // 64 MB
      timeCost: parseInt(process.env.ARGON2_TIME_COST) || 3,
      parallelism: parseInt(process.env.ARGON2_PARALLELISM) || 4,
      hashLength: 32
    };
    
    this.aesConfig = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 12,  // 96 bits (recommended for GCM)
      tagLength: 16  // 128 bits
    };
  }

  /**
   * Hash a password using Argon2id
   * @param {string} password - The password to hash
   * @returns {Promise<string>} - The hashed password
   */
  async hashPassword(password) {
    try {
      return await argon2.hash(password, this.argonConfig);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Verify a password against a hash
   * @param {string} password - The password to verify
   * @param {string} hash - The hash to verify against
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(password, hash) {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      throw new Error(`Password verification failed: ${error.message}`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} plaintext - The data to encrypt
   * @param {Buffer} key - The encryption key
   * @returns {Promise<object>} - Object containing ciphertext, iv, and authTag
   */
  async encrypt(plaintext, key) {
    try {
      const iv = crypto.randomBytes(this.aesConfig.ivLength);
      const cipher = crypto.createCipheriv(this.aesConfig.algorithm, key, iv);
      
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        ciphertext,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {object} encryptedData - Object containing ciphertext, iv, and authTag
   * @param {Buffer} key - The decryption key
   * @returns {Promise<string>} - The decrypted plaintext
   */
  async decrypt(encryptedData, key) {
    try {
      const { ciphertext, iv, authTag } = encryptedData;
      
      const decipher = crypto.createDecipheriv(
        this.aesConfig.algorithm, 
        key, 
        Buffer.from(iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      
      return plaintext;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate a cryptographically secure random encryption key
   * @returns {Promise<Buffer>} - A 256-bit random key
   */
  async generateEncryptionKey() {
    return crypto.randomBytes(this.aesConfig.keyLength);
  }

  /**
   * Derive an encryption key from a master password using PBKDF2
   * @param {string} masterPassword - The master password
   * @param {string} salt - The salt (should be user-specific)
   * @returns {Promise<Buffer>} - The derived key
   */
  async deriveKeyFromPassword(masterPassword, salt) {
    try {
      return crypto.pbkdf2Sync(
        masterPassword, 
        salt, 
        100000, // iterations
        this.aesConfig.keyLength, 
        'sha256'
      );
    } catch (error) {
      throw new Error(`Key derivation failed: ${error.message}`);
    }
  }

  /**
   * Clear sensitive data from memory by overwriting with zeros
   * @param {Buffer} buffer - The buffer to clear
   */
  clearMemory(buffer) {
    if (Buffer.isBuffer(buffer)) {
      buffer.fill(0);
    }
  }
}

// Export class, plus a shared singleton and top-level helpers for easier testing/mocking
const cryptoService = new CryptoService();

async function encrypt(plaintext, key) {
  return cryptoService.encrypt(plaintext, key);
}

async function decrypt(encryptedData, key) {
  return cryptoService.decrypt(encryptedData, key);
}

module.exports = { CryptoService, cryptoService, encrypt, decrypt };