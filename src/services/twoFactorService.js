const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const argon2 = require('argon2');
const { logger } = require('../utils/logger');

/**
 * Two-Factor Authentication Service
 * Handles TOTP generation, verification, and backup codes
 */
class TwoFactorService {
  constructor() {
    this.appName = 'Lockr Password Manager';
    this.issuer = 'Lockr';
  }

  /**
   * Generate a new TOTP secret for a user
   * @param {string} userEmail - User's email address
   * @returns {Object} - Contains secret, QR code URL, and manual entry key
   */
  async generateSecret(userEmail) {
    try {
      // Generate a base32 secret
      const secret = speakeasy.generateSecret({
        name: `${this.appName} (${userEmail})`,
        issuer: this.issuer,
        length: 32 // 32 bytes = 256 bits for strong security
      });

      // Generate QR code as data URL
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      logger.info('2FA secret generated', {
        userEmail,
        secretLength: secret.base32.length
      });

      return {
        secret: secret.base32,
        qrCodeUrl,
        manualEntryKey: secret.base32,
        otpauthUrl: secret.otpauth_url
      };
    } catch (error) {
      logger.error('Failed to generate 2FA secret', {
        userEmail,
        error: error.message
      });
      throw new Error('Failed to generate 2FA secret');
    }
  }

  /**
   * Verify a TOTP token against a secret
   * @param {string} token - 6-digit TOTP token
   * @param {string} secret - Base32 encoded secret
   * @param {number} window - Time window for verification (default: 2)
   * @returns {boolean} - Whether the token is valid
   */
  verifyToken(token, secret, window = 2) {
    try {
      // Remove any spaces or formatting from token
      const cleanToken = token.replace(/\s/g, '');

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: cleanToken,
        window, // Allow 2 time steps before/after (±60 seconds)
        time: Math.floor(Date.now() / 1000) // Current Unix timestamp
      });

      logger.info('2FA token verification attempt', {
        success: verified,
        tokenLength: cleanToken.length,
        window
      });

      return verified;
    } catch (error) {
      logger.error('2FA token verification failed', {
        error: error.message,
        tokenLength: token?.length
      });
      return false;
    }
  }

  /**
   * Generate backup codes for account recovery
   * @param {number} count - Number of backup codes to generate (default: 10)
   * @returns {Object} - Contains plain codes and hashed codes
   */
  async generateBackupCodes(count = 10) {
    try {
      const codes = [];
      const hashedCodes = [];

      for (let i = 0; i < count; i++) {
        // Generate 8-digit backup code
        const code = crypto.randomInt(10000000, 99999999).toString();
        codes.push(code);

        // Hash the code for secure storage
        const hashedCode = await argon2.hash(code, {
          type: argon2.argon2id,
          memoryCost: 2048,
          timeCost: 2,
          parallelism: 1,
        });
        hashedCodes.push(hashedCode);
      }

      logger.info('Backup codes generated', {
        count,
        hashedCount: hashedCodes.length
      });

      return {
        plainCodes: codes,
        hashedCodes
      };
    } catch (error) {
      logger.error('Failed to generate backup codes', {
        error: error.message,
        count
      });
      throw new Error('Failed to generate backup codes');
    }
  }

  /**
   * Verify a backup code
   * @param {string} inputCode - User-provided backup code
   * @param {string[]} hashedCodes - Array of hashed backup codes
   * @returns {Object} - Contains verification result and used code index
   */
  async verifyBackupCode(inputCode, hashedCodes) {
    try {
      const cleanCode = inputCode.replace(/\s/g, '');

      for (let i = 0; i < hashedCodes.length; i++) {
        const isValid = await argon2.verify(hashedCodes[i], cleanCode);
        if (isValid) {
          logger.info('Backup code verified successfully', {
            codeIndex: i,
            totalCodes: hashedCodes.length
          });

          return {
            valid: true,
            usedIndex: i
          };
        }
      }

      logger.warn('Backup code verification failed', {
        codeLength: cleanCode.length,
        totalCodes: hashedCodes.length
      });

      return {
        valid: false,
        usedIndex: -1
      };
    } catch (error) {
      logger.error('Backup code verification error', {
        error: error.message
      });
      return {
        valid: false,
        usedIndex: -1
      };
    }
  }

  /**
   * Remove a used backup code from the array
   * @param {string[]} hashedCodes - Array of hashed backup codes
   * @param {number} usedIndex - Index of the used code to remove
   * @returns {string[]} - Updated array without the used code
   */
  removeUsedBackupCode(hashedCodes, usedIndex) {
    if (usedIndex >= 0 && usedIndex < hashedCodes.length) {
      const updatedCodes = [...hashedCodes];
      updatedCodes.splice(usedIndex, 1);

      logger.info('Backup code removed after use', {
        removedIndex: usedIndex,
        remainingCodes: updatedCodes.length
      });

      return updatedCodes;
    }

    return hashedCodes;
  }

  /**
   * Get current TOTP token for testing/debugging
   * @param {string} secret - Base32 encoded secret
   * @returns {string} - Current 6-digit TOTP token
   */
  getCurrentToken(secret) {
    try {
      return speakeasy.totp({
        secret,
        encoding: 'base32'
      });
    } catch (error) {
      logger.error('Failed to generate current token', {
        error: error.message
      });
      throw new Error('Failed to generate current token');
    }
  }

  /**
   * Validate secret format
   * @param {string} secret - Base32 secret to validate
   * @returns {boolean} - Whether the secret is valid
   */
  isValidSecret(secret) {
    try {
      // Check if it's a valid base32 string
      const base32Regex = /^[A-Z2-7]+=*$/;
      return typeof secret === 'string' && 
             secret.length >= 16 && 
             base32Regex.test(secret);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get 2FA setup instructions
   * @returns {Object} - Setup instructions and supported apps
   */
  getSetupInstructions() {
    return {
      steps: [
        'Download a compatible authenticator app',
        'Scan the QR code or enter the manual key',
        'Enter the 6-digit code from your app to verify',
        'Save your backup codes in a secure location'
      ],
      supportedApps: [
        'Google Authenticator',
        'Microsoft Authenticator',
        'Authy',
        '1Password',
        'Bitwarden',
        'LastPass Authenticator'
      ],
      securityTips: [
        'Never share your QR code or manual entry key',
        'Store backup codes securely and separately from your device',
        'Use backup codes only when you cannot access your authenticator app',
        'Each backup code can only be used once'
      ]
    };
  }
}

module.exports = TwoFactorService; 