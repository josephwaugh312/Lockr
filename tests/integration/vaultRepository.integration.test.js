/**
 * Vault Repository Integration Tests
 * Tests real vault operations with database and session management
 */

const vaultRepository = require('../../src/models/vaultRepository');
const userRepository = require('../../src/models/userRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');

describe('Vault Repository Integration Tests', () => {
  let testUser;
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
    await database.query('DELETE FROM vault_entries WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%vault-integration%']);
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%vault-integration%']);

    // Clear all sessions to prevent interference between tests
    vaultRepository.sessions.clear();

    // Create test user
    const userData = {
      email: 'vault-integration-test@example.com',
      password: 'SecurePassword123!',
      name: 'Vault Integration Test User'
    };

    // Hash the password before creating the user
    const passwordHash = await cryptoService.hashPassword(userData.password);
    const userDataWithHash = {
      ...userData,
      passwordHash
    };
    delete userDataWithHash.password;

    testUser = await userRepository.create(userDataWithHash);
  });

  describe('Vault Entry CRUD Operations', () => {
    test('should create vault entry with encrypted data', async () => {
      const entryData = {
        name: 'Test Website',
        username: 'testuser',
        url: 'https://test.com',
        category: 'login',
        encryptedData: Buffer.from('encrypted-password-data'),
        favorite: false
      };

      const entry = await vaultRepository.createEntry(testUser.id, entryData);

      expect(entry).toHaveProperty('id');
      expect(entry.userId).toBe(testUser.id);
      expect(entry.name).toBe(entryData.name);
      expect(entry.username).toBe(entryData.username);
      expect(entry.url).toBe(entryData.url);
      expect(entry.category).toBe(entryData.category);
      expect(entry.favorite).toBe(entryData.favorite);
      expect(entry.encryptedData).toBe(entryData.encryptedData.toString()); // Fix: expect string, not Buffer
      expect(entry.createdAt).toBeDefined();
      expect(entry.updatedAt).toBeDefined();

      // Verify data is stored in database
      const dbEntry = await database.query('SELECT * FROM vault_entries WHERE id = $1', [entry.id]);
      expect(dbEntry.rows).toHaveLength(1);
      expect(dbEntry.rows[0].user_id).toBe(testUser.id);
      expect(dbEntry.rows[0].name).toBe(entryData.name);
    });

    test('should retrieve vault entries with pagination', async () => {
      // Create multiple entries
      const entries = [
        { name: 'Entry 1', username: 'user1', category: 'login', encryptedData: Buffer.from('data1') },
        { name: 'Entry 2', username: 'user2', category: 'login', encryptedData: Buffer.from('data2') },
        { name: 'Entry 3', username: 'user3', category: 'card', encryptedData: Buffer.from('data3') }
      ];

      for (const entryData of entries) {
        await vaultRepository.createEntry(testUser.id, entryData);
      }

      // Test pagination
      const result = await vaultRepository.getEntries(testUser.id, { page: 1, limit: 2 });

      expect(result.entries).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.pages).toBe(2);

      // Test second page
      const secondPage = await vaultRepository.getEntries(testUser.id, { page: 2, limit: 2 });
      expect(secondPage.entries).toHaveLength(1);
    });

    test('should filter entries by category', async () => {
      // Create entries with different categories
      const entries = [
        { name: 'Login Entry', username: 'user1', category: 'login', encryptedData: Buffer.from('data1') },
        { name: 'Card Entry', username: 'user2', category: 'card', encryptedData: Buffer.from('data2') },
        { name: 'Note Entry', username: 'user3', category: 'secure_note', encryptedData: Buffer.from('data3') }
      ];

      for (const entryData of entries) {
        await vaultRepository.createEntry(testUser.id, entryData);
      }

      // Filter by login category
      const loginEntries = await vaultRepository.getEntries(testUser.id, { category: 'login' });
      expect(loginEntries.entries).toHaveLength(1);
      expect(loginEntries.entries[0].category).toBe('login');

      // Filter by card category
      const cardEntries = await vaultRepository.getEntries(testUser.id, { category: 'card' });
      expect(cardEntries.entries).toHaveLength(1);
      expect(cardEntries.entries[0].category).toBe('card');
    });

    test('should get specific entry by ID', async () => {
      const entryData = {
        name: 'Specific Entry',
        username: 'specificuser',
        category: 'login',
        encryptedData: Buffer.from('specific-data')
      };

      const createdEntry = await vaultRepository.createEntry(testUser.id, entryData);
      const retrievedEntry = await vaultRepository.getEntry(createdEntry.id, testUser.id);

      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry.id).toBe(createdEntry.id);
      expect(retrievedEntry.name).toBe(entryData.name);
      expect(retrievedEntry.username).toBe(entryData.username);
    });

    test('should return null for non-existent entry', async () => {
      const fakeEntryId = '00000000-0000-0000-0000-000000000000';
      const entry = await vaultRepository.getEntry(fakeEntryId, testUser.id);
      expect(entry).toBeNull();
    });

    test('should update vault entry', async () => {
      const entryData = {
        name: 'Original Name',
        username: 'originaluser',
        category: 'login',
        encryptedData: Buffer.from('original-data')
      };

      const createdEntry = await vaultRepository.createEntry(testUser.id, entryData);

      const updateData = {
        name: 'Updated Name',
        username: 'updateduser',
        encryptedData: Buffer.from('updated-data'),
        favorite: true
      };

      const updatedEntry = await vaultRepository.updateEntry(createdEntry.id, testUser.id, updateData);

      expect(updatedEntry).toBeDefined();
      expect(updatedEntry.id).toBe(createdEntry.id);
      expect(updatedEntry.name).toBe(updateData.name);
      expect(updatedEntry.username).toBe(updateData.username);
      expect(updatedEntry.encryptedData).toBe(updateData.encryptedData.toString()); // Fix: expect string, not Buffer
      expect(updatedEntry.favorite).toBe(updateData.favorite);
      expect(updatedEntry.category).toBe(entryData.category); // Should remain unchanged
    });

    test('should return null when updating non-existent entry', async () => {
      const fakeEntryId = '00000000-0000-0000-0000-000000000000';
      const updateData = { name: 'Updated Name' };
      
      const result = await vaultRepository.updateEntry(fakeEntryId, testUser.id, updateData);
      expect(result).toBeNull();
    });

    test('should delete vault entry', async () => {
      const entryData = {
        name: 'Delete Test Entry',
        username: 'deleteuser',
        category: 'login',
        encryptedData: Buffer.from('delete-data')
      };

      const createdEntry = await vaultRepository.createEntry(testUser.id, entryData);
      
      // Verify entry exists
      const existingEntry = await vaultRepository.getEntry(createdEntry.id, testUser.id);
      expect(existingEntry).toBeDefined();

      // Delete entry
      const deleted = await vaultRepository.deleteEntry(createdEntry.id, testUser.id);
      expect(deleted).toBe(true);

      // Verify entry is deleted
      const deletedEntry = await vaultRepository.getEntry(createdEntry.id, testUser.id);
      expect(deletedEntry).toBeNull();
    });

    test('should return false when deleting non-existent entry', async () => {
      const fakeEntryId = '00000000-0000-0000-0000-000000000000';
      const deleted = await vaultRepository.deleteEntry(fakeEntryId, testUser.id);
      expect(deleted).toBe(false);
    });
  });

  describe('Vault Search Operations', () => {
    beforeEach(async () => {
      // Create multiple test entries
      const entries = [
        { name: 'GitHub Account', username: 'dev1', url: 'github.com', category: 'login', encryptedData: Buffer.from('data1') },
        { name: 'GitLab Account', username: 'dev2', url: 'gitlab.com', category: 'login', encryptedData: Buffer.from('data2') },
        { name: 'Credit Card', username: '', url: '', category: 'card', encryptedData: Buffer.from('data3') },
        { name: 'Bank Account', username: '', url: '', category: 'secure_note', encryptedData: Buffer.from('data4') }
      ];

      for (const entry of entries) {
        await vaultRepository.createEntry(testUser.id, entry);
      }
    });

    test('should search entries by query', async () => {
      const results = await vaultRepository.searchEntries(testUser.id, { query: 'Git' });

      expect(results).toHaveLength(2);
      expect(results.some(entry => entry.name.includes('GitHub'))).toBe(true);
      expect(results.some(entry => entry.name.includes('GitLab'))).toBe(true);
    });

    test('should search entries by username', async () => {
      const results = await vaultRepository.searchEntries(testUser.id, { query: 'dev1' });

      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('dev1');
    });

    test('should search entries by URL', async () => {
      const results = await vaultRepository.searchEntries(testUser.id, { query: 'github.com' });

      expect(results).toHaveLength(1);
      expect(results[0].url).toBe('github.com');
    });

    test('should filter entries by category', async () => {
      const results = await vaultRepository.searchEntries(testUser.id, { category: 'login' });

      expect(results).toHaveLength(2);
      expect(results.every(entry => entry.category === 'login')).toBe(true);
    });

    test('should combine search query and category filter', async () => {
      const results = await vaultRepository.searchEntries(testUser.id, { 
        query: 'Git', 
        category: 'login' 
      });

      expect(results).toHaveLength(2);
      expect(results.every(entry => entry.category === 'login')).toBe(true);
      expect(results.some(entry => entry.name.includes('GitHub'))).toBe(true);
      expect(results.some(entry => entry.name.includes('GitLab'))).toBe(true);
    });

    test('should return empty results for no matches', async () => {
      const results = await vaultRepository.searchEntries(testUser.id, { query: 'NonExistentEntry' });
      expect(results).toHaveLength(0);
    });

    test('should handle case-insensitive search', async () => {
      const results = await vaultRepository.searchEntries(testUser.id, { query: 'github' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('GitHub Account');
    });
  });

  describe('Session Management', () => {
    test('should create vault session', async () => {
      const encryptionKey = Buffer.from('test-encryption-key');
      const session = await vaultRepository.createSession(testUser.id, encryptionKey);

      expect(session).toBeDefined();
      expect(session.userId).toBe(testUser.id);
      expect(session.createdAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    test('should get vault session', async () => {
      const encryptionKey = Buffer.from('test-encryption-key');
      await vaultRepository.createSession(testUser.id, encryptionKey);

      const session = await vaultRepository.getSession(testUser.id);

      expect(session).toBeDefined();
      expect(session.userId).toBe(testUser.id);
      expect(session.createdAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    test('should return null for non-existent session', async () => {
      const session = await vaultRepository.getSession(testUser.id);
      expect(session).toBeNull();
    });

    test('should check vault unlock status', async () => {
      // Initially unlocked
      expect(await vaultRepository.isVaultUnlocked(testUser.id)).toBe(false);

      // Create session
      const encryptionKey = Buffer.from('test-encryption-key');
      await vaultRepository.createSession(testUser.id, encryptionKey);

      // Now unlocked
      expect(await vaultRepository.isVaultUnlocked(testUser.id)).toBe(true);
    });

    test('should get encryption key from session', async () => {
      const encryptionKey = Buffer.from('test-encryption-key');
      await vaultRepository.createSession(testUser.id, encryptionKey);

      const retrievedKey = await vaultRepository.getEncryptionKey(testUser.id);
      expect(retrievedKey).toEqual(encryptionKey);
    });

    test('should return null for encryption key when no session', async () => {
      const key = await vaultRepository.getEncryptionKey(testUser.id);
      expect(key).toBeNull();
    });

    test('should clear vault session', async () => {
      const encryptionKey = Buffer.from('test-encryption-key');
      await vaultRepository.createSession(testUser.id, encryptionKey);

      // Verify session exists
      expect(await vaultRepository.isVaultUnlocked(testUser.id)).toBe(true);

      // Clear session
      const cleared = await vaultRepository.clearSession(testUser.id);
      expect(cleared).toBe(true);

      // Verify session is cleared
      expect(await vaultRepository.isVaultUnlocked(testUser.id)).toBe(false);
    });

    test('should return false when clearing non-existent session', async () => {
      const cleared = await vaultRepository.clearSession(testUser.id);
      expect(cleared).toBe(false);
    });

    test('should handle session expiration', async () => {
      const encryptionKey = Buffer.from('test-encryption-key');
      await vaultRepository.createSession(testUser.id, encryptionKey);

      // Manually expire the session
      vaultRepository.expireSession(testUser.id);

      // Session should be expired
      expect(await vaultRepository.isVaultUnlocked(testUser.id)).toBe(false);
      expect(await vaultRepository.getEncryptionKey(testUser.id)).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    test('should get all entries for re-encryption', async () => {
      // Create multiple entries
      const entries = [
        { name: 'Entry 1', category: 'login', encryptedData: Buffer.from('data1') },
        { name: 'Entry 2', category: 'card', encryptedData: Buffer.from('data2') },
        { name: 'Entry 3', category: 'secure_note', encryptedData: Buffer.from('data3') }
      ];

      for (const entryData of entries) {
        await vaultRepository.createEntry(testUser.id, entryData);
      }

      const allEntries = await vaultRepository.getAllEntriesForReencryption(testUser.id);

      expect(allEntries).toHaveLength(3);
      expect(allEntries[0].userId).toBe(testUser.id);
      expect(allEntries[1].userId).toBe(testUser.id);
      expect(allEntries[2].userId).toBe(testUser.id);
    });

    test('should batch update entries', async () => {
      // Create entries
      const entries = [
        { name: 'Entry 1', category: 'login', encryptedData: Buffer.from('data1') },
        { name: 'Entry 2', category: 'card', encryptedData: Buffer.from('data2') }
      ];

      const createdEntries = [];
      for (const entryData of entries) {
        const entry = await vaultRepository.createEntry(testUser.id, entryData);
        createdEntries.push(entry);
      }

      // Update encrypted data for re-encryption
      const updatedEntries = createdEntries.map(entry => ({
        ...entry,
        encryptedData: Buffer.from('new-encrypted-data')
      }));

      const updatedCount = await vaultRepository.batchUpdateEntries(updatedEntries);

      expect(updatedCount).toBe(2);

      // Verify entries were updated
      for (const entry of createdEntries) {
        const updatedEntry = await vaultRepository.getEntry(entry.id, testUser.id);
        expect(updatedEntry.encryptedData).toBe('new-encrypted-data'); // Fix: expect string, not Buffer
      }
    });

    test('should handle empty batch update', async () => {
      const updatedCount = await vaultRepository.batchUpdateEntries([]);
      expect(updatedCount).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    test('should count entries for user', async () => {
      // Create entries
      const entries = [
        { name: 'Entry 1', category: 'login', encryptedData: Buffer.from('data1') },
        { name: 'Entry 2', category: 'card', encryptedData: Buffer.from('data2') }
      ];

      for (const entryData of entries) {
        await vaultRepository.createEntry(testUser.id, entryData);
      }

      const count = await vaultRepository.count(testUser.id);
      expect(count).toBe(2);
    });

    test('should count all entries when no user specified', async () => {
      // Create entries for multiple users
      const user2 = await userRepository.create({
        email: 'vault-integration-test2@example.com',
        passwordHash: await cryptoService.hashPassword('Password123!'),
        name: 'Test User 2'
      });

      await vaultRepository.createEntry(testUser.id, {
        name: 'Entry 1',
        category: 'login',
        encryptedData: Buffer.from('data1')
      });

      await vaultRepository.createEntry(user2.id, {
        name: 'Entry 2',
        category: 'card',
        encryptedData: Buffer.from('data2')
      });

      const totalCount = await vaultRepository.count();
      expect(totalCount).toBe(2);

      // Clean up
      await userRepository.delete(user2.id);
    });

    test('should get session count', async () => {
      expect(vaultRepository.sessionCount()).toBe(0);

      const encryptionKey = Buffer.from('test-key');
      await vaultRepository.createSession(testUser.id, encryptionKey);

      expect(vaultRepository.sessionCount()).toBe(1);

      await vaultRepository.clearSession(testUser.id);
      expect(vaultRepository.sessionCount()).toBe(0);
    });

    test('should get all entries by user ID', async () => {
      // Create entries
      const entries = [
        { name: 'Entry 1', category: 'login', encryptedData: Buffer.from('data1') },
        { name: 'Entry 2', category: 'card', encryptedData: Buffer.from('data2') }
      ];

      for (const entryData of entries) {
        await vaultRepository.createEntry(testUser.id, entryData);
      }

      const allEntries = await vaultRepository.getAllByUserId(testUser.id);

      expect(allEntries).toHaveLength(2);
      expect(allEntries[0].userId).toBe(testUser.id);
      expect(allEntries[1].userId).toBe(testUser.id);
    });
  });

  describe('Data Formatting', () => {
    test('should format entry correctly', async () => {
      const entryData = {
        name: 'Test Entry',
        username: 'testuser',
        url: 'https://test.com',
        category: 'login',
        encryptedData: Buffer.from('test-data'),
        favorite: true
      };

      const entry = await vaultRepository.createEntry(testUser.id, entryData);

      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('userId');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('username');
      expect(entry).toHaveProperty('url');
      expect(entry).toHaveProperty('website'); // Alias for url
      expect(entry).toHaveProperty('category');
      expect(entry).toHaveProperty('encryptedData');
      expect(entry).toHaveProperty('favorite');
      expect(entry).toHaveProperty('createdAt');
      expect(entry).toHaveProperty('updatedAt');

      expect(entry.website).toBe(entry.url); // Verify alias
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Try to create entry with invalid user ID
      const invalidUserId = 'invalid-uuid';
      const entryData = {
        name: 'Test Entry',
        category: 'login',
        encryptedData: Buffer.from('test-data')
      };

      await expect(vaultRepository.createEntry(invalidUserId, entryData))
        .rejects.toThrow();
    });

    test('should handle missing required fields', async () => {
      const entryData = {
        // Missing name and encryptedData
        username: 'testuser',
        category: 'login'
      };

      await expect(vaultRepository.createEntry(testUser.id, entryData))
        .rejects.toThrow();
    });
  });

  describe('Test Methods', () => {
    test('should create corrupted entry for testing', async () => {
      const corruptedEntry = await vaultRepository.createCorruptedEntry(testUser.id);

      expect(corruptedEntry).toBeDefined();
      expect(corruptedEntry.name).toBe('Corrupted Entry');
      expect(corruptedEntry.category).toBe('test');
      expect(corruptedEntry.encryptedData.toString()).toContain('corrupted-data');
    });

    test('should create invalid session for testing', async () => {
      const invalidSession = vaultRepository.createInvalidSession(testUser.id);

      expect(invalidSession).toBeDefined();
      expect(invalidSession.userId).toBe(testUser.id);
      expect(invalidSession.encryptionKey.toString()).toBe('invalid-key');
    });

    test('should not allow test methods in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expect(vaultRepository.createCorruptedEntry(testUser.id))
          .rejects.toThrow('Test methods not allowed in production');

        expect(() => vaultRepository.createInvalidSession(testUser.id))
          .toThrow('Test methods not allowed in production');

        expect(() => vaultRepository.expireSession(testUser.id))
          .toThrow('Test methods not allowed in production');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Clear Operations', () => {
    test('should clear all vault data', async () => {
      // Create some entries
      await vaultRepository.createEntry(testUser.id, {
        name: 'Test Entry',
        category: 'login',
        encryptedData: Buffer.from('test-data')
      });

      // Create a session
      await vaultRepository.createSession(testUser.id, Buffer.from('test-key'));

      // Verify data exists
      expect(await vaultRepository.count(testUser.id)).toBe(1);
      expect(vaultRepository.sessionCount()).toBe(1);

      // Clear all data
      await vaultRepository.clear();

      // Verify data is cleared
      expect(await vaultRepository.count(testUser.id)).toBe(0);
      expect(vaultRepository.sessionCount()).toBe(0);
    });

    test('should not allow clear in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        await expect(vaultRepository.clear())
          .rejects.toThrow('Clear operation not allowed in production');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
}); 