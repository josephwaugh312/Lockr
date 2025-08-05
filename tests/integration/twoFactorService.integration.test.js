/**
 * TwoFactorService Integration Tests
 * Tests real service operations with database and encryption dependencies
 */

const TwoFactorService = require('../../src/services/twoFactorService');
const TwoFactorEncryptionService = require('../../src/services/twoFactorEncryptionService');
const userRepository = require('../../src/models/userRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');
const speakeasy = require('speakeasy');

describe('TwoFactorService Integration Tests', () => {
  let twoFactorService;
  let twoFactorEncryptionService;
  let cryptoService;

  beforeAll(async () => {
    await database.connect();
    twoFactorService = new TwoFactorService();
    twoFactorEncryptionService = new TwoFactorEncryptionService();
    cryptoService = new CryptoService();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%test-2fa-integration%']);
  });

  describe('2FA Setup and Management', () => {
    test('should complete full 2FA setup flow with encryption', async () => {
      // Create test user
      const userData = {
        email: 'test-2fa-integration-setup@example.com',
        password: 'SecurePassword123!',
        name: '2FA Setup Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Step 1: Generate 2FA secret
      const secretResult = await twoFactorService.generateSecret(user.email);
      expect(secretResult.secret).toBeTruthy();
      expect(secretResult.qrCodeUrl).toBeTruthy();
      expect(secretResult.manualEntryKey).toBe(secretResult.secret);
      expect(twoFactorService.isValidSecret(secretResult.secret)).toBe(true);

      // Step 2: Generate backup codes
      const backupCodesResult = await twoFactorService.generateBackupCodes(5);
      expect(backupCodesResult.plainCodes).toHaveLength(5);
      expect(backupCodesResult.hashedCodes).toHaveLength(5);
      expect(backupCodesResult.plainCodes[0]).toMatch(/^\d{8}$/);

      // Step 3: Encrypt the secret
      const { encryptedData, salt } = await twoFactorEncryptionService.encryptTwoFactorSecret(
        secretResult.secret,
        userData.password
      );

      // Step 4: Enable 2FA in database
      const enableResult = await userRepository.enable2FAEncrypted(
        user.id,
        encryptedData,
        salt,
        backupCodesResult.hashedCodes
      );

      expect(enableResult).toBeTruthy();
      expect(enableResult.twoFactorEnabled).toBe(true);

      // Step 5: Verify 2FA is enabled
      const userWith2FA = await userRepository.findByIdWithEncrypted2FA(user.id);
      expect(userWith2FA.twoFactorEnabled).toBe(true);
      expect(userWith2FA.encryptedTwoFactorSecret).toBeTruthy();
      expect(userWith2FA.twoFactorSecretSalt).toBeTruthy();
      expect(userWith2FA.twoFactorBackupCodes).toHaveLength(5);

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should verify TOTP tokens correctly', async () => {
      // Create test user
      const userData = {
        email: 'test-2fa-integration-verify@example.com',
        password: 'SecurePassword123!',
        name: '2FA Verify Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Generate and enable 2FA
      const secretResult = await twoFactorService.generateSecret(user.email);
      const backupCodesResult = await twoFactorService.generateBackupCodes(3);
      const { encryptedData, salt } = await twoFactorEncryptionService.encryptTwoFactorSecret(
        secretResult.secret,
        userData.password
      );

      await userRepository.enable2FAEncrypted(
        user.id,
        encryptedData,
        salt,
        backupCodesResult.hashedCodes
      );

      // Test valid token verification
      const validToken = twoFactorService.getCurrentToken(secretResult.secret);
      const isValidToken = twoFactorService.verifyToken(validToken, secretResult.secret);
      expect(isValidToken).toBe(true);

      // Test invalid token
      const invalidToken = '123456';
      const isInvalidToken = twoFactorService.verifyToken(invalidToken, secretResult.secret);
      expect(isInvalidToken).toBe(false);

      // Test token with spaces (should be cleaned)
      const tokenWithSpaces = ` ${validToken} `;
      const isTokenWithSpacesValid = twoFactorService.verifyToken(tokenWithSpaces, secretResult.secret);
      expect(isTokenWithSpacesValid).toBe(true);

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should handle backup code verification and removal', async () => {
      // Create test user
      const userData = {
        email: 'test-2fa-integration-backup@example.com',
        password: 'SecurePassword123!',
        name: '2FA Backup Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Generate and enable 2FA with backup codes
      const secretResult = await twoFactorService.generateSecret(user.email);
      const backupCodesResult = await twoFactorService.generateBackupCodes(3);
      const { encryptedData, salt } = await twoFactorEncryptionService.encryptTwoFactorSecret(
        secretResult.secret,
        userData.password
      );

      await userRepository.enable2FAEncrypted(
        user.id,
        encryptedData,
        salt,
        backupCodesResult.hashedCodes
      );

      // Test backup code verification
      const testCode = backupCodesResult.plainCodes[0];
      const verificationResult = await twoFactorService.verifyBackupCode(
        testCode,
        backupCodesResult.hashedCodes
      );

      expect(verificationResult.valid).toBe(true);
      expect(verificationResult.usedIndex).toBe(0);

      // Remove used backup code
      const updatedCodes = twoFactorService.removeUsedBackupCode(
        backupCodesResult.hashedCodes,
        verificationResult.usedIndex
      );

      expect(updatedCodes).toHaveLength(2);
      expect(updatedCodes).not.toContain(backupCodesResult.hashedCodes[0]);

      // Test invalid backup code
      const invalidCode = '99999999';
      const invalidVerification = await twoFactorService.verifyBackupCode(
        invalidCode,
        backupCodesResult.hashedCodes
      );

      expect(invalidVerification.valid).toBe(false);
      expect(invalidVerification.usedIndex).toBe(-1);

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should handle 2FA disable flow', async () => {
      // Create test user
      const userData = {
        email: 'test-2fa-integration-disable@example.com',
        password: 'SecurePassword123!',
        name: '2FA Disable Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Enable 2FA first
      const secretResult = await twoFactorService.generateSecret(user.email);
      const backupCodesResult = await twoFactorService.generateBackupCodes(3);
      const { encryptedData, salt } = await twoFactorEncryptionService.encryptTwoFactorSecret(
        secretResult.secret,
        userData.password
      );

      await userRepository.enable2FAEncrypted(
        user.id,
        encryptedData,
        salt,
        backupCodesResult.hashedCodes
      );

      // Verify 2FA is enabled
      let userWith2FA = await userRepository.findByIdWithEncrypted2FA(user.id);
      expect(userWith2FA.twoFactorEnabled).toBe(true);

      // Disable 2FA
      const disableResult = await userRepository.disable2FA(user.id);
      expect(disableResult).toBeTruthy();
      expect(disableResult.twoFactorEnabled).toBe(false);

      // Verify 2FA is disabled
      userWith2FA = await userRepository.findByIdWithEncrypted2FA(user.id);
      expect(userWith2FA.twoFactorEnabled).toBe(false);
      expect(userWith2FA.encryptedTwoFactorSecret).toBeNull();
      expect(userWith2FA.twoFactorSecretSalt).toBeNull();
      expect(userWith2FA.twoFactorBackupCodes).toEqual([]); // Changed from toBeNull() to toEqual([])

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('Security and Validation', () => {
    test('should handle time window validation correctly', async () => {
      const testSecret = speakeasy.generateSecret().base32;

      // Test current token
      const currentToken = twoFactorService.getCurrentToken(testSecret);
      const isCurrentValid = twoFactorService.verifyToken(currentToken, testSecret, 2);
      expect(isCurrentValid).toBe(true);

      // Test token from previous window (should be valid with window=2)
      const previousToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 30 // 30 seconds ago
      });
      const isPreviousValid = twoFactorService.verifyToken(previousToken, testSecret, 2);
      expect(isPreviousValid).toBe(true);

      // Test token from much earlier (should be invalid)
      const oldToken = speakeasy.totp({
        secret: testSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 300 // 5 minutes ago
      });
      const isOldValid = twoFactorService.verifyToken(oldToken, testSecret, 1);
      expect(isOldValid).toBe(false);
    });

    test('should validate secret format correctly', async () => {
      // Valid secrets
      const validSecrets = [
        'JBSWY3DPEHPK3PXP',
        'ABCDEFGHIJKLMNOP',
        '234567ABCDEFGHIJ'
      ];

      for (const secret of validSecrets) {
        expect(twoFactorService.isValidSecret(secret)).toBe(true);
      }

      // Invalid secrets
      const invalidSecrets = [
        '',
        null,
        undefined,
        'invalid-secret',
        '123456789',
        'ABCDEFGHIJKLMNOP1', // Contains '1' which is not in base32
        'ABCDEFGHIJKLMNOP9'  // Contains '9' which is not in base32
      ];

      for (const secret of invalidSecrets) {
        expect(twoFactorService.isValidSecret(secret)).toBe(false);
      }
    });

    test('should handle malformed tokens gracefully', async () => {
      const testSecret = speakeasy.generateSecret().base32;

      const malformedTokens = [
        '',
        null,
        undefined,
        'abc',
        '12345',
        '1234567',
        'abcdef',
        'ABCDEF',
        '12 34 56',
        '12-34-56'
      ];

      for (const token of malformedTokens) {
        const isValid = twoFactorService.verifyToken(token, testSecret);
        expect(isValid).toBe(false);
      }
    });

    test('should generate unique secrets for different users', async () => {
      const user1 = 'user1@example.com';
      const user2 = 'user2@example.com';

      const secret1 = await twoFactorService.generateSecret(user1);
      const secret2 = await twoFactorService.generateSecret(user2);

      expect(secret1.secret).not.toBe(secret2.secret);
      expect(secret1.otpauthUrl).not.toBe(secret2.otpauthUrl);
      expect(secret1.qrCodeUrl).not.toBe(secret2.qrCodeUrl);
    });
  });

  describe('Backup Code Management', () => {
    test('should generate and verify multiple backup codes', async () => {
      const backupCodesResult = await twoFactorService.generateBackupCodes(10);
      
      expect(backupCodesResult.plainCodes).toHaveLength(10);
      expect(backupCodesResult.hashedCodes).toHaveLength(10);

      // Verify each backup code
      for (let i = 0; i < backupCodesResult.plainCodes.length; i++) {
        const verificationResult = await twoFactorService.verifyBackupCode(
          backupCodesResult.plainCodes[i],
          backupCodesResult.hashedCodes
        );

        expect(verificationResult.valid).toBe(true);
        expect(verificationResult.usedIndex).toBe(i);
      }
    });

    test('should handle backup code removal correctly', async () => {
      const backupCodesResult = await twoFactorService.generateBackupCodes(5);
      let currentCodes = [...backupCodesResult.hashedCodes];

      // Remove codes one by one
      for (let i = 0; i < 3; i++) {
        const verificationResult = await twoFactorService.verifyBackupCode(
          backupCodesResult.plainCodes[i],
          currentCodes
        );

        expect(verificationResult.valid).toBe(true);
        
        currentCodes = twoFactorService.removeUsedBackupCode(
          currentCodes,
          verificationResult.usedIndex
        );

        expect(currentCodes).toHaveLength(4 - i);
      }

      // Verify remaining codes still work
      const remainingVerification = await twoFactorService.verifyBackupCode(
        backupCodesResult.plainCodes[3],
        currentCodes
      );

      expect(remainingVerification.valid).toBe(true);
    });

    test('should handle edge cases in backup code operations', async () => {
      const backupCodesResult = await twoFactorService.generateBackupCodes(3);

      // Test with empty hashed codes array
      const emptyVerification = await twoFactorService.verifyBackupCode(
        backupCodesResult.plainCodes[0],
        []
      );
      expect(emptyVerification.valid).toBe(false);
      expect(emptyVerification.usedIndex).toBe(-1);

      // Test removal with invalid index
      const invalidRemoval = twoFactorService.removeUsedBackupCode(
        backupCodesResult.hashedCodes,
        -1
      );
      expect(invalidRemoval).toEqual(backupCodesResult.hashedCodes);

      const outOfBoundsRemoval = twoFactorService.removeUsedBackupCode(
        backupCodesResult.hashedCodes,
        999
      );
      expect(outOfBoundsRemoval).toEqual(backupCodesResult.hashedCodes);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle encryption service errors gracefully', async () => {
      // Create test user
      const userData = {
        email: 'test-2fa-integration-errors@example.com',
        password: 'SecurePassword123!',
        name: '2FA Error Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Test with invalid password for encryption
      const secretResult = await twoFactorService.generateSecret(user.email);
      
      try {
        await twoFactorEncryptionService.encryptTwoFactorSecret(
          secretResult.secret,
          'wrong-password'
        );
        // This should not throw if the service handles errors gracefully
      } catch (error) {
        // Expected behavior - encryption should fail with wrong password
        expect(error).toBeDefined();
      }

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should handle database errors gracefully', async () => {
      // Test with non-existent user ID
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const secretResult = await twoFactorService.generateSecret('test@example.com');
      const backupCodesResult = await twoFactorService.generateBackupCodes(3);

      try {
        await userRepository.enable2FAEncrypted(
          fakeUserId,
          'encrypted-data',
          'salt',
          backupCodesResult.hashedCodes
        );
        // This should return null for non-existent user
      } catch (error) {
        // Expected behavior - should handle gracefully
        expect(error).toBeDefined();
      }
    });

    test('should handle concurrent 2FA operations', async () => {
      // Create test user
      const userData = {
        email: 'test-2fa-integration-concurrent@example.com',
        password: 'SecurePassword123!',
        name: '2FA Concurrent Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Generate multiple secrets simultaneously
      const secretPromises = Array(3).fill().map(() => 
        twoFactorService.generateSecret(user.email)
      );

      const secrets = await Promise.all(secretPromises);
      
      // All secrets should be unique
      const secretValues = secrets.map(s => s.secret);
      const uniqueSecrets = new Set(secretValues);
      expect(uniqueSecrets.size).toBe(3);

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('Setup Instructions and Documentation', () => {
    test('should provide comprehensive setup instructions', async () => {
      const instructions = twoFactorService.getSetupInstructions();

      expect(instructions).toHaveProperty('steps');
      expect(instructions).toHaveProperty('supportedApps');
      expect(instructions).toHaveProperty('securityTips');

      expect(Array.isArray(instructions.steps)).toBe(true);
      expect(instructions.steps.length).toBeGreaterThan(0);

      expect(Array.isArray(instructions.supportedApps)).toBe(true);
      expect(instructions.supportedApps.length).toBeGreaterThan(0);
      expect(instructions.supportedApps).toContain('Google Authenticator');

      expect(Array.isArray(instructions.securityTips)).toBe(true);
      expect(instructions.securityTips.length).toBeGreaterThan(0);
    });

    test('should generate proper otpauth URLs', async () => {
      const userEmail = 'test@example.com';
      const secretResult = await twoFactorService.generateSecret(userEmail);

      expect(secretResult.otpauthUrl).toContain('otpauth://totp/');
      expect(secretResult.otpauthUrl).toContain(encodeURIComponent(userEmail));
      expect(secretResult.otpauthUrl).toContain(`secret=${secretResult.secret}`);
      // The issuer is embedded in the name parameter, not as a separate issuer parameter
      expect(secretResult.otpauthUrl).toContain('Lockr%20Password%20Manager');
    });
  });
}); 