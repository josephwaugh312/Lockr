const database = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * PostgreSQL-backed user repository
 * Replaces the in-memory user store with persistent database storage
 */
class UserRepository {
  /**
   * Check if specific columns exist in the users table
   * @param {array} columnNames - Array of column names to check
   * @returns {boolean} - True if all columns exist
   */
  async checkIfColumnsExist(columnNames) {
    try {
      const query = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = ANY($1)
      `;
      const result = await database.query(query, [columnNames]);
      const foundColumns = result.rows.map(row => row.column_name);
      const exists = result.rows.length === columnNames.length;
      
      logger.info('Column existence check', {
        requested: columnNames,
        found: foundColumns,
        exists: exists
      });
      
      return exists;
    } catch (error) {
      logger.warn('Failed to check column existence, assuming they don\'t exist', { error: error.message });
      return false;
    }
  }

  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {object} - Created user
   */
  async create(userData) {
    try {
      // Check if we have encrypted phone number fields available
      const hasEncryptedPhoneFields = await this.checkIfColumnsExist(['encrypted_phone_number', 'phone_number_salt']);
      
      let query, values;
      
      if (hasEncryptedPhoneFields) {
        // Full query with encrypted phone number fields
        query = `INSERT INTO users (email, password_hash, role, name, encrypted_phone_number, phone_number_iv, phone_number_salt, phone_verified, sms_opt_out) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id, email, password_hash, role, name, encrypted_phone_number, phone_number_iv, phone_number_salt, phone_verified, sms_opt_out, created_at, updated_at`;
        values = [
          userData.email.toLowerCase(),
          userData.passwordHash,
          userData.role || 'user',
          userData.name || null,
          userData.encryptedPhoneNumber || null,
          userData.phoneNumberIv || null,
          userData.phoneNumberSalt || null,
          userData.phoneVerified === true,
          userData.smsOptOut === true
        ];
      } else {
        // Basic query without encrypted phone number fields
        query = `INSERT INTO users (email, password_hash, role, name) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, email, password_hash, role, name, created_at, updated_at`;
        values = [
          userData.email.toLowerCase(),
          userData.passwordHash,
          userData.role || 'user',
          userData.name || null
        ];
      }

      const result = await database.query(query, values);

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        role: result.rows[0].role,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      // Add encrypted phone fields if they exist and are returned
      if (hasEncryptedPhoneFields && result.rows[0].encrypted_phone_number !== undefined) {
        user.encryptedPhoneNumber = result.rows[0].encrypted_phone_number;
        user.phoneNumberIv = result.rows[0].phone_number_iv;
        user.phoneNumberSalt = result.rows[0].phone_number_salt;
        user.phone_verified = result.rows[0].phone_verified;
        user.sms_opt_out = result.rows[0].sms_opt_out;
      }

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
        'SELECT id, email, password_hash, role, name, email_verified, created_at, updated_at FROM users WHERE email = $1',
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
        email_verified: result.rows[0].email_verified,
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
      // Check if we have encrypted fields available
      const hasEncryptedFields = await this.checkIfColumnsExist([
        'encrypted_phone_number', 'phone_number_salt',
        'encrypted_two_factor_secret', 'two_factor_secret_salt'
      ]);
      
      let query;
      if (hasEncryptedFields) {
        query = `SELECT id, email, password_hash, role, name, email_verified, 
                encrypted_phone_number, phone_number_iv, phone_number_salt, phone_verified, sms_opt_out,
                two_factor_enabled, encrypted_two_factor_secret, two_factor_secret_salt,
                created_at, updated_at 
         FROM users WHERE id = $1`;
      } else {
        query = `SELECT id, email, password_hash, role, name, email_verified, created_at, updated_at 
         FROM users WHERE id = $1`;
      }

      const result = await database.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        passwordHash: result.rows[0].password_hash,
        role: result.rows[0].role,
        name: result.rows[0].name,
        email_verified: result.rows[0].email_verified,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      // Add encrypted fields if they exist
      if (hasEncryptedFields) {
        user.encryptedPhoneNumber = result.rows[0].encrypted_phone_number;
        user.phoneNumberIv = result.rows[0].phone_number_iv;
        user.phoneNumberSalt = result.rows[0].phone_number_salt;
        user.phone_verified = result.rows[0].phone_verified;
        user.sms_opt_out = result.rows[0].sms_opt_out;
        
        // Add 2FA fields if they exist
        user.twoFactorEnabled = result.rows[0].two_factor_enabled;
        user.encryptedTwoFactorSecret = result.rows[0].encrypted_two_factor_secret;
        user.twoFactorSecretSalt = result.rows[0].two_factor_secret_salt;
      }

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

      if (updateData.encryptedPhoneNumber !== undefined) {
        updates.push(`encrypted_phone_number = $${++paramCount}`);
        values.push(updateData.encryptedPhoneNumber);
      }

      if (updateData.phoneNumberIv !== undefined) {
        updates.push(`phone_number_iv = $${++paramCount}`);
        values.push(updateData.phoneNumberIv);
      }

      if (updateData.phoneNumberSalt !== undefined) {
        updates.push(`phone_number_salt = $${++paramCount}`);
        values.push(updateData.phoneNumberSalt);
      }

      if (updateData.phone_verified !== undefined) {
        updates.push(`phone_verified = $${++paramCount}`);
        values.push(updateData.phone_verified);
      }

      if (updateData.sms_opt_out !== undefined) {
        updates.push(`sms_opt_out = $${++paramCount}`);
        values.push(updateData.sms_opt_out);
      }

      if (updateData.phone_verification_code !== undefined) {
        updates.push(`phone_verification_code = $${++paramCount}`);
        values.push(updateData.phone_verification_code);
      }

      if (updateData.phone_verification_expires_at !== undefined) {
        updates.push(`phone_verification_expires_at = $${++paramCount}`);
        values.push(updateData.phone_verification_expires_at);
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
                two_factor_enabled, encrypted_two_factor_secret, two_factor_secret_salt,
                two_factor_backup_codes, two_factor_enabled_at
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
        encryptedTwoFactorSecret: row.encrypted_two_factor_secret,
        twoFactorSecretSalt: row.two_factor_secret_salt,
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
   * Enable 2FA for a user with encrypted secret
   * @param {string} id - User ID
   * @param {string} encryptedSecret - Encrypted TOTP secret
   * @param {string} salt - Salt for encryption key derivation
   * @param {string[]} backupCodes - Hashed backup codes
   * @returns {object|null} - Updated user or null
   */
  async enable2FAEncrypted(id, encryptedSecret, salt, backupCodes) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET two_factor_enabled = TRUE,
             encrypted_two_factor_secret = $2,
             two_factor_secret_iv = NULL,
             two_factor_secret_salt = $3,
             two_factor_backup_codes = $4,
             two_factor_enabled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING id, email, two_factor_enabled, two_factor_enabled_at`,
        [id, encryptedSecret, salt, backupCodes]
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

      logger.info('2FA enabled for user with encrypted secret', { 
        userId: user.id,
        backupCodeCount: backupCodes.length
      });

      return user;
    } catch (error) {
      logger.error('Failed to enable 2FA with encrypted secret', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Disable 2FA for a user (updated for encrypted secrets)
   * @param {string} id - User ID
   * @returns {object|null} - Updated user or null
   */
  async disable2FA(id) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET two_factor_enabled = FALSE,
             two_factor_secret = NULL,
             encrypted_two_factor_secret = NULL,
             two_factor_secret_salt = NULL,
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
                two_factor_enabled, encrypted_two_factor_secret, two_factor_secret_salt,
                two_factor_backup_codes, two_factor_enabled_at
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
        encryptedTwoFactorSecret: result.rows[0].encrypted_two_factor_secret,
        twoFactorSecretSalt: result.rows[0].two_factor_secret_salt,
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

  /**
   * Get user with encrypted 2FA data
   * @param {string} id - User ID
   * @returns {object|null} - User with encrypted 2FA data
   */
  async findByIdWithEncrypted2FA(id) {
    try {
      const result = await database.query(
        `SELECT id, email, password_hash, role, created_at, updated_at,
                two_factor_enabled, encrypted_two_factor_secret, two_factor_secret_salt,
                two_factor_backup_codes, two_factor_enabled_at
         FROM users 
         WHERE id = $1`,
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
        encryptedTwoFactorSecret: row.encrypted_two_factor_secret,
        twoFactorSecretSalt: row.two_factor_secret_salt,
        twoFactorBackupCodes: row.two_factor_backup_codes || [],
        twoFactorEnabledAt: row.two_factor_enabled_at?.toISOString()
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user with encrypted 2FA', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Migrate existing plaintext 2FA secret to encrypted format
   * @param {string} id - User ID
   * @param {string} encryptedSecret - Encrypted TOTP secret
   * @param {string} salt - Salt for encryption key derivation
   * @returns {boolean} - Success status
   */
  async migrate2FASecretToEncrypted(id, encryptedSecret, salt) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET encrypted_two_factor_secret = $2,
             two_factor_secret_iv = NULL,
             two_factor_secret_salt = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, encryptedSecret, salt]
      );

      const success = result.rowCount > 0;
      
      if (success) {
        logger.info('2FA secret migrated to encrypted format', { userId: id });
      }

      return success;
    } catch (error) {
      logger.error('Failed to migrate 2FA secret to encrypted', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove old plaintext 2FA secret after migration
   * @param {string} id - User ID
   * @returns {boolean} - Success status
   */
  async removePlaintext2FASecret(id) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET two_factor_secret = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      const success = result.rowCount > 0;
      
      if (success) {
        logger.info('Plaintext 2FA secret removed after migration', { userId: id });
      }

      return success;
    } catch (error) {
      logger.error('Failed to remove plaintext 2FA secret', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add encrypted phone number to user
   * @param {string} id - User ID
   * @param {string} encryptedPhoneNumber - Encrypted phone number (includes IV + authTag + encrypted data)
   * @param {string} phoneNumberSalt - Salt for phone number encryption
   * @returns {object|null} - Updated user or null
   */
  async addEncryptedPhoneNumber(id, encryptedPhoneNumber, phoneNumberSalt) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET encrypted_phone_number = $2,
             phone_number_iv = NULL,
             phone_number_salt = $3,
             phone_verified = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING id, email, encrypted_phone_number, phone_verified`,
        [id, encryptedPhoneNumber, phoneNumberSalt]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        encryptedPhoneNumber: result.rows[0].encrypted_phone_number,
        phone_verified: result.rows[0].phone_verified
      };

      logger.info('Encrypted phone number added to user', { 
        userId: user.id,
        phoneVerified: user.phone_verified
      });

      return user;
    } catch (error) {
      logger.error('Failed to add encrypted phone number', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove encrypted phone number from user
   * @param {string} id - User ID
   * @returns {object|null} - Updated user or null
   */
  async removeEncryptedPhoneNumber(id) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET encrypted_phone_number = NULL,
             phone_number_iv = NULL,
             phone_number_salt = NULL,
             phone_verified = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 
         RETURNING id, email, phone_verified`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        phone_verified: result.rows[0].phone_verified
      };

      logger.info('Encrypted phone number removed from user', { userId: user.id });

      return user;
    } catch (error) {
      logger.error('Failed to remove encrypted phone number', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Migrate existing plaintext phone number to encrypted format
   * @param {string} id - User ID
   * @param {string} encryptedPhoneNumber - Encrypted phone number (includes IV + authTag + encrypted data)
   * @param {string} phoneNumberSalt - Salt for phone number encryption
   * @returns {boolean} - Success status
   */
  async migratePhoneNumberToEncrypted(id, encryptedPhoneNumber, phoneNumberSalt) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET encrypted_phone_number = $2,
             phone_number_iv = NULL,
             phone_number_salt = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, encryptedPhoneNumber, phoneNumberSalt]
      );

      const success = result.rowCount > 0;
      
      if (success) {
        logger.info('Phone number migrated to encrypted format', { userId: id });
      }

      return success;
    } catch (error) {
      logger.error('Failed to migrate phone number to encrypted', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove old plaintext phone number after migration
   * @param {string} id - User ID
   * @returns {boolean} - Success status
   */
  async removePlaintextPhoneNumber(id) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET phone_number = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      const success = result.rowCount > 0;
      
      if (success) {
        logger.info('Plaintext phone number removed after migration', { userId: id });
      }

      return success;
    } catch (error) {
      logger.error('Failed to remove plaintext phone number', { 
        userId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all users for notifications (with basic info only)
   * @returns {Array} - Array of users with id, email, name
   */
  async getAllActiveUsers() {
    try {
      const result = await database.query(
        'SELECT id, email, name FROM users WHERE created_at IS NOT NULL ORDER BY created_at DESC'
      );

      return result.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name
      }));
    } catch (error) {
      logger.error('Failed to get all active users', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update email verification token
   * @param {string} userId - User ID
   * @param {string} token - Verification token
   * @param {Date} expiresAt - Token expiration date
   * @returns {Promise<boolean>} - Success status
   */
  async updateEmailVerificationToken(userId, token, expiresAt) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET email_verification_token = $2, 
             email_verification_expires_at = $3,
             email_verification_sent_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId, token, expiresAt]
      );

      logger.info('Email verification token updated', { 
        userId,
        expiresAt: expiresAt.toISOString()
      });

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to update email verification token', { 
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find user by email verification token
   * @param {string} token - Verification token
   * @returns {object|null} - User object or null
   */
  async findByEmailVerificationToken(token) {
    try {
      const result = await database.query(
        `SELECT id, email, name, email_verified, email_verification_expires_at, created_at, updated_at 
         FROM users 
         WHERE email_verification_token = $1`,
        [token]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        email_verified: result.rows[0].email_verified,
        email_verification_expires_at: result.rows[0].email_verification_expires_at,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user by verification token', { 
        token: token.substring(0, 8) + '***',
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Mark email as verified
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async markEmailAsVerified(userId) {
    try {
      const result = await database.query(
        `UPDATE users 
         SET email_verified = true,
             email_verification_token = NULL,
             email_verification_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );

      logger.info('Email marked as verified', { userId });

      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to mark email as verified', { 
        userId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find user by email with verification status
   * @param {string} email - User email
   * @returns {object|null} - User object with verification status or null
   */
  async findByEmailWithVerification(email) {
    try {
      const result = await database.query(
        `SELECT id, email, password_hash, role, name, email_verified, 
                email_verification_sent_at, created_at, updated_at 
         FROM users 
         WHERE email = $1`,
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
        email_verified: result.rows[0].email_verified,
        email_verification_sent_at: result.rows[0].email_verification_sent_at,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user by email with verification', { 
        email,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find user by email with password hash (for testing/authentication)
   * @param {string} email - User email
   * @returns {object|null} - User object with password hash or null
   */
  async findByEmailWithPassword(email) {
    try {
      const result = await database.query(
        'SELECT id, email, password_hash, role, name, email_verified, created_at, updated_at FROM users WHERE email = $1',
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
        email_verified: result.rows[0].email_verified,
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString()
      };

      return user;
    } catch (error) {
      logger.error('Failed to find user by email with password', { 
        email: email,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} newPassword - New password (plaintext)
   * @returns {boolean} - Success status
   */
  async changePassword(userId, newPassword) {
    try {
      const { CryptoService } = require('../services/cryptoService');
      const cryptoService = new CryptoService();
      
      const newPasswordHash = await cryptoService.hashPassword(newPassword);
      
      const result = await database.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
        [newPasswordHash, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      logger.info('Password changed successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to change password', { 
        userId,
        error: error.message 
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new UserRepository(); 