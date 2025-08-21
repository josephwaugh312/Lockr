/**
 * Tests for Master Password Reset Repository
 */

// Mock dependencies BEFORE requiring the repository
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

const crypto = require('crypto');
const database = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');

describe('MasterPasswordResetRepository', () => {
  let mockClient;
  let repository;

  beforeAll(() => {
    // Require repository after mocks are set up
    jest.isolateModules(() => {
      repository = require('../../src/models/masterPasswordResetRepository');
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logger mocks
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Setup database mocks
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    database.query = jest.fn();
    database.getClient = jest.fn().mockResolvedValue(mockClient);
  });

  describe('createResetToken', () => {
    test('should create reset token successfully', async () => {
      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const ipAddress = '127.0.0.1';
      const userAgent = 'Mozilla/5.0';
      
      const mockResult = {
        rows: [{
          id: 'token123',
          expires_at: new Date(Date.now() + 15 * 60 * 1000),
          created_at: new Date()
        }]
      };
      
      database.query.mockResolvedValue(mockResult);

      const result = await repository.createResetToken(userId, ipAddress, userAgent);

      expect(result).toHaveProperty('id', 'token123');
      expect(result).toHaveProperty('token');
      expect(result.token).toMatch(/^[a-f0-9]{64}$/); // 32 bytes as hex
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('createdAt');

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO master_password_reset_tokens'),
        expect.arrayContaining([userId, expect.any(String), expect.any(Date), ipAddress, userAgent])
      );

      expect(logger.info).toHaveBeenCalledWith('Master password reset token created', expect.any(Object));
    });

    test('should handle database error', async () => {
      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const ipAddress = '127.0.0.1';
      const userAgent = 'Mozilla/5.0';
      
      const error = new Error('Database error');
      database.query.mockRejectedValue(error);

      await expect(repository.createResetToken(userId, ipAddress, userAgent))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith('Failed to create master password reset token', {
        userId,
        ipAddress,
        error: error.message
      });
    });

    test('should truncate long user agent strings in logs', async () => {
      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const ipAddress = '127.0.0.1';
      const longUserAgent = 'a'.repeat(200);
      
      const mockResult = {
        rows: [{
          id: 'token123',
          expires_at: new Date(),
          created_at: new Date()
        }]
      };
      
      database.query.mockResolvedValue(mockResult);

      await repository.createResetToken(userId, ipAddress, longUserAgent);

      expect(logger.info).toHaveBeenCalledWith('Master password reset token created', 
        expect.objectContaining({
          userAgent: 'a'.repeat(100)
        })
      );
    });
  });

  describe('findValidResetToken', () => {
    test('should find valid reset token', async () => {
      const token = 'a'.repeat(64);
      
      const mockResult = {
        rows: [{
          id: 'token123',
          user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
          used: false,
          data_wiped: false,
          created_at: new Date()
        }]
      };
      
      database.query.mockResolvedValue(mockResult);

      const result = await repository.findValidResetToken(token);

      expect(result).toEqual({
        id: 'token123',
        userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        expiresAt: mockResult.rows[0].expires_at,
        used: false,
        dataWiped: false,
        createdAt: mockResult.rows[0].created_at
      });

      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([expect.any(String)])
      );
    });

    test('should return null for invalid token', async () => {
      const token = 'invalid-token';
      
      database.query.mockResolvedValue({ rows: [] });

      const result = await repository.findValidResetToken(token);

      expect(result).toBeNull();
    });

    test('should handle database error', async () => {
      const token = 'test-token';
      const error = new Error('Database error');
      
      database.query.mockRejectedValue(error);

      await expect(repository.findValidResetToken(token))
        .rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith('Failed to find reset token', {
        error: error.message
      });
    });
  });

  describe('wipeVaultAndResetMasterPassword', () => {
    test('should wipe vault data and mark token as used', async () => {
      const token = 'valid-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Mock transaction queries
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ // SELECT token
          rows: [{
            id: 'token123',
            user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
          }]
        })
        .mockResolvedValueOnce({ // COUNT entries
          rows: [{
            count: '5'
          }]
        })
        .mockResolvedValueOnce({ rowCount: 5 }) // DELETE vault_entries
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE token
        .mockResolvedValueOnce({}); // COMMIT

      const result = await repository.wipeVaultAndResetMasterPassword(token, 'NewPassword123!');

      expect(result).toEqual({
        success: true,
        entriesWiped: 5,
        sessionCleared: true,
        timestamp: expect.any(String)
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();

      expect(logger.error).toHaveBeenCalledWith('Vault data wiped and master password reset', 
        expect.objectContaining({
          userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          entriesWiped: 5
        })
      );
    });

    test('should handle invalid token', async () => {
      const token = 'invalid-token';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT token - no results
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(repository.wipeVaultAndResetMasterPassword(token, 'NewPassword123!'))
        .rejects.toThrow('Invalid or expired master password reset token');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should rollback on error', async () => {
      const token = 'valid-token';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ // SELECT token
          rows: [{
            id: 'token123',
            user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
          }]
        })
        .mockRejectedValueOnce(new Error('Database error')) // COUNT fails
        .mockResolvedValueOnce({}); // ROLLBACK

      await expect(repository.wipeVaultAndResetMasterPassword(token, 'NewPassword123!'))
        .rejects.toThrow();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});