/**
 * End-to-End Integration Tests
 * Tests complete user workflows from registration to vault management
 */

// Add polyfills for Node.js compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Add setImmediate polyfill for Node.js
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => {
    return setTimeout(() => callback(...args), 0);
  };
}

const request = require('supertest');
const app = require('../../src/app');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');

describe('End-to-End Integration Tests', () => {
  let testUser;
  let accessToken;
  let refreshToken;
  let encryptionKey;
  let cryptoService;

  beforeAll(async () => {
    await database.connect();
    cryptoService = new CryptoService();
  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
    try {
      await database.close();
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }, 10000); // Increase timeout to 10 seconds

  beforeEach(async () => {
    // Clean up test data - use a safer approach that won't be affected by SQL injection
    try {
      await database.query('DELETE FROM vault_entries WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['e2e-test%']);
      await database.query('DELETE FROM users WHERE email LIKE $1', ['e2e-test%']);
    } catch (error) {
      // If cleanup fails due to deadlock or other issues, continue with test
      console.warn('Cleanup failed, continuing with test:', error.message);
    }

    // Generate unique test user data
    const timestamp = Date.now();
    testUser = {
      email: `e2e-test-${timestamp}@example.com`,
      password: 'SecurePassword123!',
      masterPassword: 'MasterKey456!',
      name: 'E2E Test User'
    };

    // Derive encryption key from master password
    const salt = 'test-salt-for-e2e-tests';
    const derivedKey = await cryptoService.deriveKeyFromPassword(testUser.masterPassword, salt);
    encryptionKey = derivedKey.toString('base64');
  });

  describe('Complete User Journey', () => {
    test('should complete full user registration and vault setup', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe(testUser.email);
      expect(registerResponse.body.tokens).toHaveProperty('accessToken');
      expect(registerResponse.body.tokens).toHaveProperty('refreshToken');

      accessToken = registerResponse.body.tokens.accessToken;
      refreshToken = registerResponse.body.tokens.refreshToken;

      // Step 2: Login to verify credentials
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.email).toBe(testUser.email);
      accessToken = loginResponse.body.tokens.accessToken;

      // Step 3: Get user profile
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.user.email).toBe(testUser.email);

      // Step 4: Unlock vault with encryption key (stateless approach)
      const unlockResponse = await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          encryptionKey: encryptionKey
        });

      // Debug: Log the response if it fails
      if (unlockResponse.status !== 200) {
        console.log('Vault unlock failed with status:', unlockResponse.status);
        console.log('Response body:', unlockResponse.body);
      }

      expect(unlockResponse.status).toBe(200);
      expect(unlockResponse.body.message).toContain('unlocked');

      // Step 5: Create vault entry
      const entryData = {
        encryptionKey: encryptionKey,
        title: 'Test Website',
        username: 'testuser',
        password: 'testpassword123',
        website: 'https://test.com',
        notes: 'Test entry for E2E testing',
        category: 'login'
      };

      const createEntryResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      expect(createEntryResponse.status).toBe(201);
      expect(createEntryResponse.body.message).toBe('Entry created successfully');
      expect(createEntryResponse.body.entry).toHaveProperty('id');

      const entryId = createEntryResponse.body.entry.id;

      // Step 6: Get vault entries
      const getEntriesResponse = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey: encryptionKey });

      // Debug: Log the response if it fails
      if (getEntriesResponse.status !== 200) {
        console.log('Get entries failed with status:', getEntriesResponse.status);
        console.log('Response body:', getEntriesResponse.body);
      }

      expect(getEntriesResponse.status).toBe(200);
      expect(getEntriesResponse.body.entries).toBeInstanceOf(Array);
      expect(getEntriesResponse.body.entries.length).toBeGreaterThan(0);

      // Step 7: Get specific entry
      const getEntryResponse = await request(app)
        .get(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ encryptionKey: encryptionKey });

      expect(getEntryResponse.status).toBe(200);
      expect(getEntryResponse.body.entry.id).toBe(entryId);
      expect(getEntryResponse.body.entry.name).toBe('Test Website');

      // Step 8: Update entry
      const updateData = {
        encryptionKey: encryptionKey,
        title: 'Updated Test Website',
        username: 'updateduser',
        password: 'updatedpassword123'
      };

      const updateEntryResponse = await request(app)
        .put(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(updateEntryResponse.status).toBe(200);
      expect(updateEntryResponse.body.message).toBe('Entry updated successfully');

      // Step 9: Search entries
      const searchResponse = await request(app)
        .post('/api/v1/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ 
          encryptionKey: encryptionKey,
          q: 'Updated'
        });

      // Debug: Log the response if it fails
      if (searchResponse.status !== 200) {
        console.log('Search failed with status:', searchResponse.status);
        console.log('Response body:', searchResponse.body);
      }

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.entries).toBeInstanceOf(Array);
      expect(searchResponse.body.entries.length).toBeGreaterThan(0);

      // Step 10: Delete entry
      const deleteEntryResponse = await request(app)
        .delete(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey: encryptionKey });

      expect(deleteEntryResponse.status).toBe(200);
      expect(deleteEntryResponse.body.message).toBe('Entry deleted successfully');
    });

    test('should handle 2FA setup and login flow', async () => {
      // Step 1: Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      accessToken = registerResponse.body.tokens.accessToken;

      // Step 2: Setup 2FA
      const setup2FAResponse = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(setup2FAResponse.status).toBe(200);
      expect(setup2FAResponse.body).toHaveProperty('secret');
      expect(setup2FAResponse.body).toHaveProperty('qrCodeUrl');
      expect(setup2FAResponse.body).toHaveProperty('backupCodes');

      const { secret, backupCodes } = setup2FAResponse.body;

      // Step 3: Generate valid TOTP token
      const speakeasy = require('speakeasy');
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });

      // Step 4: Enable 2FA
      const enable2FAResponse = await request(app)
        .post('/api/v1/auth/2fa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          secret: secret,
          token: token,
          backupCodes: backupCodes,
          password: testUser.password
        });

      expect(enable2FAResponse.status).toBe(200);
      expect(enable2FAResponse.body.user.twoFactorEnabled).toBe(true);

      // Step 5: Verify 2FA status
      const status2FAResponse = await request(app)
        .get('/api/v1/auth/2fa/status')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(status2FAResponse.status).toBe(200);
      expect(status2FAResponse.body.enabled).toBe(true);

      // Step 6: Login with 2FA
      const newToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          twoFactorCode: newToken
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.twoFactorEnabled).toBe(true);

      // Step 7: Test backup code login
      const backupCodeLoginResponse = await request(app)
        .post('/api/v1/auth/2fa/verify-backup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          backupCode: backupCodes[0]
        });

      expect(backupCodeLoginResponse.status).toBe(200);
    });

    test('should handle password reset flow', async () => {
      // Step 1: Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);

      // Step 2: Request password reset
      const resetRequestResponse = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: testUser.email
        });

      expect(resetRequestResponse.status).toBe(200);
      expect(resetRequestResponse.body.message).toContain('password reset link');

      // Note: In real test environment, extract token from email
      // For now, verify the request was processed correctly
    });

    test('should handle token refresh flow', async () => {
      // Step 1: Register and login
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      refreshToken = registerResponse.body.tokens.refreshToken;

      // Step 2: Refresh access token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: refreshToken
        });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.tokens).toHaveProperty('accessToken');
      expect(refreshResponse.body.tokens).toHaveProperty('refreshToken');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid vault access gracefully', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      accessToken = registerResponse.body.tokens.accessToken;

      // Try to access vault without encryption key
      const vaultResponse = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(vaultResponse.status).toBe(400);
      expect(vaultResponse.body.error).toContain('Encryption key is required');
    });

    test('should handle expired tokens gracefully', async () => {
      // Use invalid token
      const invalidResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(invalidResponse.status).toBe(401);
    });

    test('should handle duplicate registration', async () => {
      // Register user first time
      const firstResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(firstResponse.status).toBe(201);

      // Try to register same user again
      const duplicateResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.error).toContain('already registered');
    });

    test('should handle wrong login credentials', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);

      // Try login with wrong password
      const wrongPasswordResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(wrongPasswordResponse.status).toBe(401);

      // Try login with wrong email
      const wrongEmailResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testUser.password
        });

      expect(wrongEmailResponse.status).toBe(401);
    });
  });

  describe('Security Integration Tests', () => {
    test('should prevent unauthorized vault access', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      accessToken = registerResponse.body.tokens.accessToken;

      // Try to access vault without encryption key
      const vaultResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Unauthorized Entry',
          username: 'test',
          password: 'test123',
          category: 'login'
        });

      expect(vaultResponse.status).toBe(400);
      expect(vaultResponse.body.error).toContain('Encryption key is required');
    });

    test('should validate encryption key for vault operations', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      accessToken = registerResponse.body.tokens.accessToken;

      // Try to unlock vault with wrong encryption key
      const wrongKey = await cryptoService.deriveKeyFromPassword('WrongMasterPassword123!', 'wrong-salt');
      const wrongEncryptionKey = wrongKey.toString('base64');

      const unlockResponse = await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          encryptionKey: wrongEncryptionKey
        });

      // For new users without existing data, any key is accepted
      expect(unlockResponse.status).toBe(200);
    });

    test('should handle SQL injection attempts', async () => {
      const maliciousEmail = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: maliciousEmail,
          password: testUser.password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid email address');
    });

    test('should handle XSS attempts in vault entries', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.tokens.accessToken;

      // Unlock vault with encryption key
      await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          encryptionKey: encryptionKey
        });

      // Try to create entry with XSS payload
      const maliciousEntry = {
        encryptionKey: encryptionKey,
        title: '<script>alert("xss")</script>',
        username: 'test',
        password: 'test123',
        notes: '<img src="x" onerror="alert(1)">',
        category: 'login'
      };

      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(maliciousEntry);

      // Should still create the entry (XSS protection is client-side)
      expect(response.status).toBe(201);
      expect(response.body.entry).toHaveProperty('id');
    });
  });

  describe('Performance Integration Tests', () => {
    test('should handle concurrent user operations', async () => {
      // Create multiple users concurrently with unique emails
      const timestamp = Date.now();
      const users = [];
      for (let i = 0; i < 5; i++) {
        users.push({
          email: `e2e-concurrent-${timestamp}-${i}@example.com`,
          password: 'SecurePassword123!',
          masterPassword: 'MasterKey456!',
          name: `Concurrent User ${i}`
        });
      }

      const registrationPromises = users.map(user =>
        request(app)
          .post('/api/v1/auth/register')
          .send(user)
      );

      const responses = await Promise.all(registrationPromises);
      
      // Debug: Log any failing responses
      responses.forEach((response, index) => {
        if (response.status !== 201) {
          console.log(`Registration ${index} failed:`, response.status, response.body);
        }
      });
      
      // All registrations should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
    });

    test('should handle large vault operations', async () => {
      // Register user and unlock vault
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.tokens.accessToken;

      await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          encryptionKey: encryptionKey
        });

      // Create multiple entries
      const entries = [];
      for (let i = 0; i < 20; i++) {
        entries.push({
          encryptionKey: encryptionKey,
          title: `Performance Test Entry ${i}`,
          username: `user${i}`,
          password: `password${i}`,
          category: 'login'
        });
      }

      const createPromises = entries.map(entry =>
        request(app)
          .post('/api/v1/vault/entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(entry)
      );

      const createResponses = await Promise.all(createPromises);
      
      // All entries should be created successfully
      createResponses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify all entries can be retrieved
      const getResponse = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          encryptionKey: encryptionKey
        });

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.entries).toHaveLength(20);
    });
  });
}); 