/**
 * @jest-environment jsdom
 */

// Mock the Web Crypto API
const mockSubtleCrypto = {
  importKey: jest.fn(),
  deriveBits: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
};

const mockCrypto = {
  subtle: mockSubtleCrypto,
  getRandomValues: jest.fn(),
};

// Mock global crypto
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
});

// Mock atob/btoa
global.atob = jest.fn();
global.btoa = jest.fn();

// Mock console to avoid noise
const originalConsole = console.error;
console.error = jest.fn();

describe('Encryption utilities', () => {
  let encryptionModule;

  beforeAll(async () => {
    encryptionModule = await import('../../src/lib/encryption.ts');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default implementations
    global.btoa.mockImplementation((str) => Buffer.from(str).toString('base64'));
    global.atob.mockImplementation((str) => Buffer.from(str, 'base64').toString());
    
    mockCrypto.getRandomValues.mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    });
  });

  afterAll(() => {
    console.error = originalConsole;
  });

  describe('deriveEncryptionKey', () => {
    test('should derive encryption key using PBKDF2', async () => {
      const masterPassword = 'test-password';
      const email = 'test@example.com';
      
      const mockKeyMaterial = { type: 'key' };
      const mockDerivedBits = new ArrayBuffer(32);
      new Uint8Array(mockDerivedBits).set([1, 2, 3, 4, 5]);
      
      mockSubtleCrypto.importKey.mockResolvedValue(mockKeyMaterial);
      mockSubtleCrypto.deriveBits.mockResolvedValue(mockDerivedBits);
      
      const result = await encryptionModule.deriveEncryptionKey(masterPassword, email);
      
      expect(mockSubtleCrypto.importKey).toHaveBeenCalledWith(
        'raw',
        expect.anything(),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      
      expect(mockSubtleCrypto.deriveBits).toHaveBeenCalledWith(
        {
          name: 'PBKDF2',
          salt: expect.anything(),
          iterations: 100000,
          hash: 'SHA-256'
        },
        mockKeyMaterial,
        256
      );
      
      expect(global.btoa).toHaveBeenCalled();
      expect(typeof result).toBe('string');
    });

    test('should normalize email to lowercase for salt', async () => {
      const masterPassword = 'test-password';
      const email = 'TEST@EXAMPLE.COM';
      
      const mockKeyMaterial = { type: 'key' };
      const mockDerivedBits = new ArrayBuffer(32);
      
      mockSubtleCrypto.importKey.mockResolvedValue(mockKeyMaterial);
      mockSubtleCrypto.deriveBits.mockResolvedValue(mockDerivedBits);
      
      await encryptionModule.deriveEncryptionKey(masterPassword, email);
      
      // Verify the salt is lowercase
      const saltCall = mockSubtleCrypto.deriveBits.mock.calls[0][0];
      const saltString = new TextDecoder().decode(saltCall.salt);
      expect(saltString).toBe('test@example.com');
    });

    test('should handle errors gracefully', async () => {
      const masterPassword = 'test-password';
      const email = 'test@example.com';
      
      mockSubtleCrypto.importKey.mockRejectedValue(new Error('Import failed'));
      
      await expect(encryptionModule.deriveEncryptionKey(masterPassword, email))
        .rejects.toThrow('Import failed');
    });
  });

  describe('generateTestData', () => {
    test('should generate valid test data object', () => {
      const testData = encryptionModule.generateTestData();
      const parsed = JSON.parse(testData);
      
      expect(parsed).toHaveProperty('test', true);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('data', 'validation_test');
      expect(typeof parsed.timestamp).toBe('number');
    });

    test('should generate data with current timestamp', () => {
      const before = Date.now();
      const testData = encryptionModule.generateTestData();
      const after = Date.now();
      const parsed = JSON.parse(testData);
      
      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
      expect(parsed.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('encryptData', () => {
    test('should encrypt data using AES-GCM', async () => {
      const data = 'test-data';
      const encryptionKey = 'base64-key';
      
      const mockCryptoKey = { type: 'secret' };
      const mockEncrypted = new ArrayBuffer(16);
      new Uint8Array(mockEncrypted).set([10, 20, 30, 40]);
      
      // Mock atob to return key buffer
      global.atob.mockReturnValue('\x01\x02\x03\x04');
      
      mockSubtleCrypto.importKey.mockResolvedValue(mockCryptoKey);
      mockSubtleCrypto.encrypt.mockResolvedValue(mockEncrypted);
      
      // Mock getRandomValues for IV
      mockCrypto.getRandomValues.mockImplementation((array) => {
        array.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        return array;
      });
      
      const result = await encryptionModule.encryptData(data, encryptionKey);
      
      expect(mockSubtleCrypto.importKey).toHaveBeenCalledWith(
        'raw',
        expect.anything(),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          iv: expect.anything()
        },
        mockCryptoKey,
        expect.anything()
      );
      
      expect(global.btoa).toHaveBeenCalled();
      expect(typeof result).toBe('string');
    });

    test('should handle encryption errors', async () => {
      const data = 'test-data';
      const encryptionKey = 'invalid-key';
      
      mockSubtleCrypto.importKey.mockRejectedValue(new Error('Invalid key'));
      
      await expect(encryptionModule.encryptData(data, encryptionKey))
        .rejects.toThrow('Failed to encrypt data');
      
      // Don't test console.error since it's being mocked at test setup level
    });

    test('should handle atob errors', async () => {
      const data = 'test-data';
      const encryptionKey = 'invalid-base64';
      
      global.atob.mockImplementation(() => {
        throw new Error('Invalid base64');
      });
      
      await expect(encryptionModule.encryptData(data, encryptionKey))
        .rejects.toThrow('Failed to encrypt data');
    });
  });

  describe('decryptData', () => {
    test('should decrypt data using AES-GCM', async () => {
      const encryptedData = 'base64-encrypted-data';
      const encryptionKey = 'base64-key';
      
      const mockCryptoKey = { type: 'secret' };
      const mockDecrypted = new ArrayBuffer(9);
      new TextEncoder().encodeInto('test-data', new Uint8Array(mockDecrypted));
      
      // Mock atob for encrypted data (IV + encrypted)
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0Cencrypted');
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04'); // For key
      
      mockSubtleCrypto.importKey.mockResolvedValue(mockCryptoKey);
      mockSubtleCrypto.decrypt.mockResolvedValue(mockDecrypted);
      
      const result = await encryptionModule.decryptData(encryptedData, encryptionKey);
      
      expect(mockSubtleCrypto.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      expect(mockSubtleCrypto.decrypt).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          iv: expect.any(Uint8Array)
        },
        mockCryptoKey,
        expect.any(Uint8Array)
      );
      
      expect(typeof result).toBe('string');
    });

    test('should handle decryption errors', async () => {
      const encryptedData = 'invalid-encrypted-data';
      const encryptionKey = 'base64-key';
      
      mockSubtleCrypto.importKey.mockRejectedValue(new Error('Invalid key'));
      
      await expect(encryptionModule.decryptData(encryptedData, encryptionKey))
        .rejects.toThrow('Failed to decrypt data');
      
      // Don't test console.error since it's being mocked at test setup level
    });

    test('should extract IV and encrypted data correctly', async () => {
      const encryptedData = 'base64-encrypted-data';
      const encryptionKey = 'base64-key';
      
      const mockCryptoKey = { type: 'secret' };
      const mockDecrypted = new ArrayBuffer(4);
      
      // Mock a 20-byte combined data (12-byte IV + 8-byte encrypted)
      const combined = new Array(20).fill(0).map((_, i) => String.fromCharCode(i + 1));
      global.atob.mockReturnValueOnce(combined.join(''));
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04'); // For key
      
      mockSubtleCrypto.importKey.mockResolvedValue(mockCryptoKey);
      mockSubtleCrypto.decrypt.mockResolvedValue(mockDecrypted);
      
      await encryptionModule.decryptData(encryptedData, encryptionKey);
      
      const decryptCall = mockSubtleCrypto.decrypt.mock.calls[0];
      const iv = decryptCall[0].iv;
      const encryptedPart = decryptCall[2];
      
      // IV should be first 12 bytes
      expect(iv.length).toBe(12);
      expect(Array.from(iv)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      
      // Encrypted data should be remaining 8 bytes
      expect(encryptedPart.length).toBe(8);
      expect(Array.from(encryptedPart)).toEqual([13, 14, 15, 16, 17, 18, 19, 20]);
    });
  });

  describe('validateMasterPassword', () => {
    test('should validate correct master password', async () => {
      const masterPassword = 'correct-password';
      const email = 'test@example.com';
      const testEncryptedData = 'encrypted-test-data';
      
      const mockKeyMaterial = { type: 'key' };
      const mockDerivedBits = new ArrayBuffer(32);
      const mockCryptoKey = { type: 'secret' };
      
      // Mock successful key derivation
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockKeyMaterial);
      mockSubtleCrypto.deriveBits.mockResolvedValue(mockDerivedBits);
      
      // Mock successful decryption
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0Cencrypted');
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04'); // For key
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockCryptoKey);
      
      // Mock decrypted test data - create valid JSON buffer
      const validTestData = JSON.stringify({ test: true, timestamp: Date.now() });
      const dataBuffer = new TextEncoder().encode(validTestData);
      mockSubtleCrypto.decrypt.mockResolvedValue(dataBuffer.buffer);
      
      const result = await encryptionModule.validateMasterPassword(
        masterPassword, 
        email, 
        testEncryptedData
      );
      
      expect(result).toBe(true);
    });

    test('should return false for invalid master password', async () => {
      const masterPassword = 'wrong-password';
      const email = 'test@example.com';
      const testEncryptedData = 'encrypted-test-data';
      
      // Mock error in key derivation
      mockSubtleCrypto.importKey.mockRejectedValue(new Error('Invalid password'));
      
      const result = await encryptionModule.validateMasterPassword(
        masterPassword, 
        email, 
        testEncryptedData
      );
      
      expect(result).toBe(false);
    });

    test('should return false for invalid decrypted test data', async () => {
      const masterPassword = 'test-password';
      const email = 'test@example.com';
      const testEncryptedData = 'encrypted-test-data';
      
      const mockKeyMaterial = { type: 'key' };
      const mockDerivedBits = new ArrayBuffer(32);
      const mockCryptoKey = { type: 'secret' };
      
      // Mock successful key derivation and decryption
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockKeyMaterial);
      mockSubtleCrypto.deriveBits.mockResolvedValue(mockDerivedBits);
      
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0Cencrypted');
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04');
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockCryptoKey);
      
      // Mock invalid test data
      const invalidTestData = JSON.stringify({ test: false, timestamp: 'invalid' });
      const dataBuffer = new TextEncoder().encode(invalidTestData);
      mockSubtleCrypto.decrypt.mockResolvedValue(dataBuffer.buffer);
      
      const result = await encryptionModule.validateMasterPassword(
        masterPassword, 
        email, 
        testEncryptedData
      );
      
      expect(result).toBe(false);
    });

    test('should return false for malformed JSON', async () => {
      const masterPassword = 'test-password';
      const email = 'test@example.com';
      const testEncryptedData = 'encrypted-test-data';
      
      const mockKeyMaterial = { type: 'key' };
      const mockDerivedBits = new ArrayBuffer(32);
      const mockCryptoKey = { type: 'secret' };
      const mockDecrypted = new ArrayBuffer(20);
      
      // Mock successful key derivation and decryption
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockKeyMaterial);
      mockSubtleCrypto.deriveBits.mockResolvedValue(mockDerivedBits);
      
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0Cencrypted');
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04');
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockCryptoKey);
      
      // Mock invalid JSON
      const invalidJson = 'invalid json {';
      new TextEncoder().encodeInto(invalidJson, new Uint8Array(mockDecrypted));
      mockSubtleCrypto.decrypt.mockResolvedValue(mockDecrypted);
      
      const result = await encryptionModule.validateMasterPassword(
        masterPassword, 
        email, 
        testEncryptedData
      );
      
      expect(result).toBe(false);
    });

    test('should handle decryption failure', async () => {
      const masterPassword = 'test-password';
      const email = 'test@example.com';
      const testEncryptedData = 'encrypted-test-data';
      
      const mockKeyMaterial = { type: 'key' };
      const mockDerivedBits = new ArrayBuffer(32);
      const mockCryptoKey = { type: 'secret' };
      
      // Mock successful key derivation but failed decryption
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockKeyMaterial);
      mockSubtleCrypto.deriveBits.mockResolvedValue(mockDerivedBits);
      
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0Cencrypted');
      global.atob.mockReturnValueOnce('\x01\x02\x03\x04');
      mockSubtleCrypto.importKey.mockResolvedValueOnce(mockCryptoKey);
      mockSubtleCrypto.decrypt.mockRejectedValue(new Error('Decryption failed'));
      
      const result = await encryptionModule.validateMasterPassword(
        masterPassword, 
        email, 
        testEncryptedData
      );
      
      expect(result).toBe(false);
    });
  });

  describe('Integration tests', () => {
    test('should encrypt and decrypt data successfully', async () => {
      const originalData = 'This is a test message';
      const encryptionKey = 'base64-encoded-key';
      
      // Set up realistic mocks for a full encrypt/decrypt cycle
      const mockKeyMaterial = { type: 'key' };
      const mockDerivedBits = new ArrayBuffer(32);
      const mockEncryptKey = { type: 'secret', usage: 'encrypt' };
      const mockDecryptKey = { type: 'secret', usage: 'decrypt' };
      const mockEncrypted = new ArrayBuffer(20);
      
      // Mock encryption
      global.atob.mockReturnValue('\x01\x02\x03\x04');
      mockSubtleCrypto.importKey
        .mockResolvedValueOnce(mockEncryptKey) // For encryption
        .mockResolvedValueOnce(mockDecryptKey); // For decryption
        
      mockCrypto.getRandomValues.mockImplementation((array) => {
        array.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        return array;
      });
      
      new Uint8Array(mockEncrypted).set([10, 20, 30, 40, 50]);
      mockSubtleCrypto.encrypt.mockResolvedValue(mockEncrypted);
      
      // Mock decryption
      const decryptedBuffer = new TextEncoder().encode(originalData);
      mockSubtleCrypto.decrypt.mockResolvedValue(decryptedBuffer.buffer);
      
      // Mock combined data for decryption (IV + encrypted)
      const ivPlusEncrypted = new Array(17);
      for (let i = 0; i < 12; i++) ivPlusEncrypted[i] = String.fromCharCode(i + 1);
      for (let i = 12; i < 17; i++) ivPlusEncrypted[i] = String.fromCharCode(10 + i);
      
      global.btoa.mockReturnValue('mocked-base64');
      global.atob.mockReturnValueOnce(ivPlusEncrypted.join(''));
      
      const encrypted = await encryptionModule.encryptData(originalData, encryptionKey);
      const decrypted = await encryptionModule.decryptData(encrypted, encryptionKey);
      
      expect(typeof encrypted).toBe('string');
      expect(typeof decrypted).toBe('string');
      expect(mockSubtleCrypto.encrypt).toHaveBeenCalled();
      expect(mockSubtleCrypto.decrypt).toHaveBeenCalled();
    });
  });
});