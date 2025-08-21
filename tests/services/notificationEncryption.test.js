// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const NotificationEncryptionService = require('../../src/services/notificationEncryptionService');
const crypto = require('crypto');
const { logger: mockLogger } = require('../../src/utils/logger');

describe('NotificationEncryptionService', () => {
  let service;
  const testPassword = 'testPassword123!';
  const testNotification = {
    title: 'Test Notification',
    message: 'This is a test notification message',
    data: { userId: '123', action: 'login' }
  };

  beforeEach(() => {
    service = new NotificationEncryptionService();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct configuration', () => {
      expect(service.algorithm).toBe('aes-256-gcm');
      expect(service.keyLength).toBe(32);
      expect(service.ivLength).toBe(12);
      expect(service.saltLength).toBe(32);
      expect(service.tagLength).toBe(16);
    });
  });

  describe('generateSalt', () => {
    test('should generate valid base64 salt', () => {
      const salt = service.generateSalt();
      
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(Buffer.from(salt, 'base64').length).toBe(32);
    });

    test('should generate different salts each time', () => {
      const salt1 = service.generateSalt();
      const salt2 = service.generateSalt();
      
      expect(salt1).not.toBe(salt2);
    });

    test('should handle crypto errors', () => {
      jest.spyOn(crypto, 'randomBytes').mockImplementation(() => {
        throw new Error('Crypto error');
      });

      expect(() => service.generateSalt()).toThrow('Failed to generate salt');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate salt for notification encryption', 
        { error: 'Crypto error' }
      );

      crypto.randomBytes.mockRestore();
    });
  });

  describe('deriveKeyFromPassword', () => {
    test('should derive key from password and salt', () => {
      const salt = 'testSalt';
      const key = service.deriveKeyFromPassword(testPassword, salt);
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    test('should produce consistent keys for same inputs', () => {
      const salt = 'testSalt';
      const key1 = service.deriveKeyFromPassword(testPassword, salt);
      const key2 = service.deriveKeyFromPassword(testPassword, salt);
      
      expect(key1.equals(key2)).toBe(true);
    });

    test('should produce different keys for different salts', () => {
      const key1 = service.deriveKeyFromPassword(testPassword, 'salt1');
      const key2 = service.deriveKeyFromPassword(testPassword, 'salt2');
      
      expect(key1.equals(key2)).toBe(false);
    });

    test('should handle crypto errors', () => {
      jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation(() => {
        throw new Error('PBKDF2 error');
      });

      expect(() => service.deriveKeyFromPassword(testPassword, 'salt')).toThrow('Failed to derive encryption key');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to derive notification encryption key', 
        { error: 'PBKDF2 error' }
      );

      crypto.pbkdf2Sync.mockRestore();
    });
  });

  describe('encryptField', () => {
    test('should encrypt and decrypt field successfully', () => {
      const plaintext = 'Test message';
      const key = Buffer.alloc(32, 1); // Simple test key
      
      const encrypted = service.encryptField(plaintext, key);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      
      const decrypted = service.decryptField(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    test('should produce different encrypted values each time', () => {
      const plaintext = 'Test message';
      const key = Buffer.alloc(32, 1);
      
      const encrypted1 = service.encryptField(plaintext, key);
      const encrypted2 = service.encryptField(plaintext, key);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('should handle encryption errors', () => {
      const plaintext = 'Test message';
      const invalidKey = null;
      
      expect(() => service.encryptField(plaintext, invalidKey)).toThrow('Failed to encrypt field');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to encrypt notification field', 
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('decryptField', () => {
    test('should handle decryption errors with invalid data', () => {
      const key = Buffer.alloc(32, 1);
      const invalidEncrypted = 'invalidbase64!@#';
      
      expect(() => service.decryptField(invalidEncrypted, key)).toThrow('Failed to decrypt field');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to decrypt notification field', 
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    test('should handle decryption with wrong key', () => {
      const plaintext = 'Test message';
      const key1 = Buffer.alloc(32, 1);
      const key2 = Buffer.alloc(32, 2);
      
      const encrypted = service.encryptField(plaintext, key1);
      
      expect(() => service.decryptField(encrypted, key2)).toThrow('Failed to decrypt field');
    });
  });

  describe('encryptNotificationContent', () => {
    test('should encrypt notification content successfully', () => {
      const result = service.encryptNotificationContent(testNotification, testPassword);
      
      expect(result).toHaveProperty('encryptedTitle');
      expect(result).toHaveProperty('encryptedMessage');
      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('salt');
      
      expect(typeof result.encryptedTitle).toBe('string');
      expect(typeof result.encryptedMessage).toBe('string');
      expect(typeof result.encryptedData).toBe('string');
      expect(typeof result.salt).toBe('string');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification content encrypted successfully',
        expect.objectContaining({
          titleLength: testNotification.title.length,
          messageLength: testNotification.message.length,
          hasData: true
        })
      );
    });

    test('should encrypt notification without data field', () => {
      const notificationWithoutData = {
        title: 'Test Title',
        message: 'Test Message'
      };
      
      const result = service.encryptNotificationContent(notificationWithoutData, testPassword);
      
      expect(result.encryptedTitle).toBeDefined();
      expect(result.encryptedMessage).toBeDefined();
      expect(result.encryptedData).toBeNull();
      expect(result.salt).toBeDefined();
    });

    test('should use provided salt if given', () => {
      const providedSalt = service.generateSalt();
      
      const result = service.encryptNotificationContent(testNotification, testPassword, providedSalt);
      
      expect(result.salt).toBe(providedSalt);
    });

    test('should require title and message', () => {
      const invalidNotification = { title: '', message: 'Test' };
      
      expect(() => service.encryptNotificationContent(invalidNotification, testPassword))
        .toThrow('Failed to encrypt notification content');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to encrypt notification content',
        expect.objectContaining({ error: 'Title and message are required for notification encryption' })
      );
    });

    test('should handle encryption errors', () => {
      jest.spyOn(service, 'encryptField').mockImplementation(() => {
        throw new Error('Field encryption failed');
      });

      expect(() => service.encryptNotificationContent(testNotification, testPassword))
        .toThrow('Failed to encrypt notification content');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to encrypt notification content',
        expect.objectContaining({ error: 'Field encryption failed' })
      );

      service.encryptField.mockRestore();
    });
  });

  describe('decryptNotificationContent', () => {
    test('should decrypt notification content successfully', () => {
      const encrypted = service.encryptNotificationContent(testNotification, testPassword);
      const decrypted = service.decryptNotificationContent(encrypted, testPassword, encrypted.salt);
      
      expect(decrypted.title).toBe(testNotification.title);
      expect(decrypted.message).toBe(testNotification.message);
      expect(decrypted.data).toEqual(testNotification.data);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification content decrypted successfully',
        expect.objectContaining({
          titleLength: testNotification.title.length,
          messageLength: testNotification.message.length,
          hasData: true
        })
      );
    });

    test('should handle notification without data field', () => {
      const notificationWithoutData = {
        title: 'Test Title',
        message: 'Test Message'
      };
      
      const encrypted = service.encryptNotificationContent(notificationWithoutData, testPassword);
      const decrypted = service.decryptNotificationContent(encrypted, testPassword, encrypted.salt);
      
      expect(decrypted.title).toBe(notificationWithoutData.title);
      expect(decrypted.message).toBe(notificationWithoutData.message);
      expect(decrypted.data).toBeNull();
    });

    test('should handle decryption errors', () => {
      const encrypted = service.encryptNotificationContent(testNotification, testPassword);
      
      expect(() => service.decryptNotificationContent(encrypted, 'wrongpassword', encrypted.salt))
        .toThrow('Failed to decrypt notification content');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to decrypt notification content',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    test('should handle invalid JSON in data field', () => {
      jest.spyOn(service, 'decryptField').mockImplementation((field, key) => {
        if (field === 'encryptedDataField') {
          return 'invalid json {';
        }
        return field === 'encryptedTitle' ? 'Title' : 'Message';
      });

      const mockEncrypted = {
        encryptedTitle: 'encryptedTitle',
        encryptedMessage: 'encryptedMessage',
        encryptedData: 'encryptedDataField'
      };

      expect(() => service.decryptNotificationContent(mockEncrypted, testPassword, 'salt'))
        .toThrow('Failed to decrypt notification content');

      service.decryptField.mockRestore();
    });
  });

  describe('migratePlaintextNotification', () => {
    test('should migrate plaintext notification successfully', () => {
      const result = service.migratePlaintextNotification(testNotification, testPassword);
      
      expect(result).toHaveProperty('encryptedTitle');
      expect(result).toHaveProperty('encryptedMessage');
      expect(result).toHaveProperty('encryptedData');
      expect(result).toHaveProperty('notificationSalt');
      expect(result).toHaveProperty('notificationIv');
      
      expect(result.notificationIv).toBeNull();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Migrating plaintext notification to encrypted format');
    });

    test('should handle migration errors', () => {
      jest.spyOn(service, 'encryptNotificationContent').mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      expect(() => service.migratePlaintextNotification(testNotification, testPassword))
        .toThrow('Failed to migrate notification');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to migrate notification',
        expect.objectContaining({ error: 'Encryption failed' })
      );

      service.encryptNotificationContent.mockRestore();
    });
  });

  describe('verifyEncryptedNotification', () => {
    test('should verify valid encrypted notification', () => {
      const encrypted = service.encryptNotificationContent(testNotification, testPassword);
      const isValid = service.verifyEncryptedNotification(encrypted, testPassword, encrypted.salt);
      
      expect(isValid).toBe(true);
    });

    test('should return false for invalid password', () => {
      const encrypted = service.encryptNotificationContent(testNotification, testPassword);
      const isValid = service.verifyEncryptedNotification(encrypted, 'wrongpassword', encrypted.salt);
      
      expect(isValid).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to verify encrypted notification',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    test('should return false for notification without required fields', () => {
      jest.spyOn(service, 'decryptNotificationContent').mockReturnValue({
        title: '',
        message: 'Message',
        data: null
      });

      const encrypted = service.encryptNotificationContent(testNotification, testPassword);
      const isValid = service.verifyEncryptedNotification(encrypted, testPassword, encrypted.salt);
      
      expect(isValid).toBe(false);

      service.decryptNotificationContent.mockRestore();
    });
  });

  describe('clearMemory', () => {
    test('should clear buffer memory', () => {
      const buffer = Buffer.from('sensitive data', 'utf8');
      const originalData = buffer.toString();
      
      service.clearMemory(buffer);
      
      expect(buffer.toString()).not.toBe(originalData);
      expect(buffer.every(byte => byte === 0)).toBe(true);
    });

    test('should handle non-buffer inputs gracefully', () => {
      expect(() => service.clearMemory(null)).not.toThrow();
      expect(() => service.clearMemory(undefined)).not.toThrow();
      expect(() => service.clearMemory('string')).not.toThrow();
      expect(() => service.clearMemory({})).not.toThrow();
    });

    test('should handle buffer without fill method', () => {
      const mockBuffer = {};
      expect(() => service.clearMemory(mockBuffer)).not.toThrow();
    });
  });

  describe('Integration tests', () => {
    test('should encrypt and decrypt complex notification data', () => {
      const complexNotification = {
        title: 'Password Expiry Warning',
        message: 'Your password for account "test@example.com" will expire in 7 days. Please update your password.',
        data: {
          userId: 'user-123-456',
          accountEmail: 'test@example.com',
          expiryDate: '2024-01-15T10:30:00Z',
          urgency: 'high',
          actions: ['change_password', 'extend_expiry'],
          metadata: {
            lastLogin: '2024-01-01T10:30:00Z',
            loginCount: 42
          }
        }
      };

      const encrypted = service.encryptNotificationContent(complexNotification, testPassword);
      const decrypted = service.decryptNotificationContent(encrypted, testPassword, encrypted.salt);

      expect(decrypted).toEqual(complexNotification);
    });

    test('should handle unicode and special characters', () => {
      const unicodeNotification = {
        title: '🔒 Sécurité Important! 重要通知',
        message: 'Votre mot de passe contient des caractères spéciaux: !@#$%^&*()',
        data: { emoji: '💡', chinese: '密码', french: 'français' }
      };

      const encrypted = service.encryptNotificationContent(unicodeNotification, testPassword);
      const decrypted = service.decryptNotificationContent(encrypted, testPassword, encrypted.salt);

      expect(decrypted).toEqual(unicodeNotification);
    });

    test('should handle very long notification content', () => {
      const longContent = 'A'.repeat(10000);
      const longNotification = {
        title: longContent,
        message: longContent,
        data: { longField: longContent }
      };

      const encrypted = service.encryptNotificationContent(longNotification, testPassword);
      const decrypted = service.decryptNotificationContent(encrypted, testPassword, encrypted.salt);

      expect(decrypted).toEqual(longNotification);
    });
  });
});