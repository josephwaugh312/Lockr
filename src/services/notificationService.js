const { logger } = require("../utils/logger");
const EmailService = require("./emailService");
const SMSService = require("./smsService");
const InAppNotificationService = require("./inAppNotificationService");

// Notification types and subtypes
const NOTIFICATION_TYPES = {
  SECURITY: 'security',
  ACCOUNT: 'account',
  SYSTEM: 'system'
};

const NOTIFICATION_SUBTYPES = {
  // Security alerts
  NEW_DEVICE_LOGIN: 'new_device_login',
  SUSPICIOUS_LOGIN: 'suspicious_login',
  MULTIPLE_FAILED_LOGINS: 'multiple_failed_logins',
  MASTER_PASSWORD_RESET: 'master_password_reset',
  ACCOUNT_LOCKOUT: 'account_lockout',
  TWO_FACTOR_ENABLED: 'two_factor_enabled',
  TWO_FACTOR_DISABLED: 'two_factor_disabled',
  VAULT_ACCESSED: 'vault_accessed',
  PASSWORD_EXPIRY_WARNING: 'password_expiry_warning',
  DATA_BREACH_ALERT: 'data_breach_alert',
  
  // Account notifications
  WELCOME: 'welcome',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_LINK: 'password_reset_link',
  MASTER_PASSWORD_RESET_REQUESTED: 'master_password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  EMAIL_VERIFIED: 'email_verified',
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  VAULT_ENTRY_CREATED: 'vault_entry_created',
  VAULT_ENTRY_UPDATED: 'vault_entry_updated',
  VAULT_ENTRY_DELETED: 'vault_entry_deleted',
  PROFILE_UPDATED: 'profile_updated',
  
  // System notifications
  SYSTEM_MAINTENANCE: 'system_maintenance',
  SYSTEM_UPDATE: 'system_update'
};

const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class NotificationService {
  constructor() {
    this.emailService = null;
    this.smsService = null;
    this.inAppService = null;
    this.initialized = false;
    
    // Deduplication cache to prevent duplicate notifications
    this.notificationCache = new Map();
    
    // Channel configuration
    this.enabledChannels = {
      email: process.env.RESEND_API_KEY ? true : false,
      sms: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? true : false,
      inApp: true // Always enabled
    };
  }

  async initialize() {
    try {
      // Initialize services
      this.inAppService = new InAppNotificationService();
      
      if (this.enabledChannels.email) {
        this.emailService = new EmailService();
        await this.emailService.initialize();
      }
      
      if (this.enabledChannels.sms) {
        this.smsService = new SMSService();
        await this.smsService.initialize();
      }
      
      this.initialized = true;
      logger.info('NotificationService initialized successfully', {
        channels: this.enabledChannels
      });
    } catch (error) {
      logger.error('Failed to initialize NotificationService:', error);
      throw error;
    }
  }

  async sendNotification(userId, type, subtype, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Check user notification preferences
      const userSettingsRepository = require('../models/userSettingsRepository');
      const userSettings = await userSettingsRepository.getByUserId(userId);
      
      // Check if user has disabled this type of notification
      if (userSettings) {
        if (type === NOTIFICATION_TYPES.SECURITY && !userSettings.securityAlerts) {
          logger.info('Security notification skipped - user has disabled security alerts', { userId, subtype });
          return { skipped: true, reason: 'Security alerts disabled' };
        }
        
        // Add more specific checks for other notification types
        if (subtype === NOTIFICATION_SUBTYPES.VAULT_ENTRY_CREATED || 
            subtype === NOTIFICATION_SUBTYPES.VAULT_ENTRY_UPDATED || 
            subtype === NOTIFICATION_SUBTYPES.VAULT_ENTRY_DELETED) {
          // These are low-priority vault notifications, could be controlled by a separate setting
          // For now, always allow them since they're in-app only
        }
      }

      const {
        title,
        message,
        data = {},
        priority = PRIORITY_LEVELS.MEDIUM,
        channels = ['inApp'], // Default to in-app only
        templateData = {}
      } = options;

      // Always create in-app notification (even if other channels are disabled)
      const notification = await this.inAppService.create({
        userId,
        type,
        subtype,
        title,
        message,
        data,
        priority
      });

      // Send to other channels if specified and user settings allow
      const results = { inApp: notification };

      if (channels.includes('email') && this.enabledChannels.email) {
        try {
          console.log('🔍 Attempting to send email notification', {
            userId,
            type,
            subtype,
            hasEmailService: !!this.emailService
          });
          
          results.email = await this.emailService.sendNotificationEmail({
            userId,
            type,
            subtype,
            title,
            message,
            templateData
          });
          
          console.log('✅ Email notification sent successfully', {
            userId,
            type,
            subtype,
            result: !!results.email
          });
        } catch (error) {
          console.log('❌ Email notification failed:', {
            userId,
            type,
            subtype,
            error: error.message,
            stack: error.stack
          });
          logger.error('Failed to send email notification:', error);
        }
      } else {
        console.log('🔍 Email notification skipped', {
          userId,
          type,
          subtype,
          channelsIncludesEmail: channels.includes('email'),
          emailChannelEnabled: this.enabledChannels.email,
          channels: channels
        });
      }

      if (channels.includes('sms') && this.enabledChannels.sms) {
        try {
          // Only send SMS for critical notifications
          if (priority === PRIORITY_LEVELS.CRITICAL) {
            results.sms = await this.smsService.sendNotificationSMS({
              userId,
              message,
              type,
              subtype
            });
          }
        } catch (error) {
          logger.error('Failed to send SMS notification:', error);
        }
      }

      logger.info('Notification sent successfully', {
        userId,
        type,
        subtype,
        channels: Object.keys(results)
      });

      return results;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  // Add method to clear notification cache (for testing)
  clearNotificationCache(userId, subtype) {
    const keysToDelete = [];
    for (const [key, value] of this.notificationCache.entries()) {
      if (key.includes(userId) && key.includes(subtype)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.notificationCache.delete(key);
      console.log('🧹 Cleared notification cache key:', key);
    });
    
    return keysToDelete.length;
  }

  // Convenience methods for common notifications
  async sendSecurityAlert(userId, subtype, options = {}) {
    // Deduplication for suspicious login alerts
    if (subtype === NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN) {
      // Use different deduplication keys for different types of suspicious login
      const reason = options.templateData?.reason || 'unknown';
      const dedupeKey = `${userId}_${subtype}_${reason.replace(/\s+/g, '_').toLowerCase()}`;
      const notificationKey = `${dedupeKey}_notified`;
      const now = Date.now();
      
      console.log('🔍 Suspicious login deduplication check:', {
        userId,
        reason,
        dedupeKey,
        hasExistingCache: this.notificationCache.has(dedupeKey)
      });
      
      // Get or initialize attempt tracking
      if (!this.notificationCache.has(dedupeKey)) {
        this.notificationCache.set(dedupeKey, []);
      }
      
      const attempts = this.notificationCache.get(dedupeKey);
      attempts.push(now);
      
      // Clean up attempts older than 15 minutes
      const recentAttempts = attempts.filter(timestamp => now - timestamp < 15 * 60 * 1000);
      this.notificationCache.set(dedupeKey, recentAttempts);
      
      // Skip internal threshold check if vault controller has already determined threshold is met
      // The vault controller calls this after 3+ attempts, so we trust that decision
      const skipThresholdCheck = options.templateData?.attemptCount >= 3;
      
      // Only send notification after 3+ attempts within 15 minutes (production setting)
      if (!skipThresholdCheck && recentAttempts.length < 3) {
        console.log('🔍 Suspicious login notification skipped - threshold not met', {
          userId,
          reason,
          attemptCount: recentAttempts.length,
          threshold: 3,
          skipThresholdCheck
        });
        logger.info('Suspicious login notification skipped - threshold not met', {
          userId,
          subtype,
          reason,
          attemptCount: recentAttempts.length,
          threshold: 3,
          skipThresholdCheck
        });
        return { skipped: true, reason: `Only ${recentAttempts.length} attempt(s), need 3+ for suspicious login alert` };
      }
      
      // Check if we've already sent a notification in this failure window
      const lastNotified = this.notificationCache.get(notificationKey) || 0;
      if (now - lastNotified < 15 * 60 * 1000) {
        console.log('🔍 Suspicious login notification skipped - already notified in current window', {
          userId,
          reason,
          attemptCount: recentAttempts.length,
          lastNotified: new Date(lastNotified).toISOString()
        });
        logger.info('Suspicious login notification skipped - already notified in current window', {
          userId,
          subtype,
          reason,
          attemptCount: recentAttempts.length,
          lastNotified: new Date(lastNotified).toISOString()
        });
        return { skipped: true, reason: 'Already notified in current failure window' };
      }
      
      // Mark that we're sending a notification now
      this.notificationCache.set(notificationKey, now);
      
      console.log('🔍 Suspicious login notification will be sent', {
        userId,
        reason,
        attemptCount: recentAttempts.length
      });
      
      // Clean up old cache entries (keep only last 30 minutes)
      for (const [key, timestamps] of this.notificationCache.entries()) {
        if (Array.isArray(timestamps)) {
          const recentTimestamps = timestamps.filter(timestamp => now - timestamp < 30 * 60 * 1000);
          if (recentTimestamps.length === 0) {
            this.notificationCache.delete(key);
          } else {
            this.notificationCache.set(key, recentTimestamps);
          }
        } else if (now - timestamps > 30 * 60 * 1000) {
          this.notificationCache.delete(key);
        }
      }
    }
    
    const securityMessages = {
      [NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN]: {
        title: 'New Device Login',
        message: 'Your account was accessed from a new device',
        priority: PRIORITY_LEVELS.CRITICAL,
        channels: ['inApp', 'email', 'sms']
      },
      [NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN]: {
        title: 'Suspicious Login Attempt',
        message: 'We detected a suspicious login attempt on your account',
        priority: PRIORITY_LEVELS.CRITICAL,
        channels: ['inApp', 'email', 'sms']
      },
      [NOTIFICATION_SUBTYPES.MULTIPLE_FAILED_LOGINS]: {
        title: 'Multiple Failed Login Attempts',
        message: 'Multiple failed login attempts detected on your account',
        priority: PRIORITY_LEVELS.CRITICAL,
        channels: ['inApp', 'email', 'sms']
      },
      [NOTIFICATION_SUBTYPES.MASTER_PASSWORD_RESET]: {
        title: 'Master Password Reset',
        message: 'Your master password has been successfully reset',
        priority: PRIORITY_LEVELS.CRITICAL,
        channels: ['inApp', 'email', 'sms']
      },
      [NOTIFICATION_SUBTYPES.ACCOUNT_LOCKOUT]: {
        title: 'Account Locked',
        message: 'Your account has been temporarily locked due to security concerns',
        priority: PRIORITY_LEVELS.CRITICAL,
        channels: ['inApp', 'email', 'sms']
      },
      [NOTIFICATION_SUBTYPES.VAULT_ACCESSED]: {
        title: 'Vault Accessed',
        message: 'Your vault has been unlocked and accessed',
        priority: PRIORITY_LEVELS.MEDIUM,
        channels: ['inApp']
      },
      [NOTIFICATION_SUBTYPES.TWO_FACTOR_ENABLED]: {
        title: 'Two-Factor Authentication Enabled',
        message: 'Two-factor authentication has been successfully enabled for your account. Your account is now more secure.',
        priority: PRIORITY_LEVELS.HIGH,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.TWO_FACTOR_DISABLED]: {
        title: 'Two-Factor Authentication Disabled',
        message: 'Two-factor authentication has been disabled for your account. If this was not you, please contact support immediately.',
        priority: PRIORITY_LEVELS.HIGH,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.PASSWORD_EXPIRY_WARNING]: {
        title: 'Password Expiry Warning',
        message: 'Some of your passwords are old and should be updated',
        priority: PRIORITY_LEVELS.MEDIUM,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.DATA_BREACH_ALERT]: {
        title: 'Data Breach Alert',
        message: 'Your accounts may be compromised in a recent data breach',
        priority: PRIORITY_LEVELS.HIGH,
        channels: ['inApp', 'email']
      }
    };

    const config = securityMessages[subtype];
    if (!config) {
      throw new Error(`Unknown security notification subtype: ${subtype}`);
    }

    return this.sendNotification(userId, NOTIFICATION_TYPES.SECURITY, subtype, {
      ...config,
      ...options
    });
  }

  async sendAccountNotification(userId, subtype, options = {}) {
    const accountMessages = {
      [NOTIFICATION_SUBTYPES.WELCOME]: {
        title: 'Welcome to Lockr!',
        message: 'Your account has been created successfully',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.PASSWORD_RESET_REQUESTED]: {
        title: 'Password Reset Requested',
        message: 'A password reset has been requested for your account',
        priority: PRIORITY_LEVELS.MEDIUM,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.PASSWORD_RESET_LINK]: {
        title: 'Password Reset Link',
        message: 'Here is your password reset link',
        priority: PRIORITY_LEVELS.MEDIUM,
        channels: ['email']
      },
      [NOTIFICATION_SUBTYPES.MASTER_PASSWORD_RESET_REQUESTED]: {
        title: 'Master Password Reset Requested',
        message: 'A master password reset has been requested for your account',
        priority: PRIORITY_LEVELS.MEDIUM,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.PASSWORD_RESET_COMPLETED]: {
        title: 'Password Reset Successful',
        message: 'Your account password has been successfully reset',
        priority: PRIORITY_LEVELS.HIGH,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.EMAIL_VERIFIED]: {
        title: 'Email Verified',
        message: 'Your email address has been successfully verified',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp']
      },
      [NOTIFICATION_SUBTYPES.VAULT_ENTRY_CREATED]: {
        title: 'New Vault Entry Created',
        message: 'A new entry has been added to your vault',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp']
      },
      [NOTIFICATION_SUBTYPES.VAULT_ENTRY_UPDATED]: {
        title: 'Vault Entry Updated',
        message: 'A vault entry has been updated',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp']
      },
      [NOTIFICATION_SUBTYPES.VAULT_ENTRY_DELETED]: {
        title: 'Vault Entry Deleted',
        message: 'A vault entry has been deleted',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp']
      },
      [NOTIFICATION_SUBTYPES.PROFILE_UPDATED]: {
        title: 'Profile Updated',
        message: 'Your profile information has been updated',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp']
      }
    };

    const config = accountMessages[subtype];
    if (!config) {
      throw new Error(`Unknown account notification subtype: ${subtype}`);
    }

    return this.sendNotification(userId, NOTIFICATION_TYPES.ACCOUNT, subtype, {
      ...config,
      ...options
    });
  }

  async sendSystemNotification(userId, subtype, options = {}) {
    const systemMessages = {
      [NOTIFICATION_SUBTYPES.SYSTEM_MAINTENANCE]: {
        title: 'System Maintenance',
        message: 'Scheduled maintenance is planned for the system',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp', 'email']
      },
      [NOTIFICATION_SUBTYPES.SYSTEM_UPDATE]: {
        title: 'System Update',
        message: 'The system has been updated with new features',
        priority: PRIORITY_LEVELS.LOW,
        channels: ['inApp']
      }
    };

    const config = systemMessages[subtype];
    if (!config) {
      throw new Error(`Unknown system notification subtype: ${subtype}`);
    }

    return this.sendNotification(userId, NOTIFICATION_TYPES.SYSTEM, subtype, {
      ...config,
      ...options
    });
  }

  // Get user notifications
  async getUserNotifications(userId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.inAppService.getUserNotifications(userId, options);
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.inAppService.markAsRead(notificationId, userId);
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.inAppService.markAllAsRead(userId);
  }

  // Get unread count
  async getUnreadCount(userId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.inAppService.getUnreadCount(userId);
  }
}

// Export singleton instance
module.exports = new NotificationService();

// Export constants for use in other files
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.NOTIFICATION_SUBTYPES = NOTIFICATION_SUBTYPES;
module.exports.PRIORITY_LEVELS = PRIORITY_LEVELS;
