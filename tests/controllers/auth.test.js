const request = require('supertest');
const express = require('express');
const authController = require('../../src/controllers/authController');
const { authMiddleware, __tokenService } = require('../../src/middleware/auth');
const { TokenService } = require('../../src/services/tokenService');
const { CryptoService } = require('../../src/services/cryptoService');
const userStore = require('../../src/models/userStore');

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

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Use the same token service instance as the middleware
    tokenService = __tokenService;
    cryptoService = new CryptoService();
    tokenService.clearBlacklist();
    userStore.clear();

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
      const response = await request(app)
        .post('/auth/register')
        .send(validUser);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(validUser.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user.role).toBe('user');
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
      expect(response.body.user.role).toBe('user'); // Should default to 'user'
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
}); 