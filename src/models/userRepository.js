const database = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * PostgreSQL-backed user repository
 * Replaces the in-memory user store with persistent database storage
 */
class UserRepository {
  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {object} - Created user
   */
  async create(userData) {
    try {
      const result = await database.query(
        `INSERT INTO users (email, password_hash, role, name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, email, password_hash, role, name, created_at, updated_at`,
        [
          userData.email.toLowerCase(),
          userData.passwordHash,
          userData.role || 'user',
          userData.name || null
        ]
      );

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        passwordHash: result.rows[0].password_hash,
        role: result.rows[0].role,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      logger.info('User created successfully', { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      });

      return user;
    } catch (error) {
      logger.error('Failed to create user', { 
        email: userData.email,
        error: error.message,
        code: error.code
      });
      
      // Handle unique constraint violation
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        const customError = new Error('Email already exists');
        customError.code = 'EMAIL_EXISTS';
        throw customError;
      }
      
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {object|null} - User object or null
   */
  async findByEmail(email) {
    try {
      const result = await database.query(
        'SELECT id, email, password_hash, role, name, created_at, updated_at FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        passwordHash: result.rows[0].password_hash,
        role: result.rows[0].role,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user by email', { 
        email,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {object|null} - User object or null
   */
  async findById(id) {
    try {
      const result = await database.query(
        'SELECT id, email, password_hash, role, name, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        passwordHash: result.rows[0].password_hash,
        role: result.rows[0].role,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user by ID', { 
        userId: id,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} updateData - Data to update
   * @returns {object|null} - Updated user or null
   */
  async update(id, updateData) {
    try {
      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 1;

      // Add user ID to values first
      values.push(id);
      
      // Build SET clause dynamically
      if (updateData.email !== undefined) {
        updates.push(`email = $${++paramCount}`);
        values.push(updateData.email.toLowerCase());
      }
      
      if (updateData.passwordHash !== undefined) {
        updates.push(`password_hash = $${++paramCount}`);
        values.push(updateData.passwordHash);
      }
      
      if (updateData.role !== undefined) {
        updates.push(`role = $${++paramCount}`);
        values.push(updateData.role);
      }

      if (updateData.name !== undefined) {
        updates.push(`name = $${++paramCount}`);
        values.push(updateData.name);
      }

      if (updates.length === 0) {
        // No updates to perform, return current user
        return await this.findById(id);
      }

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 
        RETURNING id, email, password_hash, role, name, created_at, updated_at
      `;

      const result = await database.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        passwordHash: result.rows[0].password_hash,
        role: result.rows[0].role,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      logger.info('User updated successfully', { 
        userId: user.id,
        updatedFields: Object.keys(updateData)
      });

      return user;
    } catch (error) {
      logger.error('Failed to update user', { 
        userId: id,
        updateData: Object.keys(updateData),
        error: error.message,
        code: error.code
      });
      
      // Handle unique constraint violation
      if (error.code === '23505' && error.constraint === 'users_email_key') {
        const customError = new Error('Email already exists');
        customError.code = 'EMAIL_EXISTS';
        throw customError;
      }
      
      throw error;
    }
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {boolean} - True if deleted, false if not found
   */
  async delete(id) {
    try {
      const result = await database.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );

      const deleted = result.rowCount > 0;
      
      if (deleted) {
        logger.info('User deleted successfully', { userId: id });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete user', { 
        userId: id,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {boolean} - True if exists
   */
  async emailExists(email) {
    try {
      const result = await database.query(
        'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
        [email.toLowerCase()]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check email existence', { 
        email,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get user count
   * @returns {number} - Number of users
   */
  async count() {
    try {
      const result = await database.query('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get user count', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear all users (for testing only)
   * This method should only be used in test environments
   */
  async clear() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Clear operation not allowed in production');
    }

    try {
      await database.query('TRUNCATE TABLE users CASCADE');
      logger.warn('All users cleared from database', { 
        environment: process.env.NODE_ENV 
      });
    } catch (error) {
      logger.error('Failed to clear users', { error: error.message });
      throw error;
    }
  }

  /**
   * Get database health status
   * @returns {object} - Health status
   */
  async healthCheck() {
    try {
      const result = await database.query('SELECT COUNT(*) as user_count FROM users');
      return {
        status: 'healthy',
        userCount: parseInt(result.rows[0].user_count, 10),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get user with 2FA information
   * @param {string} id - User ID
   * @returns {object|null} - User object with 2FA data or null
   */
  async findByIdWith2FA(id) {
    try {
      const result = await database.query(
        `SELECT id, email, password_hash, role, created_at, updated_at,
                two_factor_enabled, two_factor_secret, two_factor_backup_codes, two_factor_enabled_at
         FROM users WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const user = {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        twoFactorEnabled: row.two_factor_enabled,
        twoFactorSecret: row.two_factor_secret,
        twoFactorBackupCodes: row.two_factor_backup_codes || [],
        twoFactorEnabledAt: row.two_factor_enabled_at ? row.two_factor_enabled_at.toISOString() : null
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user with 2FA data', { 
        userId: id,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Enable 2FA for a user
   * @param {string} id - User ID
   * @param {string} secret - Base32 encoded TOTP secret
   * @param {string[]} backupCodes - Hashed backup codes
   * @returns {object|null} - Updated user or null
   */
  async enable2FA(id, secret, backupCodes) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET two_factor_enabled = TRUE,
             two_factor_secret = $2,
             two_factor_backup_codes = $3,
             two_factor_enabled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING id, email, two_factor_enabled, two_factor_enabled_at`,
        [id, secret, backupCodes]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        twoFactorEnabled: result.rows[0].two_factor_enabled,
        twoFactorEnabledAt: result.rows[0].two_factor_enabled_at.toISOString()
      };

      logger.info('2FA enabled for user', { 
        userId: user.id,
        backupCodeCount: backupCodes.length
      });

      return user;
    } catch (error) {
      logger.error('Failed to enable 2FA', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Disable 2FA for a user
   * @param {string} id - User ID
   * @returns {object|null} - Updated user or null
   */
  async disable2FA(id) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET two_factor_enabled = FALSE,
             two_factor_secret = NULL,
             two_factor_backup_codes = NULL,
             two_factor_enabled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING id, email, two_factor_enabled`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        twoFactorEnabled: result.rows[0].two_factor_enabled
      };

      logger.info('2FA disabled for user', { userId: user.id });

      return user;
    } catch (error) {
      logger.error('Failed to disable 2FA', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update backup codes after one is used
   * @param {string} id - User ID
   * @param {string[]} updatedBackupCodes - Updated backup codes array
   * @returns {boolean} - Success status
   */
  async updateBackupCodes(id, updatedBackupCodes) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET two_factor_backup_codes = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, updatedBackupCodes]
      );

      const success = result.rowCount > 0;
      
      if (success) {
        logger.info('Backup codes updated', { 
          userId: id,
          remainingCodes: updatedBackupCodes.length
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to update backup codes', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find user by email with 2FA data
   * @param {string} email - User email
   * @returns {object|null} - User object with 2FA data or null
   */
  async findByEmailWith2FA(email) {
    try {
      const result = await database.query(
        `SELECT id, email, password_hash, role, created_at, updated_at,
                two_factor_enabled, two_factor_secret, two_factor_backup_codes, two_factor_enabled_at
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        passwordHash: result.rows[0].password_hash,
        role: result.rows[0].role,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString(),
        twoFactorEnabled: result.rows[0].two_factor_enabled,
        twoFactorSecret: result.rows[0].two_factor_secret,
        twoFactorBackupCodes: result.rows[0].two_factor_backup_codes,
        twoFactorEnabledAt: result.rows[0].two_factor_enabled_at?.toISOString() || null
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user by email with 2FA', { 
        email,
        error: error.message 
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new UserRepository(); 