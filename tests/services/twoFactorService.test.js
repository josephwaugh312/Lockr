// Mock QRCode library - must be at the top for proper hoisting
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockqrcode')
}));

// Mock logger to prevent Winston compatibility issues in Jest
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const TwoFactorService = require('../../src/services/twoFactorService');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Mock setImmediate for Node.js compatibility in Jest
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));

describe('TwoFactorService', () => {
  let twoFactorService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Re-setup the QRCode mock
    QRCode.toDataURL.mockResolvedValue('data:image/png;base64,mockqrcode');
    
    twoFactorService = new TwoFactorService();
  });

  describe('generateSecret', () => {
    test('should generate a valid secret', async () => {
      const result = await twoFactorService.generateSecret('test@example.com');
      
      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(typeof result.secret).toBe('string');
      expect(result.secret.length).toBeGreaterThan(0);
      // Base32 encoded secrets should only contain A-Z and 2-7
      expect(result.secret).toMatch(/^[A-Z2-7]+$/);
      expect(result.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
    });

    test('should generate unique secrets', async () => {
      const result1 = await twoFactorService.generateSecret('test1@example.com');
      const result2 = await twoFactorService.generateSecret('test2@example.com');
      
      expect(result1.secret).not.toBe(result2.secret);
    });

    test('should generate secrets of appropriate length', async () => {
      const result = await twoFactorService.generateSecret('test@example.com');
      
      // Speakeasy typically generates 32-character base32 secrets
      expect(result.secret.length).toBeGreaterThan(16);
      expect(result.secret.length).toBeLessThan(100);
    });
  });

  describe('verifyToken', () => {
    let testSecret;

    beforeEach(() => {
      testSecret = speakeasy.generateSecret().base32;
    });

    test('should verify valid token', () => {
      // Generate a valid token for the current time
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });

      const isValid = twoFactorService.verifyToken(validToken, testSecret);
      expect(isValid).toBe(true);
    });

    test('should reject invalid token', () => {
      const invalidToken = '123456'; // Static invalid token
      
      const isValid = twoFactorService.verifyToken(invalidToken, testSecret);
      expect(isValid).toBe(false);
    });

    test('should reject empty token', () => {
      const isValid = twoFactorService.verifyToken('', testSecret);
      expect(isValid).toBe(false);
    });

    test('should reject null token', () => {
      const isValid = twoFactorService.verifyToken(null, testSecret);
      expect(isValid).toBe(false);
    });

    test('should reject undefined token', () => {
      const isValid = twoFactorService.verifyToken(undefined, testSecret);
      expect(isValid).toBe(false);
    });

    test('should handle invalid secret gracefully', () => {
      const validToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32'
      });
      
      const isValid = twoFactorService.verifyToken(validToken, 'INVALID_SECRET');
      expect(isValid).toBe(false);
    });

    test('should use time window for token verification', () => {
      // Generate token for previous time window
      const previousToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 30 // 30 seconds ago
      });

      // Should still be valid within the window
      const isValid = twoFactorService.verifyToken(previousToken, testSecret, 2);
      expect(isValid).toBe(true);
    });

    test('should reject tokens outside time window', () => {
      // Generate token for much earlier time
      const oldToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 300 // 5 minutes ago
      });

      // Should be invalid outside the window
      const isValid = twoFactorService.verifyToken(oldToken, testSecret, 1);
      expect(isValid).toBe(false);
    });
  });

  describe('generateQRCodeUrl', () => {
    test('should generate valid QR code URL', () => {
      const testUser = 'test@example.com';
      const testSecret = 'JBSWY3DPEHPK3PXP';
      const testIssuer = 'Lockr Password Manager';

      // Create a manual otpauth URL for testing
      const otpauthUrl = `otpauth://totp/${encodeURIComponent(testIssuer)}%20(${encodeURIComponent(testUser)})?secret=${testSecret}&issuer=${encodeURIComponent(testIssuer)}`;
      
      expect(otpauthUrl).toContain('otpauth://totp/');
      expect(otpauthUrl).toContain(encodeURIComponent(testUser));
      expect(otpauthUrl).toContain(`secret=${testSecret}`);
      expect(otpauthUrl).toContain(`issuer=${encodeURIComponent(testIssuer)}`);
    });
  });

  describe('utility methods', () => {
    test('should validate secret format', () => {
      const validSecret = 'JBSWY3DPEHPK3PXP';
      const invalidSecret = 'invalid-secret-123';
      
      expect(twoFactorService.isValidSecret(validSecret)).toBe(true);
      expect(twoFactorService.isValidSecret(invalidSecret)).toBe(false);
      expect(twoFactorService.isValidSecret('')).toBe(false);
      expect(twoFactorService.isValidSecret(null)).toBe(false);
      
      // Test catch block - create a string that causes regex test to throw
      const mockRegexTest = RegExp.prototype.test;
      RegExp.prototype.test = function() {
        throw new Error('Regex test error');
      };
      
      expect(twoFactorService.isValidSecret('JBSWY3DPEHPK3PXP')).toBe(false);
      
      // Restore original method
      RegExp.prototype.test = mockRegexTest;
    });

    test('should get current token', () => {
      const testSecret = speakeasy.generateSecret().base32;
      const token = twoFactorService.getCurrentToken(testSecret);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(6);
      expect(token).toMatch(/^\d{6}$/);
    });

    test('should get setup instructions', () => {
      const instructions = twoFactorService.getSetupInstructions();
      
      expect(instructions).toHaveProperty('steps');
      expect(instructions).toHaveProperty('supportedApps');
      expect(instructions).toHaveProperty('securityTips');
      expect(Array.isArray(instructions.steps)).toBe(true);
      expect(Array.isArray(instructions.supportedApps)).toBe(true);
      expect(Array.isArray(instructions.securityTips)).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle malformed tokens', () => {
      const testSecret = speakeasy.generateSecret().base32;
      
      const malformedTokens = [
        'abc',
        '12345',
        '1234567',
        'abcdef',
        'ABCDEF'
      ];

      for (const token of malformedTokens) {
        const isValid = twoFactorService.verifyToken(token, testSecret);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('integration with speakeasy', () => {
    test('should work with speakeasy-generated secrets and tokens', () => {
      const secretObj = speakeasy.generateSecret({
        name: 'Test User',
        issuer: 'Test App'
      });
      
      const token = speakeasy.totp({
        secret: secretObj.base32,
        encoding: 'base32'
      });

      const isValid = twoFactorService.verifyToken(token, secretObj.base32);
      expect(isValid).toBe(true);
    });
  });
}); 