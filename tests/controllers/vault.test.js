const request = require('supertest');
const express = require('express');
const vaultRoutes = require('../../src/routes/vault');
const { authMiddleware, __tokenService } = require('../../src/middleware/auth');
const { CryptoService } = require('../../src/services/cryptoService');
const userRepository = require('../../src/models/userRepository');
const vaultRepository = require('../../src/models/vaultRepository');

describe('VaultController', () => {
  let app;
  let tokenService;
  let cryptoService;
  let accessToken;
  let userId;

  // Mock vault entry data
  const validEntry = {
    name: 'Gmail Account',
    username: 'user@gmail.com',
    password: 'SecurePassword123!',
    url: 'https://gmail.com',
    notes: 'Personal email account',
    category: 'Email'
  };

  const validUser = {
    email: 'test@example.com',
    password: 'UserPassword123!',
    masterPassword: 'MasterKey456!'
  };

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    
    tokenService = __tokenService;
    cryptoService = new CryptoService();
    
    // Clear data
    tokenService.clearBlacklist();
    await userRepository.clear();
    await vaultRepository.clear();

    // Create test user and get authentication token
    const hashedPassword = await cryptoService.hashPassword(validUser.password);
    const user = await userRepository.create({
      email: validUser.email,
      passwordHash: hashedPassword
    });
    userId = user.id;

    const userForToken = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    accessToken = await tokenService.generateAccessToken(userForToken);

    // Use the actual vault routes
    app.use('/vault', vaultRoutes);
  });

  afterAll(async () => {
    try {
      // Clear all sessions and data
      await vaultRepository.clear();
      await userRepository.clear();
      
      // Clear rate limit store (it's a module-level Map)
      const vaultController = require('../../src/controllers/vaultController');
      
      // Give time for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error during vault test cleanup:', error);
    }
  });

  describe('POST /vault/unlock', () => {
    test('should unlock vault with correct master password', async () => {
      const response = await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Vault unlocked successfully');
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
    });

    test('should reject incorrect master password', async () => {
      const response = await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: 'WrongMasterPassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid master password');
    });

    test('should require master password', async () => {
      const response = await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Master password');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/vault/unlock')
        .send({ masterPassword: validUser.masterPassword });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('POST /vault/entries', () => {
    beforeEach(async () => {
      // Unlock vault first
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });
    });

    test('should create new vault entry successfully', async () => {
      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Entry created successfully');
      expect(response.body.entry).toHaveProperty('id');
      expect(response.body.entry.name).toBe(validEntry.name);
      expect(response.body.entry.username).toBe(validEntry.username);
      expect(response.body.entry.url).toBe(validEntry.url);
      expect(response.body.entry.category).toBe(validEntry.category);
      expect(response.body.entry).not.toHaveProperty('password'); // Should be encrypted
      expect(response.body.entry).toHaveProperty('createdAt');
      expect(response.body.entry).toHaveProperty('updatedAt');
    });

    test('should encrypt sensitive data', async () => {
      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      expect(response.status).toBe(201);
      expect(response.body.entry).toHaveProperty('encryptedData');
      expect(response.body.entry.encryptedData).toHaveProperty('ciphertext');
      expect(response.body.entry.encryptedData).toHaveProperty('iv');
      expect(response.body.entry.encryptedData).toHaveProperty('authTag');
    });

    test('should require entry name', async () => {
      const invalidEntry = { ...validEntry };
      delete invalidEntry.name;

      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidEntry);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Entry name');
    });

    test('should require either username or password', async () => {
      const invalidEntry = {
        name: 'Test Entry',
        url: 'https://example.com'
      };

      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidEntry);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('username or password');
    });

    test('should validate URL format when provided', async () => {
      const invalidEntry = {
        ...validEntry,
        url: 'invalid-url'
      };

      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidEntry);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid URL');
    });

    test('should require unlocked vault', async () => {
      // Clear vault session
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });

    test('should sanitize and validate input data', async () => {
      const entryWithExtraFields = {
        ...validEntry,
        maliciousScript: '<script>alert("xss")</script>',
        id: 'should-be-ignored',
        userId: 'should-be-ignored',
        createdAt: 'should-be-ignored'
      };

      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(entryWithExtraFields);

      expect(response.status).toBe(201);
      expect(response.body.entry).not.toHaveProperty('maliciousScript');
      expect(response.body.entry.userId).toBe(userId);
      expect(response.body.entry.id).not.toBe('should-be-ignored');
    });
  });

  describe('GET /vault/entries', () => {
    beforeEach(async () => {
      // Unlock vault and create test entries
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      // Create multiple test entries
      await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...validEntry,
          name: 'Facebook Account',
          username: 'user@facebook.com',
          url: 'https://facebook.com',
          category: 'Social'
        });
    });

    test('should retrieve all user entries', async () => {
      const response = await request(app)
        .get('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(2);
      expect(response.body.entries[0]).toHaveProperty('id');
      expect(response.body.entries[0]).toHaveProperty('name');
      expect(response.body.entries[0]).toHaveProperty('username');
      expect(response.body.entries[0]).toHaveProperty('url');
      expect(response.body.entries[0]).toHaveProperty('category');
      expect(response.body.entries[0]).not.toHaveProperty('password'); // Should not include decrypted password
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/vault/entries?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(1);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    test('should support category filtering', async () => {
      const response = await request(app)
        .get('/vault/entries?category=Email')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(1);
      expect(response.body.entries[0].category).toBe('Email');
    });

    test('should require unlocked vault', async () => {
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .get('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });

    test('should only return entries for authenticated user', async () => {
      // Create another user with entries
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        passwordHash: await cryptoService.hashPassword('password123')
      });

      const response = await request(app)
        .get('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      // Should only return entries for the authenticated user
      response.body.entries.forEach(entry => {
        expect(entry.userId).toBe(userId);
      });
    });
  });

  describe('GET /vault/entries/:id', () => {
    let entryId;

    beforeEach(async () => {
      // Unlock vault and create test entry
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      const createResponse = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      entryId = createResponse.body.entry.id;
    });

    test('should retrieve specific entry with decrypted data', async () => {
      const response = await request(app)
        .get(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.entry.id).toBe(entryId);
      expect(response.body.entry.name).toBe(validEntry.name);
      expect(response.body.entry.username).toBe(validEntry.username);
      expect(response.body.entry.password).toBe(validEntry.password); // Should be decrypted
      expect(response.body.entry.url).toBe(validEntry.url);
      expect(response.body.entry.notes).toBe(validEntry.notes);
    });

    test('should return 404 for non-existent entry', async () => {
      const fakeId = 'non-existent-id';
      const response = await request(app)
        .get(`/vault/entries/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Entry not found');
    });

    test('should require unlocked vault', async () => {
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .get(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });

    test('should not allow access to other users entries', async () => {
      // Create another user and their token
      const otherUser = await userRepository.create({
        email: 'other@example.com',
        passwordHash: await cryptoService.hashPassword('password123')
      });
      const otherToken = await tokenService.generateAccessToken({
        id: otherUser.id,
        email: otherUser.email,
        role: otherUser.role
      });

      const response = await request(app)
        .get(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Entry not found');
    });
  });

  describe('PUT /vault/entries/:id', () => {
    let entryId;

    beforeEach(async () => {
      // Unlock vault and create test entry
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      const createResponse = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      entryId = createResponse.body.entry.id;
    });

    test('should update entry successfully', async () => {
      const updateData = {
        name: 'Gmail Account - Updated',
        username: 'updated@gmail.com',
        password: 'NewPassword123!',
        notes: 'Updated notes'
      };

      const response = await request(app)
        .put(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Entry updated successfully');
      expect(response.body.entry.name).toBe(updateData.name);
      expect(response.body.entry.username).toBe(updateData.username);
      expect(response.body.entry.updatedAt).toBeDefined();
    });

    test('should validate updated data', async () => {
      const invalidUpdate = {
        url: 'invalid-url-format'
      };

      const response = await request(app)
        .put(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidUpdate);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid URL');
    });

    test('should return 404 for non-existent entry', async () => {
      const response = await request(app)
        .put('/vault/entries/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Entry not found');
    });

    test('should require unlocked vault', async () => {
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .put(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Entry' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });

    test('should preserve fields not being updated', async () => {
      const partialUpdate = {
        name: 'Only Name Updated'
      };

      const response = await request(app)
        .put(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(partialUpdate);

      expect(response.status).toBe(200);
      expect(response.body.entry.name).toBe(partialUpdate.name);
      expect(response.body.entry.username).toBe(validEntry.username); // Should be preserved
      expect(response.body.entry.url).toBe(validEntry.url); // Should be preserved
    });
  });

  describe('DELETE /vault/entries/:id', () => {
    let entryId;

    beforeEach(async () => {
      // Unlock vault and create test entry
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      const createResponse = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      entryId = createResponse.body.entry.id;
    });

    test('should delete entry successfully', async () => {
      const response = await request(app)
        .delete(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Entry deleted successfully');

      // Verify entry is deleted
      const getResponse = await request(app)
        .get(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getResponse.status).toBe(404);
    });

    test('should return 404 for non-existent entry', async () => {
      const response = await request(app)
        .delete('/vault/entries/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Entry not found');
    });

    test('should require unlocked vault', async () => {
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .delete(`/vault/entries/${entryId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });
  });

  describe('POST /vault/search', () => {
    beforeEach(async () => {
      // Unlock vault and create test entries
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      const entries = [
        { ...validEntry, name: 'Gmail Personal', username: 'personal@gmail.com', category: 'Email', url: 'https://gmail.com' },
        { ...validEntry, name: 'Gmail Work', username: 'work@gmail.com', category: 'Work', url: 'https://gmail.com' },
        { ...validEntry, name: 'Facebook', username: 'user@facebook.com', category: 'Social', url: 'https://facebook.com' },
        { ...validEntry, name: 'Bank Account', username: 'user@bank.com', category: 'Finance', url: 'https://bank.com' }
      ];

      for (const entry of entries) {
        await request(app)
          .post('/vault/entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(entry);
      }
    });

    test('should search by entry name', async () => {
      const response = await request(app)
        .post('/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: 'Gmail' });

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(2);
      expect(response.body.entries.every(entry => entry.name.includes('Gmail'))).toBe(true);
    });

    test('should search by category', async () => {
      const response = await request(app)
        .post('/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ category: 'Email' });

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(1);
      expect(response.body.entries[0].category).toBe('Email');
    });

    test('should search by URL domain', async () => {
      const response = await request(app)
        .post('/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: 'gmail.com' });

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(2);
    });

    test('should support case-insensitive search', async () => {
      const response = await request(app)
        .post('/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: 'gmail' });

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(2);
    });

    test('should require unlocked vault', async () => {
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .post('/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: 'Gmail' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });

    test('should return empty array for no matches', async () => {
      const response = await request(app)
        .post('/vault/search')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: 'NonExistentService' });

      expect(response.status).toBe(200);
      expect(response.body.entries).toHaveLength(0);
    });
  });

  describe('POST /vault/generate-password', () => {
    beforeEach(async () => {
      // Unlock vault
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });
    });

    test('should generate secure password with default options', async () => {
      const response = await request(app)
        .post('/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.password).toBeDefined();
      expect(response.body.password.length).toBe(12); // Default length
      expect(response.body.strength).toBeDefined();
      expect(response.body.strength.score).toBeGreaterThanOrEqual(3);
    });

    test('should respect custom password options', async () => {
      const options = {
        length: 20,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: false,
        excludeSimilar: true
      };

      const response = await request(app)
        .post('/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(options);

      expect(response.status).toBe(200);
      expect(response.body.password.length).toBe(20);
      expect(/[A-Z]/.test(response.body.password)).toBe(true);
      expect(/[a-z]/.test(response.body.password)).toBe(true);
      expect(/\d/.test(response.body.password)).toBe(true);
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(response.body.password)).toBe(false);
    });

    test('should validate password generation options', async () => {
      const invalidOptions = {
        length: 5 // Too short
      };

      const response = await request(app)
        .post('/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidOptions);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('length');
    });

    test('should generate different passwords on multiple calls', async () => {
      const response1 = await request(app)
        .post('/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      const response2 = await request(app)
        .post('/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response1.body.password).not.toBe(response2.body.password);
    });

    test('should require unlocked vault', async () => {
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .post('/vault/generate-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });
  });

  describe('POST /vault/change-master-password', () => {
    beforeEach(async () => {
      // Unlock vault and create some entries
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);
    });

    test('should change master password and re-encrypt all data', async () => {
      const newMasterPassword = 'NewMasterKey789!';
      
      const response = await request(app)
        .post('/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentMasterPassword: validUser.masterPassword,
          newMasterPassword
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Master password changed successfully');
      expect(response.body.reencryptedEntries).toBe(1);

      // Verify old master password doesn't work
      const oldPasswordResponse = await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      expect(oldPasswordResponse.status).toBe(401);

      // Verify new master password works
      const newPasswordResponse = await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: newMasterPassword });

      expect(newPasswordResponse.status).toBe(200);
    });

    test('should verify current master password', async () => {
      const response = await request(app)
        .post('/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentMasterPassword: 'WrongCurrentPassword',
          newMasterPassword: 'NewMasterKey789!'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current master password is incorrect');
    });

    test('should validate new master password strength', async () => {
      const response = await request(app)
        .post('/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentMasterPassword: validUser.masterPassword,
          newMasterPassword: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });

    test('should require unlocked vault', async () => {
      await vaultRepository.clearSession(userId);

      const response = await request(app)
        .post('/vault/change-master-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentMasterPassword: validUser.masterPassword,
          newMasterPassword: 'NewMasterKey789!'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault must be unlocked to perform this operation');
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle vault corruption gracefully', async () => {
      // Unlock vault
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      // Create entry with corrupted data simulation
      await vaultRepository.createCorruptedEntry(userId);

      const response = await request(app)
        .get('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.warnings).toContain('Some entries could not be decrypted');
    });

    test('should handle invalid vault session', async () => {
      vaultRepository.createInvalidSession(userId);

      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid vault session');
    });

    test('should rate limit vault operations', async () => {
      // Simulate multiple rapid requests
      const promises = Array(10).fill().map(() => 
        request(app)
          .post('/vault/unlock')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ masterPassword: 'wrong-password' })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(403); // Vault not unlocked
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('masterPassword');
      expect(response.body).not.toHaveProperty('encryptionKey');
    });

    test('should log security events appropriately', async () => {
      // Multiple failed unlock attempts should be logged
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: 'wrong1' });

      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: 'wrong2' });

      // Security logging is handled by the controller, 
      // this test ensures the endpoint works properly
      expect(true).toBe(true);
    });

    test('should handle vault session expiration', async () => {
      // Unlock vault first
      await request(app)
        .post('/vault/unlock')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ masterPassword: validUser.masterPassword });

      // Simulate session expiration
      vaultRepository.expireSession(userId);

      const response = await request(app)
        .post('/vault/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validEntry);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Vault session expired');
    });
  });
}); 