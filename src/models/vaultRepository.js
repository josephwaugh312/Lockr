const database = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * PostgreSQL-backed vault repository with in-memory session management
 * Handles vault entries in database and sessions in memory for security
 */
class VaultRepository {
  constructor() {
    // Keep sessions in memory for security (temporary encryption keys)
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Create a new vault entry
   * @param {string} userId - User ID
   * @param {object} entryData - Entry data
   * @returns {object} - Created entry
   */
  async createEntry(userId, entryData) {
    try {
      const result = await database.query(
        `INSERT INTO vault_entries (user_id, name, username, url, category, encrypted_data, favorite) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, user_id, name, username, url, category, encrypted_data, favorite, created_at, updated_at`,
        [
          userId,
          entryData.name,
          entryData.username || null,
          entryData.url || null,
          entryData.category || 'general',
          entryData.encryptedData,
          entryData.favorite || false
        ]
      );

      const entry = this.formatEntry(result.rows[0]);

      logger.info('Vault entry created', { 
        entryId: entry.id,
        userId: entry.userId,
        name: entry.name,
        category: entry.category,
        favorite: entry.favorite
      });

      return entry;
    } catch (error) {
      logger.error('Failed to create vault entry', { 
        userId,
        name: entryData.name,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Get all entries for a user with pagination
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {object} - Entries and pagination info
   */
  async getEntries(userId, options = {}) {
    try {
      const { page = 1, limit = 50, category } = options;
      const offset = (page - 1) * limit;

      // Build query with optional category filter
      let whereClause = 'WHERE user_id = $1';
      let queryParams = [userId];
      let paramCount = 1;

      if (category) {
        whereClause += ` AND LOWER(category) = LOWER($${++paramCount})`;
        queryParams.push(category);
      }

      // Get total count
      const countResult = await database.query(
        `SELECT COUNT(*) as total FROM vault_entries ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated entries
      const entriesResult = await database.query(
        `SELECT id, user_id, name, username, url, category, encrypted_data, favorite, created_at, updated_at 
         FROM vault_entries 
         ${whereClause}
         ORDER BY created_at DESC 
         LIMIT $${++paramCount} OFFSET $${++paramCount}`,
        [...queryParams, limit, offset]
      );

      const entries = entriesResult.rows.map(row => this.formatEntry(row));

      return {
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get vault entries', { 
        userId,
        options,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get all entries for a user (without pagination) - for password expiry analysis
   * @param {string} userId - User ID
   * @returns {Array} - All entries for the user
   */
  async getAllByUserId(userId) {
    try {
      const result = await database.query(
        `SELECT id, user_id, name, username, url, category, encrypted_data, favorite, created_at, updated_at 
         FROM vault_entries 
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => this.formatEntry(row));
    } catch (error) {
      logger.error('Failed to get all vault entries for user', { 
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get a specific entry
   * @param {string} entryId - Entry ID
   * @param {string} userId - User ID
   * @returns {object|null} - Entry or null if not found
   */
  async getEntry(entryId, userId) {
    try {
      const result = await database.query(
        `SELECT id, user_id, name, username, url, category, encrypted_data, favorite, created_at, updated_at 
         FROM vault_entries 
         WHERE id = $1 AND user_id = $2`,
        [entryId, userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatEntry(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get vault entry', { 
        entryId,
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update an entry
   * @param {string} entryId - Entry ID
   * @param {string} userId - User ID
   * @param {object} updateData - Update data
   * @returns {object|null} - Updated entry or null if not found
   */
  async updateEntry(entryId, userId, updateData) {
    try {
      // Build dynamic update query
      const updates = [];
      const values = [entryId, userId];
      let paramCount = 2;

      // Build SET clause dynamically
      if (updateData.name !== undefined) {
        updates.push(`name = $${++paramCount}`);
        values.push(updateData.name);
      }

      if (updateData.username !== undefined) {
        updates.push(`username = $${++paramCount}`);
        values.push(updateData.username);
      }

      if (updateData.url !== undefined) {
        updates.push(`url = $${++paramCount}`);
        values.push(updateData.url);
      }

      if (updateData.category !== undefined) {
        updates.push(`category = $${++paramCount}`);
        values.push(updateData.category);
      }

      if (updateData.encryptedData !== undefined) {
        updates.push(`encrypted_data = $${++paramCount}`);
        values.push(updateData.encryptedData);
      }

      if (updateData.favorite !== undefined) {
        updates.push(`favorite = $${++paramCount}`);
        values.push(updateData.favorite);
      }

      if (updates.length === 0) {
        // No updates to perform, return current entry
        return await this.getEntry(entryId, userId);
      }

      const query = `
        UPDATE vault_entries 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, name, username, url, category, encrypted_data, favorite, created_at, updated_at
      `;

      const result = await database.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const entry = this.formatEntry(result.rows[0]);

      logger.info('Vault entry updated', { 
        entryId: entry.id,
        userId: entry.userId,
        updatedFields: Object.keys(updateData)
      });

      return entry;
    } catch (error) {
      logger.error('Failed to update vault entry', { 
        entryId,
        userId,
        updateData: Object.keys(updateData),
        updateDataValues: Object.fromEntries(
          Object.entries(updateData).map(([key, value]) => [
            key, 
            typeof value === 'string' ? `${value.substring(0, 50)}${value.length > 50 ? '...' : ''}` : typeof value
          ])
        ),
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Delete an entry
   * @param {string} entryId - Entry ID
   * @param {string} userId - User ID
   * @returns {boolean} - True if deleted, false if not found
   */
  async deleteEntry(entryId, userId) {
    try {
      const result = await database.query(
        'DELETE FROM vault_entries WHERE id = $1 AND user_id = $2',
        [entryId, userId]
      );

      const deleted = result.rowCount > 0;
      
      if (deleted) {
        logger.info('Vault entry deleted', { entryId, userId });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete vault entry', { 
        entryId,
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Search entries by query and category
   * @param {string} userId - User ID
   * @param {object} searchOptions - Search options
   * @returns {array} - Matching entries
   */
  async searchEntries(userId, searchOptions = {}) {
    try {
      const { query, category } = searchOptions;
      
      let whereClause = 'WHERE user_id = $1';
      let queryParams = [userId];
      let paramCount = 1;

      // Add category filter
      if (category) {
        whereClause += ` AND LOWER(category) = LOWER($${++paramCount})`;
        queryParams.push(category);
      }

      // Add text search filter
      if (query && query.trim()) {
        const searchTerm = `%${query.trim().toLowerCase()}%`;
        whereClause += ` AND (
          LOWER(name) LIKE $${++paramCount} OR 
          LOWER(username) LIKE $${++paramCount} OR 
          LOWER(url) LIKE $${++paramCount}
        )`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      // Build order by clause - only include search relevance if there's a query
      let orderByClause = 'ORDER BY created_at DESC';
      if (query && query.trim()) {
        const searchTermIndex = queryParams.length - 2; // The first search term index
        orderByClause = `ORDER BY 
          CASE WHEN LOWER(name) LIKE $${searchTermIndex} THEN 1 ELSE 2 END,
          created_at DESC`;
      }

      const result = await database.query(
        `SELECT id, user_id, name, username, url, category, encrypted_data, favorite, created_at, updated_at 
         FROM vault_entries 
         ${whereClause}
         ${orderByClause}`,
        queryParams
      );

      return result.rows.map(row => this.formatEntry(row));
    } catch (error) {
      logger.error('Failed to search vault entries', { 
        userId,
        searchOptions,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create a vault session
   * @param {string} userId - User ID
   * @param {Buffer} encryptionKey - Encryption key
   * @returns {object} - Session info
   */
  async createSession(userId, encryptionKey) {
    const sessionData = {
      userId,
      encryptionKey,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout)
    };

    this.sessions.set(userId, sessionData);

    logger.info('Vault session created', { 
      userId, 
      expiresAt: sessionData.expiresAt.toISOString() 
    });

    return {
      userId,
      createdAt: sessionData.createdAt.toISOString(),
      expiresAt: sessionData.expiresAt.toISOString()
    };
  }

  /**
   * Get vault session
   * @param {string} userId - User ID
   * @returns {object|null} - Session or null if not found/expired
   */
  async getSession(userId) {
    const session = this.sessions.get(userId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt.getTime()) {
      this.sessions.delete(userId);
      logger.info('Vault session expired and removed', { userId });
      return null;
    }

    return {
      userId: session.userId,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString()
    };
  }

  /**
   * Check if vault is unlocked for user
   * @param {string} userId - User ID
   * @returns {boolean} - True if unlocked
   */
  async isVaultUnlocked(userId) {
    const session = await this.getSession(userId);
    return session !== null;
  }

  /**
   * Get encryption key from session
   * @param {string} userId - User ID
   * @returns {Buffer|null} - Encryption key or null
   */
  async getEncryptionKey(userId) {
    const session = this.sessions.get(userId);
    
    if (!session || Date.now() > session.expiresAt.getTime()) {
      if (session) {
        this.sessions.delete(userId);
      }
      return null;
    }

    return session.encryptionKey;
  }

  /**
   * Clear vault session
   * @param {string} userId - User ID
   * @returns {boolean} - True if session was cleared
   */
  async clearSession(userId) {
    const existed = this.sessions.has(userId);
    this.sessions.delete(userId);
    
    if (existed) {
      logger.info('Vault session cleared', { userId });
    }
    
    return existed;
  }

  /**
   * Get all entries for re-encryption (master password change)
   * @param {string} userId - User ID
   * @returns {array} - All user entries
   */
  async getAllEntriesForReencryption(userId) {
    try {
      const result = await database.query(
        `SELECT id, user_id, name, username, url, category, encrypted_data, favorite, created_at, updated_at 
         FROM vault_entries 
         WHERE user_id = $1 
         ORDER BY created_at ASC`,
        [userId]
      );

      return result.rows.map(row => this.formatEntry(row));
    } catch (error) {
      logger.error('Failed to get entries for re-encryption', { 
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Batch update entries (for re-encryption)
   * @param {array} entries - Entries to update
   * @returns {number} - Number of updated entries
   */
  async batchUpdateEntries(entries) {
    if (entries.length === 0) {
      return 0;
    }

    try {
      return await database.transaction(async (client) => {
        let updatedCount = 0;

        for (const entry of entries) {
          const result = await client.query(
            `UPDATE vault_entries 
             SET encrypted_data = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2 AND user_id = $3`,
            [entry.encryptedData, entry.id, entry.userId]
          );
          
          updatedCount += result.rowCount;
        }

        logger.info('Batch update completed', { 
          entriesProcessed: entries.length,
          entriesUpdated: updatedCount
        });

        return updatedCount;
      });
    } catch (error) {
      logger.error('Failed to batch update entries', { 
        entryCount: entries.length,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Format database row to entry object
   * @param {object} row - Database row
   * @returns {object} - Formatted entry
   */
  formatEntry(row) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      username: row.username,
      url: row.url,
      website: row.url, // Alias for password expiry service compatibility
      category: row.category,
      encryptedData: row.encrypted_data,
      favorite: row.favorite,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  /**
   * Clear all data (for testing only)
   */
  async clear() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Clear operation not allowed in production');
    }

    try {
      await database.query('TRUNCATE TABLE vault_entries CASCADE');
      this.sessions.clear();
      
      logger.warn('All vault data cleared', { 
        environment: process.env.NODE_ENV 
      });
    } catch (error) {
      logger.error('Failed to clear vault data', { error: error.message });
      throw error;
    }
  }

  /**
   * Get entry count for user
   * @param {string} userId - User ID
   * @returns {number} - Number of entries
   */
  async count(userId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM vault_entries';
      let params = [];

      if (userId) {
        query += ' WHERE user_id = $1';
        params.push(userId);
      }

      const result = await database.query(query, params);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get entry count', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get session count
   * @returns {number} - Number of active sessions
   */
  sessionCount() {
    return this.sessions.size;
  }

  /**
   * Test methods for development/testing
   */
  
  /**
   * Create a corrupted entry for testing
   */
  async createCorruptedEntry(userId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test methods not allowed in production');
    }

    const corruptedData = 'corrupted-data-' + Math.random().toString(36).substring(7);
    
    try {
      const result = await database.query(
        `INSERT INTO vault_entries (user_id, name, category, encrypted_data) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, user_id, name, username, url, category, encrypted_data, created_at, updated_at`,
        [userId, 'Corrupted Entry', 'test', corruptedData]
      );

      return this.formatEntry(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create corrupted entry', { error: error.message });
      throw error;
    }
  }

  /**
   * Create invalid session for testing
   */
  createInvalidSession(userId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test methods not allowed in production');
    }

    const invalidSession = {
      userId,
      encryptionKey: Buffer.from('invalid-key', 'utf8'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout)
    };

    this.sessions.set(userId, invalidSession);
    return invalidSession;
  }

  /**
   * Expire session for testing
   */
  expireSession(userId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test methods not allowed in production');
    }

    const session = this.sessions.get(userId);
    if (session) {
      session.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
    }
  }
}

// Export singleton instance
module.exports = new VaultRepository(); 