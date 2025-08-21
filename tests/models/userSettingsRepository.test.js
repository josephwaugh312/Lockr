/**
 * UserSettingsRepository Unit Tests for Error Handling
 */

// Reset module registry to ensure clean mocks
jest.resetModules();

// Mock dependencies before requiring the module
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  close: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

const pool = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');
const userSettingsRepository = require('../../src/models/userSettingsRepository');

describe('UserSettingsRepository Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getByUserId error handling', () => {
    test('should log and throw error when database query fails', async () => {
      const userId = 'test-user-id';
      const mockError = new Error('Database connection lost');
      
      pool.query = jest.fn().mockRejectedValueOnce(mockError);

      await expect(userSettingsRepository.getByUserId(userId))
        .rejects.toThrow('Database connection lost');

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting user settings',
        expect.objectContaining({
          userId,
          error: 'Database connection lost',
          service: 'lockr-backend'
        })
      );
    });
  });

  describe('delete error handling', () => {
    test('should log and throw error when delete fails', async () => {
      const userId = 'test-user-id';
      const mockError = new Error('Delete operation failed');
      
      pool.query = jest.fn().mockRejectedValueOnce(mockError);

      await expect(userSettingsRepository.delete(userId))
        .rejects.toThrow('Delete operation failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Error deleting user settings',
        expect.objectContaining({
          userId,
          error: 'Delete operation failed',
          service: 'lockr-backend'
        })
      );
    });
  });

});