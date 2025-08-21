// Mock dependencies before importing the service
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    randomBytes: jest.fn(() => Buffer.from('mock-salt-data-32-bytes-for-test', 'utf8'))
  };
});

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import modules after mocks are set up
const PrivacyService = require('../../src/services/privacyService');
const crypto = require('crypto');
const { logger } = require('../../src/utils/logger');

describe('PrivacyService', () => {
  let privacyService;

  beforeEach(() => {
    jest.clearAllMocks();
    privacyService = new PrivacyService();
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(privacyService.hashAlgorithm).toBe('sha256');
      expect(privacyService.saltLength).toBe(32);
    });
  });

  describe('generatePrivacySalt', () => {
    it('should generate a base64 encoded salt', () => {
      const salt = privacyService.generatePrivacySalt();

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(salt).toBe(Buffer.from('mock-salt-data-32-bytes-for-test', 'utf8').toString('base64'));
      expect(typeof salt).toBe('string');
    });

    it('should handle crypto error and throw custom error', () => {
      crypto.randomBytes.mockImplementationOnce(() => {
        throw new Error('Crypto error');
      });

      expect(() => privacyService.generatePrivacySalt()).toThrow('Failed to generate privacy salt');
      expect(logger.error).toHaveBeenCalledWith('Failed to generate privacy salt', {
        error: 'Crypto error'
      });
    });
  });

  describe('hashIPAddress', () => {
    const validIPv4 = '192.168.1.1';
    const validIPv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';

    it('should hash valid IPv4 address with provided salt', () => {
      const salt = 'test-salt';
      const result = privacyService.hashIPAddress(validIPv4, salt);

      expect(result).toHaveProperty('hashedIP');
      expect(result).toHaveProperty('salt', salt);
      expect(typeof result.hashedIP).toBe('string');
      expect(result.hashedIP.length).toBe(64); // SHA256 hex length

      expect(logger.info).toHaveBeenCalledWith('IP address hashed for privacy', {
        ipLength: validIPv4.length,
        hashedLength: result.hashedIP.length
      });
    });

    it('should hash valid IPv4 address and generate salt if not provided', () => {
      const result = privacyService.hashIPAddress(validIPv4);

      expect(result).toHaveProperty('hashedIP');
      expect(result).toHaveProperty('salt');
      expect(typeof result.hashedIP).toBe('string');
      expect(typeof result.salt).toBe('string');
      expect(result.hashedIP.length).toBe(64);
    });

    it('should hash valid IPv6 address', () => {
      const result = privacyService.hashIPAddress(validIPv6);

      expect(result).toHaveProperty('hashedIP');
      expect(result).toHaveProperty('salt');
      expect(typeof result.hashedIP).toBe('string');
      expect(result.hashedIP.length).toBe(64);
    });

    it('should throw error for invalid IP address', () => {
      expect(() => privacyService.hashIPAddress('invalid-ip')).toThrow('Failed to hash IP address');
      expect(logger.error).toHaveBeenCalledWith('Failed to hash IP address', {
        error: 'Invalid IP address format'
      });
    });

    it('should throw error for empty IP address', () => {
      expect(() => privacyService.hashIPAddress('')).toThrow('Failed to hash IP address');
      expect(() => privacyService.hashIPAddress(null)).toThrow('Failed to hash IP address');
      expect(() => privacyService.hashIPAddress(undefined)).toThrow('Failed to hash IP address');
    });

    it('should produce different hashes for different IPs', () => {
      const salt = 'same-salt';
      const result1 = privacyService.hashIPAddress('192.168.1.1', salt);
      const result2 = privacyService.hashIPAddress('192.168.1.2', salt);

      expect(result1.hashedIP).not.toBe(result2.hashedIP);
      expect(result1.salt).toBe(result2.salt);
    });

    it('should produce different hashes for same IP with different salts', () => {
      const result1 = privacyService.hashIPAddress(validIPv4, 'salt1');
      const result2 = privacyService.hashIPAddress(validIPv4, 'salt2');

      expect(result1.hashedIP).not.toBe(result2.hashedIP);
    });
  });

  describe('hashUserAgent', () => {
    const validUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    it('should hash valid user agent with provided salt', () => {
      const salt = 'test-salt';
      const result = privacyService.hashUserAgent(validUserAgent, salt);

      expect(result).toHaveProperty('hashedUserAgent');
      expect(result).toHaveProperty('salt', salt);
      expect(typeof result.hashedUserAgent).toBe('string');
      expect(result.hashedUserAgent.length).toBe(64); // SHA256 hex length

      expect(logger.info).toHaveBeenCalledWith('User agent hashed for privacy', {
        userAgentLength: validUserAgent.length,
        hashedLength: result.hashedUserAgent.length
      });
    });

    it('should hash valid user agent and generate salt if not provided', () => {
      const result = privacyService.hashUserAgent(validUserAgent);

      expect(result).toHaveProperty('hashedUserAgent');
      expect(result).toHaveProperty('salt');
      expect(typeof result.hashedUserAgent).toBe('string');
      expect(typeof result.salt).toBe('string');
      expect(result.hashedUserAgent.length).toBe(64);
    });

    it('should throw error for invalid user agent', () => {
      expect(() => privacyService.hashUserAgent('')).toThrow('Failed to hash user agent');
      expect(() => privacyService.hashUserAgent(null)).toThrow('Failed to hash user agent');
      expect(() => privacyService.hashUserAgent(undefined)).toThrow('Failed to hash user agent');
      expect(() => privacyService.hashUserAgent(123)).toThrow('Failed to hash user agent');

      expect(logger.error).toHaveBeenCalledWith('Failed to hash user agent', {
        error: 'Invalid user agent'
      });
    });

    it('should produce different hashes for different user agents', () => {
      const salt = 'same-salt';
      const result1 = privacyService.hashUserAgent('Mozilla/5.0 Chrome', salt);
      const result2 = privacyService.hashUserAgent('Mozilla/5.0 Firefox', salt);

      expect(result1.hashedUserAgent).not.toBe(result2.hashedUserAgent);
      expect(result1.salt).toBe(result2.salt);
    });
  });

  describe('isValidIPAddress', () => {
    describe('IPv4 validation', () => {
      it('should validate correct IPv4 addresses', () => {
        expect(privacyService.isValidIPAddress('192.168.1.1')).toBe(true);
        expect(privacyService.isValidIPAddress('0.0.0.0')).toBe(true);
        expect(privacyService.isValidIPAddress('255.255.255.255')).toBe(true);
        expect(privacyService.isValidIPAddress('127.0.0.1')).toBe(true);
        expect(privacyService.isValidIPAddress('8.8.8.8')).toBe(true);
      });

      it('should reject invalid IPv4 addresses', () => {
        expect(privacyService.isValidIPAddress('256.1.1.1')).toBe(false);
        expect(privacyService.isValidIPAddress('192.168.1')).toBe(false);
        expect(privacyService.isValidIPAddress('192.168.1.1.1')).toBe(false);
        expect(privacyService.isValidIPAddress('')).toBe(false);
      });

      it('should accept IPv4 addresses with leading zeros', () => {
        expect(privacyService.isValidIPAddress('192.168.01.1')).toBe(true); // Leading zeros are valid
        expect(privacyService.isValidIPAddress('192.168.001.001')).toBe(true);
      });
    });

    describe('IPv6 validation', () => {
      it('should validate correct IPv6 addresses', () => {
        expect(privacyService.isValidIPAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
        expect(privacyService.isValidIPAddress('2001:db8:85a3:0:0:8a2e:370:7334')).toBe(true);
        expect(privacyService.isValidIPAddress('0000:0000:0000:0000:0000:0000:0000:0001')).toBe(true);
      });

      it('should reject invalid IPv6 addresses', () => {
        expect(privacyService.isValidIPAddress('2001:0db8:85a3::8a2e:0370:7334')).toBe(false); // Double colon shorthand
        expect(privacyService.isValidIPAddress('2001:0db8:85a3:0000:0000:8a2e:0370')).toBe(false); // Too short
        expect(privacyService.isValidIPAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra')).toBe(false); // Too long
      });
    });

    it('should reject non-IP strings', () => {
      expect(privacyService.isValidIPAddress('not-an-ip')).toBe(false);
      expect(privacyService.isValidIPAddress('localhost')).toBe(false);
      expect(privacyService.isValidIPAddress('example.com')).toBe(false);
    });
  });

  describe('generateGDPRConsent', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should generate GDPR consent with default values', () => {
      const consent = privacyService.generateGDPRConsent();

      expect(consent).toEqual({
        version: '1.0',
        timestamp: '2024-01-15T10:00:00.000Z',
        consentGiven: true,
        dataProcessing: true,
        dataRetention: true,
        marketingCommunications: false,
        thirdPartySharing: false,
        dataPortability: true,
        dataDeletion: true
      });

      expect(logger.info).toHaveBeenCalledWith('GDPR consent generated', {
        version: '1.0',
        timestamp: '2024-01-15T10:00:00.000Z'
      });
    });

    it('should generate GDPR consent with custom version', () => {
      const consent = privacyService.generateGDPRConsent('2.1');

      expect(consent.version).toBe('2.1');
      expect(consent.timestamp).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should merge custom consent data', () => {
      const customData = {
        marketingCommunications: true,
        thirdPartySharing: true,
        customField: 'custom-value'
      };

      const consent = privacyService.generateGDPRConsent('1.5', customData);

      expect(consent).toEqual({
        version: '1.5',
        timestamp: '2024-01-15T10:00:00.000Z',
        consentGiven: true,
        dataProcessing: true,
        dataRetention: true,
        marketingCommunications: true,
        thirdPartySharing: true,
        dataPortability: true,
        dataDeletion: true,
        customField: 'custom-value'
      });
    });

    it('should handle errors during consent generation', () => {
      // Force an error by mocking Date constructor to throw
      const originalDate = Date;
      global.Date = jest.fn(() => {
        throw new Error('Date error');
      });

      expect(() => privacyService.generateGDPRConsent()).toThrow('Failed to generate GDPR consent');
      expect(logger.error).toHaveBeenCalledWith('Failed to generate GDPR consent', {
        error: 'Date error'
      });

      // Restore Date
      global.Date = originalDate;
    });
  });

  describe('calculateRetentionExpiry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate minimal retention expiry (7 days)', () => {
      const expiry = privacyService.calculateRetentionExpiry('minimal');
      const expected = new Date('2024-01-22T10:00:00Z');

      expect(expiry).toEqual(expected);
      expect(logger.info).toHaveBeenCalledWith('Data retention expiry calculated', {
        retentionPolicy: 'minimal',
        expiryDate: expected.toISOString()
      });
    });

    it('should calculate standard retention expiry (30 days)', () => {
      const expiry = privacyService.calculateRetentionExpiry('standard');
      const expected = new Date('2024-02-14T10:00:00Z');

      expect(expiry).toEqual(expected);
    });

    it('should calculate standard retention expiry by default', () => {
      const expiry = privacyService.calculateRetentionExpiry();
      const expected = new Date('2024-02-14T10:00:00Z');

      expect(expiry).toEqual(expected);
    });

    it('should calculate extended retention expiry (90 days)', () => {
      const expiry = privacyService.calculateRetentionExpiry('extended');
      const expected = new Date('2024-04-14T10:00:00Z');

      expect(expiry).toEqual(expected);
    });

    it('should default to standard retention for unknown policy', () => {
      const expiry = privacyService.calculateRetentionExpiry('unknown-policy');
      const expected = new Date('2024-02-14T10:00:00Z');

      expect(expiry).toEqual(expected);
    });

    it('should handle errors during calculation', () => {
      // Force an error by mocking Date constructor
      const originalDate = Date;
      global.Date = jest.fn(() => {
        throw new Error('Date calculation error');
      });

      expect(() => privacyService.calculateRetentionExpiry()).toThrow('Failed to calculate retention expiry');
      expect(logger.error).toHaveBeenCalledWith('Failed to calculate retention expiry', {
        error: 'Date calculation error'
      });

      // Restore Date
      global.Date = originalDate;
    });
  });

  describe('scheduleDataDeletion', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule data deletion with default reason', () => {
      const schedule = privacyService.scheduleDataDeletion(mockUserId);

      expect(schedule).toEqual({
        userId: mockUserId,
        deletionReason: 'user_request',
        requestedAt: '2024-01-15T10:00:00.000Z',
        scheduledFor: '2024-02-14T10:00:00.000Z', // 30 days later
        status: 'scheduled',
        dataTypes: [
          'personal_data',
          'notifications',
          'audit_logs',
          'reset_tokens'
        ]
      });

      expect(logger.info).toHaveBeenCalledWith('Data deletion scheduled', {
        userId: mockUserId,
        deletionReason: 'user_request',
        scheduledFor: '2024-02-14T10:00:00.000Z'
      });
    });

    it('should schedule data deletion with custom reason', () => {
      const schedule = privacyService.scheduleDataDeletion(mockUserId, 'gdpr_compliance');

      expect(schedule.deletionReason).toBe('gdpr_compliance');
      expect(schedule.userId).toBe(mockUserId);
    });

    it('should handle errors during scheduling', () => {
      // Force an error by mocking Date constructor
      const originalDate = Date;
      global.Date = jest.fn(() => {
        throw new Error('Date scheduling error');
      });

      expect(() => privacyService.scheduleDataDeletion(mockUserId)).toThrow('Failed to schedule data deletion');
      expect(logger.error).toHaveBeenCalledWith('Failed to schedule data deletion', {
        error: 'Date scheduling error'
      });

      // Restore Date
      global.Date = originalDate;
    });
  });

  describe('anonymizeData', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should anonymize data with all sensitive fields', () => {
      const originalData = {
        email: 'user@example.com',
        phoneNumber: '+1234567890',
        name: 'John Doe',
        nonSensitive: 'keep-this'
      };

      const anonymized = privacyService.anonymizeData(originalData);

      expect(anonymized).toEqual({
        email: expect.any(String),
        phoneNumber: expect.any(String),
        name: expect.any(String),
        nonSensitive: 'keep-this',
        anonymizedAt: '2024-01-15T10:00:00.000Z',
        anonymizationMethod: 'hash_based'
      });

      expect(anonymized.email).not.toBe(originalData.email);
      expect(anonymized.phoneNumber).not.toBe(originalData.phoneNumber);
      expect(anonymized.name).not.toBe(originalData.name);
      expect(anonymized.nonSensitive).toBe(originalData.nonSensitive);

      expect(logger.info).toHaveBeenCalledWith('Data anonymized for GDPR compliance', {
        originalFields: ['email', 'phoneNumber', 'name', 'nonSensitive'],
        anonymizedFields: ['email', 'phoneNumber', 'name', 'nonSensitive', 'anonymizedAt', 'anonymizationMethod']
      });
    });

    it('should anonymize data with some sensitive fields', () => {
      const originalData = {
        email: 'user@example.com',
        otherField: 'value'
      };

      const anonymized = privacyService.anonymizeData(originalData);

      expect(anonymized.email).not.toBe(originalData.email);
      expect(anonymized.otherField).toBe(originalData.otherField);
      expect(anonymized.anonymizedAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should handle data without sensitive fields', () => {
      const originalData = {
        publicField: 'public-value',
        anotherField: 123
      };

      const anonymized = privacyService.anonymizeData(originalData);

      expect(anonymized).toEqual({
        publicField: 'public-value',
        anotherField: 123,
        anonymizedAt: '2024-01-15T10:00:00.000Z',
        anonymizationMethod: 'hash_based'
      });
    });

    it('should handle empty data object', () => {
      const anonymized = privacyService.anonymizeData({});

      expect(anonymized).toEqual({
        anonymizedAt: '2024-01-15T10:00:00.000Z',
        anonymizationMethod: 'hash_based'
      });
    });

    it('should handle errors during anonymization', () => {
      // Mock one of the hash methods to throw an error
      const spy = jest.spyOn(privacyService, 'hashEmail').mockImplementation(() => {
        throw new Error('Hash error');
      });

      const originalData = { email: 'test@example.com' };

      expect(() => privacyService.anonymizeData(originalData)).toThrow('Failed to anonymize data');
      expect(logger.error).toHaveBeenCalledWith('Failed to anonymize data', {
        error: 'Hash error'
      });

      spy.mockRestore();
    });
  });

  describe('hashEmail', () => {
    it('should hash email and return 16 character string', () => {
      const email = 'test@example.com';
      const hashed = privacyService.hashEmail(email);

      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBe(16);
      expect(hashed).toMatch(/^[a-f0-9]{16}$/); // Hex string pattern
    });

    it('should produce different hashes for different emails', () => {
      const hash1 = privacyService.hashEmail('user1@example.com');
      const hash2 = privacyService.hashEmail('user2@example.com');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashPhoneNumber', () => {
    it('should hash phone number and return 16 character string', () => {
      const phoneNumber = '+1234567890';
      const hashed = privacyService.hashPhoneNumber(phoneNumber);

      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBe(16);
      expect(hashed).toMatch(/^[a-f0-9]{16}$/); // Hex string pattern
    });

    it('should produce different hashes for different phone numbers', () => {
      const hash1 = privacyService.hashPhoneNumber('+1234567890');
      const hash2 = privacyService.hashPhoneNumber('+0987654321');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashName', () => {
    it('should hash name and return 16 character string', () => {
      const name = 'John Doe';
      const hashed = privacyService.hashName(name);

      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBe(16);
      expect(hashed).toMatch(/^[a-f0-9]{16}$/); // Hex string pattern
    });

    it('should produce different hashes for different names', () => {
      const hash1 = privacyService.hashName('John Doe');
      const hash2 = privacyService.hashName('Jane Smith');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('clearMemory', () => {
    it('should clear buffer memory', () => {
      const buffer = Buffer.alloc(10, 'a');
      expect(buffer.toString()).toBe('aaaaaaaaaa');

      privacyService.clearMemory(buffer);

      expect(buffer.toString()).toBe('\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000');
    });

    it('should handle null/undefined buffer gracefully', () => {
      expect(() => privacyService.clearMemory(null)).not.toThrow();
      expect(() => privacyService.clearMemory(undefined)).not.toThrow();
    });

    it('should handle non-buffer objects gracefully', () => {
      expect(() => privacyService.clearMemory('string')).not.toThrow();
      expect(() => privacyService.clearMemory({})).not.toThrow();
      expect(() => privacyService.clearMemory(123)).not.toThrow();
    });

    it('should handle buffer without fill method', () => {
      const mockBuffer = {};
      expect(() => privacyService.clearMemory(mockBuffer)).not.toThrow();
    });
  });
});