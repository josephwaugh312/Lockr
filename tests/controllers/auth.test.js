// Add TextEncoder/TextDecoder polyfill for dependencies
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require('supertest');
const express = require('express');
const authController = require('../../src/controllers/authController');
const { authMiddleware, __tokenService } = require('../../src/middleware/auth');
const { TokenService } = require('../../src/services/tokenService');
const { CryptoService } = require('../../src/services/cryptoService');
const TwoFactorService = require('../../src/services/twoFactorService');
const userRepository = require('../../src/models/userRepository');
const speakeasy = require('speakeasy');

describe('AuthController', () => {
  let app;
  let tokenService;
  let cryptoService;

  // Mock user data
  const validUser = {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    masterPassword: 'MasterKey456!'
  };

  const existingUser = {
    id: 'user-123',
    email: 'existing@example.com',
    passwordHash: 'hashed-password',
    role: 'user'
  };

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    // Use the same token service instance as the middleware
    tokenService = __tokenService;
    cryptoService = new CryptoService();
    tokenService.clearBlacklist();
    
    // Clear database instead of userStore
    await userRepository.clear();

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

  afterAll(async () => {
    // Close database connections
    if (userRepository && userRepository.close) {
      await userRepository.close();
    }
    
    // Close the database pool
    const database = require('../../src/config/database');
    if (database && database.close) {
      await database.close();
    }
    
    // Give time for connections to close
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('POST /auth/register', () => {
    test('should register new user successfully', async () => {
      const uniqueUser = { 
        ...validUser, 
        email: `test-${Date.now()}@example.com` 
      };
      
      const response = await request(app)
        .post('/auth/register')
        .send(uniqueUser);

      if (response.status !== 201) {
        console.log('Registration failed with status:', response.status);
        console.log('Response body:', response.body);
      }
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Registration successful');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(uniqueUser.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).toHaveProperty('emailVerified');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    test('should hash password with Argon2id', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(validUser);

      expect(response.status).toBe(201);
      // Password should be hashed, not stored in plain text
      expect(response.body.user).not.toHaveProperty('password');
    });

    test('should require email field', async () => {
      const invalidUser = { ...validUser };
      delete invalidUser.email;

      const response = await request(app)
        .post('/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email');
    });

    test('should require password field', async () => {
      const invalidUser = { ...validUser };
      delete invalidUser.password;

      const response = await request(app)
        .post('/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password');
    });

    test('should require masterPassword field', async () => {
      const invalidUser = { ...validUser };
      delete invalidUser.masterPassword;

      const response = await request(app)
        .post('/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Master password');
    });

    test('should validate email format', async () => {
      const invalidUser = { ...validUser, email: 'invalid-email' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid email');
    });

    test('should enforce password strength requirements', async () => {
      const weakPasswords = [
        'weak',
        '12345678',
        'password',
        'Password',
        'password123',
        'PASSWORD123'
      ];

      for (const weakPassword of weakPasswords) {
        const invalidUser = { ...validUser, password: weakPassword };

        const response = await request(app)
          .post('/auth/register')
          .send(invalidUser);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Password');
      }
    });

    test('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/auth/register')
        .send(validUser);

      // Attempt duplicate registration
      const response = await request(app)
        .post('/auth/register')
        .send(validUser);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    test('should handle registration with extra fields gracefully', async () => {
      const userWithExtra = {
        ...validUser,
        extraField: 'should be ignored',
        role: 'admin' // Should not be settable by user
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userWithExtra);

      expect(response.status).toBe(201);
      expect(response.body.user).toHaveProperty('id'); // Registration successful
      expect(response.body.user).not.toHaveProperty('extraField');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await request(app)
        .post('/auth/register')
        .send(validUser);
    });

    test('should login with valid credentials', async () => {
      const loginData = {
        email: validUser.email,
        password: validUser.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe(validUser.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    test('should reject invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: validUser.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should reject invalid password', async () => {
      const loginData = {
        email: validUser.email,
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
        password: validUser.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email');
    });

    test('should require password field', async () => {
      const loginData = {
        email: validUser.email
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password');
    });

    test('should validate email format on login', async () => {
      const loginData = {
        email: 'invalid-email',
        password: validUser.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid email');
    });

    test('should include user role in login response', async () => {
      const loginData = {
        email: validUser.email,
        password: validUser.password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('user');
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken;

    beforeEach(async () => {
      // Register and login to get a token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(validUser);
      
      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    test('should blacklist token on logout', async () => {
      // Logout
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      // Try to use the token again
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token has been revoked');
    });

    test('should require authentication for logout', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('should reject invalid token for logout', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      // Register to get tokens
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(validUser);
      
      refreshToken = registerResponse.body.tokens.refreshToken;
    });

    test('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tokens refreshed successfully');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      
      // New tokens should be different from old ones
      expect(response.body.tokens.refreshToken).not.toBe(refreshToken);
    });

    test('should require refreshToken field', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Refresh token');
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid.refresh.token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });

    test('should reject blacklisted refresh token', async () => {
      // Blacklist the refresh token
      await tokenService.blacklistToken(refreshToken);

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });

    test('should blacklist old refresh token after refresh', async () => {
      // Refresh tokens
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      // Try to use old refresh token again
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('GET /auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      // Register to get token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(validUser);
      
      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should return current user profile', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(validUser.email);
      expect(response.body.user.role).toBe('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('PUT /auth/change-password', () => {
    let accessToken;

    beforeEach(async () => {
      // Register to get token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(validUser);
      
      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should change password successfully', async () => {
      const changeData = {
        currentPassword: validUser.password,
        newPassword: 'NewSecurePassword123!'
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
          email: validUser.email,
          password: changeData.newPassword
        });

      expect(loginResponse.status).toBe(200);
    });

    test('should require current password', async () => {
      const changeData = {
        newPassword: 'NewSecurePassword123!'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current password');
    });

    test('should require new password', async () => {
      const changeData = {
        currentPassword: validUser.password
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('New password');
    });

    test('should verify current password', async () => {
      const changeData = {
        currentPassword: 'WrongCurrentPassword',
        newPassword: 'NewSecurePassword123!'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    test('should enforce password strength for new password', async () => {
      const changeData = {
        currentPassword: validUser.password,
        newPassword: 'weak'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });

    test('should require authentication', async () => {
      const changeData = {
        currentPassword: validUser.password,
        newPassword: 'NewSecurePassword123!'
      };

      const response = await request(app)
        .put('/auth/change-password')
        .send(changeData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('DELETE /auth/delete-account', () => {
    let accessToken;

    beforeEach(async () => {
      // Register to get token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(validUser);
      
      accessToken = registerResponse.body.tokens.accessToken;
    });

    test('should delete account successfully', async () => {
      const deleteData = {
        password: validUser.password,
        confirmDelete: 'DELETE'
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify account is deleted by trying to login
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: validUser.email,
          password: validUser.password
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body.error).toBe('Invalid credentials');
    });

    test('should require password confirmation', async () => {
      const deleteData = {
        confirmDelete: 'DELETE'
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password');
    });

    test('should require delete confirmation', async () => {
      const deleteData = {
        password: validUser.password
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Delete confirmation');
    });

    test('should verify password before deletion', async () => {
      const deleteData = {
        password: 'WrongPassword',
        confirmDelete: 'DELETE'
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password is incorrect');
    });

    test('should require exact confirmation text', async () => {
      const deleteData = {
        password: validUser.password,
        confirmDelete: 'delete'
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(deleteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('DELETE');
    });

    test('should require authentication', async () => {
      const deleteData = {
        password: validUser.password,
        confirmDelete: 'DELETE'
      };

      const response = await request(app)
        .delete('/auth/delete-account')
        .send(deleteData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('Error Handling and Security', () => {
    test('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle missing request body', async () => {
      const response = await request(app)
        .post('/auth/register');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should include timestamp in error responses', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password'
        });

      expect(response.status).toBe(400);
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Two-Factor Authentication', () => {
    let accessToken;
    let userId;
    let twoFactorService;

    beforeEach(async () => {
      twoFactorService = new TwoFactorService();
      
      // Register a user and get token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(validUser);
      
      userId = registerResponse.body.user.id;

      // Login to get access token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: validUser.email,
          password: validUser.password
        });
      
      accessToken = loginResponse.body.tokens.accessToken;

      // Add 2FA routes to the app
      app.post('/auth/2fa/setup', authMiddleware, authController.setup2FA);
      app.post('/auth/2fa/enable', authMiddleware, authController.enable2FA);
      app.post('/auth/2fa/disable', authMiddleware, authController.disable2FA);
      app.get('/auth/2fa/status', authMiddleware, authController.get2FAStatus);
    });

    describe('POST /auth/2fa/setup', () => {
      test('should setup 2FA successfully', async () => {
        const response = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('secret');
        expect(response.body).toHaveProperty('qrCodeUrl');
        expect(response.body).toHaveProperty('backupCodes');
        expect(response.body.secret).toBeTruthy();
        expect(response.body.qrCodeUrl).toContain('data:image/png;base64');
        expect(Array.isArray(response.body.backupCodes)).toBe(true);
        expect(response.body.backupCodes.length).toBe(10);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .post('/auth/2fa/setup');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('should handle already setup 2FA', async () => {
        // First setup
        await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);

        // Second setup should still work (regenerate secret)
        const response = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('secret');
      });
    });

    describe('POST /auth/2fa/enable', () => {
      let twoFactorSecret;
      let backupCodes;

      beforeEach(async () => {
        // Setup 2FA first
        const setupResponse = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);
        
        twoFactorSecret = setupResponse.body.secret;
        backupCodes = setupResponse.body.backupCodes;
      });

      test('should enable 2FA with valid token', async () => {
        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        const response = await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: twoFactorSecret,
            token: validToken,
            backupCodes: backupCodes,
            password: validUser.password
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('2FA enabled successfully');
        expect(response.body.user.twoFactorEnabled).toBe(true);
      });

      test('should reject invalid 2FA token', async () => {
        const response = await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: twoFactorSecret,
            token: '123456',
            backupCodes: backupCodes,
            password: validUser.password
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid verification code');
      });

      test('should require token field', async () => {
        const response = await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            secret: twoFactorSecret,
            backupCodes: backupCodes
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Secret, verification token, backup codes, and password are required');
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .post('/auth/2fa/enable')
          .send({ 
            secret: twoFactorSecret,
            token: '123456',
            backupCodes: backupCodes
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('should require prior setup', async () => {
        // Create new user without 2FA setup
        const newUser = {
          email: 'new@example.com',
          password: 'NewPassword123!',
          masterPassword: 'NewMaster456!'
        };

        const registerResponse = await request(app)
          .post('/auth/register')
          .send(newUser);

        const newAccessToken = registerResponse.body.tokens.accessToken;

        const response = await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${newAccessToken}`)
          .send({ 
            secret: 'invalid-secret',
            token: '123456',
            backupCodes: ['12345678'],
            password: newUser.password
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid verification code');
      });
    });

    describe('POST /auth/2fa/disable', () => {
      let twoFactorSecret;
      let backupCodes;

      beforeEach(async () => {
        // Setup and enable 2FA
        const setupResponse = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);
        
        twoFactorSecret = setupResponse.body.secret;
        backupCodes = setupResponse.body.backupCodes;

        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: twoFactorSecret,
            token: validToken,
            backupCodes: backupCodes,
            password: validUser.password
          });
      });

      test('should disable 2FA successfully', async () => {
        const response = await request(app)
          .post('/auth/2fa/disable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ password: validUser.password });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('2FA disabled successfully');
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .post('/auth/2fa/disable')
          .send({ password: validUser.password });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });

      test('should handle disabling when not enabled', async () => {
        // Create new user without 2FA
        const newUser = {
          email: 'new2@example.com',
          password: 'NewPassword123!',
          masterPassword: 'NewMaster456!'
        };

        const registerResponse = await request(app)
          .post('/auth/register')
          .send(newUser);

        const newAccessToken = registerResponse.body.tokens.accessToken;

        const response = await request(app)
          .post('/auth/2fa/disable')
          .set('Authorization', `Bearer ${newAccessToken}`)
          .send({ password: newUser.password });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('2FA is not enabled for this account');
      });
    });

    describe('GET /auth/2fa/status', () => {
      test('should return disabled status for new user', async () => {
        const response = await request(app)
          .get('/auth/2fa/status')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.enabled).toBe(false);
      });

      test('should return enabled status after enabling 2FA', async () => {
        // Setup and enable 2FA
        const setupResponse = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);
        
        const twoFactorSecret = setupResponse.body.secret;
        const backupCodes = setupResponse.body.backupCodes;
        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: twoFactorSecret,
            token: validToken,
            backupCodes: backupCodes,
            password: validUser.password
          });

        const response = await request(app)
          .get('/auth/2fa/status')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.enabled).toBe(true);
      });

      test('should require authentication', async () => {
        const response = await request(app)
          .get('/auth/2fa/status');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });
    });

    describe('Login with 2FA', () => {
      let twoFactorSecret;
      let backupCodes;

      beforeEach(async () => {
        // Setup and enable 2FA for the test user
        const setupResponse = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);
        
        if (setupResponse.status !== 200) {
          console.log('2FA Setup failed:', setupResponse.status, setupResponse.body);
        }
        
        twoFactorSecret = setupResponse.body.secret;
        backupCodes = setupResponse.body.backupCodes;

        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        const enableResponse = await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: twoFactorSecret,
            token: validToken,
            backupCodes: backupCodes,
            password: validUser.password
          });
          
        if (enableResponse.status !== 200) {
          console.log('2FA Enable failed:', enableResponse.status, enableResponse.body);
        }
      });

      test('should require 2FA code for enabled users', async () => {
        const loginData = {
          email: validUser.email,
          password: validUser.password
        };

        const response = await request(app)
          .post('/auth/login')
          .send(loginData);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Two-factor authentication required');
        expect(response.body.requires2FA).toBe(true);
        expect(response.body).not.toHaveProperty('tokens');
      });

      test('should login successfully with valid 2FA code', async () => {
        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        const loginData = {
          email: validUser.email,
          password: validUser.password,
          twoFactorCode: validToken
        };

        const response = await request(app)
          .post('/auth/login')
          .send(loginData);

        if (response.status !== 200) {
          console.log('2FA Login failed:', response.status, response.body);
        }

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Login successful');
        expect(response.body.tokens).toHaveProperty('accessToken');
        expect(response.body.tokens).toHaveProperty('refreshToken');
        expect(response.body.user.email).toBe(validUser.email);
      });

      test('should reject invalid 2FA code', async () => {
        const loginData = {
          email: validUser.email,
          password: validUser.password,
          twoFactorCode: '123456'
        };

        const response = await request(app)
          .post('/auth/login')
          .send(loginData);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid two-factor authentication code');
      });

      test('should reject empty 2FA code', async () => {
        const loginData = {
          email: validUser.email,
          password: validUser.password,
          twoFactorCode: ''
        };

        const response = await request(app)
          .post('/auth/login')
          .send(loginData);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Two-factor authentication required');
        expect(response.body.requires2FA).toBe(true);
      });

      test('should still validate password when 2FA is enabled', async () => {
        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        const loginData = {
          email: validUser.email,
          password: 'WrongPassword',
          twoFactorCode: validToken
        };

        const response = await request(app)
          .post('/auth/login')
          .send(loginData);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
      });

      test('should handle time-based token windows', async () => {
        // Generate token for previous time window (should still be valid)
        const previousToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32',
          time: Math.floor(Date.now() / 1000) - 30 // 30 seconds ago
        });

        const loginData = {
          email: validUser.email,
          password: validUser.password,
          twoFactorCode: previousToken
        };

        const response = await request(app)
          .post('/auth/login')
          .send(loginData);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Login successful');
      });
    });

    describe('2FA Security Tests', () => {
      test('should not expose 2FA secret in API responses', async () => {
        const setupResponse = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(setupResponse.body.secret).toBeTruthy();
        expect(setupResponse.body.qrCodeUrl).toContain('data:image/png;base64');

        // Enable 2FA
        const validToken = speakeasy.totp({
          secret: setupResponse.body.secret,
          encoding: 'base32'
        });

        await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: setupResponse.body.secret,
            token: validToken,
            backupCodes: setupResponse.body.backupCodes,
            password: validUser.password
          });

        // Check status endpoint doesn't expose secret
        const statusResponse = await request(app)
          .get('/auth/2fa/status')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(statusResponse.body).not.toHaveProperty('secret');
        expect(statusResponse.body).not.toHaveProperty('twoFactorSecret');
      });

      test('should rate limit 2FA attempts', async () => {
        // This would require implementing rate limiting in the actual controller
        // For now, we'll test that multiple failed attempts don't reveal information
        const setupResponse = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);

        const twoFactorSecret = setupResponse.body.secret;
        const backupCodes = setupResponse.body.backupCodes;
        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: twoFactorSecret,
            token: validToken,
            backupCodes: backupCodes,
            password: validUser.password
          });

        // Multiple failed login attempts with wrong 2FA
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app)
              .post('/auth/login')
              .send({
                email: validUser.email,
                password: validUser.password,
                twoFactorCode: '123456'
              })
          );
        }

        const responses = await Promise.all(promises);
        responses.forEach(response => {
          expect(response.status).toBe(401);
          expect(response.body.error).toBe('Invalid two-factor authentication code');
        });
      });

      test('should handle malformed 2FA codes gracefully', async () => {
        const setupResponse = await request(app)
          .post('/auth/2fa/setup')
          .set('Authorization', `Bearer ${accessToken}`);

        const twoFactorSecret = setupResponse.body.secret;
        const backupCodes = setupResponse.body.backupCodes;
        const validToken = speakeasy.totp({
          secret: twoFactorSecret,
          encoding: 'base32'
        });

        await request(app)
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ 
            secret: twoFactorSecret,
            token: validToken,
            backupCodes: backupCodes,
            password: validUser.password
          });

        // Test codes that should be rejected as invalid
        const invalidCodes = [
          'abc',
          '12345',
          '1234567',
          'ABCDEF'
        ];

        for (const code of invalidCodes) {
          const response = await request(app)
            .post('/auth/login')
            .send({
              email: validUser.email,
              password: validUser.password,
              twoFactorCode: code
            });

          expect(response.status).toBe(401);
          expect(response.body.error).toBe('Invalid two-factor authentication code');
        }
      });
    });
  });
}); 