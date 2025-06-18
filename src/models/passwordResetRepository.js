const database = require('../config/database');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

class PasswordResetRepository {
  /**
   * Create a password reset token
   * @param {object} tokenData - Token data
   * @returns {object} - Created token data
   */
  async createResetToken(tokenData) {
    try {
      const { userId, tokenHash, expiresAt, ipAddress, userAgent } = tokenData;
      
      const result = await database.query(
        `INSERT INTO password_reset_tokens 
         (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [userId, tokenHash, expiresAt, ipAddress, userAgent]
      );

      logger.info('Password reset token created', {
        userId,
        tokenId: result.rows[0].id,
        expiresAt,
        ipAddress
      });

      return {
        id: result.rows[0].id,
        userId,
        expiresAt,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      logger.error('Failed to create password reset token', {
        userId: tokenData.userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find a valid password reset token
   * @param {string} tokenHash - Hashed token
   * @returns {object|null} - Token data or null
   */
  async findValidResetToken(tokenHash) {
    try {
      const result = await database.query(
        `SELECT id, user_id, token_hash, expires_at, used, created_at
         FROM password_reset_tokens 
         WHERE token_hash = $1 
           AND used = FALSE 
           AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC
         LIMIT 1`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const token = {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        tokenHash: result.rows[0].token_hash,
        expiresAt: result.rows[0].expires_at,
        used: result.rows[0].used,
        createdAt: result.rows[0].created_at
      };

      return token;
    } catch (error) {
      logger.error('Failed to find valid reset token', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark a password reset token as used
   * @param {string} tokenId - Token ID
   * @returns {boolean} - Success status
   */
  async markTokenAsUsed(tokenId) {
    try {
      const result = await database.query(
        `UPDATE password_reset_tokens 
         SET used = TRUE, used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND used = FALSE
         RETURNING id`,
        [tokenId]
      );

      const success = result.rows.length > 0;
      
      if (success) {
        logger.info('Password reset token marked as used', {
          tokenId
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to mark reset token as used', {
        tokenId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up expired tokens
   * @returns {number} - Number of deleted tokens
   */
  async cleanupExpiredTokens() {
    try {
      const result = await database.query(
        `DELETE FROM password_reset_tokens 
         WHERE expires_at < CURRENT_TIMESTAMP
         RETURNING id`
      );

      const deletedCount = result.rows.length;
      
      if (deletedCount > 0) {
        logger.info('Cleaned up expired password reset tokens', {
          deletedCount
        });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent reset attempts for rate limiting
   * @param {string} userId - User ID
   * @param {Date} since - Time threshold
   * @returns {number} - Number of recent attempts
   */
  async getRecentResetAttempts(userId, since) {
    try {
      const result = await database.query(
        `SELECT COUNT(*) as count
         FROM password_reset_tokens 
         WHERE user_id = $1 AND created_at >= $2`,
        [userId, since]
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get recent reset attempts', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent reset attempts by IP for rate limiting
   * @param {string} ipAddress - IP address
   * @param {Date} since - Time threshold
   * @returns {number} - Number of recent attempts
   */
  async getRecentResetAttemptsByIP(ipAddress, since) {
    try {
      const result = await database.query(
        `SELECT COUNT(*) as count
         FROM password_reset_tokens 
         WHERE ip_address = $1 AND created_at >= $2`,
        [ipAddress, since]
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get recent reset attempts by IP', {
        ipAddress,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate a secure reset token
   * @returns {object} - Token and hash
   */
  generateResetToken() {
    // Generate a secure random token (32 bytes = 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Hash the token for storage (using SHA-256)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    return {
      token,
      tokenHash
    };
  }

  /**
   * Hash a token for comparison
   * @param {string} token - Plain token
   * @returns {string} - Hashed token
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Clear all tokens for testing
   * @returns {number} - Number of deleted tokens
   */
  async clear() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Clear operation only allowed in test environment');
    }
    
    try {
      const result = await database.query(
        'DELETE FROM password_reset_tokens RETURNING id'
      );
      return result.rows.length;
    } catch (error) {
      logger.error('Failed to clear password reset tokens', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PasswordResetRepository(); 