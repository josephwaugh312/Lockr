/**
 * User Repository Integration Tests
 * Tests real database operations with PostgreSQL
 */

const userRepository = require('../../src/models/userRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');
const { setupTransactionTests } = require('../helpers/transactionTestHelper');
const { setupTestData } = require('../helpers/testDataHelper');

describe('User Repository Integration Tests', () => {
  // Transaction isolation per test
  setupTransactionTests();
  const testData = setupTestData('userRepository');
  let cryptoService;

  beforeAll(async () => {
    await database.connect();
    cryptoService = new CryptoService();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%test-integration%']);
  });

  describe('User CRUD Operations', () => {
    test('should create user with encrypted data', async () => {
      const userData = {
        email: 'test-integration-create@example.com',
        password: 'SecurePassword123!',
        name: 'Integration Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const user = await userRepository.create(userDataWithHash);

      expect(user).toHaveProperty('id');
      expect(user.email).toBe(userData.email);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe('user');
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');

      // Verify password is hashed in database
      const dbUser = await database.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
      expect(dbUser.rows[0].password_hash).toBeTruthy();
      expect(dbUser.rows[0].password_hash).not.toBe(userData.password);
    });

    test('should find user by email', async () => {
      const userData = {
        email: 'test-integration-find@example.com',
        password: 'SecurePassword123!',
        name: 'Find Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const createdUser = await userRepository.create(userDataWithHash);
      const foundUser = await userRepository.findByEmail(userData.email);

      expect(foundUser).toBeTruthy();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(userData.email);
    });

    test('should find user by ID', async () => {
      const userData = {
        email: 'test-integration-findbyid@example.com',
        password: 'SecurePassword123!',
        name: 'Find By ID Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const createdUser = await userRepository.create(userDataWithHash);
      const foundUser = await userRepository.findById(createdUser.id);

      expect(foundUser).toBeTruthy();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(userData.email);
    });

    test('should update user data', async () => {
      const userData = {
        email: 'test-integration-update@example.com',
        password: 'SecurePassword123!',
        name: 'Update Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const createdUser = await userRepository.create(userDataWithHash);
      const updateData = {
        name: 'Updated Name',
        email: 'test-integration-updated@example.com'
      };

      const updatedUser = await userRepository.update(createdUser.id, updateData);

      expect(updatedUser.name).toBe(updateData.name);
      expect(updatedUser.email).toBe(updateData.email);
    });

    test('should delete user', async () => {
      const userData = {
        email: 'test-integration-delete@example.com',
        password: 'SecurePassword123!',
        name: 'Delete Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const createdUser = await userRepository.create(userDataWithHash);
      await userRepository.delete(createdUser.id);

      const deletedUser = await userRepository.findById(createdUser.id);
      expect(deletedUser).toBeNull();
    });
  });

  describe('2FA Integration', () => {
    test('should enable and manage 2FA with encryption', async () => {
      // Now that encrypted_two_factor_secret columns are added to local database
      const userData = {
        email: 'test-integration-2fa-isolated@example.com',
        password: 'SecurePassword123!',
        name: '2FA Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const user = await userRepository.create(userDataWithHash);

      // Enable 2FA with encrypted secret - we need to encrypt it first
      const TwoFactorEncryptionService = require('../../src/services/twoFactorEncryptionService');
      const twoFactorEncryptionService = new TwoFactorEncryptionService();
      
      const twoFactorSecret = 'JBSWY3DPEHPK3PXP';
      const { encryptedData, salt } = await twoFactorEncryptionService.encryptTwoFactorSecret(
        twoFactorSecret, 
        userData.password
      );

      const backupCodes = ['code1', 'code2', 'code3'];
      const result = await userRepository.enable2FAEncrypted(user.id, encryptedData, salt, backupCodes);

      // Verify the enable2FA operation returned successfully
      expect(result).toBeTruthy();
      expect(result.twoFactorEnabled).toBe(true);

      // Verify 2FA is enabled and secret is encrypted - check immediately after operation
      const updatedUser = await userRepository.findByIdWithEncrypted2FA(user.id);
      expect(updatedUser).toBeTruthy();
      expect(updatedUser.twoFactorEnabled).toBe(true);
      expect(updatedUser.encryptedTwoFactorSecret).toBeTruthy();
      expect(updatedUser.twoFactorSecretSalt).toBeTruthy();
      expect(updatedUser.twoFactorSecretIv).toBeFalsy(); // IV is embedded in encrypted data

      // Also verify the data is actually stored in the database
      const dbUser = await database.query(`
        SELECT two_factor_enabled, encrypted_two_factor_secret, two_factor_secret_salt
        FROM users WHERE id = $1
      `, [user.id]);

      expect(dbUser.rows[0].two_factor_enabled).toBe(true);
      expect(dbUser.rows[0].encrypted_two_factor_secret).toBeTruthy();
      expect(dbUser.rows[0].two_factor_secret_salt).toBeTruthy();

      // Clean up this test user specifically
      await userRepository.delete(user.id);
    });

    test('should handle phone number encryption', async () => {
      // Now that encrypted_phone_number columns are added to local database
      const userData = {
        email: 'test-integration-phone-isolated@example.com',
        password: 'SecurePassword123!',
        name: 'Phone Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const user = await userRepository.create(userDataWithHash);

      // Add encrypted phone number - we need to encrypt it first
      const PhoneNumberEncryptionService = require('../../src/services/phoneNumberEncryptionService');
      const phoneNumberEncryptionService = new PhoneNumberEncryptionService();
      
      const phoneNumber = '+1234567890';
      const { encryptedData, salt } = await phoneNumberEncryptionService.encryptPhoneNumber(
        phoneNumber,
        userData.password
      );

      const result = await userRepository.addEncryptedPhoneNumber(user.id, encryptedData, salt);

      // Verify the addEncryptedPhoneNumber operation returned successfully
      expect(result).toBeTruthy();
      expect(result.encryptedPhoneNumber).toBeTruthy();

      // Verify phone number is encrypted - check immediately after operation
      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser).toBeTruthy();
      expect(updatedUser.encryptedPhoneNumber).toBeTruthy();
      expect(updatedUser.phoneNumberSalt).toBeTruthy();
      expect(updatedUser.phone_verified).toBe(false); // Should not be verified initially

      // Also verify the data is actually stored in the database
      const dbUser = await database.query(`
        SELECT encrypted_phone_number, phone_number_salt, phone_verified
        FROM users WHERE id = $1
      `, [user.id]);

      expect(dbUser.rows[0].encrypted_phone_number).toBeTruthy();
      expect(dbUser.rows[0].phone_number_salt).toBeTruthy();
      expect(dbUser.rows[0].phone_verified).toBe(false);

      // Clean up this test user specifically
      await userRepository.delete(user.id);
    });
  });

  describe('Password Operations', () => {
    test('should verify password correctly', async () => {
      const userData = {
        email: 'test-integration-password@example.com',
        password: 'SecurePassword123!',
        name: 'Password Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const user = await userRepository.create(userDataWithHash);
      const userWithPassword = await userRepository.findByEmailWithPassword(userData.email);

      // Test correct password
      const isValidCorrect = await cryptoService.verifyPassword(userData.password, userWithPassword.passwordHash);
      expect(isValidCorrect).toBe(true);

      // Test incorrect password
      const isValidIncorrect = await cryptoService.verifyPassword('WrongPassword123!', userWithPassword.passwordHash);
      expect(isValidIncorrect).toBe(false);
    });

    test('should change password with proper hashing', async () => {
      const userData = {
        email: 'test-integration-changepass@example.com',
        password: 'OldPassword123!',
        name: 'Change Password Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const user = await userRepository.create(userDataWithHash);
      const newPassword = 'NewPassword456!';

      await userRepository.changePassword(user.id, newPassword);

      const updatedUser = await userRepository.findByEmailWithPassword(userData.email);
      const isValidOld = await cryptoService.verifyPassword(userData.password, updatedUser.passwordHash);
      const isValidNew = await cryptoService.verifyPassword(newPassword, updatedUser.passwordHash);

      expect(isValidOld).toBe(false);
      expect(isValidNew).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle duplicate email creation', async () => {
      const userData = {
        email: 'test-integration-duplicate@example.com',
        password: 'SecurePassword123!',
        name: 'Duplicate Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      await userRepository.create(userDataWithHash);

      await expect(userRepository.create(userDataWithHash)).rejects.toThrow();
    });

    test('should handle non-existent user operations', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const user = await userRepository.findById(fakeId);
      expect(user).toBeNull();

      // Note: update operation will return false or throw for non-existent user
      try {
        const updateResult = await userRepository.update(fakeId, { name: 'Test' });
        expect(updateResult).toBeNull();
      } catch (error) {
        expect(error.message).toContain('not found');
      }
      
      // Note: delete operation will return false for non-existent user
      const deleteResult = await userRepository.delete(fakeId);
      expect(deleteResult).toBe(false);
    });

    test('should handle invalid data types', async () => {
      await expect(userRepository.create({
        email: 'invalid-email',
        passwordHash: '123', // Too short hash
        name: ''
      })).rejects.toThrow();
    });
  });

  describe('GDPR Compliance', () => {
    test('should handle data retention settings', async () => {
      // Now that GDPR columns are added to local database
      const userData = {
        email: 'test-integration-gdpr@example.com',
        password: 'SecurePassword123!',
        name: 'GDPR Test User'
      };

      // Hash the password before creating the user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const userDataWithHash = {
        ...userData,
        passwordHash
      };
      delete userDataWithHash.password;

      const user = await userRepository.create(userDataWithHash);

      // Verify GDPR fields are set with default values from migration
      const dbUser = await database.query(`
        SELECT data_retention_policy, gdpr_consent_given_at, gdpr_consent_version
        FROM users WHERE id = $1
      `, [user.id]);

      expect(dbUser.rows[0].data_retention_policy).toEqual({});
      expect(dbUser.rows[0].gdpr_consent_version).toBeNull(); // No default version
      // gdpr_consent_given_at should be NULL by default since user hasn't given consent yet
      expect(dbUser.rows[0].gdpr_consent_given_at).toBeNull();
    });
  });
}); 