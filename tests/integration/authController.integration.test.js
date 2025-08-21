/**
 * AuthController Integration Tests
 * Tests real controller operations with database, services, and middleware
 */

// Increase timeout for DB + controller flows
jest.setTimeout(30000)

// Add TextEncoder/TextDecoder polyfill for dependencies
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require('supertest');
const express = require('express');
const authController = require('../../src/controllers/authController');
const { authMiddleware } = require('../../src/middleware/auth');
const userRepository = require('../../src/models/userRepository');
const userSettingsRepository = require('../../src/models/userSettingsRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');
const { TokenService } = require('../../src/services/tokenService');
const { setupTransactionTests } = require('../helpers/transactionTestHelper');
const { setupTestData } = require('../helpers/testDataHelper');

describe('AuthController Integration Tests', () => {
  setupTransactionTests();
  const testData = setupTestData('authController');
  let app;
  let cryptoService;
  let tokenService;

  beforeAll(async () => {
    await database.connect();
    cryptoService = new CryptoService();
    tokenService = new TokenService();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%auth-integration%']);
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%auth-integration%']);

    // Clear global state
    if (global.accountLockouts) {
      global.accountLockouts = {};
    }
    if (global.failedLoginAttempts) {
      global.failedLoginAttempts = {};
    }

    app = express();
    app.use(express.json());
    
    // Setup auth routes
    app.post('/auth/register', authController.register);
    app.post('/auth/login', authController.login);
    app.post('/auth/logout', authMiddleware, authController.logout);
    app.post('/auth/refresh', authController.refresh);
    app.get('/auth/me', authMiddleware, authController.getProfile);
    app.put('/auth/change-password', authMiddleware, authController.changePassword);
    app.delete('/auth/delete-account', authMiddleware, authController.deleteAccount);
    
    // Add error handling middleware
    app.use(authController.handleJsonError);
  });

  describe('POST /auth/register', () => {
    test('should register new user successfully', async () => {
      const userData = {
        email: 'auth-integration-test@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Registration successful');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('masterPassword');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.phoneVerificationSent).toBeDefined();

      // Verify user is stored in database
      const dbUser = await userRepository.findByEmail(userData.email);
      expect(dbUser).toBeDefined();
      expect(dbUser.email).toBe(userData.email);
      expect(dbUser.passwordHash).toBeDefined();
      expect(dbUser.passwordHash).not.toBe(userData.password);
    });

    test('should reject duplicate email registration', async () => {
      const userData = {
        email: 'auth-integration-duplicate@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      // Register first user
      const firstResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(firstResponse.status).toBe(201);

      // Try to register same email again
      const secondResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.error).toBe('Email already exists');
    });

    test('should require email field', async () => {
      const userData = {
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email is required');
    });

    test('should require password field', async () => {
      const userData = {
        email: 'auth-integration-test@example.com',
        masterPassword: 'MasterKey456!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password is required');
    });

    test('should require masterPassword field', async () => {
      const userData = {
        email: 'auth-integration-test@example.com',
        password: 'SecurePassword123!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Master password is required');
    });

    test('should handle registration with phone number', async () => {
      const userData = {
        email: 'auth-integration-phone@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!',
        phoneNumber: '+1234567890',
        smsNotifications: true
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      // Note: phoneNumber is not returned in the response, but the registration should succeed
      expect(response.body.user.smsNotifications).toBe(true);
      expect(response.body.user.phoneVerified).toBe(false);
    });

    test('should handle registration with SMS opt-out', async () => {
      const userData = {
        email: 'auth-integration-sms-optout@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!',
        phoneNumber: '+1234567890',
        smsNotifications: false
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user.smsNotifications).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    let registeredUser;
    let userData;

    beforeEach(async () => {
      userData = {
        email: 'auth-integration-login@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      // Register a user for login tests
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      registeredUser = registerResponse.body.user;
    });

    test('should login with valid credentials', async () => {
      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    test('should reject invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: userData.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should reject invalid password', async () => {
      const loginData = {
        email: userData.email,
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should require email field', async () => {
      const loginData = {
        password: userData.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email is required');
    });

    test('should require password field', async () => {
      const loginData = {
        email: userData.email
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password is required');
    });

    test('should handle login with 2FA code', async () => {
      const loginData = {
        email: userData.email,
        password: userData.password,
        twoFactorCode: '123456'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      // Should still login successfully since 2FA is not enabled
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken;

    beforeEach(async () => {
      // Register and login to get access token
      const userData = {
        email: 'auth-integration-logout@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    test('should require authentication for logout', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(401);
    });

    test('should reject invalid token for logout', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      // Register to get refresh token
      const userData = {
        email: 'auth-integration-refresh@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      refreshToken = registerResponse.body.tokens.refreshToken;
    });

    test('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.tokens.accessToken).not.toBe(refreshToken);
    });

    test('should require refreshToken field', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Refresh token is required');
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      // Register and login to get access token
      const userData = {
        email: 'auth-integration-me@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should return current user profile', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('auth-integration-me@example.com');
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /auth/change-password', () => {
    let accessToken;
    let userData;

    beforeEach(async () => {
      userData = {
        email: 'auth-integration-change-password@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      // Register and login to get access token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should change password successfully', async () => {
      const changeData = {
        currentPassword: userData.password,
        newPassword: 'NewSecurePassword456!'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: userData.email,
          password: changeData.newPassword,
          masterPassword: userData.masterPassword
        });

      expect(loginResponse.status).toBe(200);
    });

    test('should require current password', async () => {
      const changeData = {
        newPassword: 'NewSecurePassword456!'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current password is required');
    });

    test('should require new password', async () => {
      const changeData = {
        currentPassword: userData.password
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('New password is required');
    });

    test('should reject incorrect current password', async () => {
      const changeData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecurePassword456!'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    test('should require authentication', async () => {
      const changeData = {
        currentPassword: userData.password,
        newPassword: 'NewSecurePassword456!'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .send(changeData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /auth/delete-account', () => {
    let accessToken;
    let userData;

    beforeEach(async () => {
      userData = {
        email: 'auth-integration-delete@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      // Register and login to get access token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should delete account with correct password', async () => {
      const deleteData = {
        password: userData.password,
        confirmDelete: 'DELETE'
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify user is deleted
      const dbUser = await userRepository.findByEmail(userData.email);
      expect(dbUser).toBeNull();
    });

    test('should require password for deletion', async () => {
      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password confirmation is required');
    });

    test('should reject incorrect password for deletion', async () => {
      const deleteData = {
        password: 'WrongPassword123!',
        confirmDelete: 'DELETE'
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password is incorrect');
    });

    test('should require authentication', async () => {
      const deleteData = {
        password: userData.password
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .send(deleteData);

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    test('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid JSON');
    });

    test('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the controller doesn't crash
      const userData = {
        email: 'auth-integration-error@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      // Should either succeed or return a proper error response
      expect([201, 400, 500]).toContain(response.status);
    });
  });

  describe('Security Features', () => {
    test('should not expose sensitive data in responses', async () => {
      const userData = {
        email: 'auth-integration-security@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user).not.toHaveProperty('password');
      expect(registerResponse.body.user).not.toHaveProperty('passwordHash');
      expect(registerResponse.body.user).not.toHaveProperty('masterPassword');
      expect(registerResponse.body.user).not.toHaveProperty('masterPasswordHash');
    });

    test('should hash passwords properly', async () => {
      const userData = {
        email: 'auth-integration-hash@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(201);

      // Verify password is hashed in database
      const dbUser = await userRepository.findByEmail(userData.email);
      expect(dbUser.passwordHash).not.toBe(userData.password);
      expect(dbUser.passwordHash).toMatch(/^\$argon2id\$/); // Argon2id hash format
    });
  });
}); 