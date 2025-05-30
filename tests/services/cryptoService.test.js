const { CryptoService } = require('../../src/services/cryptoService');

describe('CryptoService', () => {
  let cryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  describe('Password Hashing', () => {
    test('should hash password with Argon2id', async () => {
      const password = 'MySecurePassword123!';
      const hash = await cryptoService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^\$argon2id\$/); // Argon2id hash format
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await cryptoService.hashPassword(password);
      
      const isValid = await cryptoService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'MySecurePassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await cryptoService.hashPassword(password);
      
      const isValid = await cryptoService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    test('should generate different hashes for same password', async () => {
      const password = 'MySecurePassword123!';
      const hash1 = await cryptoService.hashPassword(password);
      const hash2 = await cryptoService.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt should make them different
    });
  });

  describe('AES-256-GCM Encryption', () => {
    test('should encrypt and decrypt data successfully', async () => {
      const plaintext = 'This is sensitive vault data';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key);
      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await cryptoService.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    test('should fail decryption with wrong key', async () => {
      const plaintext = 'This is sensitive vault data';
      const key1 = await cryptoService.generateEncryptionKey();
      const key2 = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key1);
      
      await expect(cryptoService.decrypt(encrypted, key2))
        .rejects.toThrow();
    });

    test('should fail decryption with tampered data', async () => {
      const plaintext = 'This is sensitive vault data';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key);
      
      // Tamper with the ciphertext
      const tamperedEncrypted = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -1) + 'X'
      };
      
      await expect(cryptoService.decrypt(tamperedEncrypted, key))
        .rejects.toThrow();
    });

    test('should generate unique IVs for each encryption', async () => {
      const plaintext = 'Same data';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted1 = await cryptoService.encrypt(plaintext, key);
      const encrypted2 = await cryptoService.encrypt(plaintext, key);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });

  describe('Key Derivation', () => {
    test('should derive encryption key from master password', async () => {
      const masterPassword = 'MyMasterPassword123!';
      const salt = 'user-specific-salt';
      
      const key = await cryptoService.deriveKeyFromPassword(masterPassword, salt);
      
      expect(key).toBeDefined();
      expect(key.length).toBe(32); // 256 bits
    });

    test('should generate same key for same password and salt', async () => {
      const masterPassword = 'MyMasterPassword123!';
      const salt = 'user-specific-salt';
      
      const key1 = await cryptoService.deriveKeyFromPassword(masterPassword, salt);
      const key2 = await cryptoService.deriveKeyFromPassword(masterPassword, salt);

      expect(key1).toEqual(key2);
    });

    test('should generate different keys for different salts', async () => {
      const masterPassword = 'MyMasterPassword123!';
      const salt1 = 'user-specific-salt-1';
      const salt2 = 'user-specific-salt-2';
      
      const key1 = await cryptoService.deriveKeyFromPassword(masterPassword, salt1);
      const key2 = await cryptoService.deriveKeyFromPassword(masterPassword, salt2);

      expect(key1).not.toEqual(key2);
    });

    test('should generate cryptographically secure random encryption key', async () => {
      const key1 = await cryptoService.generateEncryptionKey();
      const key2 = await cryptoService.generateEncryptionKey();

      expect(key1.length).toBe(32); // 256 bits
      expect(key2.length).toBe(32); // 256 bits
      expect(key1).not.toEqual(key2);
    });
  });

  describe('Memory Security', () => {
    test('should clear sensitive data from memory', () => {
      const sensitiveBuffer = Buffer.from('sensitive-data');
      const originalData = sensitiveBuffer.toString();
      
      cryptoService.clearMemory(sensitiveBuffer);
      
      expect(sensitiveBuffer.toString()).not.toBe(originalData);
      expect(sensitiveBuffer.every(byte => byte === 0)).toBe(true);
    });
  });
}); 