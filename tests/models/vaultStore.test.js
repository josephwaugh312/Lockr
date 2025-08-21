const vaultStore = require('../../src/models/vaultStore');
const crypto = require('crypto');

describe('VaultStore', () => {
  const testUserId = 'test-user-123';
  const testUserId2 = 'test-user-456';

  beforeEach(() => {
    // Clear the store before each test
    vaultStore.clear();
  });

  describe('createEntry', () => {
    test('should create a new vault entry', async () => {
      const entryData = {
        name: 'Test Entry',
        username: 'testuser',
        url: 'https://example.com',
        category: 'websites',
        encryptedData: { ciphertext: 'encrypted-data', iv: 'iv', authTag: 'tag' }
      };

      const entry = await vaultStore.createEntry(testUserId, entryData);

      expect(entry).toHaveProperty('id');
      expect(entry.userId).toBe(testUserId);
      expect(entry.name).toBe(entryData.name);
      expect(entry.username).toBe(entryData.username);
      expect(entry.url).toBe(entryData.url);
      expect(entry.category).toBe(entryData.category);
      expect(entry.encryptedData).toEqual(entryData.encryptedData);
      expect(entry).toHaveProperty('createdAt');
      expect(entry).toHaveProperty('updatedAt');
    });

    test('should generate unique IDs for different entries', async () => {
      const entryData1 = { name: 'Entry 1', encryptedData: {} };
      const entryData2 = { name: 'Entry 2', encryptedData: {} };

      const entry1 = await vaultStore.createEntry(testUserId, entryData1);
      const entry2 = await vaultStore.createEntry(testUserId, entryData2);

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('getEntries', () => {
    beforeEach(async () => {
      // Create test entries
      await vaultStore.createEntry(testUserId, {
        name: 'Website 1',
        category: 'websites',
        encryptedData: {}
      });
      await vaultStore.createEntry(testUserId, {
        name: 'App 1',
        category: 'apps',
        encryptedData: {}
      });
      await vaultStore.createEntry(testUserId, {
        name: 'Website 2',
        category: 'websites',
        encryptedData: {}
      });
      await vaultStore.createEntry(testUserId2, {
        name: 'Other User Entry',
        category: 'websites',
        encryptedData: {}
      });
    });

    test('should return all entries for a user with default pagination', async () => {
      const result = await vaultStore.getEntries(testUserId);

      expect(result.entries).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.totalPages).toBe(1);
    });

    test('should filter entries by category', async () => {
      const result = await vaultStore.getEntries(testUserId, { category: 'websites' });

      expect(result.entries).toHaveLength(2);
      expect(result.entries.every(entry => entry.category === 'websites')).toBe(true);
    });

    test('should handle pagination correctly', async () => {
      // Create more entries
      for (let i = 0; i < 10; i++) {
        await vaultStore.createEntry(testUserId, {
          name: `Entry ${i}`,
          category: 'test',
          encryptedData: {}
        });
      }

      const page1 = await vaultStore.getEntries(testUserId, { page: 1, limit: 5 });
      const page2 = await vaultStore.getEntries(testUserId, { page: 2, limit: 5 });

      expect(page1.entries).toHaveLength(5);
      expect(page2.entries).toHaveLength(5);
      expect(page1.pagination.total).toBe(13); // 3 from beforeEach + 10 new
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.pages).toBe(3);

      // Ensure no duplicate entries between pages
      const page1Ids = page1.entries.map(e => e.id);
      const page2Ids = page2.entries.map(e => e.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    test('should return empty result for non-existent user', async () => {
      const result = await vaultStore.getEntries('non-existent-user');

      expect(result.entries).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    test('should sort entries by creation date (newest first)', async () => {
      // Add a delay to ensure different timestamps
      const entry1 = await vaultStore.createEntry(testUserId, { name: 'Old Entry', encryptedData: {} });
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const entry2 = await vaultStore.createEntry(testUserId, { name: 'New Entry', encryptedData: {} });

      const result = await vaultStore.getEntries(testUserId);

      // Newer entry should be first
      expect(result.entries[0].name).toBe('New Entry');
    });
  });

  describe('getEntry', () => {
    test('should return entry for correct user', async () => {
      const entryData = {
        name: 'Test Entry',
        encryptedData: { test: 'data' }
      };

      const createdEntry = await vaultStore.createEntry(testUserId, entryData);
      const retrievedEntry = await vaultStore.getEntry(createdEntry.id, testUserId);

      expect(retrievedEntry).toEqual(createdEntry);
    });

    test('should return null for wrong user', async () => {
      const entryData = { name: 'Test Entry', encryptedData: {} };
      const createdEntry = await vaultStore.createEntry(testUserId, entryData);

      const retrievedEntry = await vaultStore.getEntry(createdEntry.id, testUserId2);

      expect(retrievedEntry).toBeNull();
    });

    test('should return null for non-existent entry', async () => {
      const retrievedEntry = await vaultStore.getEntry('non-existent-id', testUserId);

      expect(retrievedEntry).toBeNull();
    });
  });

  describe('updateEntry', () => {
    test('should update existing entry', async () => {
      const entryData = {
        name: 'Original Name',
        username: 'originaluser',
        encryptedData: {}
      };

      const createdEntry = await vaultStore.createEntry(testUserId, entryData);
      const updateData = {
        name: 'Updated Name',
        username: 'updateduser'
      };

      const updatedEntry = await vaultStore.updateEntry(createdEntry.id, testUserId, updateData);

      expect(updatedEntry.name).toBe('Updated Name');
      expect(updatedEntry.username).toBe('updateduser');
      expect(new Date(updatedEntry.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(createdEntry.updatedAt).getTime());
      expect(updatedEntry.createdAt).toBe(createdEntry.createdAt);
    });

    test('should return null for wrong user', async () => {
      const entryData = { name: 'Test Entry', encryptedData: {} };
      const createdEntry = await vaultStore.createEntry(testUserId, entryData);

      const result = await vaultStore.updateEntry(createdEntry.id, testUserId2, { name: 'Updated' });

      expect(result).toBeNull();
    });

    test('should return null for non-existent entry', async () => {
      const result = await vaultStore.updateEntry('non-existent-id', testUserId, { name: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('deleteEntry', () => {
    test('should delete existing entry', async () => {
      const entryData = { name: 'Test Entry', encryptedData: {} };
      const createdEntry = await vaultStore.createEntry(testUserId, entryData);

      const deleted = await vaultStore.deleteEntry(createdEntry.id, testUserId);

      expect(deleted).toBe(true);
      expect(await vaultStore.getEntry(createdEntry.id, testUserId)).toBeNull();
    });

    test('should return false for wrong user', async () => {
      const entryData = { name: 'Test Entry', encryptedData: {} };
      const createdEntry = await vaultStore.createEntry(testUserId, entryData);

      const deleted = await vaultStore.deleteEntry(createdEntry.id, testUserId2);

      expect(deleted).toBe(false);
      expect(await vaultStore.getEntry(createdEntry.id, testUserId)).not.toBeNull();
    });

    test('should return false for non-existent entry', async () => {
      const deleted = await vaultStore.deleteEntry('non-existent-id', testUserId);

      expect(deleted).toBe(false);
    });
  });

  describe('searchEntries', () => {
    beforeEach(async () => {
      await vaultStore.createEntry(testUserId, {
        name: 'Gmail Account',
        username: 'user@gmail.com',
        url: 'https://gmail.com',
        category: 'email',
        encryptedData: {}
      });
      await vaultStore.createEntry(testUserId, {
        name: 'Facebook Login',
        username: 'facebookuser',
        url: 'https://facebook.com',
        category: 'social',
        encryptedData: {}
      });
      await vaultStore.createEntry(testUserId, {
        name: 'Bank Account',
        username: 'bankuser',
        url: 'https://mybank.com',
        category: 'finance',
        encryptedData: {}
      });
    });

    test('should search by name', async () => {
      const results = await vaultStore.searchEntries(testUserId, { query: 'gmail' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Gmail Account');
    });

    test('should search by username', async () => {
      const results = await vaultStore.searchEntries(testUserId, { query: 'facebook' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Facebook Login');
    });

    test('should search by URL domain', async () => {
      const results = await vaultStore.searchEntries(testUserId, { query: 'mybank' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bank Account');
    });

    test('should handle invalid URL in search', async () => {
      await vaultStore.createEntry(testUserId, {
        name: 'Invalid URL Entry',
        url: 'not-a-valid-url',
        encryptedData: {}
      });

      const results = await vaultStore.searchEntries(testUserId, { query: 'invalid' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Invalid URL Entry');
    });

    test('should filter by category', async () => {
      const results = await vaultStore.searchEntries(testUserId, { category: 'email' });

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('email');
    });

    test('should combine query and category filters', async () => {
      const results = await vaultStore.searchEntries(testUserId, {
        query: 'gmail',
        category: 'email'
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Gmail Account');
    });

    test('should return empty array for no matches', async () => {
      const results = await vaultStore.searchEntries(testUserId, { query: 'nonexistent' });

      expect(results).toHaveLength(0);
    });

    test('should be case insensitive', async () => {
      const results = await vaultStore.searchEntries(testUserId, { query: 'GMAIL' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Gmail Account');
    });

    test('should handle empty query', async () => {
      const results = await vaultStore.searchEntries(testUserId, { query: '' });

      expect(results).toHaveLength(3); // All entries
    });

    test('should handle whitespace-only query', async () => {
      const results = await vaultStore.searchEntries(testUserId, { query: '   ' });

      expect(results).toHaveLength(3); // All entries
    });
  });

  describe('Session Management', () => {
    const testEncryptionKey = Buffer.from('test-encryption-key');

    describe('createSession', () => {
      test('should create a new vault session', async () => {
        const session = await vaultStore.createSession(testUserId, testEncryptionKey);

        expect(session).toHaveProperty('sessionId');
        expect(session.userId).toBe(testUserId);
        expect(session.encryptionKey).toBe(testEncryptionKey);
        expect(session).toHaveProperty('createdAt');
        expect(session).toHaveProperty('expiresAt');

        // Verify expiration is in the future
        const expiresAt = new Date(session.expiresAt);
        expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      });

      test('should replace existing session for same user', async () => {
        const session1 = await vaultStore.createSession(testUserId, testEncryptionKey);
        const session2 = await vaultStore.createSession(testUserId, Buffer.from('new-key'));

        const currentSession = await vaultStore.getSession(testUserId);

        expect(currentSession.sessionId).toBe(session2.sessionId);
        expect(currentSession.sessionId).not.toBe(session1.sessionId);
      });
    });

    describe('getSession', () => {
      test('should return existing session', async () => {
        const createdSession = await vaultStore.createSession(testUserId, testEncryptionKey);
        const retrievedSession = await vaultStore.getSession(testUserId);

        expect(retrievedSession).toEqual(createdSession);
      });

      test('should return null for non-existent session', async () => {
        const session = await vaultStore.getSession('non-existent-user');

        expect(session).toBeNull();
      });
    });

    describe('isVaultUnlocked', () => {
      test('should return true for valid session', async () => {
        await vaultStore.createSession(testUserId, testEncryptionKey);
        const isUnlocked = await vaultStore.isVaultUnlocked(testUserId);

        expect(isUnlocked).toBe(true);
      });

      test('should return false for no session', async () => {
        const isUnlocked = await vaultStore.isVaultUnlocked(testUserId);

        expect(isUnlocked).toBe(false);
      });

      test('should return false and clean up expired session', async () => {
        await vaultStore.createSession(testUserId, testEncryptionKey);
        
        // Expire the session
        vaultStore.expireSession(testUserId);
        
        const isUnlocked = await vaultStore.isVaultUnlocked(testUserId);

        expect(isUnlocked).toBe(false);
        // Session should be cleaned up
        expect(await vaultStore.getSession(testUserId)).toBeNull();
      });
    });

    describe('getEncryptionKey', () => {
      test('should return encryption key for valid session', async () => {
        await vaultStore.createSession(testUserId, testEncryptionKey);
        const key = await vaultStore.getEncryptionKey(testUserId);

        expect(key).toBe(testEncryptionKey);
      });

      test('should return null for expired session', async () => {
        await vaultStore.createSession(testUserId, testEncryptionKey);
        vaultStore.expireSession(testUserId);
        
        const key = await vaultStore.getEncryptionKey(testUserId);

        expect(key).toBeNull();
      });

      test('should return null for non-existent session', async () => {
        const key = await vaultStore.getEncryptionKey(testUserId);

        expect(key).toBeNull();
      });
    });

    describe('clearSession', () => {
      test('should clear existing session', async () => {
        await vaultStore.createSession(testUserId, testEncryptionKey);
        await vaultStore.clearSession(testUserId);

        expect(await vaultStore.getSession(testUserId)).toBeNull();
        expect(await vaultStore.isVaultUnlocked(testUserId)).toBe(false);
      });

      test('should handle clearing non-existent session gracefully', async () => {
        await vaultStore.clearSession('non-existent-user');
        // Should not throw error
      });
    });

    describe('clearSessions', () => {
      test('should clear sessions for user', async () => {
        await vaultStore.createSession(testUserId, testEncryptionKey);
        vaultStore.clearSessions(testUserId);

        expect(await vaultStore.getSession(testUserId)).toBeNull();
      });
    });
  });

  describe('Batch Operations', () => {
    describe('getAllEntriesForReencryption', () => {
      test('should return all entries for user', async () => {
        await vaultStore.createEntry(testUserId, { name: 'Entry 1', encryptedData: {} });
        await vaultStore.createEntry(testUserId, { name: 'Entry 2', encryptedData: {} });
        await vaultStore.createEntry(testUserId2, { name: 'Entry 3', encryptedData: {} });

        const entries = await vaultStore.getAllEntriesForReencryption(testUserId);

        expect(entries).toHaveLength(2);
        expect(entries.every(entry => entry.userId === testUserId)).toBe(true);
      });

      test('should return empty array for user with no entries', async () => {
        const entries = await vaultStore.getAllEntriesForReencryption('no-entries-user');

        expect(entries).toHaveLength(0);
      });
    });

    describe('batchUpdateEntries', () => {
      test('should update multiple entries', async () => {
        const entry1 = await vaultStore.createEntry(testUserId, { name: 'Entry 1', encryptedData: {} });
        const entry2 = await vaultStore.createEntry(testUserId, { name: 'Entry 2', encryptedData: {} });

        const originalUpdatedAt1 = entry1.updatedAt;
        const originalUpdatedAt2 = entry2.updatedAt;

        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));

        entry1.name = 'Updated Entry 1';
        entry2.name = 'Updated Entry 2';

        await vaultStore.batchUpdateEntries([entry1, entry2]);

        const updatedEntry1 = await vaultStore.getEntry(entry1.id, testUserId);
        const updatedEntry2 = await vaultStore.getEntry(entry2.id, testUserId);

        expect(updatedEntry1.name).toBe('Updated Entry 1');
        expect(updatedEntry2.name).toBe('Updated Entry 2');
        expect(updatedEntry1.updatedAt).not.toBe(originalUpdatedAt1);
        expect(updatedEntry2.updatedAt).not.toBe(originalUpdatedAt2);
      });
    });
  });

  describe('Test Helpers', () => {
    describe('createCorruptedEntry', () => {
      test('should create corrupted entry for testing', async () => {
        const corruptedEntry = await vaultStore.createCorruptedEntry(testUserId);

        expect(corruptedEntry.name).toBe('Corrupted Entry');
        expect(corruptedEntry.encryptedData.ciphertext).toBe('invalid-ciphertext');
        expect(corruptedEntry.encryptedData.iv).toBe('invalid-iv');
        expect(corruptedEntry.encryptedData.authTag).toBe('invalid-auth-tag');
      });
    });

    describe('createInvalidSession', () => {
      test('should create invalid session for testing', () => {
        vaultStore.createInvalidSession(testUserId);
        
        const session = vaultStore.sessions.get(testUserId);
        expect(session.sessionId).toBe('invalid-session');
        expect(session.encryptionKey).toBeNull();
      });
    });

    describe('expireSession', () => {
      test('should expire existing session', async () => {
        const testKey = Buffer.from('test-key');
        await vaultStore.createSession(testUserId, testKey);
        vaultStore.expireSession(testUserId);

        const session = await vaultStore.getSession(testUserId);
        const expiresAt = new Date(session.expiresAt);
        expect(expiresAt.getTime()).toBeLessThan(Date.now());
      });

      test('should handle expiring non-existent session gracefully', () => {
        vaultStore.expireSession('non-existent-user');
        // Should not throw error
      });
    });
  });

  describe('Utility Methods', () => {
    describe('count', () => {
      test('should return correct entry count', async () => {
        expect(vaultStore.count()).toBe(0);

        await vaultStore.createEntry(testUserId, { name: 'Entry 1', encryptedData: {} });
        await vaultStore.createEntry(testUserId, { name: 'Entry 2', encryptedData: {} });

        expect(vaultStore.count()).toBe(2);
      });
    });

    describe('sessionCount', () => {
      test('should return correct session count', async () => {
        expect(vaultStore.sessionCount()).toBe(0);

        await vaultStore.createSession(testUserId, Buffer.from('key1'));
        await vaultStore.createSession(testUserId2, Buffer.from('key2'));

        expect(vaultStore.sessionCount()).toBe(2);
      });
    });

    describe('clear', () => {
      test('should clear all entries and sessions', async () => {
        await vaultStore.createEntry(testUserId, { name: 'Entry', encryptedData: {} });
        await vaultStore.createSession(testUserId, Buffer.from('key'));

        expect(vaultStore.count()).toBe(1);
        expect(vaultStore.sessionCount()).toBe(1);

        vaultStore.clear();

        expect(vaultStore.count()).toBe(0);
        expect(vaultStore.sessionCount()).toBe(0);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete vault workflow', async () => {
      const encryptionKey = Buffer.from('test-key');

      // Create session
      const session = await vaultStore.createSession(testUserId, encryptionKey);
      expect(await vaultStore.isVaultUnlocked(testUserId)).toBe(true);

      // Create entries
      const entry1 = await vaultStore.createEntry(testUserId, {
        name: 'Website Login',
        username: 'user@example.com',
        url: 'https://example.com',
        category: 'websites',
        encryptedData: { ciphertext: 'encrypted', iv: 'iv', authTag: 'tag' }
      });

      const entry2 = await vaultStore.createEntry(testUserId, {
        name: 'App Password',
        category: 'apps',
        encryptedData: { ciphertext: 'encrypted2', iv: 'iv2', authTag: 'tag2' }
      });

      // Verify entries
      const entries = await vaultStore.getEntries(testUserId);
      expect(entries.entries).toHaveLength(2);

      // Search entries
      const searchResults = await vaultStore.searchEntries(testUserId, { query: 'website' });
      expect(searchResults).toHaveLength(1);

      // Update entry
      const updatedEntry = await vaultStore.updateEntry(entry1.id, testUserId, {
        name: 'Updated Website Login'
      });
      expect(updatedEntry.name).toBe('Updated Website Login');

      // Clear session
      await vaultStore.clearSession(testUserId);
      expect(await vaultStore.isVaultUnlocked(testUserId)).toBe(false);

      // Delete entry
      const deleted = await vaultStore.deleteEntry(entry2.id, testUserId);
      expect(deleted).toBe(true);

      const finalEntries = await vaultStore.getEntries(testUserId);
      expect(finalEntries.entries).toHaveLength(1);
    });
  });
});