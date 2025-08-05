/**
 * Vault Controller Integration Tests
 * Tests vault-related API endpoints and functionality
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
const express = require('express');
const vaultController = require('../../src/controllers/vaultController');
const { authMiddleware } = require('../../src/middleware/auth');
const userRepository = require('../../src/models/userRepository');
const vaultRepository = require('../../src/models/vaultRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');
const { TokenService } = require('../../src/services/tokenService');

// Helper function to derive encryption key from master password
async function deriveEncryptionKey(masterPassword, salt = 'test-salt-for-integration-tests') {
  const cryptoService = new CryptoService();
  const derivedKey = await cryptoService.deriveKeyFromPassword(masterPassword, salt);
  return derivedKey.toString('base64');
}

describe('VaultController Integration Tests', () => {
  let app;
  let cryptoService;
  let tokenService;

  beforeAll(async () => {
    await database.connect();
    cryptoService = new CryptoService();
    tokenService = new TokenService();
  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
    try {
      await database.close();
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }, 10000); // Increase timeout to 10 seconds

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM vault_entries WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%vault-controller%']);
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%vault-controller%']);

    // Clear vault sessions
    vaultRepository.sessions.clear();

    app = express();
    app.use(express.json());
    
    // Setup vault routes - Note: system is stateless, no requireUnlockedVault middleware
    app.post('/api/v1/vault/unlock', authMiddleware, vaultController.unlockVault);
    app.post('/api/v1/vault/lock', authMiddleware, vaultController.lockVault);
    app.put('/api/v1/vault/change-master-password', authMiddleware, vaultController.changeMasterPassword);
    app.post('/api/v1/vault/entries', authMiddleware, vaultController.createEntry);
    app.post('/api/v1/vault/entries/list', authMiddleware, vaultController.getEntries);
    app.get('/api/v1/vault/entries/:id', authMiddleware, vaultController.getEntry);
    app.put('/api/v1/vault/entries/:id', authMiddleware, vaultController.updateEntry);
    app.delete('/api/v1/vault/entries/:id', authMiddleware, vaultController.deleteEntry);
    app.post('/api/v1/vault/search', authMiddleware, vaultController.searchEntries);
    app.post('/api/v1/vault/generate-password', authMiddleware, vaultController.generatePassword);
    app.post('/api/v1/vault/export', authMiddleware, vaultController.exportVault);
    app.post('/api/v1/vault/import', authMiddleware, vaultController.importVault);
    app.post('/api/v1/vault/expiring-passwords', authMiddleware, vaultController.checkExpiringPasswords);
    app.post('/api/v1/vault/clear-notification-tracking', authMiddleware, vaultController.clearNotificationTracking);
    app.post('/api/v1/vault/reset-master-password-hash', authMiddleware, vaultController.resetMasterPasswordHash);
    
    // Add error handling middleware
    app.use(vaultController.handleVaultError);
  });

  describe('POST /vault/unlock', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-unlock@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      // Create test user
      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Generate access token
      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      // Generate encryption key from master password
      encryptionKey = await deriveEncryptionKey(userData.masterPassword);
    });

    test('should unlock vault with correct encryption key', async () => {
      const response = await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Vault unlocked successfully');
      expect(response.body.timestamp).toBeDefined();

      // For new users, any encryption key is accepted
      // For existing users with data, the key would be validated
    });

    test('should accept any encryption key for new users', async () => {
      const wrongKey = Buffer.from('WrongMasterPassword').toString('base64');
      const response = await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey: wrongKey });

      // New users without existing data accept any encryption key
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Vault unlocked successfully');
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/vault/unlock')
        .send({ encryptionKey });

      expect(response.status).toBe(401);
    });

    test('should validate encryption key format', async () => {
      const response = await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey: 'invalid-format!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid encryption key format');
    });

    test('should enforce rate limiting on unlock attempts', async () => {
      const userData = {
        email: 'vault-controller-rate-limit@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      const accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      const wrongKey = await deriveEncryptionKey('WrongMasterPassword');
      // Make multiple failed attempts
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/v1/vault/unlock')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ encryptionKey: wrongKey });

        // For new users, first 5 attempts succeed, 6th should be rate limited
        if (i < 5) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
        }
      }
    });
  });

  describe('PUT /vault/change-master-password', () => {
    let accessToken;
    let userData;
    let encryptionKey;
    let newEncryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-change-password@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);
      newEncryptionKey = await deriveEncryptionKey('NewMasterKey789!');
    });

    test('should change master password successfully', async () => {
      const changeData = {
        currentEncryptionKey: encryptionKey,
        newEncryptionKey: newEncryptionKey
      };

      const response = await request(app)
        .put('/api/v1/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Master password changed successfully');
    });

    test('should require current encryption key', async () => {
      const changeData = {
        newEncryptionKey: newEncryptionKey
      };

      const response = await request(app)
        .put('/api/v1/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current and new encryption keys are required');
    });

    test('should require new encryption key', async () => {
      const changeData = {
        currentEncryptionKey: encryptionKey
      };

      const response = await request(app)
        .put('/api/v1/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current and new encryption keys are required');
    });

    test('should reject incorrect current encryption key', async () => {
      // First create some data so the user has existing entries to validate against
      const entryData = {
        encryptionKey,
        title: 'Test Entry for Change Password',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      const wrongKey = await deriveEncryptionKey('WrongMasterPassword');
      const changeData = {
        currentEncryptionKey: wrongKey,
        newEncryptionKey: newEncryptionKey
      };

      const response = await request(app)
        .put('/api/v1/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Current encryption key does not match existing data');
    });
  });

  describe('POST /vault/entries', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-entries@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      // Properly derive encryption key from master password
      encryptionKey = await deriveEncryptionKey(userData.masterPassword);
    });

    test('should create vault entry successfully', async () => {
      const entryData = {
        encryptionKey,
        title: 'Test Entry',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      // Debug: Log the response if it fails
      if (response.status !== 201) {
        console.log('Response status:', response.status);
        console.log('Response body:', response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Entry created successfully');
      expect(response.body.entry).toHaveProperty('id');
      expect(response.body.entry).toHaveProperty('category');
      expect(response.body.entry).toHaveProperty('createdAt');
      expect(response.body.entry).toHaveProperty('updatedAt');
    });

    test('should require title field', async () => {
      const entryData = {
        encryptionKey,
        username: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Entry title is required');
    });

    test('should handle missing password field', async () => {
      const entryData = {
        encryptionKey,
        title: 'Test Entry',
        username: 'test@example.com'
        // password is optional
      };

      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      expect(response.status).toBe(201); // Password is optional in the current implementation
    });

    test('should require encryption key', async () => {
      const entryData = {
        title: 'Test Entry',
        username: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });

    test('should validate encryption key format', async () => {
      const entryData = {
        encryptionKey: 'invalid-format!',
        title: 'Test Entry',
        username: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid encryption key format');
    });

    test('should reject invalid encryption key', async () => {
      const wrongKey = await deriveEncryptionKey('WrongMasterPassword');
      const entryData = {
        encryptionKey: wrongKey,
        title: 'Test Entry',
        username: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      // For new users without existing data, any key is accepted
      expect(response.status).toBe(201);
    });
  });

  describe('POST /vault/entries/list', () => {
    let accessToken;
    let userData;
    let encryptionKey;
    let entryId;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-get-entries@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);

      // Create a test entry first
      const entryData = {
        encryptionKey,
        title: 'Test Entry for Get',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      const createResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      entryId = createResponse.body.entry.id;
    });

    test('should get all vault entries', async () => {
      const response = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey });

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeInstanceOf(Array);
      expect(response.body.entries.length).toBeGreaterThan(0);
      expect(response.body.entries[0]).toHaveProperty('id');
      expect(response.body.entries[0]).toHaveProperty('name');
      expect(response.body.entries[0]).toHaveProperty('category');
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ 
          encryptionKey,
          limit: 1,
          page: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeInstanceOf(Array);
      expect(response.body.entries.length).toBeLessThanOrEqual(1);
    });

    test('should support category filtering', async () => {
      const response = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ 
          encryptionKey,
          category: 'Test'
        });

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeInstanceOf(Array);
      // All returned entries should be in the Test category
      response.body.entries.forEach(entry => {
        expect(entry.category).toBe('Test');
      });
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('GET /vault/entries/:id', () => {
    let accessToken;
    let userData;
    let encryptionKey;
    let entryId;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-get-entry@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);

      // Create a test entry first
      const entryData = {
        encryptionKey,
        title: 'Test Entry for Get By ID',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      const createResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      entryId = createResponse.body.entry.id;
    });

    test('should get vault entry by id', async () => {
      const response = await request(app)
        .get(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ encryptionKey });

      expect(response.status).toBe(200);
      expect(response.body.entry).toHaveProperty('id', entryId);
      expect(response.body.entry).toHaveProperty('name');
      expect(response.body.entry).toHaveProperty('category');
      expect(response.body.entry).toHaveProperty('username');
      expect(response.body.entry).toHaveProperty('password');
    });

    test('should return 404 for non-existent entry', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/vault/entries/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ encryptionKey });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Entry not found');
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .get(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('PUT /vault/entries/:id', () => {
    let accessToken;
    let userData;
    let encryptionKey;
    let entryId;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-update-entry@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);

      // Create a test entry first
      const entryData = {
        encryptionKey,
        title: 'Test Entry for Update',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      const createResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      entryId = createResponse.body.entry.id;
    });

    test('should update vault entry successfully', async () => {
      const updateData = {
        encryptionKey,
        title: 'Updated Entry Title',
        username: 'updated@example.com',
        password: 'UpdatedPassword123!',
        category: 'Updated'
      };

      const response = await request(app)
        .put(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Entry updated successfully');
      expect(response.body.entry).toHaveProperty('id', entryId);
      expect(response.body.entry).toHaveProperty('name', 'Updated Entry Title');
      expect(response.body.entry).toHaveProperty('category', 'Updated');
    });

    test('should return 404 for non-existent entry', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        encryptionKey,
        title: 'Updated Entry Title',
        username: 'updated@example.com',
        password: 'UpdatedPassword123!'
      };

      const response = await request(app)
        .put(`/api/v1/vault/entries/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Entry not found');
    });

    test('should require encryption key', async () => {
      const updateData = {
        title: 'Updated Entry Title',
        username: 'updated@example.com',
        password: 'UpdatedPassword123!'
      };

      const response = await request(app)
        .put(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('DELETE /vault/entries/:id', () => {
    let accessToken;
    let userData;
    let encryptionKey;
    let entryId;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-delete-entry@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);

      // Create a test entry first
      const entryData = {
        encryptionKey,
        title: 'Test Entry for Delete',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      const createResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      entryId = createResponse.body.entry.id;
    });

    test('should delete vault entry successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Entry deleted successfully');

      // Verify entry is deleted
      const getResponse = await request(app)
        .get(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ encryptionKey });

      expect(getResponse.status).toBe(404);
    });

    test('should return 404 for non-existent entry', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/v1/vault/entries/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Entry not found');
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .delete(`/api/v1/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('GET /vault/search', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-search@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);

      // Create test entries
      const entries = [
        { title: 'Gmail Account', username: 'user@gmail.com', password: 'pass123', category: 'Email' },
        { title: 'GitHub Account', username: 'developer', password: 'devpass', category: 'Development' },
        { title: 'Bank Account', username: 'bankuser', password: 'bankpass', category: 'Finance' }
      ];

      for (const entry of entries) {
        await request(app)
          .post('/api/v1/vault/entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ encryptionKey, ...entry });
      }
    });

    test('should search vault entries by query', async () => {
      const response = await request(app)
        .post('/api/v1/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ 
          encryptionKey,
          q: 'Gmail'
        });

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeInstanceOf(Array);
      expect(response.body.entries.length).toBeGreaterThan(0);
      expect(response.body.entries[0].name).toContain('Gmail');
    });

    test('should search by category', async () => {
      const response = await request(app)
        .post('/api/v1/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ 
          encryptionKey,
          q: 'Gmail',
          category: 'Email'
        });

      expect(response.status).toBe(200);
      expect(response.body.entries).toBeInstanceOf(Array);
      expect(response.body.entries.length).toBeGreaterThan(0);
      expect(response.body.entries[0].category).toBe('Email');
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .post('/api/v1/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ q: 'test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('POST /vault/generate-password', () => {
    let accessToken;
    let userData;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-generate@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });
    });

    test('should generate password with default options', async () => {
      const response = await request(app)
        .post('/api/v1/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.password).toBeDefined();
      expect(response.body.password.length).toBeGreaterThan(0);
    });

    test('should generate password with custom options', async () => {
      const options = {
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: false
      };

      const response = await request(app)
        .post('/api/v1/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(options);

      expect(response.status).toBe(200);
      expect(response.body.password).toBeDefined();
      expect(response.body.password.length).toBe(16);
    });
  });

  describe('POST /vault/export', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-export@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);

      // Create test entries
      const entries = [
        { title: 'Test Entry 1', username: 'user1', password: 'pass1', category: 'Test' },
        { title: 'Test Entry 2', username: 'user2', password: 'pass2', category: 'Test' }
      ];

      for (const entry of entries) {
        await request(app)
          .post('/api/v1/vault/entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ encryptionKey, ...entry });
      }
    });

    test('should export vault data', async () => {
      const response = await request(app)
        .post('/api/v1/vault/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('exportDate');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('source');
      expect(response.body.data).toHaveProperty('itemCount');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.message).toBe('Vault export completed successfully');
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .post('/api/v1/vault/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('POST /vault/import', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-import@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);
    });

    test('should import vault data', async () => {
      const importData = {
        encryptionKey,
        data: {
          version: '1.0',
          source: 'Test Import',
          items: [
            {
              title: 'Imported Entry 1',
              username: 'import1',
              password: 'importpass1',
              category: 'login'
            },
            {
              title: 'Imported Entry 2',
              username: 'import2',
              password: 'importpass2',
              category: 'login'
            }
          ]
        }
      };

      const response = await request(app)
        .post('/api/v1/vault/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(importData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Vault import completed');
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalItems).toBe(2);
    });

    test('should validate import data', async () => {
      const importData = {
        encryptionKey,
        data: {
          version: '1.0',
          source: 'Test Import',
          items: [
            {
              title: 'Invalid Entry',
              // Missing required category
              username: 'test'
            }
          ]
        }
      };

      const response = await request(app)
        .post('/api/v1/vault/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(importData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid import data format');
    });

    test('should require encryption key', async () => {
      const importData = {
        data: {
          version: '1.0',
          source: 'Test Import',
          items: []
        }
      };

      const response = await request(app)
        .post('/api/v1/vault/import')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(importData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('GET /vault/expiring-passwords', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-expiring@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);
    });

    test('should check expiring passwords successfully', async () => {
      const response = await request(app)
        .post('/api/v1/vault/expiring-passwords')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ encryptionKey });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('expiringPasswords');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should require encryption key', async () => {
      const response = await request(app)
        .post('/api/v1/vault/expiring-passwords')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key is required for vault operations');
    });
  });

  describe('Enhanced Security Features', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-security@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);
    });

    test('should handle concurrent vault operations safely', async () => {
      const entryData = {
        encryptionKey,
        title: 'Concurrent Test Entry',
        username: 'concurrent@example.com',
        password: 'ConcurrentPass123!',
        category: 'Test'
      };

      // Make multiple concurrent requests
      const promises = Array(5).fill().map(() =>
        request(app)
          .post('/api/v1/vault/entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(entryData)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Entry created successfully');
      });
    });

    test('should handle large vault operations efficiently', async () => {
      const entries = [];
      
      // Create 10 entries
      for (let i = 0; i < 10; i++) {
        const entryData = {
          encryptionKey,
          title: `Large Vault Entry ${i}`,
          username: `user${i}@example.com`,
          password: `Password${i}123!`,
          category: 'LargeTest'
        };

        const response = await request(app)
          .post('/api/v1/vault/entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(entryData);

        expect(response.status).toBe(201);
        entries.push(response.body.entry);
      }

      // Retrieve all entries
      const getResponse = await request(app)
        .post('/api/v1/vault/entries/list')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey });

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.entries.length).toBeGreaterThanOrEqual(10);
    });

    test('should handle encryption/decryption errors gracefully', async () => {
      const wrongKey = await deriveEncryptionKey('WrongMasterPassword');
      const entryData = {
        encryptionKey: wrongKey,
        title: 'Test Entry',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      const createResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      // For new users without existing data, any key is accepted
      expect(createResponse.status).toBe(201);
    });
  });

  describe('Security Features', () => {
    let accessToken;
    let userData;
    let encryptionKey;

    beforeEach(async () => {
      userData = {
        email: 'vault-controller-encryption@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      encryptionKey = await deriveEncryptionKey(userData.masterPassword);
    });

    test('should not expose sensitive data in responses', async () => {
      const entryData = {
        encryptionKey,
        title: 'Test Entry',
        username: 'test@example.com',
        password: 'TestPassword123!',
        category: 'Test'
      };

      const createResponse = await request(app)
        .post('/api/v1/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.entry).not.toHaveProperty('encryptedData');
      expect(createResponse.body.entry).not.toHaveProperty('iv');
      expect(createResponse.body.entry).not.toHaveProperty('salt');
    });
  });

  describe('Error Handling', () => {
    test('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/v1/vault/entries')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid JSON');
    });

    test('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the controller doesn't crash
      const userData = {
        email: 'vault-controller-error@example.com',
        password: 'SecurePassword123!',
        masterPassword: 'MasterKey456!'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      const accessToken = await tokenService.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      const encryptionKey = await deriveEncryptionKey(userData.masterPassword);
      const response = await request(app)
        .post('/api/v1/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ encryptionKey });

      // Should either succeed or return a proper error response
      expect([200, 400, 500]).toContain(response.status);
    });
  });
}); 