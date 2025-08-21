/**
 * Simplified CryptoService Tests
 * Unit tests for encryption/decryption without external dependencies
 */

const { CryptoService } = require('../../src/services/cryptoService');

describe('CryptoService - Simplified Tests', () => {
  let cryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  describe('Basic Encryption/Decryption', () => {
    test('should encrypt and decrypt string data', async () => {
      const plaintext = 'Hello, World!';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      
      const decrypted = await cryptoService.decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    test('should generate unique IVs for same data', async () => {
      const plaintext = 'Same data';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted1 = await cryptoService.encrypt(plaintext, key);
      const encrypted2 = await cryptoService.encrypt(plaintext, key);
      
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
    });

    test('should fail decryption with wrong key', async () => {
      const plaintext = 'Secret data';
      const key1 = await cryptoService.generateEncryptionKey();
      const key2 = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key1);
      
      await expect(cryptoService.decrypt(encrypted, key2)).rejects.toThrow();
    });

    test('should handle empty string encryption', async () => {
      const plaintext = '';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key);
      const decrypted = await cryptoService.decrypt(encrypted, key);
      
      expect(decrypted).toBe('');
    });

    test('should handle special characters', async () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~\\n\\t\\r';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key);
      const decrypted = await cryptoService.decrypt(encrypted, key);
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle unicode characters', async () => {
      const plaintext = '你好世界 🌍 مرحبا بالعالم';
      const key = await cryptoService.generateEncryptionKey();
      
      const encrypted = await cryptoService.encrypt(plaintext, key);
      const decrypted = await cryptoService.decrypt(encrypted, key);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Password Hashing', () => {
    test('should hash password with Argon2', async () => {
      const password = 'TestPassword123!';
      
      const hash = await cryptoService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2');
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should verify correct password', async () => {
      const password = 'CorrectPassword123!';
      
      const hash = await cryptoService.hashPassword(password);
      const isValid = await cryptoService.verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      
      const hash = await cryptoService.hashPassword(password);
      const isValid = await cryptoService.verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    test('should generate unique hashes for same password', async () => {
      const password = 'SamePassword123!';
      
      const hash1 = await cryptoService.hashPassword(password);
      const hash2 = await cryptoService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      
      // But both should verify correctly
      expect(await cryptoService.verifyPassword(password, hash1)).toBe(true);
      expect(await cryptoService.verifyPassword(password, hash2)).toBe(true);
    });

    test('should handle empty password', async () => {
      const password = '';
      
      const hash = await cryptoService.hashPassword(password);
      const isValid = await cryptoService.verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Key Generation', () => {
    test('should generate encryption keys', async () => {
      const key = await cryptoService.generateEncryptionKey();
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // 256 bits
    });

    test('should generate unique keys', async () => {
      const key1 = await cryptoService.generateEncryptionKey();
      const key2 = await cryptoService.generateEncryptionKey();
      
      expect(key1).not.toEqual(key2);
    });

    test('should derive key from password', async () => {
      const password = 'UserPassword123!';
      const salt = 'test-salt-value';
      
      const key = await cryptoService.deriveKeyFromPassword(password, salt);
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    test('should derive consistent key with same password and salt', async () => {
      const password = 'ConsistentPassword123!';
      const salt = 'consistent-salt-value';
      
      const key1 = await cryptoService.deriveKeyFromPassword(password, salt);
      const key2 = await cryptoService.deriveKeyFromPassword(password, salt);
      
      expect(key1).toEqual(key2);
    });

    test('should derive different keys with different salts', async () => {
      const password = 'SamePassword123!';
      const salt1 = 'salt-value-1';
      const salt2 = 'salt-value-2';
      
      const key1 = await cryptoService.deriveKeyFromPassword(password, salt1);
      const key2 = await cryptoService.deriveKeyFromPassword(password, salt2);
      
      expect(key1).not.toEqual(key2);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid encryption key', async () => {
      const plaintext = 'Test data';
      const invalidKey = Buffer.from('short');
      
      await expect(cryptoService.encrypt(plaintext, invalidKey)).rejects.toThrow();
    });

    test('should throw error for corrupted encrypted data', async () => {
      const key = await cryptoService.generateEncryptionKey();
      const encrypted = await cryptoService.encrypt('test', key);
      
      // Corrupt the encrypted data
      encrypted.ciphertext = 'corrupted';
      
      await expect(cryptoService.decrypt(encrypted, key)).rejects.toThrow();
    });

    test('should throw error for missing IV', async () => {
      const key = await cryptoService.generateEncryptionKey();
      const invalidData = {
        ciphertext: 'somedata',
        authTag: 'sometag'
        // Missing iv
      };
      
      await expect(cryptoService.decrypt(invalidData, key)).rejects.toThrow();
    });

    test('should throw error for missing authTag', async () => {
      const key = await cryptoService.generateEncryptionKey();
      const invalidData = {
        ciphertext: 'somedata',
        iv: 'someiv'
        // Missing authTag
      };
      
      await expect(cryptoService.decrypt(invalidData, key)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    test('should encrypt small data quickly', async () => {
      const key = await cryptoService.generateEncryptionKey();
      const data = 'Small data';
      
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await cryptoService.encrypt(data, key);
      }
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(500); // Should complete 100 operations in under 500ms
    });

    test('should hash passwords within reasonable time', async () => {
      const password = 'TestPassword123!';
      
      const start = Date.now();
      await cryptoService.hashPassword(password);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(duration).toBeGreaterThan(20); // But not too fast (indicates secure hashing)
    });
  });
});