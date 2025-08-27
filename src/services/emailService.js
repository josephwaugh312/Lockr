const { Resend } = require('resend');
const database = require('../config/database');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.resend = null;
    this.initialized = false;
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@lockrr.app';
  }

  async initialize() {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY environment variable is required');
      }

      this.resend = new Resend(process.env.RESEND_API_KEY);
      
      this.initialized = true;
      logger.info('EmailService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize EmailService:', error);
      throw error;
    }
  }

  async getUserEmail(userId) {
    try {
      const query = 'SELECT email, name FROM users WHERE id = $1';
      
      const client = await database.getClient();
      try {
        const result = await client.query(query, [userId]);
        
        if (result.rows.length === 0) {
          throw new Error('User not found');
        }

        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get user email:', error);
      throw error;
    }
  }

  generateSecurityAlertTemplate(type, data = {}) {
    const templates = {
      new_device_login: {
        subject: 'New Device Login - Lockrr Security Alert',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #dc3545; margin: 0;">🔐 New Device Login</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>We detected a new device login to your Lockrr account:</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Login Details:</strong><br>
              📅 Time: ${data.loginTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              💻 Device: ${data.device || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <p>If this was you, you can safely ignore this email. If you don't recognize this activity, please:</p>
            
            <ul>
              <li>Change your master password immediately</li>
              <li>Review your account activity</li>
              <li>Enable two-factor authentication if not already enabled</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security alert from Lockrr. If you have questions, please contact our support team.
            </p>
          </div>
        `
      },

      multiple_failed_logins: {
        subject: 'Multiple Failed Login Attempts - Lockrr Security Alert',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #ffc107; color: #212529; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">⚠️ Multiple Failed Login Attempts</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>We detected multiple failed login attempts on your Lockrr account:</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Alert Details:</strong><br>
              📅 Time: ${data.timestamp || new Date().toLocaleString()}<br>
              🌐 IP Address: ${data.ip || 'Unknown'}<br>
              💻 Device: ${data.userAgent ? data.userAgent.substring(0, 50) + '...' : 'Unknown'}<br>
              🔢 Failed Attempts: ${data.attemptCount || 'Multiple'} attempts detected
            </div>
            
            <p>If this was you trying to log in, please:</p>
            
            <ul>
              <li>Double-check your password and try again</li>
              <li>Make sure Caps Lock is off</li>
              <li>Use the "Forgot Password" option if needed</li>
              <li>Contact support if you're still having trouble</li>
            </ul>
            
            <p><strong>If this wasn't you, please take immediate action:</strong></p>
            
            <ul>
              <li>Log in and change your account password immediately</li>
              <li>Enable two-factor authentication</li>
              <li>Review your account for any unauthorized changes</li>
              <li>Consider changing your master password as well</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/authentication/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Try Logging In</a>
              <a href="${process.env.FRONTEND_URL}/authentication/signin?redirect=settings" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Secure My Account</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security alert from Lockrr. If you have questions, please contact our support team.
            </p>
          </div>
        `
      },
      
      suspicious_login: {
        subject: 'Lockrr Security Notice - Login Activity Detected',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">⚠️ Suspicious Login Attempt</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p><strong>We detected unusual login activity on your Lockrr account.</strong></p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Activity Details:</strong><br>
              📅 Time: ${data.loginTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}<br>
              ℹ️ Reason: ${data.reason || 'Multiple failed login attempts'}<br>
              🔒 Status: Login prevented for security
            </div>
            
            <p><strong>If this was you:</strong></p>
            
            <ul>
              <li>Double-check your login credentials</li>
              <li>Make sure you're entering the correct 2FA code</li>
              <li>Verify your master password is correct</li>
              <li>Try logging in again</li>
            </ul>
            
            <p><strong>If this wasn't you, please review your account security:</strong></p>
            
            <ol>
              <li>Log in and change your account password</li>
              <li>Consider updating your master password</li>
              <li>Review all your stored passwords</li>
              <li>Enable two-factor authentication if not already enabled</li>
              <li>Check for any unauthorized changes to your account</li>
            </ol>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/authentication/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login to Account</a>
              <a href="${process.env.FRONTEND_URL}/authentication/signin?redirect=settings" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Secure My Account</a>
            </div>
            
            <p style="color: #dc3545; font-weight: bold;">
              If you did not attempt to log in, your account may be compromised. Please take action immediately.
            </p>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security alert from Lockr. If you have questions, please contact our support team.
            </p>
          </div>
        `
      },

      master_password_reset: {
        subject: 'Master Password Successfully Reset - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">✅ Master Password Reset Complete</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Your Lockrr master password has been successfully reset.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Reset Details:</strong><br>
              📅 Time: ${data.resetTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <p>Your account is now secure with your new master password. For additional security, we recommend:</p>
            
            <ul>
              <li>Enabling two-factor authentication</li>
              <li>Reviewing your stored passwords</li>
              <li>Using a strong, unique master password</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Access Your Dashboard</a>
            </div>
          </div>
        `
      },

      two_factor_enabled: {
        subject: 'Two-Factor Authentication Enabled - Lockrr Security Update',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🛡️ Two-Factor Authentication Enabled</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Great news! Two-factor authentication (2FA) has been successfully enabled on your Lockrr account.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Security Enhancement Details:</strong><br>
              📅 Enabled: ${data.enabledTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}<br>
              📱 Method: Authenticator App (TOTP)
            </div>
            
            <div style="background: #cce5ff; border: 1px solid #99ccff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0066cc;">🔐 Your Account is Now More Secure!</h3>
              <p style="margin-bottom: 0; color: #0066cc;">With 2FA enabled, even if someone gets your password, they won't be able to access your account without your authenticator app.</p>
            </div>
            
            <p><strong>Important Reminders:</strong></p>
            
            <ul>
              <li>📱 Keep your authenticator app secure and backed up</li>
              <li>💾 Save your backup codes in a safe place</li>
              <li>🔄 You'll now need both your password and 2FA code to log in</li>
              <li>⚠️ Don't lose access to your authenticator device</li>
            </ul>
            
            <p>If you didn't enable 2FA yourself, please contact our support team immediately.</p>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/settings" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Security Settings</a>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security notification from Lockrr. Your account security is our top priority.
            </p>
          </div>
        `
      },

      two_factor_disabled: {
        subject: 'Two-Factor Authentication Disabled - Lockrr Security Alert',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #ffc107; color: #212529; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">⚠️ Two-Factor Authentication Disabled</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Two-factor authentication (2FA) has been disabled on your Lockrr account.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Security Change Details:</strong><br>
              📅 Disabled: ${data.disabledTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #721c24;">🔓 Your Account Security Has Been Reduced</h3>
              <p style="margin-bottom: 0; color: #721c24;">Without 2FA, your account is now protected only by your password. We strongly recommend re-enabling 2FA for maximum security.</p>
            </div>
            
            <p><strong>Security Recommendations:</strong></p>
            
            <ul>
              <li>🔄 Consider re-enabling 2FA for better security</li>
              <li>🔐 Ensure you're using a strong, unique password</li>
              <li>👀 Monitor your account for any suspicious activity</li>
              <li>📧 Keep your email secure as it's now your primary recovery method</li>
            </ul>
            
            <p><strong>If you didn't disable 2FA yourself, this could indicate unauthorized access to your account. Please:</strong></p>
            
            <ul>
              <li>Change your password immediately</li>
              <li>Re-enable 2FA right away</li>
              <li>Review your account activity</li>
              <li>Contact our support team</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/settings" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Re-enable 2FA</a>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security notification from Lockrr. Your account security is our top priority.
            </p>
          </div>
        `
      },

      password_expiry_warning: {
        subject: 'Password Security Alert - Some Passwords Need Updating - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #ff9800; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🔐 Password Security Alert</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Our security scan has detected that some of your stored passwords are old and should be updated for better security.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Password Health Summary:</strong><br>
              📊 Total Passwords: ${data.totalPasswords || 'Multiple'}<br>
              ⚠️ Passwords Needing Update: ${data.totalExpired || data.totalCritical || data.totalWarning || data.count || 'Several'}<br>
              📅 Last Check: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : new Date().toLocaleString()}<br>
              🎯 Recommended Action: Update old passwords<br>
              📈 Severity: ${data.severity ? data.severity.charAt(0).toUpperCase() + data.severity.slice(1) : 'Warning'}
            </div>
            
            ${data.passwords && data.passwords.length > 0 ? `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Passwords That Need Updating:</h3>
              <ul style="margin-bottom: 0;">
                ${data.passwords.map(pwd => `
                  <li>${pwd.website || pwd.name || pwd.title} - Last updated: ${pwd.lastUpdated || pwd.updatedAt || 'Unknown'}</li>
                `).join('')}
                ${data.count > data.passwords.length ? `<li><em>...and ${data.count - data.passwords.length} more</em></li>` : ''}
              </ul>
            </div>
            ` : ''}
            
            ${data.message ? `
            <div style="background: #e7f3ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0066cc;"><strong>Alert:</strong> ${data.message}</p>
            </div>
            ` : ''}
            
            <p><strong>Why Update Old Passwords?</strong></p>
            
            <ul>
              <li>🛡️ Reduces risk from potential data breaches</li>
              <li>🔒 Ensures maximum account security</li>
              <li>📈 Improves your overall security score</li>
              <li>⚡ Keeps up with modern security standards</li>
            </ul>
            
            <p><strong>Security Best Practices:</strong></p>
            
            <ul>
              <li>Update passwords every 6-12 months</li>
              <li>Use unique passwords for each account</li>
              <li>Enable two-factor authentication where possible</li>
              <li>Use Lockrr's password generator for strong passwords</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Update Passwords</a>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Generate New Passwords</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security reminder from Lockrr. Regular password updates help keep your accounts secure.
            </p>
          </div>
        `
      },

      data_breach_alert: {
        subject: '🚨 URGENT: Data Breach Alert - Your Accounts May Be Compromised - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🚨 URGENT: Data Breach Alert</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p style="color: #dc3545; font-weight: bold;">We've detected that your email address appears in ${data.breachesFound || 'recent'} data breach${data.breachesFound > 1 ? 'es' : ''}.</p>
            
            <div style="background: #f8d7da; border: 2px solid #dc3545; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #721c24;">⚠️ IMMEDIATE ACTION REQUIRED</h3>
              <p style="color: #721c24; margin-bottom: 10px;"><strong>Your accounts may be compromised. Take action now to protect yourself.</strong></p>
              <div style="color: #721c24;">
                📧 Email Found In: ${data.breachesFound || 'Multiple'} breach${data.breachesFound > 1 ? 'es' : ''}<br>
                📅 Most Recent: ${data.mostRecentBreach || 'Recent breach'}<br>
                🔍 Data Exposed: ${data.dataTypes || 'Email addresses, passwords, personal information'}
              </div>
            </div>
            
            ${data.breaches && data.breaches.length > 0 ? `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #856404;">Affected Services:</h3>
              <ul style="margin-bottom: 0; color: #856404;">
                ${data.breaches.slice(0, 5).map(breach => `
                  <li><strong>${breach.name}</strong> - ${breach.date} (${breach.accounts?.toLocaleString() || 'Unknown'} accounts affected)</li>
                `).join('')}
                ${data.breaches.length > 5 ? `<li><em>...and ${data.breaches.length - 5} more</em></li>` : ''}
              </ul>
            </div>
            ` : ''}
            
            <p><strong>🚨 Take These Steps Immediately:</strong></p>
            
            <ol>
              <li><strong>Change passwords</strong> for all accounts using this email</li>
              <li><strong>Enable 2FA</strong> on all important accounts</li>
              <li><strong>Monitor accounts</strong> for suspicious activity</li>
              <li><strong>Check credit reports</strong> if financial data was exposed</li>
              <li><strong>Update Lockrr passwords</strong> for affected services</li>
            </ol>
            
            <p><strong>🛡️ How Lockrr Helps:</strong></p>
            
            <ul>
              <li>✅ Your Lockrr vault data is encrypted and secure</li>
              <li>🔍 We monitor breaches to alert you quickly</li>
              <li>🔐 Generate strong, unique passwords for each account</li>
              <li>📊 Track your security score and improvements</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Update Passwords Now</a>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Security Dashboard</a>
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c5460;"><strong>💡 Pro Tip:</strong> Use Lockrr's password generator to create unique, strong passwords for each account. This way, even if one service is breached, your other accounts remain secure.</p>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This alert is based on data from Have I Been Pwned and other breach monitoring services. Lockrr continuously monitors for new breaches to keep you informed.
            </p>
          </div>
        `
      },

      account_lockout: {
        subject: '🔒 URGENT: Account Temporarily Locked - Lockrr Security Alert',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🔒 Account Temporarily Locked</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p style="color: #dc3545; font-weight: bold;">Your Lockrr account has been temporarily locked due to security concerns.</p>
            
            <div style="background: #f8d7da; border: 2px solid #dc3545; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #721c24;">🚨 ACCOUNT LOCKED</h3>
              <p style="color: #721c24; margin-bottom: 10px;"><strong>Your account is temporarily inaccessible for security reasons.</strong></p>
              <div style="color: #721c24;">
                🔒 Reason: ${data.reason || 'Multiple failed login attempts detected'}<br>
                📅 Locked At: ${data.lockedAt || new Date().toLocaleString()}<br>
                ⏰ Lock Duration: ${data.lockDuration || '30 minutes'}<br>
                🌐 IP Address: ${data.ipAddress || 'Unknown'}
              </div>
            </div>
            
            <p><strong>Why was my account locked?</strong></p>
            
            <ul>
              <li>🚫 Multiple failed login attempts were detected</li>
              <li>🛡️ This is an automatic security measure to protect your account</li>
              <li>🔐 It prevents unauthorized access attempts</li>
              <li>⚡ Your account data remains secure and encrypted</li>
            </ul>
            
            <p><strong>What happens next?</strong></p>
            
            <ol>
              <li><strong>Wait for automatic unlock</strong> - Your account will be automatically unlocked after ${data.lockDuration || '30 minutes'}</li>
              <li><strong>Try logging in again</strong> - Use your correct credentials</li>
              <li><strong>Reset your password</strong> - If you've forgotten your password</li>
              <li><strong>Contact support</strong> - If you need immediate assistance</li>
            </ol>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #856404;">🔓 How to Unlock Your Account</h3>
              <p style="color: #856404; margin-bottom: 10px;">Your account will be automatically unlocked at:</p>
              <p style="color: #856404; font-weight: bold; font-size: 18px; margin: 0;">${data.unlockTime || 'In 30 minutes'}</p>
            </div>
            
            <p><strong>If this wasn't you:</strong></p>
            
            <ul>
              <li>🔐 Someone may be trying to access your account</li>
              <li>📧 Change your password immediately after unlock</li>
              <li>🛡️ Enable two-factor authentication</li>
              <li>📞 Contact our support team for assistance</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/auth/forgot-password" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Reset Password</a>
              <a href="mailto:support@lockr.app" style="background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Contact Support</a>
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c5460;"><strong>💡 Security Tip:</strong> To prevent future lockouts, make sure you're using the correct password and consider enabling two-factor authentication for added security.</p>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security alert from Lockrr. Account lockouts help protect your data from unauthorized access attempts.
            </p>
          </div>
        `
      },

      password_reset_requested: {
        subject: 'Password Reset Requested - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #ffc107; color: #212529; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🔑 Password Reset Requested</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>A password reset has been requested for your Lockrr account.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Request Details:</strong><br>
              📅 Time: ${data.requestTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <p>If you requested this reset, you should receive a separate email with reset instructions shortly. If you did not request this reset, please:</p>
            
            <ul>
              <li>Ignore this email</li>
              <li>Consider changing your password</li>
              <li>Enable two-factor authentication</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/authentication/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Go to Login</a>
              <a href="${process.env.FRONTEND_URL}/authentication/forgot-password" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            </div>
          </div>
        `
      },

      password_reset_link: {
        subject: 'Reset Your Lockrr Password - Action Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🔑 Reset Your Password</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>You requested a password reset for your Lockrr account. Click the button below to create a new password:</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Request Details:</strong><br>
              📅 Requested: ${data.requestTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <p style="margin-bottom: 20px; font-size: 16px;">Click the button below to reset your password:</p>
              <a href="${data.resetLink}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset My Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 14px;">
              ${data.resetLink}
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Important:</strong> This password reset link will expire in 15 minutes for security reasons.</p>
            </div>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #721c24;"><strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email and consider enabling two-factor authentication for added security.</p>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
              Need help? Contact our support team at support@lockrr.app
            </p>
          </div>
        `
      },

      master_password_reset_requested: {
        subject: '🚨 CRITICAL: Master Password Reset Requested - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🚨 CRITICAL: Master Password Reset Requested</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p><strong>A master password reset has been requested for your Lockrr account.</strong></p>
            
            <div style="background: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #721c24;">⚠️ CRITICAL WARNING</h3>
              <p style="color: #721c24; font-weight: bold; margin-bottom: 10px;">Resetting your master password will PERMANENTLY DELETE ALL your vault data!</p>
              <ul style="color: #721c24; margin-bottom: 0;">
                <li>🗑️ All stored passwords will be deleted</li>
                <li>🗑️ All secure notes will be deleted</li>
                <li>🗑️ All vault entries will be deleted</li>
                <li>❌ This action CANNOT be undone</li>
              </ul>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Request Details:</strong><br>
              📅 Time: ${data.requestTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <p><strong>If you requested this reset:</strong></p>
            <ul>
              <li>Click the button below to proceed with the reset</li>
              <li>You will need to confirm that you understand all data will be deleted</li>
              <li>After reset, you'll start with an empty vault</li>
            </ul>
            
            <p><strong>If you did NOT request this reset:</strong></p>
            <ul>
              <li>Do NOT click the reset button</li>
              <li>Change your account password immediately</li>
              <li>Enable two-factor authentication</li>
              <li>Contact support if you're concerned</li>
            </ul>
            
            <div style="margin: 30px 0; text-align: center;">
              <a href="${data.resetLink || `${process.env.FRONTEND_URL}/auth/reset-master-password`}" style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">⚠️ Reset Master Password (DELETES ALL DATA)</a>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Cancel - Go to Dashboard</a>
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c5460;"><strong>💡 Alternative:</strong> If you remember your master password, you can change it safely from your security settings without losing any data.</p>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is a critical security notification from Lockrr. Master password resets permanently delete all vault data for security reasons.
            </p>
          </div>
        `
      },

      password_reset_completed: {
        subject: 'Password Reset Successful - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">✅ Password Reset Successful</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Your Lockrr account password has been successfully reset and updated.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Reset Confirmation:</strong><br>
              📅 Completed: ${data.resetTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}<br>
              🔐 Status: Password successfully updated
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0c5460;">🔒 Your Account is Now Secure</h3>
              <p style="margin-bottom: 0; color: #0c5460;">You can now log in with your new password. Your vault data and stored passwords remain safe and encrypted.</p>
            </div>
            
            <p><strong>Security Recommendations:</strong></p>
            
            <ul>
              <li>🛡️ Enable two-factor authentication for extra security</li>
              <li>🔐 Use a strong, unique password for your account</li>
              <li>📱 Consider updating your master password if needed</li>
              <li>👀 Review your account activity regularly</li>
            </ul>
            
            <p><strong>If you didn't reset your password:</strong></p>
            
            <ul>
              <li>🚨 Someone may have unauthorized access to your account</li>
              <li>🔄 Change your password again immediately</li>
              <li>🛡️ Enable two-factor authentication right away</li>
              <li>📞 Contact our support team for assistance</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/authentication/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login to Account</a>
              <a href="${process.env.FRONTEND_URL}/settings/security" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Security Settings</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security confirmation from Lockrr. If you have questions, please contact our support team.
            </p>
          </div>
        `
      }
    };

    return templates[type] || {
      subject: 'Security Alert - Lockrr',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Security Alert</h2>
          <p>Hello ${data.firstName || 'there'},</p>
          <p>We wanted to notify you about recent activity on your Lockrr account.</p>
          <p>If you have any concerns, please contact our support team.</p>
        </div>
      `
    };
  }

  generateAccountNotificationTemplate(type, data = {}) {
    const templates = {
      email_verification: {
        subject: 'Verify Your Email Address - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">📧 Verify Your Email Address</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Thank you for creating your Lockrr account! To complete your registration and secure your account, please verify your email address.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <p style="margin-bottom: 20px; font-size: 16px;">Click the button below to verify your email:</p>
              <a href="${data.verificationLink}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 14px;">
              ${data.verificationLink}
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
            </div>
            
            <p>If you didn't create a Lockrr account, you can safely ignore this email.</p>
            
            <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
              Need help? Contact our support team at support@lockrr.app
            </p>
          </div>
        `
      },

      email_verified: {
        subject: 'Email Verified Successfully - Welcome to Lockrr!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">✅ Email Verified Successfully!</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Congratulations! Your email address has been successfully verified. Your Lockrr account is now fully activated and ready to use.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #155724;">🎉 What's Next?</h3>
              <ul style="color: #155724; margin-bottom: 0;">
                <li>🔐 Add your first password to your vault</li>
                <li>🛡️ Enable two-factor authentication for extra security</li>
                <li>📱 Download our browser extension</li>
                <li>⚙️ Customize your security settings</li>
              </ul>
            </div>
            
            <div style="margin: 30px 0; text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">Go to Dashboard</a>
              <a href="${process.env.FRONTEND_URL}/settings" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Security Settings</a>
            </div>
            
            <p>Welcome to Lockrr! We're excited to help you secure your digital life.</p>
          </div>
        `
      },

      welcome: {
        subject: 'Welcome to Lockrr - Your Password Manager',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🎉 Welcome to Lockrr!</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Welcome to Lockrr! Your account has been successfully created and you're ready to start securing your digital life.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Getting Started:</h3>
              <ul>
                <li>🔐 Add your first password</li>
                <li>🛡️ Enable two-factor authentication</li>
                <li>📱 Install our browser extension</li>
                <li>⚙️ Customize your security settings</li>
              </ul>
            </div>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Get Started</a>
              <a href="${process.env.FRONTEND_URL}/settings" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Security Settings</a>
            </div>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
        `
      },

      password_reset_requested: {
        subject: 'Password Reset Requested - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #ffc107; color: #212529; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🔑 Password Reset Requested</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>A password reset has been requested for your Lockrr account.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Request Details:</strong><br>
              📅 Time: ${data.requestTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <p>If you requested this reset, you should receive a separate email with reset instructions shortly. If you did not request this reset, please:</p>
            
            <ul>
              <li>Ignore this email</li>
              <li>Consider changing your password</li>
              <li>Enable two-factor authentication</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/authentication/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Go to Login</a>
              <a href="${process.env.FRONTEND_URL}/authentication/forgot-password" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            </div>
          </div>
        `
      },

      password_reset_link: {
        subject: 'Reset Your Lockrr Password - Action Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #007bff; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🔑 Reset Your Password</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>You requested a password reset for your Lockrr account. Click the button below to create a new password:</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Request Details:</strong><br>
              📅 Requested: ${data.requestTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <p style="margin-bottom: 20px; font-size: 16px;">Click the button below to reset your password:</p>
              <a href="${data.resetLink}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset My Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 14px;">
              ${data.resetLink}
            </p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Important:</strong> This password reset link will expire in 15 minutes for security reasons.</p>
            </div>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #721c24;"><strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email and consider enabling two-factor authentication for added security.</p>
            </div>
            
            <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
              Need help? Contact our support team at support@lockrr.app
            </p>
          </div>
        `
      },

      master_password_reset_requested: {
        subject: '🚨 CRITICAL: Master Password Reset Requested - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🚨 CRITICAL: Master Password Reset Requested</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p><strong>A master password reset has been requested for your Lockrr account.</strong></p>
            
            <div style="background: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #721c24;">⚠️ CRITICAL WARNING</h3>
              <p style="color: #721c24; font-weight: bold; margin-bottom: 10px;">Resetting your master password will PERMANENTLY DELETE ALL your vault data!</p>
              <ul style="color: #721c24; margin-bottom: 0;">
                <li>🗑️ All stored passwords will be deleted</li>
                <li>🗑️ All secure notes will be deleted</li>
                <li>🗑️ All vault entries will be deleted</li>
                <li>❌ This action CANNOT be undone</li>
              </ul>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Request Details:</strong><br>
              📅 Time: ${data.requestTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}
            </div>
            
            <p><strong>If you requested this reset:</strong></p>
            <ul>
              <li>Click the button below to proceed with the reset</li>
              <li>You will need to confirm that you understand all data will be deleted</li>
              <li>After reset, you'll start with an empty vault</li>
            </ul>
            
            <p><strong>If you did NOT request this reset:</strong></p>
            <ul>
              <li>Do NOT click the reset button</li>
              <li>Change your account password immediately</li>
              <li>Enable two-factor authentication</li>
              <li>Contact support if you're concerned</li>
            </ul>
            
            <div style="margin: 30px 0; text-align: center;">
              <a href="${data.resetLink || `${process.env.FRONTEND_URL}/auth/reset-master-password`}" style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">⚠️ Reset Master Password (DELETES ALL DATA)</a>
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Cancel - Go to Dashboard</a>
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #0c5460;"><strong>💡 Alternative:</strong> If you remember your master password, you can change it safely from your security settings without losing any data.</p>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is a critical security notification from Lockrr. Master password resets permanently delete all vault data for security reasons.
            </p>
          </div>
        `
      },

      password_reset_completed: {
        subject: 'Password Reset Successful - Lockrr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">✅ Password Reset Successful</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Your Lockrr account password has been successfully reset and updated.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Reset Confirmation:</strong><br>
              📅 Completed: ${data.resetTime || new Date().toLocaleString()}<br>
              🌍 Location: ${data.location || 'Unknown'}<br>
              🌐 IP Address: ${data.ipAddress || 'Unknown'}<br>
              🔐 Status: Password successfully updated
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0c5460;">🔒 Your Account is Now Secure</h3>
              <p style="margin-bottom: 0; color: #0c5460;">You can now log in with your new password. Your vault data and stored passwords remain safe and encrypted.</p>
            </div>
            
            <p><strong>Security Recommendations:</strong></p>
            
            <ul>
              <li>🛡️ Enable two-factor authentication for extra security</li>
              <li>🔐 Use a strong, unique password for your account</li>
              <li>📱 Consider updating your master password if needed</li>
              <li>👀 Review your account activity regularly</li>
            </ul>
            
            <p><strong>If you didn't reset your password:</strong></p>
            
            <ul>
              <li>🚨 Someone may have unauthorized access to your account</li>
              <li>🔄 Change your password again immediately</li>
              <li>🛡️ Enable two-factor authentication right away</li>
              <li>📞 Contact our support team for assistance</li>
            </ul>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/authentication/signin" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Login to Account</a>
              <a href="${process.env.FRONTEND_URL}/settings/security" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Security Settings</a>
            </div>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated security confirmation from Lockrr. If you have questions, please contact our support team.
            </p>
          </div>
        `
      }
    };

    return templates[type] || {
      subject: 'Account Notification - Lockr',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Account Notification</h2>
          <p>Hello ${data.firstName || 'there'},</p>
          <p>This is a notification about your Lockr account.</p>
        </div>
      `
    };
  }

  generateSystemNotificationTemplate(type, data = {}) {
    const templates = {
      system_maintenance: {
        subject: 'Scheduled Maintenance - Lockrr Service Update',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #ffc107; color: #212529; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🔧 Scheduled Maintenance Notice</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>We wanted to inform you about upcoming scheduled maintenance for the Lockrr service.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Maintenance Details:</strong><br>
              📅 Scheduled Date: ${data.scheduledDate || data.scheduledFor || 'To be announced'}<br>
              ⏰ Duration: ${data.duration || 'Approximately 2-4 hours'}<br>
              🌍 Affected Services: ${data.affectedServices || 'All Lockrr services'}<br>
              🔧 Maintenance Type: ${data.maintenanceType || 'System updates and improvements'}
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #0c5460;">📋 What to Expect</h3>
              <ul style="color: #0c5460; margin-bottom: 0;">
                <li>🚫 Temporary service interruption during maintenance window</li>
                <li>💾 Your vault data remains safe and encrypted</li>
                <li>🔄 Service will be restored automatically after completion</li>
                <li>📧 You'll receive a confirmation email when maintenance is complete</li>
              </ul>
            </div>
            
            <p><strong>What You Can Do:</strong></p>
            
            <ul>
              <li>📱 Ensure you have offline access to critical passwords if needed</li>
              <li>💾 Your data is automatically backed up and secure</li>
              <li>⏰ Plan any password management tasks before or after the maintenance window</li>
              <li>📞 Contact support if you have urgent needs during this time</li>
            </ul>
            
            <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">🚀 Improvements Coming</h3>
              <p style="margin-bottom: 0; color: #495057;">This maintenance will bring ${data.improvements || 'performance improvements, security enhancements, and new features'} to make your Lockrr experience even better.</p>
            </div>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Go to Dashboard</a>
              <a href="mailto:support@lockrr.app" style="background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Contact Support</a>
            </div>
            
            <p>We apologize for any inconvenience and appreciate your patience as we work to improve the Lockrr service.</p>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated system notification from Lockrr. For questions about this maintenance, please contact our support team.
            </p>
          </div>
        `
      },

      system_update: {
        subject: 'New Features Available - Lockrr Update',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="margin: 0;">🚀 New Features Available!</h2>
            </div>
            
            <p>Hello ${data.firstName || 'there'},</p>
            
            <p>Great news! We've just released new features and improvements to make your Lockrr experience even better.</p>
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>Update Details:</strong><br>
              📅 Release Date: ${data.releaseDate || new Date().toLocaleDateString()}<br>
              🆕 Version: ${data.version || 'Latest'}<br>
              🎯 Update Type: ${data.updateType || 'Feature release and improvements'}
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0;">✨ What's New:</h3>
              <ul>
                ${data.features ? data.features.map(feature => `<li>${feature}</li>`).join('') : `
                  <li>🔐 Enhanced security features</li>
                  <li>⚡ Improved performance</li>
                  <li>🎨 Better user interface</li>
                  <li>🐛 Bug fixes and stability improvements</li>
                `}
              </ul>
            </div>
            
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Explore New Features</a>
              <a href="${process.env.FRONTEND_URL}/help" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Learn More</a>
            </div>
            
            <p>Thank you for using Lockrr! We're constantly working to improve your password management experience.</p>
            
            <p style="color: #6c757d; font-size: 14px;">
              This is an automated update notification from Lockrr. You can manage your notification preferences in your account settings.
            </p>
          </div>
        `
      }
    };

    return templates[type] || {
      subject: 'System Notification - Lockrr',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>System Notification</h2>
          <p>Hello ${data.firstName || 'there'},</p>
          <p>This is a system notification from Lockrr.</p>
        </div>
      `
    };
  }

  async sendNotificationEmail({ userId, type, subtype, title, message, templateData = {} }) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const user = await this.getUserEmail(userId);
      const emailData = {
        firstName: user.name,
        ...templateData
      };

      let template;
      if (type === 'security') {
        template = this.generateSecurityAlertTemplate(subtype, emailData);
      } else if (type === 'account') {
        template = this.generateAccountNotificationTemplate(subtype, emailData);
      } else if (type === 'system') {
        template = this.generateSystemNotificationTemplate(subtype, emailData);
      } else {
        template = {
          subject: title || 'Notification from Lockrr',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>${title}</h2>
              <p>Hello ${emailData.firstName || 'there'},</p>
              <p>${message}</p>
            </div>
          `
        };
      }

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: user.email,
        subject: template.subject,
        html: template.html
      });

      logger.info('Email notification sent successfully', {
        userId,
        email: user.email,
        type,
        subtype,
        emailId: result.id
      });

      return {
        success: true,
        emailId: result.id,
        recipient: user.email
      };
    } catch (error) {
      logger.error('Failed to send email notification:', error);
      throw error;
    }
  }

  async sendCustomEmail({ to, subject, html, text = null }) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        text
      });

      logger.info('Custom email sent successfully', {
        recipient: to,
        subject,
        emailId: result.id
      });

      return {
        success: true,
        emailId: result.id,
        recipient: to
      };
    } catch (error) {
      logger.error('Failed to send custom email:', error);
      throw error;
    }
  }

  async sendVerificationEmail(email, firstName, token) {
    logger.info('[DEBUG] sendVerificationEmail called', { email, firstName, tokenPreview: token?.substring(0, 8) + '...' });
    try {
      if (!this.initialized) {
        logger.info('[DEBUG] EmailService not initialized, initializing now');
        await this.initialize();
      }

      const verificationLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
      logger.info('[DEBUG] Verification link constructed', { verificationLink, frontendUrl: process.env.FRONTEND_URL });
      
      const template = this.generateAccountNotificationTemplate('email_verification', {
        firstName,
        verificationLink
      });

      logger.info('[DEBUG] Template generated', { 
        hasTemplate: !!template,
        subject: template?.subject,
        htmlLength: template?.html?.length 
      });
      
      logger.info('[DEBUG] Calling Resend API', { from: this.fromEmail, to: email });
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject: template.subject,
        html: template.html
      });
      logger.info('[DEBUG] Resend API call successful', { emailId: result.id });

      logger.info('Verification email sent successfully', {
        email,
        emailId: result.id
      });

      return {
        success: true,
        emailId: result.id,
        recipient: email
      };
    } catch (error) {
      logger.error('[DEBUG] Failed to send verification email - Full Error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        response: error.response?.data,
        statusCode: error.response?.status
      });
      throw error;
    }
  }

  async close() {
    this.initialized = false;
  }
}

module.exports = EmailService;
