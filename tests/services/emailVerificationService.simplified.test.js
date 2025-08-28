/**
 * Simplified Email Verification Service Tests
 * Unit tests without database dependencies
 */

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/models/userRepository');
jest.mock('../../src/services/emailService');
jest.mock('../../src/services/notificationService');
jest.mock('../../src/utils/logger');

const crypto = require('crypto');
const database = require('../../src/config/database');
const userRepository = require('../../src/models/userRepository');
const EmailService = require('../../src/services/emailService');
const notificationService = require('../../src/services/notificationService');
const { logger } = require('../../src/utils/logger');
const service = require('../../src/services/emailVerificationService');

describe('EmailVerificationService - Simplified Tests', () => {
  let mockEmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logger mocks
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Setup EmailService mock
    mockEmailService = {
      sendNotificationEmail: jest.fn(),
      sendVerificationEmail: jest.fn()
    };
    EmailService.mockImplementation(() => mockEmailService);
    EmailService.sendVerificationEmail = jest.fn();

    // Setup database mock
    database.query = jest.fn();

    // Setup userRepository mock
    userRepository.updateEmailVerificationToken = jest.fn();
    userRepository.findByEmail = jest.fn();
    userRepository.findById = jest.fn();
    userRepository.markEmailAsVerified = jest.fn();

    // Setup notification service mock
    notificationService.sendNotification = jest.fn();

    // Reset service's emailService to use our mock
    service.emailService = mockEmailService;
  });

  describe('generateVerificationToken', () => {
    test('should generate a 64-character hex token', () => {
      const token = service.generateVerificationToken();
      
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(token.length).toBe(64);
    });

    test('should generate unique tokens', () => {
      const token1 = service.generateVerificationToken();
      const token2 = service.generateVerificationToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('sendVerificationEmail', () => {
    test('should send verification email with mocked repository', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      const firstName = 'John';

      // Make repository mocked
      userRepository.updateEmailVerificationToken._isMockFunction = true;
      userRepository.updateEmailVerificationToken.mockResolvedValue(true);
      mockEmailService.sendNotificationEmail.mockResolvedValue(true);

      const result = await service.sendVerificationEmail(userId, email, firstName);

      expect(result).toEqual({
        success: true,
        message: 'Verification email sent successfully'
      });

      expect(userRepository.updateEmailVerificationToken).toHaveBeenCalledWith(
        userId,
        expect.any(String),
        expect.any(Date)
      );

      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith({
        type: 'account',
        subtype: 'email_verification',
        userId,
        to: email,
        templateData: { 
          firstName, 
          verificationLink: expect.stringContaining('/auth/verify-email?token=')
        }
      });

      expect(logger.info).toHaveBeenCalledWith('Verification email sent', { email });
    });

    test('should send verification email with direct database', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      const firstName = 'Jane';

      // Repository not mocked
      userRepository.updateEmailVerificationToken._isMockFunction = false;

      database.query
        .mockResolvedValueOnce({ rows: [] }) // SELECT check
        .mockResolvedValueOnce({ // INSERT token
          rows: [{
            token: 'generated-token',
            expires_at: new Date()
          }]
        });

      mockEmailService.sendVerificationEmail.mockResolvedValue(true);

      const result = await service.sendVerificationEmail(userId, email, firstName);

      expect(result).toEqual({
        success: true,
        message: 'Verification email sent successfully'
      });

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_verification_tokens'),
        [userId, expect.any(String), expect.any(Date)]
      );

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        email,
        firstName,
        'generated-token'
      );
    });

    test('should handle email sending failure', async () => {
      const userId = 'user123';
      const email = 'test@example.com';

      userRepository.updateEmailVerificationToken._isMockFunction = true;
      userRepository.updateEmailVerificationToken.mockResolvedValue(true);
      mockEmailService.sendNotificationEmail.mockRejectedValue(new Error('Email service down'));

      const result = await service.sendVerificationEmail(userId, email);

      expect(result).toEqual({
        success: false,
        error: 'Failed to send verification email'
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to send verification email', {
        error: 'Email service down'
      });
    });

    test('should handle database error', async () => {
      const userId = 'user123';
      const email = 'test@example.com';

      userRepository.updateEmailVerificationToken._isMockFunction = false;
      database.query.mockRejectedValue(new Error('Database error'));

      const result = await service.sendVerificationEmail(userId, email);

      expect(result).toEqual({
        success: false,
        error: 'Failed to create verification token'
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to create verification token', {
        error: 'Database error'
      });
    });
  });

  describe('getUserByToken', () => {
    test('should get user by valid token', async () => {
      const token = 'valid-token';
      
      database.query.mockResolvedValueOnce({
        rows: [{
          id: 'user123',
          email: 'test@example.com',
          name: 'John Doe',
          token_expires_at: new Date(Date.now() + 3600000)
        }]
      });

      const result = await service.getUserByToken(token);

      expect(result).toEqual({
        success: true,
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: 'John Doe'
        }
      });

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT u.id, u.email, u.name'),
        [token]
      );
    });

    test('should handle invalid token', async () => {
      const token = 'invalid-token';
      
      database.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getUserByToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired token'
      });
    });

    test('should handle database error', async () => {
      const token = 'test-token';
      
      database.query.mockRejectedValue(new Error('Database error'));

      const result = await service.getUserByToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Failed to get user by token'
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to get user by token', {
        error: 'Database error'
      });
    });
  });

  describe('resendVerificationEmail', () => {
    test('should resend verification for unverified user', async () => {
      const email = 'unverified@example.com';
      
      userRepository.findByEmail.mockResolvedValue({
        id: 'user123',
        email,
        email_verified: false,
        name: 'John Doe'
      });

      userRepository.updateEmailVerificationToken.mockResolvedValue(true);
      mockEmailService.sendNotificationEmail.mockResolvedValue(true);

      const result = await service.resendVerificationEmail(email);

      expect(result).toEqual({
        success: true,
        message: 'Verification email resent successfully'
      });

      expect(userRepository.updateEmailVerificationToken).toHaveBeenCalledWith(
        'user123',
        expect.any(String),
        expect.any(Date)
      );
    });

    test('should reject resend for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerificationEmail(email);

      expect(result).toEqual({
        success: true,
        message: 'If an account exists, a verification email has been sent'
      });

      // No warning is logged in mocked path for security reasons
    });

    test('should reject resend for already verified user', async () => {
      const email = 'verified@example.com';
      
      userRepository.findByEmail.mockResolvedValue({
        id: 'user123',
        email,
        email_verified: true
      });

      const result = await service.resendVerificationEmail(email);

      expect(result).toEqual({
        success: true,
        message: 'Email is already verified'
      });

      // No info log is generated in mocked path
    });

    test('should handle database error during resend', async () => {
      const email = 'test@example.com';
      
      userRepository.findByEmail.mockRejectedValue(new Error('Database error'));

      const result = await service.resendVerificationEmail(email);

      expect(result).toEqual({
        success: false,
        error: 'Failed to resend verification email'
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to resend verification email', {
        email,
        error: 'Database error'
      });
    });
  });

  describe('checkVerificationStatus', () => {
    test('should return verified status for verified user', async () => {
      const userId = 'user123';
      
      database.query.mockResolvedValue({
        rows: [{
          email_verified: true,
          email_verified_at: new Date('2024-01-01')
        }]
      });

      const result = await service.checkVerificationStatus(userId);

      expect(result).toEqual({
        success: true,
        verified: true,
        verifiedAt: expect.any(Date)
      });
    });

    test('should return unverified status for unverified user', async () => {
      const userId = 'user123';
      
      database.query.mockResolvedValue({
        rows: [{
          email_verified: false,
          email_verified_at: null
        }]
      });

      const result = await service.checkVerificationStatus(userId);

      expect(result).toEqual({
        success: true,
        verified: false,
        verifiedAt: null
      });
    });

    test('should handle non-existent user', async () => {
      const userId = 'nonexistent';
      
      database.query.mockResolvedValue({
        rows: []
      });

      const result = await service.checkVerificationStatus(userId);

      expect(result).toEqual({
        success: false,
        error: 'User not found'
      });
    });

    test('should handle database error', async () => {
      const userId = 'user123';
      
      database.query.mockRejectedValue(new Error('Database error'));

      const result = await service.checkVerificationStatus(userId);

      expect(result).toEqual({
        success: false,
        error: 'Failed to check email verification status'
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to check email verification status', {
        error: 'Database error'
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    test('should cleanup expired tokens', async () => {
      database.query.mockResolvedValue({ rowCount: 5 });

      const result = await service.cleanupExpiredTokens();

      expect(result).toEqual({ success: true, deletedCount: 5 });

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM email_verification_tokens'),
        []
      );

      expect(logger.info).toHaveBeenCalledWith('Cleaned up expired verification tokens', {
        count: 5
      });
    });

    test('should handle cleanup error', async () => {
      database.query.mockRejectedValue(new Error('Database error'));

      const result = await service.cleanupExpiredTokens();

      expect(result).toEqual({ success: false, error: 'Failed to cleanup expired tokens' });

      expect(logger.error).toHaveBeenCalledWith('Failed to cleanup expired tokens', {
        error: 'Database error'
      });
    });
  });
});