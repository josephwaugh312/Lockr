// Enhanced test suite for userRepository.js
const userRepository = require('../../src/models/userRepository');
const pool = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');
const TwoFactorEncryptionService = require('../../src/services/twoFactorEncryptionService');
const crypto = require('crypto');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  securityEvents: {
    logEmailChange: jest.fn(),
    logPasswordChange: jest.fn(),
    log2FAEnabled: jest.fn(),
    log2FADisabled: jest.fn()
  }
}));

describe('UserRepository - Enhanced Test Suite', () => {
  const cryptoService = new CryptoService();
  const twoFactorEncryptionService = new TwoFactorEncryptionService();
  let testUserId;
  
  beforeAll(async () => {
    // Database is initialized by global setup
  });

  beforeEach(async () => {
    // Clear all users before each test
    await userRepository.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up
    await userRepository.clear();
    if (pool && pool.end) {
      await pool.end();
    }
  });

  describe('User Creation', () => {
    test('should create a user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: await cryptoService.hashPassword('Password123!'),
        phoneNumber: '+1234567890'
      };

      const user = await userRepository.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.password_hash).toBe(userData.passwordHash);
      expect(user.phone_number).toBe(userData.phoneNumber);
      expect(user.email_verified).toBe(false);
      expect(user.role).toBe('user');
      
      testUserId = user.id;
    });

    test('should create user with minimal data', async () => {
      const userData = {
        email: 'minimal@example.com',
        passwordHash: await cryptoService.hashPassword('Password123!')
      };

      const user = await userRepository.create(userData);

      expect(user).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.phone_number).toBeNull();
    });

    test('should handle duplicate email error', async () => {
      const userData = {
        email: 'duplicate@example.com',
        passwordHash: 'hash'
      };

      await userRepository.create(userData);
      
      await expect(userRepository.create(userData))
        .rejects.toThrow();
    });

    test('should create user with all optional fields', async () => {
      const userData = {
        email: 'complete@example.com',
        passwordHash: 'hash',
        phoneNumber: '+1234567890',
        phoneVerified: true,
        smsOptOut: true,
        emailVerified: true,
        role: 'admin'
      };

      const user = await userRepository.create(userData);

      expect(user.phone_verified).toBe(true);
      expect(user.sms_opt_out).toBe(true);
      expect(user.email_verified).toBe(true);
      expect(user.role).toBe('admin');
    });
  });

  describe('User Finding', () => {
    beforeEach(async () => {
      // Create test user
      const user = await userRepository.create({
        email: 'find-test@example.com',
        passwordHash: 'hash123'
      });
      testUserId = user.id;
    });

    test('should find user by email', async () => {
      const user = await userRepository.findByEmail('find-test@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('find-test@example.com');
    });

    test('should return null for non-existent email', async () => {
      const user = await userRepository.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    test('should find user by ID', async () => {
      const user = await userRepository.findById(testUserId);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.email).toBe('find-test@example.com');
    });

    test('should return null for non-existent ID', async () => {
      const user = await userRepository.findById('00000000-0000-0000-0000-000000000000');

      expect(user).toBeNull();
    });

    test('should find user by email with 2FA', async () => {
      const user = await userRepository.findByEmailWith2FA('find-test@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('find-test@example.com');
      expect(user).toHaveProperty('two_factor_enabled');
    });

    test('should find user by ID with 2FA', async () => {
      const user = await userRepository.findByIdWith2FA(testUserId);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user).toHaveProperty('two_factor_enabled');
    });

    test('should find user by email with password', async () => {
      const user = await userRepository.findByEmailWithPassword('find-test@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('find-test@example.com');
      expect(user).toHaveProperty('password_hash');
    });

    test('should find user by email with verification', async () => {
      const user = await userRepository.findByEmailWithVerification('find-test@example.com');

      expect(user).toBeDefined();
      expect(user.email).toBe('find-test@example.com');
      expect(user).toHaveProperty('email_verified');
    });
  });

  describe('User Updates', () => {
    beforeEach(async () => {
      const user = await userRepository.create({
        email: 'update-test@example.com',
        passwordHash: 'hash123'
      });
      testUserId = user.id;
    });

    test('should update user email', async () => {
      const updated = await userRepository.update(testUserId, {
        email: 'newemail@example.com'
      });

      expect(updated).toBeDefined();
      expect(updated.email).toBe('newemail@example.com');
    });

    test('should update user phone number', async () => {
      const updated = await userRepository.update(testUserId, {
        phoneNumber: '+9876543210',
        phoneVerified: true
      });

      expect(updated.phone_number).toBe('+9876543210');
      expect(updated.phone_verified).toBe(true);
    });

    test('should update multiple fields', async () => {
      const updated = await userRepository.update(testUserId, {
        email: 'multi@example.com',
        emailVerified: true,
        smsOptOut: true
      });

      expect(updated.email).toBe('multi@example.com');
      expect(updated.email_verified).toBe(true);
      expect(updated.sms_opt_out).toBe(true);
    });

    test('should handle update of non-existent user', async () => {
      const result = await userRepository.update('00000000-0000-0000-0000-000000000000', {
        email: 'test@example.com'
      });

      expect(result).toBeNull();
    });

    test('should change user password', async () => {
      const newHash = await cryptoService.hashPassword('NewPassword123!');
      const result = await userRepository.changePassword(testUserId, newHash);

      expect(result).toBe(true);

      // Verify password was changed
      const user = await userRepository.findByEmailWithPassword('update-test@example.com');
      expect(user.password_hash).toBe(newHash);
    });
  });

  describe('2FA Operations', () => {
    beforeEach(async () => {
      const user = await userRepository.create({
        email: '2fa-test@example.com',
        passwordHash: 'hash123'
      });
      testUserId = user.id;
    });

    test('should enable 2FA with plaintext secret', async () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const backupCodes = ['code1', 'code2', 'code3'];

      const result = await userRepository.enable2FA(testUserId, secret, backupCodes);

      expect(result).toBeDefined();
      expect(result.two_factor_enabled).toBe(true);
      expect(result.two_factor_secret).toBe(secret);
    });

    test('should enable 2FA with encrypted secret', async () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const { encryptedSecret, salt } = await twoFactorEncryptionService.encryptSecret(secret);
      const backupCodes = ['code1', 'code2', 'code3'];

      const result = await userRepository.enable2FAEncrypted(testUserId, encryptedSecret, salt, backupCodes);

      expect(result).toBeDefined();
      expect(result.two_factor_enabled).toBe(true);
      expect(result.two_factor_secret_encrypted).toBe(encryptedSecret);
      expect(result.two_factor_secret_salt).toBe(salt);
    });

    test('should disable 2FA', async () => {
      // First enable 2FA
      await userRepository.enable2FA(testUserId, 'secret', ['code1']);

      // Then disable it
      const result = await userRepository.disable2FA(testUserId);

      expect(result).toBeDefined();
      expect(result.two_factor_enabled).toBe(false);
      expect(result.two_factor_secret).toBeNull();
      expect(result.backup_codes).toBeNull();
    });

    test('should update backup codes', async () => {
      // First enable 2FA
      await userRepository.enable2FA(testUserId, 'secret', ['oldcode1']);

      // Update backup codes
      const newCodes = ['newcode1', 'newcode2'];
      const result = await userRepository.updateBackupCodes(testUserId, newCodes);

      expect(result).toBeDefined();
      expect(result.backup_codes).toEqual(newCodes);
    });

    test('should find user by ID with encrypted 2FA', async () => {
      const { encryptedSecret, salt } = await twoFactorEncryptionService.encryptSecret('secret');
      await userRepository.enable2FAEncrypted(testUserId, encryptedSecret, salt, ['code1']);

      const user = await userRepository.findByIdWithEncrypted2FA(testUserId);

      expect(user).toBeDefined();
      expect(user.two_factor_secret_encrypted).toBe(encryptedSecret);
      expect(user.two_factor_secret_salt).toBe(salt);
    });

    test('should migrate 2FA secret to encrypted', async () => {
      // Enable with plaintext
      await userRepository.enable2FA(testUserId, 'plainsecret', ['code1']);

      // Migrate to encrypted
      const { encryptedSecret, salt } = await twoFactorEncryptionService.encryptSecret('plainsecret');
      const result = await userRepository.migrate2FASecretToEncrypted(testUserId, encryptedSecret, salt);

      expect(result).toBe(true);

      // Verify migration
      const user = await userRepository.findByIdWithEncrypted2FA(testUserId);
      expect(user.two_factor_secret_encrypted).toBe(encryptedSecret);
      expect(user.two_factor_secret).toBeNull();
    });

    test('should remove plaintext 2FA secret', async () => {
      await userRepository.enable2FA(testUserId, 'secret', ['code1']);

      const result = await userRepository.removePlaintext2FASecret(testUserId);
      expect(result).toBe(true);

      const user = await userRepository.findByIdWith2FA(testUserId);
      expect(user.two_factor_secret).toBeNull();
    });
  });

  describe('Phone Number Encryption', () => {
    beforeEach(async () => {
      const user = await userRepository.create({
        email: 'phone-test@example.com',
        passwordHash: 'hash123',
        phoneNumber: '+1234567890'
      });
      testUserId = user.id;
    });

    test('should add encrypted phone number', async () => {
      const encryptedPhone = 'encrypted_phone_data';
      const salt = 'phone_salt';

      const result = await userRepository.addEncryptedPhoneNumber(testUserId, encryptedPhone, salt);

      expect(result).toBeDefined();
      expect(result.phone_number_encrypted).toBe(encryptedPhone);
      expect(result.phone_number_salt).toBe(salt);
    });

    test('should remove encrypted phone number', async () => {
      // First add encrypted phone
      await userRepository.addEncryptedPhoneNumber(testUserId, 'encrypted', 'salt');

      // Then remove it
      const result = await userRepository.removeEncryptedPhoneNumber(testUserId);

      expect(result).toBeDefined();
      expect(result.phone_number_encrypted).toBeNull();
      expect(result.phone_number_salt).toBeNull();
    });

    test('should migrate phone number to encrypted', async () => {
      const encryptedPhone = 'encrypted_phone';
      const salt = 'salt';

      const result = await userRepository.migratePhoneNumberToEncrypted(testUserId, encryptedPhone, salt);

      expect(result).toBe(true);

      // Verify migration
      const user = await userRepository.findById(testUserId);
      expect(user.phone_number_encrypted).toBe(encryptedPhone);
      expect(user.phone_number).toBeNull();
    });

    test('should remove plaintext phone number', async () => {
      const result = await userRepository.removePlaintextPhoneNumber(testUserId);

      expect(result).toBe(true);

      const user = await userRepository.findById(testUserId);
      expect(user.phone_number).toBeNull();
    });
  });

  describe('Email Verification', () => {
    beforeEach(async () => {
      const user = await userRepository.create({
        email: 'verify-test@example.com',
        passwordHash: 'hash123'
      });
      testUserId = user.id;
    });

    test('should update email verification token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      const result = await userRepository.updateEmailVerificationToken(testUserId, token, expiresAt);

      expect(result).toBe(true);
    });

    test('should find user by email verification token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000);

      await userRepository.updateEmailVerificationToken(testUserId, token, expiresAt);

      const user = await userRepository.findByEmailVerificationToken(token);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
    });

    test('should not find user with expired token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() - 3600000); // Expired 1 hour ago

      await userRepository.updateEmailVerificationToken(testUserId, token, expiresAt);

      const user = await userRepository.findByEmailVerificationToken(token);

      expect(user).toBeNull();
    });

    test('should mark email as verified', async () => {
      const result = await userRepository.markEmailAsVerified(testUserId);

      expect(result).toBe(true);

      const user = await userRepository.findById(testUserId);
      expect(user.email_verified).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    test('should check if email exists', async () => {
      await userRepository.create({
        email: 'exists@example.com',
        passwordHash: 'hash'
      });

      const exists = await userRepository.emailExists('exists@example.com');
      const notExists = await userRepository.emailExists('notexists@example.com');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    test('should count users', async () => {
      await userRepository.clear();

      const countBefore = await userRepository.count();
      expect(countBefore).toBe(0);

      await userRepository.create({ email: 'user1@example.com', passwordHash: 'hash' });
      await userRepository.create({ email: 'user2@example.com', passwordHash: 'hash' });

      const countAfter = await userRepository.count();
      expect(countAfter).toBe(2);
    });

    test('should clear all users', async () => {
      await userRepository.create({ email: 'clear1@example.com', passwordHash: 'hash' });
      await userRepository.create({ email: 'clear2@example.com', passwordHash: 'hash' });

      const result = await userRepository.clear();
      expect(result).toBe(true);

      const count = await userRepository.count();
      expect(count).toBe(0);
    });

    test('should perform health check', async () => {
      const result = await userRepository.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result).toHaveProperty('userCount');
    });

    test('should get all active users', async () => {
      await userRepository.clear();

      // Create some users
      await userRepository.create({
        email: 'active1@example.com',
        passwordHash: 'hash',
        emailVerified: true
      });
      await userRepository.create({
        email: 'active2@example.com',
        passwordHash: 'hash',
        emailVerified: true
      });

      const users = await userRepository.getAllActiveUsers();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(2);
    });

    test('should check if columns exist', async () => {
      const result = await userRepository.checkIfColumnsExist(['email', 'password_hash']);

      expect(result).toBeDefined();
      expect(result.email).toBe(true);
      expect(result.password_hash).toBe(true);
    });
  });

  describe('User Deletion', () => {
    test('should delete user by ID', async () => {
      const user = await userRepository.create({
        email: 'delete-test@example.com',
        passwordHash: 'hash'
      });

      const result = await userRepository.delete(user.id);
      expect(result).toBe(true);

      const deletedUser = await userRepository.findById(user.id);
      expect(deletedUser).toBeNull();
    });

    test('should handle deletion of non-existent user', async () => {
      const result = await userRepository.delete('00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock pool.query to throw error
      const originalQuery = pool.query;
      pool.query = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(userRepository.findByEmail('test@example.com'))
        .rejects.toThrow('Database error');

      // Restore original
      pool.query = originalQuery;
    });

    test('should handle invalid UUID format', async () => {
      const user = await userRepository.findById('invalid-uuid');
      expect(user).toBeNull();
    });
  });
});