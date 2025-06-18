const { logger } = require('../utils/logger');
const notificationService = require('./notificationService');
const { NOTIFICATION_SUBTYPES } = require('./notificationService');
const vaultRepository = require('../models/vaultRepository');
const userSettingsRepository = require('../models/userSettingsRepository');

class PasswordExpiryService {
  constructor() {
    // Default password age thresholds (in days)
    this.thresholds = {
      WARNING: 75,    // Warn at 75 days
      CRITICAL: 90,   // Critical at 90 days
      EXPIRED: 120    // Consider expired at 120 days
    };
  }

  /**
   * Check password age for all vault entries of a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Password expiry analysis
   */
  async checkPasswordExpiry(userId) {
    try {
      // Check if user has password expiry notifications enabled
      const userSettings = await userSettingsRepository.getByUserId(userId);
      if (!userSettings?.passwordExpiry) {
        return {
          enabled: false,
          message: 'Password expiry notifications are disabled'
        };
      }

      // Get all vault entries for the user
      const vaultEntries = await vaultRepository.getAllByUserId(userId);
      
      if (!vaultEntries || vaultEntries.length === 0) {
        return {
          enabled: true,
          totalEntries: 0,
          expiredPasswords: [],
          warningPasswords: [],
          criticalPasswords: []
        };
      }

      const now = new Date();
      const expiredPasswords = [];
      const criticalPasswords = [];
      const warningPasswords = [];

      // Analyze each vault entry
      for (const entry of vaultEntries) {
        // Use updatedAt as the last password change date
        // In a real system, you'd track password change dates separately
        const lastChanged = new Date(entry.updatedAt || entry.createdAt);
        const daysSinceChange = Math.floor((now - lastChanged) / (1000 * 60 * 60 * 24));

        const passwordInfo = {
          entryId: entry.id,
          name: entry.name,
          website: entry.website,
          daysSinceChange,
          lastChanged: lastChanged.toISOString(),
          category: this.categorizePasswordAge(daysSinceChange)
        };

        if (daysSinceChange >= this.thresholds.EXPIRED) {
          expiredPasswords.push(passwordInfo);
        } else if (daysSinceChange >= this.thresholds.CRITICAL) {
          criticalPasswords.push(passwordInfo);
        } else if (daysSinceChange >= this.thresholds.WARNING) {
          warningPasswords.push(passwordInfo);
        }
      }

      return {
        enabled: true,
        totalEntries: vaultEntries.length,
        expiredPasswords,
        criticalPasswords,
        warningPasswords,
        summary: {
          expired: expiredPasswords.length,
          critical: criticalPasswords.length,
          warning: warningPasswords.length,
          healthy: vaultEntries.length - (expiredPasswords.length + criticalPasswords.length + warningPasswords.length)
        }
      };

    } catch (error) {
      logger.error('Error checking password expiry', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Send password expiry notifications for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Notification results
   */
  async sendPasswordExpiryNotifications(userId) {
    try {
      const expiryData = await this.checkPasswordExpiry(userId);
      
      if (!expiryData.enabled) {
        return {
          sent: false,
          reason: 'Password expiry notifications disabled'
        };
      }

      let notificationsSent = 0;
      const notifications = [];

      // Send notifications for expired passwords
      if (expiryData.expiredPasswords.length > 0) {
        try {
          await notificationService.sendSecurityAlert(userId, NOTIFICATION_SUBTYPES.PASSWORD_EXPIRY_WARNING, {
            templateData: {
              severity: 'expired',
              count: expiryData.expiredPasswords.length,
              passwords: expiryData.expiredPasswords.slice(0, 5), // Limit to 5 examples
              totalExpired: expiryData.expiredPasswords.length,
              message: `${expiryData.expiredPasswords.length} password${expiryData.expiredPasswords.length > 1 ? 's are' : ' is'} overdue for update`,
              timestamp: new Date().toISOString()
            }
          });

          notificationsSent++;
          notifications.push({
            type: 'expired',
            count: expiryData.expiredPasswords.length,
            sent: true
          });

          logger.info('Password expiry notification sent', {
            userId,
            type: 'expired',
            count: expiryData.expiredPasswords.length
          });
        } catch (error) {
          logger.error('Failed to send expired password notification', {
            error: error.message,
            userId
          });
        }
      }

      // Send notifications for critical passwords
      if (expiryData.criticalPasswords.length > 0) {
        try {
          await notificationService.sendSecurityAlert(userId, NOTIFICATION_SUBTYPES.PASSWORD_EXPIRY_WARNING, {
            templateData: {
              severity: 'critical',
              count: expiryData.criticalPasswords.length,
              passwords: expiryData.criticalPasswords.slice(0, 5),
              totalCritical: expiryData.criticalPasswords.length,
              message: `${expiryData.criticalPasswords.length} password${expiryData.criticalPasswords.length > 1 ? 's need' : ' needs'} urgent update`,
              timestamp: new Date().toISOString()
            }
          });

          notificationsSent++;
          notifications.push({
            type: 'critical',
            count: expiryData.criticalPasswords.length,
            sent: true
          });

          logger.info('Password expiry notification sent', {
            userId,
            type: 'critical',
            count: expiryData.criticalPasswords.length
          });
        } catch (error) {
          logger.error('Failed to send critical password notification', {
            error: error.message,
            userId
          });
        }
      }

      // Send notifications for warning passwords (less frequent)
      if (expiryData.warningPasswords.length > 0) {
        try {
          await notificationService.sendSecurityAlert(userId, NOTIFICATION_SUBTYPES.PASSWORD_EXPIRY_WARNING, {
            templateData: {
              severity: 'warning',
              count: expiryData.warningPasswords.length,
              passwords: expiryData.warningPasswords.slice(0, 3),
              totalWarning: expiryData.warningPasswords.length,
              message: `${expiryData.warningPasswords.length} password${expiryData.warningPasswords.length > 1 ? 's should' : ' should'} be updated soon`,
              timestamp: new Date().toISOString()
            }
          });

          notificationsSent++;
          notifications.push({
            type: 'warning',
            count: expiryData.warningPasswords.length,
            sent: true
          });

          logger.info('Password expiry notification sent', {
            userId,
            type: 'warning',
            count: expiryData.warningPasswords.length
          });
        } catch (error) {
          logger.error('Failed to send warning password notification', {
            error: error.message,
            userId
          });
        }
      }

      return {
        sent: notificationsSent > 0,
        notificationsSent,
        notifications,
        summary: expiryData.summary
      };

    } catch (error) {
      logger.error('Error sending password expiry notifications', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Categorize password age
   * @param {number} daysSinceChange - Days since password was last changed
   * @returns {string} Category (healthy, warning, critical, expired)
   */
  categorizePasswordAge(daysSinceChange) {
    if (daysSinceChange >= this.thresholds.EXPIRED) {
      return 'expired';
    } else if (daysSinceChange >= this.thresholds.CRITICAL) {
      return 'critical';
    } else if (daysSinceChange >= this.thresholds.WARNING) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Get password health statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Password health stats
   */
  async getPasswordHealthStats(userId) {
    try {
      const expiryData = await this.checkPasswordExpiry(userId);
      
      if (!expiryData.enabled) {
        return {
          enabled: false,
          message: 'Password expiry monitoring is disabled'
        };
      }

      const summary = expiryData.summary || {
        expired: 0,
        critical: 0,
        warning: 0,
        healthy: 0
      };

      const stats = {
        enabled: true,
        totalPasswords: expiryData.totalEntries || 0,
        healthScore: this.calculateHealthScore(summary),
        breakdown: summary,
        recommendations: this.generateRecommendations(summary)
      };

      return stats;

    } catch (error) {
      logger.error('Error getting password health stats', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Calculate overall password health score (0-100)
   * @param {Object} summary - Password summary stats
   * @returns {number} Health score
   */
  calculateHealthScore(summary) {
    if (!summary) {
      return 100;
    }

    const expired = summary.expired || 0;
    const critical = summary.critical || 0;
    const warning = summary.warning || 0;
    const healthy = summary.healthy || 0;
    
    const total = expired + critical + warning + healthy;
    
    if (total === 0) return 100;

    // Weight different categories
    const score = (
      (healthy * 100) +
      (warning * 70) +
      (critical * 30) +
      (expired * 0)
    ) / total;

    return Math.round(score);
  }

  /**
   * Generate recommendations based on password health
   * @param {Object} summary - Password summary stats
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(summary) {
    const recommendations = [];

    if (!summary) {
      recommendations.push({
        priority: 'info',
        message: 'No password data available for analysis.',
        action: 'add_passwords'
      });
      return recommendations;
    }

    const expired = summary.expired || 0;
    const critical = summary.critical || 0;
    const warning = summary.warning || 0;

    if (expired > 0) {
      recommendations.push({
        priority: 'high',
        message: `Update ${expired} expired password${expired > 1 ? 's' : ''} immediately`,
        action: 'update_expired'
      });
    }

    if (critical > 0) {
      recommendations.push({
        priority: 'medium',
        message: `${critical} password${critical > 1 ? 's are' : ' is'} due for update`,
        action: 'update_critical'
      });
    }

    if (warning > 0) {
      recommendations.push({
        priority: 'low',
        message: `Consider updating ${warning} aging password${warning > 1 ? 's' : ''}`,
        action: 'update_warning'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'info',
        message: 'All passwords are up to date! Great job maintaining good security hygiene.',
        action: 'maintain'
      });
    }

    return recommendations;
  }

  /**
   * Perform a manual password expiry check and send notifications
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Check results
   */
  async performManualExpiryCheck(userId) {
    try {
      const results = await this.sendPasswordExpiryNotifications(userId);
      
      logger.info('Manual password expiry check completed', {
        userId,
        notificationsSent: results.notificationsSent,
        summary: results.summary
      });

      return {
        success: true,
        message: 'Password expiry check completed',
        ...results
      };

    } catch (error) {
      logger.error('Error in manual password expiry check', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Run scheduled password expiry checks for all users
   * This should be called by a cron job or scheduler
   * @returns {Promise<Object>} Summary of notifications sent
   */
  async runScheduledPasswordExpiryCheck() {
    try {
      logger.info('Starting scheduled password expiry check for all users');
      
      const userRepository = require('../models/userRepository');
      const users = await userRepository.getAllActiveUsers();
      
      let totalNotificationsSent = 0;
      let usersProcessed = 0;
      let usersWithExpiredPasswords = 0;
      const results = [];

      for (const user of users) {
        try {
          const result = await this.sendPasswordExpiryNotifications(user.id);
          
          if (result.sent) {
            totalNotificationsSent += result.notificationsSent;
            usersWithExpiredPasswords++;
          }
          
          results.push({
            userId: user.id,
            email: user.email,
            notifications: result.notifications || [],
            sent: result.sent
          });
          
          usersProcessed++;
        } catch (error) {
          logger.error('Failed to process password expiry for user', {
            userId: user.id,
            email: user.email,
            error: error.message
          });
        }
      }

      const summary = {
        usersProcessed,
        usersWithExpiredPasswords,
        totalNotificationsSent,
        completedAt: new Date().toISOString()
      };

      logger.info('Scheduled password expiry check completed', summary);
      
      return {
        success: true,
        summary,
        results
      };

    } catch (error) {
      logger.error('Scheduled password expiry check failed', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PasswordExpiryService(); 