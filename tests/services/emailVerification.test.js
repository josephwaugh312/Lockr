/**
 * Tests for Email Verification Service
 * Target: Increase coverage from 25.55% to 80%+
 */

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
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
    sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
    sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  }));
});

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mocktoken123456789'),
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('hashedtoken'),
  }),
}));

const database = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');
const emailService = require('../../src/services/emailService');
const emailVerificationService = require('../../src/services/emailVerificationService');

describe('EmailVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createVerificationToken', () => {
    test('creates verification token successfully', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      const mockToken = 'mocktoken123456789';

      database.query.mockResolvedValueOnce({ rows: [] }); // Check existing token
      database.query.mockResolvedValueOnce({ // Insert new token
        rows: [{ 
          id: '1', 
          user_id: userId, 
          token: mockToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }]
      });

      const result = await emailVerificationService.createVerificationToken(userId, email);

      expect(result).toEqual({
        success: true,
        token: mockToken,
        expiresAt: expect.any(Date),
      });

      expect(database.query).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Verification token created'),
        expect.objectContaining({ userId })
      );
    });

    test('handles existing token by deleting and creating new one', async () => {
      const userId = 'user123';
      const email = 'test@example.com';

      database.query.mockResolvedValueOnce({ // Check existing token
        rows: [{ id: 'old-token', user_id: userId }]
      });
      database.query.mockResolvedValueOnce({ rows: [] }); // Delete old token
      database.query.mockResolvedValueOnce({ // Insert new token
        rows: [{ 
          id: '1', 
          user_id: userId, 
          token: 'newtoken',
          expires_at: new Date()
        }]
      });

      const result = await emailVerificationService.createVerificationToken(userId, email);

      expect(result.success).toBe(true);
      expect(database.query).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted existing verification token'),
        expect.any(Object)
      );
    });

    test('handles database error', async () => {
      const userId = 'user123';
      const email = 'test@example.com';

      database.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await emailVerificationService.createVerificationToken(userId, email);

      expect(result).toEqual({
        success: false,
        error: 'Failed to create verification token',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create verification token',
        expect.objectContaining({ error: 'Database error' })
      );
    });

    test('handles missing user ID', async () => {
      const result = await emailVerificationService.createVerificationToken(null, 'test@example.com');

      expect(result).toEqual({
        success: false,
        error: 'User ID and email are required',
      });

      expect(database.query).not.toHaveBeenCalled();
    });

    test('handles missing email', async () => {
      const result = await emailVerificationService.createVerificationToken('user123', null);

      expect(result).toEqual({
        success: false,
        error: 'User ID and email are required',
      });
    });
  });

  describe('verifyToken', () => {
    test('verifies valid token successfully', async () => {
      const token = 'validtoken';
      const userId = 'user123';
      const futureDate = new Date(Date.now() + 60000);

      database.query.mockResolvedValueOnce({ // Find token
        rows: [{
          id: '1',
          user_id: userId,
          token: token,
          expires_at: futureDate,
          used: false,
        }]
      });
      database.query.mockResolvedValueOnce({ rows: [] }); // Mark as used
      database.query.mockResolvedValueOnce({ rows: [] }); // Update user

      const result = await emailVerificationService.verifyToken(token);

      expect(result).toEqual({
        success: true,
        userId: userId,
        message: 'Email verified successfully',
      });

      expect(database.query).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(
        'Email verified successfully',
        expect.objectContaining({ userId })
      );
    });

    test('handles invalid token', async () => {
      const token = 'invalidtoken';

      database.query.mockResolvedValueOnce({ rows: [] });

      const result = await emailVerificationService.verifyToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired verification token',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid verification token attempt',
        expect.objectContaining({ token })
      );
    });

    test('handles expired token', async () => {
      const token = 'expiredtoken';
      const pastDate = new Date(Date.now() - 60000);

      database.query.mockResolvedValueOnce({
        rows: [{
          id: '1',
          user_id: 'user123',
          token: token,
          expires_at: pastDate,
          used: false,
        }]
      });

      const result = await emailVerificationService.verifyToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired verification token',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Expired verification token',
        expect.any(Object)
      );
    });

    test('handles already used token', async () => {
      const token = 'usedtoken';

      database.query.mockResolvedValueOnce({
        rows: [{
          id: '1',
          user_id: 'user123',
          token: token,
          expires_at: new Date(Date.now() + 60000),
          used: true,
        }]
      });

      const result = await emailVerificationService.verifyToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired verification token',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Already used verification token',
        expect.any(Object)
      );
    });

    test('handles database error during verification', async () => {
      const token = 'token';

      database.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await emailVerificationService.verifyToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Failed to verify token',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to verify token',
        expect.objectContaining({ error: 'Database error' })
      );
    });

    test('handles missing token', async () => {
      const result = await emailVerificationService.verifyToken(null);

      expect(result).toEqual({
        success: false,
        error: 'Token is required',
      });

      expect(database.query).not.toHaveBeenCalled();
    });
  });

  describe('sendVerificationEmail', () => {
    test('sends verification email successfully', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      const name = 'Test User';

      database.query.mockResolvedValueOnce({ rows: [] }); // Check existing
      database.query.mockResolvedValueOnce({ // Create token
        rows: [{
          token: 'verifytoken',
          expires_at: new Date(),
        }]
      });
      emailService.sendVerificationEmail.mockResolvedValueOnce({ success: true });

      const result = await emailVerificationService.sendVerificationEmail(userId, email, name);

      expect(result).toEqual({
        success: true,
        message: 'Verification email sent successfully',
      });

      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        email,
        name,
        'verifytoken'
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Verification email sent',
        expect.objectContaining({ email })
      );
    });

    test('handles email sending failure', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      const name = 'Test User';

      database.query.mockResolvedValueOnce({ rows: [] });
      database.query.mockResolvedValueOnce({
        rows: [{ token: 'token', expires_at: new Date() }]
      });
      emailService.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP error'));

      const result = await emailVerificationService.sendVerificationEmail(userId, email, name);

      expect(result).toEqual({
        success: false,
        error: 'Failed to send verification email',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send verification email',
        expect.objectContaining({ error: 'SMTP error' })
      );
    });

    test('handles token creation failure', async () => {
      const userId = 'user123';
      const email = 'test@example.com';
      const name = 'Test User';

      database.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await emailVerificationService.sendVerificationEmail(userId, email, name);

      expect(result).toEqual({
        success: false,
        error: 'Failed to create verification token',
      });

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('resendVerificationEmail', () => {
    test('resends verification email successfully', async () => {
      const email = 'test@example.com';

      database.query.mockResolvedValueOnce({ // Find user
        rows: [{
          id: 'user123',
          email: email,
          name: 'Test User',
          email_verified: false,
        }]
      });
      database.query.mockResolvedValueOnce({ rows: [] }); // Check existing token
      database.query.mockResolvedValueOnce({ // Create new token
        rows: [{ token: 'newtoken', expires_at: new Date() }]
      });
      emailService.sendVerificationEmail.mockResolvedValueOnce({ success: true });

      const result = await emailVerificationService.resendVerificationEmail(email);

      expect(result).toEqual({
        success: true,
        message: 'Verification email resent successfully',
      });

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [email]
      );
    });

    test('handles already verified email', async () => {
      const email = 'verified@example.com';

      database.query.mockResolvedValueOnce({
        rows: [{
          id: 'user123',
          email: email,
          email_verified: true,
        }]
      });

      const result = await emailVerificationService.resendVerificationEmail(email);

      expect(result).toEqual({
        success: false,
        error: 'Email is already verified',
      });

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    test('handles non-existent user', async () => {
      const email = 'nonexistent@example.com';

      database.query.mockResolvedValueOnce({ rows: [] });

      const result = await emailVerificationService.resendVerificationEmail(email);

      expect(result).toEqual({
        success: false,
        error: 'User not found',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Resend verification attempted for non-existent user',
        expect.objectContaining({ email })
      );
    });

    test('handles rate limiting', async () => {
      const email = 'test@example.com';

      database.query.mockResolvedValueOnce({ // Find user
        rows: [{
          id: 'user123',
          email: email,
          email_verified: false,
        }]
      });
      database.query.mockResolvedValueOnce({ // Check recent token
        rows: [{
          created_at: new Date(Date.now() - 30000), // 30 seconds ago
        }]
      });

      const result = await emailVerificationService.resendVerificationEmail(email);

      expect(result).toEqual({
        success: false,
        error: 'Please wait before requesting another verification email',
      });

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredTokens', () => {
    test('cleans up expired tokens successfully', async () => {
      database.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 5,
      });

      const result = await emailVerificationService.cleanupExpiredTokens();

      expect(result).toEqual({
        success: true,
        deletedCount: 5,
      });

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array)
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Cleaned up expired verification tokens',
        expect.objectContaining({ count: 5 })
      );
    });

    test('handles cleanup error', async () => {
      database.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await emailVerificationService.cleanupExpiredTokens();

      expect(result).toEqual({
        success: false,
        error: 'Failed to cleanup expired tokens',
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup expired tokens',
        expect.objectContaining({ error: 'Database error' })
      );
    });

    test('handles no expired tokens', async () => {
      database.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await emailVerificationService.cleanupExpiredTokens();

      expect(result).toEqual({
        success: true,
        deletedCount: 0,
      });

      expect(logger.info).toHaveBeenCalledWith(
        'No expired verification tokens to cleanup'
      );
    });
  });

  describe('getUserByToken', () => {
    test('gets user by token successfully', async () => {
      const token = 'usertoken';
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };

      database.query.mockResolvedValueOnce({
        rows: [{
          ...user,
          token_expires_at: new Date(Date.now() + 60000),
        }]
      });

      const result = await emailVerificationService.getUserByToken(token);

      expect(result).toEqual({
        success: true,
        user: user,
      });

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN'),
        [token]
      );
    });

    test('handles invalid token', async () => {
      const token = 'invalidtoken';

      database.query.mockResolvedValueOnce({ rows: [] });

      const result = await emailVerificationService.getUserByToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired token',
      });
    });

    test('handles database error', async () => {
      const token = 'token';

      database.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await emailVerificationService.getUserByToken(token);

      expect(result).toEqual({
        success: false,
        error: 'Failed to get user by token',
      });

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('checkVerificationStatus', () => {
    test('checks verification status successfully', async () => {
      const userId = 'user123';

      database.query.mockResolvedValueOnce({
        rows: [{
          email_verified: true,
          email_verified_at: new Date('2024-01-01'),
        }]
      });

      const result = await emailVerificationService.checkVerificationStatus(userId);

      expect(result).toEqual({
        success: true,
        verified: true,
        verifiedAt: expect.any(Date),
      });
    });

    test('handles unverified user', async () => {
      const userId = 'user123';

      database.query.mockResolvedValueOnce({
        rows: [{
          email_verified: false,
          email_verified_at: null,
        }]
      });

      const result = await emailVerificationService.checkVerificationStatus(userId);

      expect(result).toEqual({
        success: true,
        verified: false,
        verifiedAt: null,
      });
    });

    test('handles non-existent user', async () => {
      const userId = 'nonexistent';

      database.query.mockResolvedValueOnce({ rows: [] });

      const result = await emailVerificationService.checkVerificationStatus(userId);

      expect(result).toEqual({
        success: false,
        error: 'User not found',
      });
    });
  });
});