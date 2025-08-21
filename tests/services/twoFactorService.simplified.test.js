/**
 * Simplified Two-Factor Service Tests
 * Unit tests for 2FA functionality without external dependencies
 */

// Mock external dependencies FIRST before any imports
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('argon2');
jest.mock('../../src/utils/logger');

describe('TwoFactorService - Simplified Tests', () => {
  let twoFactorService;
  let TwoFactorService;
  let speakeasy;
  let QRCode;
  let argon2;
  let logger;
  let crypto;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Require all modules fresh for each test
    speakeasy = require('speakeasy');
    QRCode = require('qrcode');
    argon2 = require('argon2');
    logger = require('../../src/utils/logger').logger;
    crypto = require('crypto');
    
    // Setup logger mocks
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Setup speakeasy mocks
    speakeasy.generateSecret = jest.fn();
    speakeasy.totp = jest.fn();
    speakeasy.totp.verify = jest.fn();
    
    // Setup QRCode mocks
    QRCode.toDataURL = jest.fn();
    
    // Setup argon2 mocks
    argon2.hash = jest.fn();
    argon2.verify = jest.fn();
    
    // Mock crypto.randomInt
    jest.spyOn(crypto, 'randomInt').mockImplementation(() => 12345678);
    
    // Require service after all mocks are configured
    TwoFactorService = require('../../src/services/twoFactorService');
    
    // Create service instance
    twoFactorService = new TwoFactorService();
  });
  
  afterEach(() => {
    // Restore crypto.randomInt
    if (crypto && crypto.randomInt && crypto.randomInt.mockRestore) {
      crypto.randomInt.mockRestore();
    }
  });

  describe('Service Initialization', () => {
    test('should initialize with correct app name and issuer', () => {
      expect(twoFactorService.appName).toBe('Lockr Password Manager');
      expect(twoFactorService.issuer).toBe('Lockr');
    });
  });

  describe('Secret Generation', () => {
    test('should generate TOTP secret for user', async () => {
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Lockr%20Password%20Manager:user@example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Lockr'
      };
      const mockQRCode = 'data:image/png;base64,mockQRCodeData';

      speakeasy.generateSecret.mockReturnValue(mockSecret);
      QRCode.toDataURL.mockResolvedValue(mockQRCode);

      const result = await twoFactorService.generateSecret('user@example.com');

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'Lockr Password Manager (user@example.com)',
        issuer: 'Lockr',
        length: 32
      });

      expect(QRCode.toDataURL).toHaveBeenCalledWith(mockSecret.otpauth_url);

      expect(result).toEqual({
        secret: mockSecret.base32,
        qrCodeUrl: mockQRCode,
        manualEntryKey: mockSecret.base32,
        otpauthUrl: mockSecret.otpauth_url
      });

      expect(logger.info).toHaveBeenCalledWith('2FA secret generated', {
        userEmail: 'user@example.com',
        secretLength: mockSecret.base32.length
      });
    });

    test('should handle error in secret generation', async () => {
      const error = new Error('Generation failed');
      speakeasy.generateSecret.mockImplementation(() => {
        throw error;
      });

      await expect(twoFactorService.generateSecret('user@example.com'))
        .rejects.toThrow('Failed to generate 2FA secret');

      expect(logger.error).toHaveBeenCalledWith('Failed to generate 2FA secret', {
        userEmail: 'user@example.com',
        error: error.message
      });
    });

    test('should handle QR code generation error', async () => {
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/test'
      };
      
      speakeasy.generateSecret.mockReturnValue(mockSecret);
      QRCode.toDataURL.mockRejectedValue(new Error('QR generation failed'));

      await expect(twoFactorService.generateSecret('user@example.com'))
        .rejects.toThrow('Failed to generate 2FA secret');
    });
  });

  describe('Token Verification', () => {
    test('should verify valid TOTP token', () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const token = '123456';
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      
      const result = twoFactorService.verifyToken(token, secret);

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        encoding: 'base32',
        token,
        window: 2,
        time: expect.any(Number)
      });

      expect(logger.info).toHaveBeenCalledWith('2FA token verification attempt', {
        success: true,
        tokenLength: 6,
        window: 2
      });
    });

    test('should reject invalid TOTP token', () => {
      speakeasy.totp.verify.mockReturnValue(false);

      const token = '000000';
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      
      const result = twoFactorService.verifyToken(token, secret);

      expect(result).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('2FA token verification attempt', {
        success: false,
        tokenLength: 6,
        window: 2
      });
    });

    test('should handle token with spaces', () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const token = '123 456';
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      
      const result = twoFactorService.verifyToken(token, secret);

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        encoding: 'base32',
        token: '123456', // Spaces removed
        window: 2,
        time: expect.any(Number)
      });
    });

    test('should use custom window parameter', () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const token = '123456';
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      const window = 5;
      
      const result = twoFactorService.verifyToken(token, secret, window);

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        encoding: 'base32',
        token,
        window: 5,
        time: expect.any(Number)
      });
    });

    test('should handle verification error gracefully', () => {
      speakeasy.totp.verify.mockImplementation(() => {
        throw new Error('Verification error');
      });

      const token = '123456';
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      
      const result = twoFactorService.verifyToken(token, secret);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('2FA token verification failed', {
        error: 'Verification error',
        tokenLength: 6
      });
    });

    test('should handle null token', () => {
      const result = twoFactorService.verifyToken(null, 'secret');
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    test('should handle undefined token', () => {
      const result = twoFactorService.verifyToken(undefined, 'secret');
      
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    test('should handle empty token', () => {
      speakeasy.totp.verify.mockReturnValue(false);
      
      const result = twoFactorService.verifyToken('', 'secret');
      
      expect(result).toBe(false);
    });
  });

  describe('Backup Codes', () => {
    test('should generate backup codes', async () => {
      const count = 5;
      
      // Mock crypto.randomInt
      crypto.randomInt.mockReset();
      crypto.randomInt
        .mockReturnValueOnce(12345678)
        .mockReturnValueOnce(23456789)
        .mockReturnValueOnce(34567890)
        .mockReturnValueOnce(45678901)
        .mockReturnValueOnce(56789012);
      
      // Mock argon2.hash
      argon2.hash.mockImplementation((code) => 
        Promise.resolve(`$argon2id$mockHash$${code}`)
      );

      const result = await twoFactorService.generateBackupCodes(count);

      expect(result).toBeDefined();
      expect(result.plainCodes).toBeDefined();
      expect(result.hashedCodes).toBeDefined();
      expect(Array.isArray(result.plainCodes)).toBe(true);
      expect(Array.isArray(result.hashedCodes)).toBe(true);
      expect(result.plainCodes.length).toBe(count);
      expect(result.hashedCodes.length).toBe(count);

      // Check format of codes (8-digit numbers as strings)
      result.plainCodes.forEach(code => {
        expect(typeof code).toBe('string');
        expect(code).toMatch(/^\d{8}$/);
      });

      // Check that hashed codes are different from plain codes
      result.hashedCodes.forEach((hash, index) => {
        expect(hash).not.toBe(result.plainCodes[index]);
        expect(hash).toContain('$argon2');
      });
    });

    test('should generate default 10 backup codes', async () => {
      // Mock crypto.randomInt to return different values
      crypto.randomInt.mockReset();
      crypto.randomInt.mockImplementation(() => 
        Math.floor(Math.random() * 90000000) + 10000000
      );
      
      // Mock argon2.hash
      argon2.hash.mockImplementation((code) => 
        Promise.resolve(`$argon2id$mockHash$${code}`)
      );

      const result = await twoFactorService.generateBackupCodes();

      expect(result.plainCodes.length).toBe(10);
      expect(result.hashedCodes.length).toBe(10);
    });

    test('should generate unique backup codes', async () => {
      // Mock crypto.randomInt to return unique values
      let counter = 10000000;
      crypto.randomInt.mockReset();
      crypto.randomInt.mockImplementation(() => counter++);
      
      // Mock argon2.hash
      argon2.hash.mockImplementation((code) => 
        Promise.resolve(`$argon2id$mockHash$${code}`)
      );

      const result = await twoFactorService.generateBackupCodes(10);
      const uniqueCodes = new Set(result.plainCodes);

      expect(uniqueCodes.size).toBe(10);
    });

    test('should handle backup code generation error', async () => {
      // Mock crypto.randomInt to throw error
      crypto.randomInt.mockReset();
      crypto.randomInt.mockImplementation(() => {
        throw new Error('Random generation failed');
      });

      await expect(twoFactorService.generateBackupCodes())
        .rejects.toThrow('Failed to generate backup codes');
    });
  });

  describe('Backup Code Verification', () => {
    test('should verify valid backup code', async () => {
      const code = '12345678';
      const hashedCodes = [
        '$argon2id$v=19$m=65536,t=3,p=4$wrongHash',
        '$argon2id$v=19$m=65536,t=3,p=4$correctHash',
        '$argon2id$v=19$m=65536,t=3,p=4$anotherHash'
      ];

      // Mock argon2.verify to return true for second hash
      argon2.verify
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await twoFactorService.verifyBackupCode(code, hashedCodes);

      expect(result.valid).toBe(true);
      expect(result.usedIndex).toBe(1);
      expect(argon2.verify).toHaveBeenCalledTimes(2);
    });

    test('should reject invalid backup code', async () => {
      const code = '00000000';
      const hashedCodes = [
        '$argon2id$v=19$m=65536,t=3,p=4$hash1',
        '$argon2id$v=19$m=65536,t=3,p=4$hash2'
      ];

      // Mock argon2.verify to return false
      argon2.verify.mockResolvedValue(false);

      const result = await twoFactorService.verifyBackupCode(code, hashedCodes);

      expect(result.valid).toBe(false);
      expect(result.usedIndex).toBe(-1);
    });

    test('should handle verification error', async () => {
      const code = '12345678';
      const hashedCodes = ['$argon2id$v=19$m=65536,t=3,p=4$mockHash'];

      // Mock argon2.verify to throw error
      argon2.verify.mockRejectedValue(new Error('Verification failed'));

      const result = await twoFactorService.verifyBackupCode(code, hashedCodes);

      expect(result.valid).toBe(false);
      expect(result.usedIndex).toBe(-1);
      expect(logger.error).toHaveBeenCalled();
    });

    test('should remove spaces from backup code', async () => {
      const code = '1234 5678';
      const hashedCodes = ['$argon2id$v=19$m=65536,t=3,p=4$mockHash'];

      // Mock argon2.verify
      argon2.verify.mockResolvedValue(true);

      await twoFactorService.verifyBackupCode(code, hashedCodes);

      // Should verify with spaces removed
      expect(argon2.verify).toHaveBeenCalledWith(hashedCodes[0], '12345678');
    });
  });

  describe('Additional Methods', () => {
    test('should get current TOTP token', () => {
      const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      const mockToken = '123456';

      speakeasy.totp.mockReturnValue(mockToken);

      const result = twoFactorService.getCurrentToken(secret);

      expect(result).toBe(mockToken);
      expect(speakeasy.totp).toHaveBeenCalledWith({
        secret,
        encoding: 'base32'
      });
    });

    test('should handle error in getCurrentToken', () => {
      const secret = 'INVALID_SECRET';

      speakeasy.totp.mockImplementation(() => {
        throw new Error('Invalid secret');
      });

      expect(() => twoFactorService.getCurrentToken(secret))
        .toThrow('Failed to generate current token');

      expect(logger.error).toHaveBeenCalled();
    });

    test('should validate secret format', () => {
      // Valid secrets
      expect(twoFactorService.isValidSecret('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')).toBe(true);
      expect(twoFactorService.isValidSecret('ABCDEFGHIJKLMNOP')).toBe(true);
      
      // Invalid secrets
      expect(twoFactorService.isValidSecret('short')).toBe(false);
      expect(twoFactorService.isValidSecret('invalid!@#$')).toBe(false);
      expect(twoFactorService.isValidSecret('')).toBe(false);
      expect(twoFactorService.isValidSecret(null)).toBe(false);
      expect(twoFactorService.isValidSecret(123)).toBe(false);
    });

    test('should remove used backup code', () => {
      const hashedCodes = ['hash1', 'hash2', 'hash3', 'hash4'];
      const usedIndex = 1;

      const result = twoFactorService.removeUsedBackupCode(hashedCodes, usedIndex);

      expect(result).toEqual(['hash1', 'hash3', 'hash4']);
      expect(result.length).toBe(3);
      expect(logger.info).toHaveBeenCalledWith('Backup code removed after use', {
        removedIndex: 1,
        remainingCodes: 3
      });
    });

    test('should not remove code with invalid index', () => {
      const hashedCodes = ['hash1', 'hash2', 'hash3'];

      // Invalid index
      let result = twoFactorService.removeUsedBackupCode(hashedCodes, -1);
      expect(result).toEqual(hashedCodes);

      result = twoFactorService.removeUsedBackupCode(hashedCodes, 10);
      expect(result).toEqual(hashedCodes);
    });

    test('should get setup instructions', () => {
      const instructions = twoFactorService.getSetupInstructions();

      expect(instructions).toBeDefined();
      expect(instructions.steps).toBeDefined();
      expect(instructions.supportedApps).toBeDefined();
      expect(Array.isArray(instructions.steps)).toBe(true);
      expect(Array.isArray(instructions.supportedApps)).toBe(true);
      expect(instructions.steps.length).toBeGreaterThan(0);
    });
  });
});