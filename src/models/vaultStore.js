const crypto = require('crypto');

/**
 * In-memory vault store for managing vault entries and sessions
 * This will be replaced with a proper database in production
 */
class VaultStore {
  constructor() {
    this.entries = new Map(); // Store vault entries
    this.sessions = new Map(); // Store vault sessions (userId -> session)
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Create a new vault entry
   * @param {string} userId - User ID
   * @param {object} entryData - Entry data
   * @returns {object} - Created entry
   */
  async createEntry(userId, entryData) {
    const entryId = crypto.randomUUID();
    const entry = {
      id: entryId,
      userId,
      name: entryData.name,
      username: entryData.username,
      url: entryData.url,
      category: entryData.category,
      encryptedData: entryData.encryptedData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.entries.set(entryId, entry);
    return entry;
  }

  /**
   * Get all entries for a user with pagination
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {object} - Entries and pagination info
   */
  async getEntries(userId, options = {}) {
    const { page = 1, limit = 50, category } = options;
    
    // Filter entries by user and category
    let userEntries = Array.from(this.entries.values())
      .filter(entry => entry.userId === userId);

    if (category) {
      userEntries = userEntries.filter(entry => 
        entry.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Sort by creation date (newest first)
    userEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEntries = userEntries.slice(startIndex, endIndex);

    return {
      entries: paginatedEntries,
      pagination: {
        page,
        limit,
        total: userEntries.length,
        totalPages: Math.ceil(userEntries.length / limit),
        pages: Math.ceil(userEntries.length / limit)
      }
    };
  }

  /**
   * Get a specific entry
   * @param {string} entryId - Entry ID
   * @param {string} userId - User ID
   * @returns {object|null} - Entry or null if not found
   */
  async getEntry(entryId, userId) {
    const entry = this.entries.get(entryId);
    if (!entry || entry.userId !== userId) {
      return null;
    }
    return entry;
  }

  /**
   * Update an entry
   * @param {string} entryId - Entry ID
   * @param {string} userId - User ID
   * @param {object} updateData - Update data
   * @returns {object|null} - Updated entry or null if not found
   */
  async updateEntry(entryId, userId, updateData) {
    const entry = await this.getEntry(entryId, userId);
    if (!entry) {
      return null;
    }

    // Update entry
    const updatedEntry = {
      ...entry,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.entries.set(entryId, updatedEntry);
    return updatedEntry;
  }

  /**
   * Delete an entry
   * @param {string} entryId - Entry ID
   * @param {string} userId - User ID
   * @returns {boolean} - True if deleted, false if not found
   */
  async deleteEntry(entryId, userId) {
    const entry = await this.getEntry(entryId, userId);
    if (!entry) {
      return false;
    }

    this.entries.delete(entryId);
    return true;
  }

  /**
   * Search entries by query and category
   * @param {string} userId - User ID
   * @param {object} searchOptions - Search options
   * @returns {array} - Matching entries
   */
  async searchEntries(userId, searchOptions = {}) {
    const { query, category } = searchOptions;
    
    // Get all user entries
    let userEntries = Array.from(this.entries.values())
      .filter(entry => entry.userId === userId);

    // Filter by category if provided
    if (category) {
      userEntries = userEntries.filter(entry => 
        entry.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter by query if provided
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase();
      
      userEntries = userEntries.filter(entry => {
        // Search in name (case-insensitive)
        const nameMatch = entry.name && entry.name.toLowerCase().includes(searchTerm);
        
        if (nameMatch) {
          return true;
        }

        // Search in username (case-insensitive)
        const usernameMatch = entry.username && entry.username.toLowerCase().includes(searchTerm);
        if (usernameMatch) {
          return true;
        }

        // Search in URL domain (case-insensitive)
        if (entry.url) {
          try {
            const url = new URL(entry.url);
            const domain = url.hostname.toLowerCase();
            const domainMatch = domain.includes(searchTerm);
            if (domainMatch) {
              return true;
            }
          } catch (error) {
            // If URL parsing fails, search in the raw URL string
            const urlMatch = entry.url.toLowerCase().includes(searchTerm);
            if (urlMatch) {
              return true;
            }
          }
        }

        return false;
      });
    }

    // Sort by relevance (name matches first, then creation date)
    userEntries.sort((a, b) => {
      if (query && query.trim()) {
        const searchTerm = query.trim().toLowerCase();
        const aNameMatch = a.name && a.name.toLowerCase().includes(searchTerm);
        const bNameMatch = b.name && b.name.toLowerCase().includes(searchTerm);
        
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
      }
      
      // Sort by creation date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return userEntries;
  }

  /**
   * Create a vault session
   * @param {string} userId - User ID
   * @param {Buffer} encryptionKey - Encryption key
   * @returns {object} - Session info
   */
  async createSession(userId, encryptionKey) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionTimeout);
    
    const session = {
      sessionId,
      userId,
      encryptionKey,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    this.sessions.set(userId, session);
    return session;
  }

  /**
   * Get vault session
   * @param {string} userId - User ID
   * @returns {object|null} - Session or null if not found
   */
  async getSession(userId) {
    return this.sessions.get(userId) || null;
  }

  /**
   * Check if vault is unlocked for user
   * @param {string} userId - User ID
   * @returns {boolean} - True if unlocked
   */
  async isVaultUnlocked(userId) {
    const session = this.sessions.get(userId);
    if (!session) {
      return false;
    }

    // Check if session has expired
    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(userId);
      return false;
    }

    return true;
  }

  /**
   * Get encryption key from session
   * @param {string} userId - User ID
   * @returns {Buffer|null} - Encryption key or null
   */
  async getEncryptionKey(userId) {
    const session = this.sessions.get(userId);
    if (!session || new Date() > new Date(session.expiresAt)) {
      return null;
    }
    return session.encryptionKey;
  }

  /**
   * Clear vault session
   * @param {string} userId - User ID
   */
  async clearSession(userId) {
    this.sessions.delete(userId);
  }

  /**
   * Clear all sessions for a user (test helper)
   * @param {string} userId - User ID
   */
  clearSessions(userId) {
    this.sessions.delete(userId);
  }

  /**
   * Get all entries for re-encryption
   * @param {string} userId - User ID
   * @returns {array} - All user entries
   */
  async getAllEntriesForReencryption(userId) {
    return Array.from(this.entries.values())
      .filter(entry => entry.userId === userId);
  }

  /**
   * Batch update entries
   * @param {array} entries - Entries to update
   */
  async batchUpdateEntries(entries) {
    for (const entry of entries) {
      entry.updatedAt = new Date().toISOString();
      this.entries.set(entry.id, entry);
    }
  }

  /**
   * Test helper: Create corrupted entry for error handling tests
   * @param {string} userId - User ID
   */
  async createCorruptedEntry(userId) {
    const entryId = crypto.randomUUID();
    const corruptedEntry = {
      id: entryId,
      userId,
      name: 'Corrupted Entry',
      encryptedData: {
        ciphertext: 'invalid-ciphertext',
        iv: 'invalid-iv',
        authTag: 'invalid-auth-tag'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.entries.set(entryId, corruptedEntry);
    return corruptedEntry;
  }

  /**
   * Test helper: Create invalid session for error handling tests
   * @param {string} userId - User ID
   */
  createInvalidSession(userId) {
    const invalidSession = {
      sessionId: 'invalid-session',
      userId,
      encryptionKey: null, // Invalid key
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString()
    };

    this.sessions.set(userId, invalidSession);
  }

  /**
   * Test helper: Expire session for testing
   * @param {string} userId - User ID
   */
  expireSession(userId) {
    const session = this.sessions.get(userId);
    if (session) {
      session.expiresAt = new Date(Date.now() - 1000).toISOString(); // Expired 1 second ago
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear() {
    this.entries.clear();
    this.sessions.clear();
  }

  /**
   * Get entry count
   * @returns {number} - Total number of entries
   */
  count() {
    return this.entries.size;
  }

  /**
   * Get session count
   * @returns {number} - Total number of sessions
   */
  sessionCount() {
    return this.sessions.size;
  }
}

// Export singleton instance
module.exports = new VaultStore(); 