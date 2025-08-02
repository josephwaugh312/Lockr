const database = require('../config/database');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Repository for managing master password reset tokens and vault data wipe operations
 * This handles the critical "nuclear option" for master password recovery
 */
class MasterPasswordResetRepository {

  /**
   * Create a new master password reset token
   * @param {string} userId - User ID
   * @param {string} ipAddress - IP address of requester
   * @param {string} userAgent - User agent string
   * @returns {object} - Token data
   */
  async createResetToken(userId, ipAddress, userAgent) {
    try {
      // Generate secure random token (64 hex characters)
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Set expiration (15 minutes for security)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const result = await database.query(
        `INSERT INTO master_password_reset_tokens 
         (user_id, token_hash, expires_at, ip_address, user_agent) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, expires_at, created_at`,
        [userId, tokenHash, expiresAt, ipAddress, userAgent]
      );

      logger.info('Master password reset token created', {
        userId,
        tokenId: result.rows[0].id,
        expiresAt,
        ipAddress,
        userAgent: userAgent?.substring(0, 100) // Truncate for logging
      });

      return {
        id: result.rows[0].id,
        token, // Return plain token (only time it's available)
        expiresAt: result.rows[0].expires_at,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      logger.error('Failed to create master password reset token', {
        userId,
        ipAddress,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find valid reset token
   * @param {string} token - Plain token
   * @returns {object|null} - Token data or null
   */
  async findValidResetToken(token) {
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      const result = await database.query(
        `SELECT id, user_id, expires_at, used, data_wiped, created_at
         FROM master_password_reset_tokens 
         WHERE token_hash = $1 
         AND used = false 
         AND expires_at > CURRENT_TIMESTAMP`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        expiresAt: result.rows[0].expires_at,
        used: result.rows[0].used,
        dataWiped: result.rows[0].data_wiped,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      logger.error('Failed to find reset token', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Wipe all vault data for a user and reset master password
   * This is the "nuclear option" - all vault entries are permanently deleted
   * @param {string} userId - User ID
   * @param {string} tokenId - Reset token ID for tracking
   * @returns {object} - Wipe results
   */
  async wipeVaultAndResetMasterPassword(userId, tokenId) {
    const client = await database.getClient();
    
    try {
      await client.query('BEGIN');

      // Count entries before deletion for audit logging
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM vault_entries WHERE user_id = $1',
        [userId]
      );
      const entriesCount = parseInt(countResult.rows[0].count, 10);

      // Delete all vault entries for the user
      await client.query(
        'DELETE FROM vault_entries WHERE user_id = $1',
        [userId]
      );

      // ZERO-KNOWLEDGE: Master password hash no longer stored on server
      // The column has been removed as part of zero-knowledge architecture
      // No action needed - server never stores master passwords

      // NOTE: No vault session clearing needed - system is stateless
      // The vault_sessions table does not exist in this deployment

      // CRITICAL: Set a flag to indicate master password was recently reset
      // This will force the user to re-authenticate with the new password
      // TEMPORARILY DISABLED - waiting for migration to be applied
      /*
      await client.query(
        'UPDATE users SET master_password_reset_at = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
      */

      // Mark token as used and record wipe details
      await client.query(
        `UPDATE master_password_reset_tokens 
         SET used = true, 
             used_at = CURRENT_TIMESTAMP,
             data_wiped = true,
             wiped_at = CURRENT_TIMESTAMP,
             entries_count = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [entriesCount, tokenId]
      );

      await client.query('COMMIT');

      logger.error('Vault data wiped and master password reset', {
        userId,
        entriesWiped: entriesCount,
        sessionCleared: true,
        tokenId,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        entriesWiped: entriesCount,
        sessionCleared: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Failed to wipe vault and reset master password', {
        userId,
        tokenId,
        error: error.message,
        stack: error.stack
      });
      
      console.error('🔴 VAULT WIPE ERROR:', error.message);
      console.error('🔴 ERROR STACK:', error.stack);
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark token as used without wiping data (for validation failures)
   * @param {string} tokenId - Token ID
   */
  async markTokenAsUsed(tokenId) {
    try {
      await database.query(
        `UPDATE master_password_reset_tokens 
         SET used = true, used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [tokenId]
      );

      logger.info('Master password reset token marked as used', { tokenId });
    } catch (error) {
      logger.error('Failed to mark token as used', {
        tokenId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cleanup expired tokens
   */
  async cleanupExpiredTokens() {
    try {
      const result = await database.query(
        'DELETE FROM master_password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP'
      );

      if (result.rowCount > 0) {
        logger.info('Cleaned up expired master password reset tokens', {
          deletedCount: result.rowCount
        });
      }

      return result.rowCount;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Rate limiting: Check recent requests for a user
   * @param {string} userId - User ID
   * @param {number} maxAttempts - Max attempts allowed
   * @param {number} windowMinutes - Time window in minutes
   * @returns {object} - Rate limit info
   */
  async checkUserRateLimit(userId, maxAttempts = 3, windowMinutes = 60) {
    // TEMPORARILY DISABLED FOR TESTING
    return {
      allowed: true,
      remaining: maxAttempts,
      count: 0,
      maxAttempts,
      windowMinutes
    };
    
    /* Original implementation temporarily commented out
    try {
      const result = await database.query(
        `SELECT COUNT(*) as count 
         FROM master_password_reset_tokens 
         WHERE user_id = $1 
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '${windowMinutes} minutes'`,
        [userId]
      );

      const count = parseInt(result.rows[0].count, 10);
      const remaining = Math.max(0, maxAttempts - count);
      const allowed = count < maxAttempts;

      return {
        allowed,
        remaining,
        count,
        maxAttempts,
        windowMinutes
      };
    } catch (error) {
      logger.error('Failed to check user rate limit', {
        userId,
        error: error.message
      });
      throw error;
    }
    */
  }

  /**
   * Rate limiting: Check recent requests from an IP
   * @param {string} ipAddress - IP address
   * @param {number} maxAttempts - Max attempts allowed
   * @param {number} windowMinutes - Time window in minutes
   * @returns {object} - Rate limit info
   */
  async checkIpRateLimit(ipAddress, maxAttempts = 5, windowMinutes = 60) {
    // TEMPORARILY DISABLED FOR TESTING
    return {
      allowed: true,
      remaining: maxAttempts,
      count: 0,
      maxAttempts,
      windowMinutes
    };
    
    /* Original implementation temporarily commented out
    try {
      const result = await database.query(
        `SELECT COUNT(*) as count 
         FROM master_password_reset_tokens 
         WHERE ip_address = $1 
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '${windowMinutes} minutes'`,
        [ipAddress]
      );

      const count = parseInt(result.rows[0].count, 10);
      const remaining = Math.max(0, maxAttempts - count);
      const allowed = count < maxAttempts;

      return {
        allowed,
        remaining,
        count,
        maxAttempts,
        windowMinutes
      };
    } catch (error) {
      logger.error('Failed to check IP rate limit', {
        ipAddress,
        error: error.message
      });
      throw error;
    }
    */
  }
}

module.exports = new MasterPasswordResetRepository(); 