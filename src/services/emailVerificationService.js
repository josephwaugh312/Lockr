const crypto = require('crypto');
const { logger } = require('../utils/logger');
const userRepository = require('../models/userRepository');
const EmailService = require('./emailService');
const notificationService = require('./notificationService');
const { NOTIFICATION_SUBTYPES } = require('./notificationService');

class EmailVerificationService {
  constructor() {
    this.emailService = new EmailService();
    this.tokenExpiryHours = 24; // 24 hours
  }

  /**
   * Generate a secure verification token
   * @returns {string} Verification token
   */
  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send email verification email
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @param {string} firstName - User first name
   * @returns {Promise<Object>} Result of sending verification email
   */
  async sendVerificationEmail(userId, email, firstName = null) {
    try {
      // Generate verification token
      const token = this.generateVerificationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.tokenExpiryHours);

      // Save token to database
      await userRepository.updateEmailVerificationToken(userId, token, expiresAt);

      // Create verification link
      const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;

      // Send verification email
      const emailResult = await this.emailService.sendNotificationEmail({
        userId,
        type: 'account',
        subtype: 'email_verification',
        title: 'Verify Your Email Address - Lockr',
        message: 'Please verify your email address to complete your registration.',
        templateData: {
          firstName,
          verificationLink,
          expiresIn: `${this.tokenExpiryHours} hours`
        }
      });

      logger.info('Email verification sent', {
        userId,
        email: email.substring(0, 3) + '***',
        emailId: emailResult.emailId,
        expiresAt: expiresAt.toISOString()
      });

      return {
        success: true,
        message: 'Verification email sent successfully',
        emailId: emailResult.emailId,
        expiresAt: expiresAt.toISOString()
      };

    } catch (error) {
      logger.error('Failed to send verification email', {
        error: error.message,
        userId,
        email: email.substring(0, 3) + '***'
      });
      throw error;
    }
  }

  /**
   * Verify email with token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Verification result
   */
  async verifyEmail(token) {
    try {
      if (!token) {
        throw new Error('Verification token is required');
      }

      // Find user by verification token
      const user = await userRepository.findByEmailVerificationToken(token);
      
      if (!user) {
        throw new Error('Invalid or expired verification token');
      }

      // Check if token is expired
      const now = new Date();
      if (user.email_verification_expires_at && now > new Date(user.email_verification_expires_at)) {
        throw new Error('Verification token has expired');
      }

      // Check if email is already verified
      if (user.email_verified) {
        return {
          success: true,
          message: 'Email is already verified',
          alreadyVerified: true
        };
      }

      // Mark email as verified and clear verification token
      await userRepository.markEmailAsVerified(user.id);

      // Send email verified notification
      try {
        await notificationService.sendAccountNotification(user.id, NOTIFICATION_SUBTYPES.EMAIL_VERIFIED, {
          templateData: {
            timestamp: new Date().toISOString()
          }
        });
      } catch (notificationError) {
        logger.error('Failed to send email verified notification', {
          error: notificationError.message,
          userId: user.id
        });
        // Don't fail the verification if notification fails
      }

      // Send welcome notification (now that email is verified)
      try {
        await notificationService.sendAccountNotification(user.id, NOTIFICATION_SUBTYPES.WELCOME, {
          templateData: {
            email: user.email,
            firstName: user.name
          }
        });
      } catch (notificationError) {
        logger.error('Failed to send welcome notification', {
          error: notificationError.message,
          userId: user.id
        });
        // Don't fail the verification if notification fails
      }

      // Send welcome email (instead of email verified confirmation)
      try {
        await this.emailService.sendNotificationEmail({
          userId: user.id,
          type: 'account',
          subtype: 'welcome',
          title: 'Welcome to Lockr - Your Password Manager',
          message: 'Welcome to Lockr! Your account is now fully activated.',
          templateData: {
            firstName: user.name
          }
        });
      } catch (emailError) {
        logger.error('Failed to send welcome email', {
          error: emailError.message,
          userId: user.id
        });
        // Don't fail the verification if email fails
      }

      logger.info('Email verified successfully', {
        userId: user.id,
        email: user.email.substring(0, 3) + '***'
      });

      return {
        success: true,
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: true
        }
      };

    } catch (error) {
      logger.error('Email verification failed', {
        error: error.message,
        token: token ? token.substring(0, 8) + '***' : 'null'
      });
      throw error;
    }
  }

  /**
   * Resend verification email
   * @param {string} email - User email
   * @returns {Promise<Object>} Result of resending verification email
   */
  async resendVerificationEmail(email) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      // Find user by email
      const user = await userRepository.findByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists for security
        return {
          success: true,
          message: 'If an account with this email exists and is not verified, a verification email has been sent.'
        };
      }

      // Check if email is already verified
      if (user.email_verified) {
        return {
          success: true,
          message: 'Email is already verified',
          alreadyVerified: true
        };
      }

      // Check rate limiting (don't send more than once every 5 minutes)
      if (user.email_verification_sent_at) {
        const lastSent = new Date(user.email_verification_sent_at);
        const now = new Date();
        const minutesSinceLastSent = (now - lastSent) / (1000 * 60);
        
        if (minutesSinceLastSent < 5) {
          throw new Error('Please wait at least 5 minutes before requesting another verification email');
        }
      }

      // Send verification email
      const result = await this.sendVerificationEmail(user.id, user.email, user.name);

      return {
        success: true,
        message: 'Verification email sent successfully',
        ...result
      };

    } catch (error) {
      logger.error('Failed to resend verification email', {
        error: error.message,
        email: email.substring(0, 3) + '***'
      });
      throw error;
    }
  }

  /**
   * Check if user's email is verified
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether email is verified
   */
  async isEmailVerified(userId) {
    try {
      const user = await userRepository.findById(userId);
      return user ? user.email_verified : false;
    } catch (error) {
      logger.error('Failed to check email verification status', {
        error: error.message,
        userId
      });
      return false;
    }
  }
}

module.exports = new EmailVerificationService(); 