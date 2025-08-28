/**
 * Fixed Tests for Email Verification Service
 * Tests the actual methods that exist in the service
 */

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn()
  })),
  connect: jest.fn(),
  close: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../src/services/emailService', () => {
  return jest.fn().mockImplementation(() => ({
    // The service calls sendNotificationEmail for various templates
    sendNotificationEmail: jest.fn().mockResolvedValue({ success: true, emailId: 'mock-email' }),
  }));
});

jest.mock('../../src/models/userRepository', () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  markEmailAsVerified: jest.fn(),
  updateEmailVerificationToken: jest.fn(),
  findByEmailVerificationToken: jest.fn(),
}));

const database = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');
const userRepository = require('../../src/models/userRepository');
const emailVerificationService = require('../../src/services/emailVerificationService');

describe('EmailVerificationService - Fixed Tests', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure service path follows non-test but not dev auto-verify branches
    process.env.NODE_ENV = 'production';
    // Provide fake email config so code path sends instead of skipping
    process.env.RESEND_API_KEY = 'test-key';
    process.env.FROM_EMAIL = 'test@example.com';
    service = emailVerificationService; // Use the singleton instance
  });

  describe('generateVerificationToken', () => {
    test('generates a verification token', () => {
      const token = service.generateVerificationToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes hex = 64 chars
    });
  });

  describe('sendVerificationEmail', () => {
    test('sends verification email successfully', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      const firstName = 'Test';

      // Mock database queries
      database.getClient.mockResolvedValueOnce({
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // No existing token
          .mockResolvedValueOnce({ // Insert new token
            rows: [{
              token: 'test-token',
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }]
          }),
        release: jest.fn()
      });

      const result = await service.sendVerificationEmail(userId, email, firstName);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Verification email sent');
    });

    test('handles database error', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      // Cause repository to fail when saving token
      userRepository.updateEmailVerificationToken.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.sendVerificationEmail(userId, email)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Failed to send verification email', expect.any(Object));
    });
  });

  describe('verifyEmail', () => {
    test('verifies email with valid token', async () => {
      const token = 'valid-token';

      // Mock verifyToken to return success
      service.verifyToken = jest.fn().mockResolvedValueOnce({
        success: true,
        userId: 'user123',
        message: 'Token verified successfully'
      });
      
      // Mock database query for user details
      database.query.mockResolvedValueOnce({
        rows: [{
          id: 'user123',
          email: 'test@example.com',
          name: 'Test User'
        }]
      });

      const result = await service.verifyEmail(token);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Email verified successfully');
    });

    test('handles invalid token', async () => {
      const token = 'invalid-token';
      
      // Mock verifyToken to return failure
      service.verifyToken = jest.fn().mockResolvedValueOnce({
        success: false,
        error: 'Failed to verify token'
      });
      
      await expect(service.verifyEmail(token)).rejects.toThrow('Failed to verify token');
    });

    test('handles expired token', async () => {
      const token = 'expired-token';
      
      // Mock verifyToken to return failure for expired token
      service.verifyToken = jest.fn().mockResolvedValueOnce({
        success: false,
        error: 'Failed to verify token'
      });
      
      await expect(service.verifyEmail(token)).rejects.toThrow('Failed to verify token');
    });
  });

  describe('resendVerificationEmail', () => {
    test('resends verification email successfully', async () => {
      const email = 'test@example.com';

      userRepository.findByEmail.mockResolvedValueOnce({
        id: 'user123',
        email: email,
        email_verified: false,
        name: 'Test User'
      });

      userRepository.updateEmailVerificationToken.mockResolvedValueOnce();

      const result = await service.resendVerificationEmail(email);
      expect(result.success).toBe(true);
      expect(typeof result.message).toBe('string');
    });

    test('handles already verified email', async () => {
      const email = 'verified@example.com';

      userRepository.findByEmail.mockResolvedValueOnce({
        id: 'user123',
        email: email,
        email_verified: true,
        name: 'Test User'
      });

      await expect(service.resendVerificationEmail(email)).resolves.toEqual(
        expect.objectContaining({ success: true, message: expect.any(String) })
      );
    });

    test('handles non-existent user', async () => {
      const email = 'nonexistent@example.com';

      userRepository.findByEmail.mockResolvedValueOnce(null);

      await expect(service.resendVerificationEmail(email)).resolves.toEqual(
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('isEmailVerified', () => {
    test('checks if email is verified', async () => {
      const userId = 'user123';

      userRepository.findById.mockResolvedValueOnce({
        id: userId,
        email_verified: true
      });

      const result = await service.isEmailVerified(userId);

      expect(result).toBe(true);
    });

    test('returns false for unverified email', async () => {
      const userId = 'user123';

      userRepository.findById.mockResolvedValueOnce({
        id: userId,
        email_verified: false
      });

      const result = await service.isEmailVerified(userId);
      expect(result).toBe(false);
    });

    test('returns false for non-existent user', async () => {
      const userId = 'nonexistent';

      userRepository.findById.mockResolvedValueOnce(null);

      const result = await service.isEmailVerified(userId);
      expect(result).toBe(false);
    });
  });
});