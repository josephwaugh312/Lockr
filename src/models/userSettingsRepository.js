const pool = require('../config/database');
const { logger } = require('../utils/logger');

class UserSettingsRepository {
  /**
   * Get user settings by user ID
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>} User settings object or null if not found
   */
  async getByUserId(userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM user_settings WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        // Return default settings if none exist
        return this.getDefaultSettings();
      }
      
      return this.transformDbToSettings(result.rows[0]);
    } catch (error) {
      logger.error('Error getting user settings', { 
        userId, 
        error: error.message,
        service: 'lockr-backend'
      });
      throw error;
    }
  }

  /**
   * Create user settings for a new user
   * @param {string} userId - User UUID
   * @param {Object} settings - Settings object (optional, will use defaults)
   * @returns {Promise<Object>} Created settings object
   */
  async create(userId, settings = {}) {
    try {
      const defaultSettings = this.getDefaultSettings();
      const mergedSettings = { ...defaultSettings, ...settings };
      
      const result = await pool.query(
        `INSERT INTO user_settings (
          user_id, session_timeout, require_password_confirmation,
          auto_lock_timeout, clipboard_timeout, show_password_strength, auto_save,
          theme, compact_view, security_alerts, password_expiry, breach_alerts,
          vault_activity, account_updates, system_maintenance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          userId,
          mergedSettings.sessionTimeout,
          mergedSettings.requirePasswordConfirmation,
          mergedSettings.autoLockTimeout,
          mergedSettings.clipboardTimeout,
          mergedSettings.showPasswordStrength,
          mergedSettings.autoSave,
          mergedSettings.theme,
          mergedSettings.compactView,
          mergedSettings.securityAlerts,
          mergedSettings.passwordExpiry,
          mergedSettings.breachAlerts,
          mergedSettings.vaultActivity,
          mergedSettings.accountUpdates,
          mergedSettings.systemMaintenance
        ]
      );
      
      logger.info('User settings created', {
        userId,
        service: 'lockr-backend'
      });
      
      return this.transformDbToSettings(result.rows[0]);
    } catch (error) {
      logger.error('Error creating user settings', {
        userId,
        error: error.message,
        service: 'lockr-backend'
      });
      throw error;
    }
  }

  /**
   * Update user settings
   * @param {string} userId - User UUID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>} Updated settings object
   */
  async update(userId, settings) {
    try {
      // Check if settings exist, create if not
      const existing = await pool.query(
        'SELECT id FROM user_settings WHERE user_id = $1',
        [userId]
      );
      
      if (existing.rows.length === 0) {
        return await this.create(userId, settings);
      }
      
      const result = await pool.query(
        `UPDATE user_settings SET
          session_timeout = COALESCE($2, session_timeout),
          require_password_confirmation = COALESCE($3, require_password_confirmation),
          auto_lock_timeout = COALESCE($4, auto_lock_timeout),
          clipboard_timeout = COALESCE($5, clipboard_timeout),
          show_password_strength = COALESCE($6, show_password_strength),
          auto_save = COALESCE($7, auto_save),
          theme = COALESCE($8, theme),
          compact_view = COALESCE($9, compact_view),
          security_alerts = COALESCE($10, security_alerts),
          password_expiry = COALESCE($11, password_expiry),
          breach_alerts = COALESCE($12, breach_alerts),
          vault_activity = COALESCE($13, vault_activity),
          account_updates = COALESCE($14, account_updates),
          system_maintenance = COALESCE($15, system_maintenance),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *`,
        [
          userId,
          settings.sessionTimeout,
          settings.requirePasswordConfirmation,
          settings.autoLockTimeout,
          settings.clipboardTimeout,
          settings.showPasswordStrength,
          settings.autoSave,
          settings.theme,
          settings.compactView,
          settings.securityAlerts,
          settings.passwordExpiry,
          settings.breachAlerts,
          settings.vaultActivity,
          settings.accountUpdates,
          settings.systemMaintenance
        ]
      );
      
      logger.info('User settings updated', {
        userId,
        updatedFields: Object.keys(settings),
        service: 'lockr-backend'
      });
      
      return this.transformDbToSettings(result.rows[0]);
    } catch (error) {
      logger.error('Error updating user settings', {
        userId,
        error: error.message,
        service: 'lockr-backend'
      });
      throw error;
    }
  }

  /**
   * Upsert helper expected by some tests
   */
  async createOrUpdate(userId, settings) {
    const existing = await this.getByUserId(userId)
    if (!existing) {
      return this.create(userId, settings)
    }
    return this.update(userId, settings)
  }

  /**
   * Delete user settings
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>} Success status
   */
  async delete(userId) {
    try {
      const result = await pool.query(
        'DELETE FROM user_settings WHERE user_id = $1',
        [userId]
      );
      
      logger.info('User settings deleted', {
        userId,
        service: 'lockr-backend'
      });
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error deleting user settings', {
        userId,
        error: error.message,
        service: 'lockr-backend'
      });
      throw error;
    }
  }

  /**
   * Get default settings
   * @returns {Object} Default settings object
   */
  getDefaultSettings() {
    return {
      sessionTimeout: 30,
      requirePasswordConfirmation: true,
      autoLockTimeout: 15,
      clipboardTimeout: 30,
      showPasswordStrength: true,
      autoSave: true,
      theme: 'system',
      compactView: false,
      securityAlerts: true,
      passwordExpiry: true,
      breachAlerts: true,
      vaultActivity: true,
      accountUpdates: true,
      systemMaintenance: true
    };
  }

  /**
   * Transform database row to settings object
   * @param {Object} dbRow - Database row
   * @returns {Object} Settings object
   */
  transformDbToSettings(dbRow) {
    return {
      sessionTimeout: dbRow.session_timeout,
      requirePasswordConfirmation: dbRow.require_password_confirmation,
      autoLockTimeout: dbRow.auto_lock_timeout,
      clipboardTimeout: dbRow.clipboard_timeout,
      showPasswordStrength: dbRow.show_password_strength,
      autoSave: dbRow.auto_save,
      theme: dbRow.theme,
      compactView: dbRow.compact_view,
      securityAlerts: dbRow.security_alerts,
      passwordExpiry: dbRow.password_expiry,
      breachAlerts: dbRow.breach_alerts,
      vaultActivity: dbRow.vault_activity,
      accountUpdates: dbRow.account_updates,
      systemMaintenance: dbRow.system_maintenance,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }
}

module.exports = new UserSettingsRepository(); 