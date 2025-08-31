const twilio = require('twilio');
const database = require('../config/database');
const { logger } = require('../utils/logger');
const systemEncryption = require('./systemEncryptionService');

class SMSService {
  constructor() {
    this.twilioClient = null;
    this.initialized = false;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async initialize() {
    try {
      // Check for required environment variables even in test mode
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required');
      }

      if (!this.fromNumber) {
        throw new Error('TWILIO_PHONE_NUMBER environment variable is required');
      }
      
      // Skip actual Twilio initialization in test mode
      if (process.env.NODE_ENV === 'test') {
        // In test mode, the Twilio client should be mocked by the test
        // If not mocked, create a dummy client to prevent errors
        if (!this.twilioClient) {
          const twilio = require('twilio');
          this.twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
        }
        this.initialized = true;
        logger.info('SMS service initialized in test mode');
        return;
      }

      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      // Test Twilio connection (skip in test environment)
      if (process.env.NODE_ENV !== 'test') {
        await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      }

      this.initialized = true;
      logger.info('SMSService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SMSService:', error);
      throw error;
    }
  }

  async getUserPhone(userId) {
    try {
      // First try to get encrypted phone number, fall back to plain text during migration
      const query = `
        SELECT 
          encrypted_phone_number,
          phone_number_iv,
          phone_number_salt,
          phone_number,
          name 
        FROM users 
        WHERE id = $1 
          AND (encrypted_phone_number IS NOT NULL OR phone_number IS NOT NULL)
      `;
      
      const client = await database.getClient();
      try {
        const result = await client.query(query, [userId]);
        
        if (result.rows.length === 0) {
          throw new Error('User not found or no phone number on file');
        }

        const user = result.rows[0];
        let phoneNumber;

        // Try to decrypt encrypted phone number first
        if (user.encrypted_phone_number && user.phone_number_iv && user.phone_number_salt) {
          if (systemEncryption.isAvailable()) {
            try {
              phoneNumber = systemEncryption.decryptPhoneNumber(
                user.encrypted_phone_number,
                user.phone_number_iv,
                user.phone_number_salt
              );
            } catch (decryptError) {
              logger.warn('Failed to decrypt phone number, falling back to plain text', {
                userId,
                error: decryptError.message
              });
              phoneNumber = user.phone_number;
            }
          } else {
            logger.warn('System encryption not available, using plain text phone number');
            phoneNumber = user.phone_number;
          }
        } else {
          // Fall back to plain text phone number during migration period
          phoneNumber = user.phone_number;
        }

        if (!phoneNumber) {
          throw new Error('Unable to retrieve phone number');
        }

        return {
          phone_number: phoneNumber,
          name: user.name
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get user phone:', error);
      throw error;
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming US)
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+${digitsOnly}`;
    } else if (digitsOnly.startsWith('+')) {
      return phoneNumber;
    }
    
    return `+${digitsOnly}`;
  }

  generateSecurityMessage(subtype, data = {}) {
    const messages = {
      suspicious_login: `🚨 Lockrr Security Alert: Suspicious login attempt detected from ${data.location || 'unknown location'}. If this wasn't you, change your password immediately. Reply STOP to opt out.`,
      
      account_lockout: `🔒 Lockrr Alert: Your account has been temporarily locked due to security concerns. Contact support at support@lockrr.app or visit lockrr.app. Reply STOP to opt out.`,
      
      multiple_failed_logins: `⚠️ Lockrr Alert: Multiple failed login attempts detected on your account. Consider changing your password if this wasn't you. Reply STOP to opt out.`,
      
      master_password_reset: `✅ Lockrr: Your master password has been successfully reset at ${data.resetTime || new Date().toLocaleString()}. If this wasn't you, contact support immediately. Reply STOP to opt out.`,
      
      new_device_login: `🔐 Lockrr: New device login detected from ${data.location || 'unknown location'}. If this was you, you can ignore this message. Reply STOP to opt out.`,
      
      two_factor_enabled: `🔐 Lockrr: Two-factor authentication has been enabled on your account. Your account is now more secure. Reply STOP to opt out.`,
      
      two_factor_disabled: `⚠️ Lockrr: Two-factor authentication has been disabled on your account. If this wasn't you, secure your account immediately. Reply STOP to opt out.`,
      
      password_expiry_warning: `⏰ Lockrr: Some of your passwords are expiring soon. Update them in your vault to stay secure. Reply STOP to opt out.`,
      
      data_breach_alert: `🚨 Lockrr Breach Alert: One of your passwords may be compromised. Check your vault for details and update affected passwords. Reply STOP to opt out.`
    };

    return messages[subtype] || `🔐 Lockrr: Security alert for your account. Please check your email for details. Reply STOP to opt out.`;
  }

  generateSystemMessage(subtype, data = {}) {
    const messages = {
      system_maintenance: `🔧 Lockrr: Scheduled maintenance on ${data.scheduledDate || 'upcoming date'}. Service may be temporarily unavailable. Check lockrr.app for updates. Reply STOP to opt out.`,
      
      system_update: `🚀 Lockrr: New features and improvements are now available! Update your app to access the latest enhancements. Reply STOP to opt out.`
    };

    return messages[subtype] || `📢 Lockrr: System notification. Please check your email for details. Reply STOP to opt out.`;
  }

  async send2FACode(userId, code) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const user = await this.getUserPhone(userId);
      const formattedPhone = this.formatPhoneNumber(user.phone_number);

      const message = `🔐 Lockrr: Your verification code is ${code}. This code expires in 5 minutes. Do not share this code with anyone. Reply STOP to opt out.`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('2FA SMS sent successfully', {
        userId,
        phone: this.maskPhoneNumber(formattedPhone),
        messageSid: result.sid
      });

      return {
        success: true,
        messageSid: result.sid,
        recipient: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error('Failed to send 2FA SMS:', error);
      throw error;
    }
  }

  async sendNotificationSMS({ userId, message, type, subtype }) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const user = await this.getUserPhone(userId);
      const formattedPhone = this.formatPhoneNumber(user.phone_number);

      // Check if user has opted out of SMS notifications
      const optedOut = await this.checkOptOutStatus(formattedPhone);
      if (optedOut) {
        logger.info('SMS notification skipped - user opted out', {
          userId,
          phone: this.maskPhoneNumber(formattedPhone),
          type,
          subtype
        });
        return {
          success: false,
          reason: 'User opted out of SMS notifications',
          recipient: this.maskPhoneNumber(formattedPhone)
        };
      }

      // Generate appropriate message based on type/subtype
      let smsMessage;
      if (type === 'security') {
        smsMessage = this.generateSecurityMessage(subtype, { 
          firstName: user.name,
          location: message.location,
          resetTime: message.resetTime 
        });
      } else if (type === 'system') {
        smsMessage = this.generateSystemMessage(subtype, {
          scheduledDate: message.scheduledDate || message.scheduledFor
        });
      } else {
        // Fallback to provided message with character limit
        smsMessage = message.length > 140 ? message.substring(0, 137) + '...' : message;
        smsMessage += ' Reply STOP to opt out.';
      }

      const result = await this.twilioClient.messages.create({
        body: smsMessage,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Notification SMS sent successfully', {
        userId,
        phone: this.maskPhoneNumber(formattedPhone),
        type,
        subtype,
        messageSid: result.sid
      });

      return {
        success: true,
        messageSid: result.sid,
        recipient: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error('Failed to send notification SMS:', error);
      throw error;
    }
  }

  async sendCustomSMS({ to, message }) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const formattedPhone = this.formatPhoneNumber(to);

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Custom SMS sent successfully', {
        phone: this.maskPhoneNumber(formattedPhone),
        messageSid: result.sid
      });

      return {
        success: true,
        messageSid: result.sid,
        recipient: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error('Failed to send custom SMS:', error);
      throw error;
    }
  }

  async getMessageStatus(messageSid) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const message = await this.twilioClient.messages(messageSid).fetch();
      
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        price: message.price,
        priceUnit: message.priceUnit
      };
    } catch (error) {
      logger.error('Failed to get message status:', error);
      throw error;
    }
  }

  async validatePhoneNumber(phoneNumber) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const lookup = await this.twilioClient.lookups.v1
        .phoneNumbers(formattedPhone)
        .fetch({ type: ['carrier'] });

      return {
        valid: true,
        phoneNumber: lookup.phoneNumber,
        nationalFormat: lookup.nationalFormat,
        countryCode: lookup.countryCode,
        carrier: lookup.carrier
      };
    } catch (error) {
      if (error.code === 20404) {
        return {
          valid: false,
          error: 'Invalid phone number'
        };
      }
      
      logger.error('Failed to validate phone number:', error);
      throw error;
    }
  }

  maskPhoneNumber(phoneNumber) {
    // Mask phone number for logging (e.g., +1234567890 -> +1****67890)
    if (phoneNumber.length > 6) {
      const start = phoneNumber.substring(0, 3);
      const end = phoneNumber.substring(phoneNumber.length - 4);
      return start + '****' + end;
    }
    return '****';
  }

  async checkOptOutStatus(phoneNumber) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Check if phone number has opted out
      // Note: This still uses plain text for now as it's checking by phone number
      // In production, you might want to check by user ID instead
      const query = 'SELECT sms_opt_out FROM users WHERE phone_number = $1';
      
      const client = await database.getClient();
      try {
        const result = await client.query(query, [formattedPhone]);
        
        if (result.rows.length === 0) {
          return false; // Not found, assume opted in
        }
        
        return result.rows[0].sms_opt_out || false;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to check opt-out status:', error);
      return false; // Default to opted in on error
    }
  }

  async handleOptOut(phoneNumber) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Update user's SMS opt-out status
      // Note: This still uses plain text for now as it's updating by phone number
      // In production, you might want to update by user ID instead
      const query = 'UPDATE users SET sms_opt_out = true WHERE phone_number = $1';
      
      const client = await database.getClient();
      try {
        await client.query(query, [formattedPhone]);
        
        logger.info('User opted out of SMS notifications', {
          phone: this.maskPhoneNumber(formattedPhone)
        });

        // Send confirmation SMS
        await this.twilioClient.messages.create({
          body: 'You have successfully opted out of Lockr SMS notifications. You will no longer receive SMS alerts.',
          from: this.fromNumber,
          to: formattedPhone
        });

        return { success: true };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to handle SMS opt-out:', error);
      throw error;
    }
  }

  async sendPhoneVerificationCode(userId, phoneNumber) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Generate 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification code in database
      const query = `
        UPDATE users 
        SET phone_verification_code = $1, 
            phone_verification_expires_at = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;
      
      const client = await database.getClient();
      try {
        await client.query(query, [verificationCode, expiresAt, userId]);
      } finally {
        client.release();
      }

      // Send SMS
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const message = `🔐 Lockrr: Your phone verification code is ${verificationCode}. This code expires in 10 minutes. Do not share this code. Reply STOP to opt out.`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Phone verification SMS sent successfully', {
        userId,
        phone: this.maskPhoneNumber(formattedPhone),
        messageSid: result.sid,
        expiresAt: expiresAt.toISOString()
      });

      return {
        success: true,
        messageSid: result.sid,
        recipient: this.maskPhoneNumber(formattedPhone),
        expiresAt: expiresAt.toISOString()
      };
    } catch (error) {
      logger.error('Failed to send phone verification SMS:', error);
      throw error;
    }
  }

  async verifyPhoneCode(userId, code) {
    try {
      const query = `
        SELECT 
          phone_verification_code, 
          phone_verification_expires_at,
          encrypted_phone_number,
          phone_number_iv,
          phone_number_salt,
          phone_number
        FROM users 
        WHERE id = $1
      `;
      
      const client = await database.getClient();
      try {
        const result = await client.query(query, [userId]);
        
        if (result.rows.length === 0) {
          return { valid: false, error: 'User not found' };
        }

        const user = result.rows[0];
        
        if (!user.phone_verification_code) {
          return { valid: false, error: 'No verification code found' };
        }

        if (new Date() > user.phone_verification_expires_at) {
          return { valid: false, error: 'Verification code expired' };
        }

        if (user.phone_verification_code !== code) {
          return { valid: false, error: 'Invalid verification code' };
        }

        // Mark phone as verified and clear verification code
        await client.query(`
          UPDATE users 
          SET phone_verified = TRUE,
              phone_verification_code = NULL,
              phone_verification_expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [userId]);

        // Decrypt phone number if encrypted
        let phoneNumber = user.phone_number;
        if (user.encrypted_phone_number && user.phone_number_iv && user.phone_number_salt) {
          if (systemEncryption.isAvailable()) {
            try {
              phoneNumber = systemEncryption.decryptPhoneNumber(
                user.encrypted_phone_number,
                user.phone_number_iv,
                user.phone_number_salt
              );
            } catch (decryptError) {
              logger.warn('Failed to decrypt phone number in verification', {
                userId,
                error: decryptError.message
              });
            }
          }
        }

        logger.info('Phone number verified successfully', {
          userId,
          phone: this.maskPhoneNumber(phoneNumber)
        });

        return { 
          valid: true, 
          phoneNumber: phoneNumber,
          verified: true 
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to verify phone code:', error);
      throw error;
    }
  }

  async sendOptInConfirmation(phoneNumber) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const message = `LOCKRR: You are now opted-in to receive security notifications and verification codes. For help, reply HELP. To opt-out, reply STOP. Message and data rates may apply.`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Opt-in confirmation SMS sent successfully', {
        phone: this.maskPhoneNumber(formattedPhone),
        messageSid: result.sid
      });

      return {
        success: true,
        messageSid: result.sid,
        recipient: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error('Failed to send opt-in confirmation SMS:', error);
      throw error;
    }
  }

  async sendOptOutConfirmation(phoneNumber) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const message = `You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Opt-out confirmation SMS sent successfully', {
        phone: this.maskPhoneNumber(formattedPhone),
        messageSid: result.sid
      });

      return {
        success: true,
        messageSid: result.sid,
        recipient: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error('Failed to send opt-out confirmation SMS:', error);
      throw error;
    }
  }

  async sendHelpMessage(phoneNumber) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const message = `Reply STOP to unsubscribe. Msg&Data Rates May Apply.`;

      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      logger.info('Help message SMS sent successfully', {
        phone: this.maskPhoneNumber(formattedPhone),
        messageSid: result.sid
      });

      return {
        success: true,
        messageSid: result.sid,
        recipient: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error('Failed to send help message SMS:', error);
      throw error;
    }
  }

  async close() {
    this.initialized = false;
  }
}

module.exports = SMSService;
