const crypto = require('crypto');
const { logger } = require('../utils/logger');

class PrivacyService {
  constructor() {
    this.hashAlgorithm = 'sha256';
    this.saltLength = 32; // 256 bits for salt
  }

  /**
   * Generate a random salt for privacy hashing
   * @returns {string} - Base64 encoded salt
   */
  generatePrivacySalt() {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      return salt.toString('base64');
    } catch (error) {
      logger.error('Failed to generate privacy salt', { error: error.message });
      throw new Error('Failed to generate privacy salt');
    }
  }

  /**
   * Hash IP address for privacy
   * @param {string} ipAddress - IP address to hash
   * @param {string} salt - Salt for hashing (optional, will generate if not provided)
   * @returns {object} - Hashed IP with salt
   */
  hashIPAddress(ipAddress, salt = null) {
    try {
      // Validate IP address format
      if (!ipAddress || !this.isValidIPAddress(ipAddress)) {
        throw new Error('Invalid IP address format');
      }

      // Generate salt if not provided
      const privacySalt = salt || this.generatePrivacySalt();
      
      // Create hash
      const hash = crypto.createHash(this.hashAlgorithm);
      hash.update(ipAddress + privacySalt);
      const hashedIP = hash.digest('hex');
      
      logger.info('IP address hashed for privacy', {
        ipLength: ipAddress.length,
        hashedLength: hashedIP.length
      });
      
      return {
        hashedIP,
        salt: privacySalt
      };
    } catch (error) {
      logger.error('Failed to hash IP address', { error: error.message });
      throw new Error('Failed to hash IP address');
    }
  }

  /**
   * Hash user agent for privacy
   * @param {string} userAgent - User agent string to hash
   * @param {string} salt - Salt for hashing (optional, will generate if not provided)
   * @returns {object} - Hashed user agent with salt
   */
  hashUserAgent(userAgent, salt = null) {
    try {
      // Validate user agent
      if (!userAgent || typeof userAgent !== 'string') {
        throw new Error('Invalid user agent');
      }

      // Generate salt if not provided
      const privacySalt = salt || this.generatePrivacySalt();
      
      // Create hash
      const hash = crypto.createHash(this.hashAlgorithm);
      hash.update(userAgent + privacySalt);
      const hashedUserAgent = hash.digest('hex');
      
      logger.info('User agent hashed for privacy', {
        userAgentLength: userAgent.length,
        hashedLength: hashedUserAgent.length
      });
      
      return {
        hashedUserAgent,
        salt: privacySalt
      };
    } catch (error) {
      logger.error('Failed to hash user agent', { error: error.message });
      throw new Error('Failed to hash user agent');
    }
  }

  /**
   * Validate IP address format
   * @param {string} ipAddress - IP address to validate
   * @returns {boolean} - True if valid IP address
   */
  isValidIPAddress(ipAddress) {
    // IPv4 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 validation (basic)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ipAddress) || ipv6Regex.test(ipAddress);
  }

  /**
   * Generate GDPR consent data
   * @param {string} version - Consent version
   * @param {object} consentData - Additional consent data
   * @returns {object} - GDPR consent information
   */
  generateGDPRConsent(version = '1.0', consentData = {}) {
    try {
      const consent = {
        version,
        timestamp: new Date().toISOString(),
        consentGiven: true,
        dataProcessing: true,
        dataRetention: true,
        marketingCommunications: consentData.marketingCommunications || false,
        thirdPartySharing: consentData.thirdPartySharing || false,
        dataPortability: true,
        dataDeletion: true,
        ...consentData
      };
      
      logger.info('GDPR consent generated', {
        version,
        timestamp: consent.timestamp
      });
      
      return consent;
    } catch (error) {
      logger.error('Failed to generate GDPR consent', { error: error.message });
      throw new Error('Failed to generate GDPR consent');
    }
  }

  /**
   * Calculate data retention expiry date
   * @param {string} retentionPolicy - Retention policy type
   * @returns {Date} - Expiry date
   */
  calculateRetentionExpiry(retentionPolicy = 'standard') {
    try {
      const now = new Date();
      let expiryDate;
      
      switch (retentionPolicy) {
        case 'minimal':
          // 7 days for minimal retention
          expiryDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
          break;
        case 'standard':
          // 30 days for standard retention
          expiryDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
          break;
        case 'extended':
          // 90 days for extended retention
          expiryDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
          break;
        default:
          // Default to standard retention
          expiryDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      }
      
      logger.info('Data retention expiry calculated', {
        retentionPolicy,
        expiryDate: expiryDate.toISOString()
      });
      
      return expiryDate;
    } catch (error) {
      logger.error('Failed to calculate retention expiry', { error: error.message });
      throw new Error('Failed to calculate retention expiry');
    }
  }

  /**
   * Schedule data deletion
   * @param {string} userId - User ID
   * @param {string} deletionReason - Reason for deletion
   * @returns {object} - Deletion schedule information
   */
  scheduleDataDeletion(userId, deletionReason = 'user_request') {
    try {
      const now = new Date();
      const deletionDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
      
      const deletionSchedule = {
        userId,
        deletionReason,
        requestedAt: now.toISOString(),
        scheduledFor: deletionDate.toISOString(),
        status: 'scheduled',
        dataTypes: [
          'personal_data',
          'notifications',
          'audit_logs',
          'reset_tokens'
        ]
      };
      
      logger.info('Data deletion scheduled', {
        userId,
        deletionReason,
        scheduledFor: deletionDate.toISOString()
      });
      
      return deletionSchedule;
    } catch (error) {
      logger.error('Failed to schedule data deletion', { error: error.message });
      throw new Error('Failed to schedule data deletion');
    }
  }

  /**
   * Anonymize sensitive data for GDPR compliance
   * @param {object} data - Data to anonymize
   * @returns {object} - Anonymized data
   */
  anonymizeData(data) {
    try {
      const anonymized = { ...data };
      
      // Remove or hash sensitive fields
      if (anonymized.email) {
        anonymized.email = this.hashEmail(anonymized.email);
      }
      
      if (anonymized.phoneNumber) {
        anonymized.phoneNumber = this.hashPhoneNumber(anonymized.phoneNumber);
      }
      
      if (anonymized.name) {
        anonymized.name = this.hashName(anonymized.name);
      }
      
      // Add anonymization metadata
      anonymized.anonymizedAt = new Date().toISOString();
      anonymized.anonymizationMethod = 'hash_based';
      
      logger.info('Data anonymized for GDPR compliance', {
        originalFields: Object.keys(data),
        anonymizedFields: Object.keys(anonymized)
      });
      
      return anonymized;
    } catch (error) {
      logger.error('Failed to anonymize data', { error: error.message });
      throw new Error('Failed to anonymize data');
    }
  }

  /**
   * Hash email address for anonymization
   * @param {string} email - Email to hash
   * @returns {string} - Hashed email
   */
  hashEmail(email) {
    const hash = crypto.createHash(this.hashAlgorithm);
    hash.update(email + this.generatePrivacySalt());
    return hash.digest('hex').substring(0, 16); // Return first 16 characters
  }

  /**
   * Hash phone number for anonymization
   * @param {string} phoneNumber - Phone number to hash
   * @returns {string} - Hashed phone number
   */
  hashPhoneNumber(phoneNumber) {
    const hash = crypto.createHash(this.hashAlgorithm);
    hash.update(phoneNumber + this.generatePrivacySalt());
    return hash.digest('hex').substring(0, 16); // Return first 16 characters
  }

  /**
   * Hash name for anonymization
   * @param {string} name - Name to hash
   * @returns {string} - Hashed name
   */
  hashName(name) {
    const hash = crypto.createHash(this.hashAlgorithm);
    hash.update(name + this.generatePrivacySalt());
    return hash.digest('hex').substring(0, 16); // Return first 16 characters
  }

  /**
   * Clear sensitive data from memory
   * @param {Buffer} buffer - Buffer to clear
   */
  clearMemory(buffer) {
    if (buffer && buffer.fill) {
      buffer.fill(0);
    }
  }
}

module.exports = PrivacyService; 