/**
 * Test suite for migrationController.js
 * Tests the temporary email verification migration endpoint
 */

// Mock dependencies before requiring modules
jest.mock('../../src/config/database', () => ({
  getClient: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const database = require('../../src/config/database');
const { logger } = require('../../src/utils/logger');
const { runEmailVerificationMigration } = require('../../src/controllers/migrationController');

describe('MigrationController', () => {
  let mockClient;
  let mockReq;
  let mockRes;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    // Setup mock request and response
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes)
    };

    // Default database.getClient to return mock client
    database.getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('runEmailVerificationMigration', () => {
    describe('Success Cases', () => {
      test('should create table when it does not exist', async () => {
        // Mock queries
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] }) // Table doesn't exist
          .mockResolvedValueOnce({}) // Create table
          .mockResolvedValueOnce({}) // Create index 1
          .mockResolvedValueOnce({}) // Create index 2
          .mockResolvedValueOnce({}) // Create index 3
          .mockResolvedValueOnce({}) // Create index 4
          .mockResolvedValueOnce({}) // Add column to users
          .mockResolvedValueOnce({ // Verify columns
            rows: [
              { column_name: 'id', data_type: 'integer' },
              { column_name: 'user_id', data_type: 'uuid' },
              { column_name: 'token', data_type: 'character varying' },
              { column_name: 'expires_at', data_type: 'timestamp with time zone' },
              { column_name: 'used', data_type: 'boolean' },
              { column_name: 'used_at', data_type: 'timestamp with time zone' },
              { column_name: 'created_at', data_type: 'timestamp with time zone' }
            ]
          });

        await runEmailVerificationMigration(mockReq, mockRes);

        // Verify database queries
        expect(mockClient.query).toHaveBeenCalledTimes(8);
        
        // Check table existence query
        expect(mockClient.query).toHaveBeenNthCalledWith(1, expect.stringContaining('SELECT EXISTS'));
        
        // Check table creation
        expect(mockClient.query).toHaveBeenNthCalledWith(2, expect.stringContaining('CREATE TABLE email_verification_tokens'));
        
        // Check index creation
        expect(mockClient.query).toHaveBeenNthCalledWith(3, expect.stringContaining('CREATE INDEX idx_email_verification_tokens_user_id'));
        expect(mockClient.query).toHaveBeenNthCalledWith(4, expect.stringContaining('CREATE INDEX idx_email_verification_tokens_token'));
        expect(mockClient.query).toHaveBeenNthCalledWith(5, expect.stringContaining('CREATE INDEX idx_email_verification_tokens_expires_at'));
        expect(mockClient.query).toHaveBeenNthCalledWith(6, expect.stringContaining('CREATE INDEX idx_email_verification_tokens_used'));
        
        // Check column addition
        expect(mockClient.query).toHaveBeenNthCalledWith(7, expect.stringContaining('ALTER TABLE users'));
        
        // Check verification
        expect(mockClient.query).toHaveBeenNthCalledWith(8, expect.stringContaining('information_schema.columns'));

        // Verify client was released
        expect(mockClient.release).toHaveBeenCalledTimes(1);

        // Verify response
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: 'Migration completed successfully',
          tableCreated: 'email_verification_tokens',
          columns: expect.arrayContaining([
            expect.objectContaining({ column_name: 'id' }),
            expect.objectContaining({ column_name: 'user_id' }),
            expect.objectContaining({ column_name: 'token' })
          ])
        });

        // Verify logging
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Starting email_verification_tokens table creation...');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Creating email_verification_tokens table...');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Table created successfully');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Creating indexes...');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Indexes created successfully');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Adding email_verified_at column to users table...');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Column added successfully');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Migration completed successfully!');
        
        expect(logger.info).toHaveBeenCalledWith('Email verification migration completed', {
          columns: expect.any(Array)
        });
      });

      test('should return success when table already exists', async () => {
        // Mock table already exists
        mockClient.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

        await runEmailVerificationMigration(mockReq, mockRes);

        // Should only check if table exists
        expect(mockClient.query).toHaveBeenCalledTimes(1);
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT EXISTS'));

        // Should release client
        expect(mockClient.release).toHaveBeenCalledTimes(1);

        // Should return appropriate response
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: 'Table email_verification_tokens already exists'
        });

        // Verify logging
        expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Table email_verification_tokens already exists');
      });

      test('should handle all indexes being created successfully', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockResolvedValueOnce({}) // Create table
          .mockResolvedValueOnce({}) // Index 1
          .mockResolvedValueOnce({}) // Index 2
          .mockResolvedValueOnce({}) // Index 3
          .mockResolvedValueOnce({}) // Index 4
          .mockResolvedValueOnce({}) // Add column
          .mockResolvedValueOnce({ rows: [] }); // Verify

        await runEmailVerificationMigration(mockReq, mockRes);

        // Verify all 4 indexes were created
        const indexCalls = mockClient.query.mock.calls.filter(call => 
          call[0].includes('CREATE INDEX')
        );
        expect(indexCalls).toHaveLength(4);
      });
    });

    describe('Error Cases', () => {
      test('should handle database connection failure', async () => {
        const connectionError = new Error('Connection failed');
        database.getClient.mockRejectedValue(connectionError);

        await runEmailVerificationMigration(mockReq, mockRes);

        // Should return 500 error
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Migration failed',
          details: 'Connection failed'
        });

        // Should log error
        expect(consoleErrorSpy).toHaveBeenCalledWith('[MIGRATION] Migration failed:', connectionError);
        expect(logger.error).toHaveBeenCalledWith('Email verification migration failed', {
          error: 'Connection failed',
          stack: expect.any(String)
        });
      });

      test('should handle table creation failure', async () => {
        const createError = new Error('Table creation failed');
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockRejectedValueOnce(createError);

        await runEmailVerificationMigration(mockReq, mockRes);

        // Should still release client
        expect(mockClient.release).toHaveBeenCalled();

        // Should return error response
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Migration failed',
          details: 'Table creation failed'
        });
      });

      test('should handle index creation failure', async () => {
        const indexError = new Error('Index creation failed');
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockResolvedValueOnce({}) // Table created
          .mockRejectedValueOnce(indexError); // First index fails

        await runEmailVerificationMigration(mockReq, mockRes);

        // Should release client
        expect(mockClient.release).toHaveBeenCalled();

        // Should return error response
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Migration failed',
          details: 'Index creation failed'
        });
      });

      test('should handle column addition failure', async () => {
        const columnError = new Error('Column addition failed');
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockResolvedValueOnce({}) // Table created
          .mockResolvedValueOnce({}) // Index 1
          .mockResolvedValueOnce({}) // Index 2
          .mockResolvedValueOnce({}) // Index 3
          .mockResolvedValueOnce({}) // Index 4
          .mockRejectedValueOnce(columnError); // Column addition fails

        await runEmailVerificationMigration(mockReq, mockRes);

        expect(mockClient.release).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Migration failed',
          details: 'Column addition failed'
        });
      });

      test('should handle verification query failure', async () => {
        const verifyError = new Error('Verification failed');
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockResolvedValueOnce({}) // Table created
          .mockResolvedValueOnce({}) // Index 1
          .mockResolvedValueOnce({}) // Index 2
          .mockResolvedValueOnce({}) // Index 3
          .mockResolvedValueOnce({}) // Index 4
          .mockResolvedValueOnce({}) // Column added
          .mockRejectedValueOnce(verifyError); // Verification fails

        await runEmailVerificationMigration(mockReq, mockRes);

        expect(mockClient.release).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(logger.error).toHaveBeenCalled();
      });

      test('should ensure client is released even on error', async () => {
        const error = new Error('Any error');
        mockClient.query.mockRejectedValue(error);

        await runEmailVerificationMigration(mockReq, mockRes);

        // Client should always be released
        expect(mockClient.release).toHaveBeenCalledTimes(1);
      });
    });

    describe('Edge Cases', () => {
      test('should handle client release failure gracefully', async () => {
        const releaseError = new Error('Release failed');
        mockClient.release.mockRejectedValue(releaseError);
        mockClient.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

        await runEmailVerificationMigration(mockReq, mockRes);

        // Should still return success response
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: 'Table email_verification_tokens already exists'
        });
      });

      test('should handle empty column verification result', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockResolvedValueOnce({}) // Table created
          .mockResolvedValueOnce({}) // Index 1
          .mockResolvedValueOnce({}) // Index 2
          .mockResolvedValueOnce({}) // Index 3
          .mockResolvedValueOnce({}) // Index 4
          .mockResolvedValueOnce({}) // Column added
          .mockResolvedValueOnce({ rows: [] }); // Empty verification

        await runEmailVerificationMigration(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: 'Migration completed successfully',
          tableCreated: 'email_verification_tokens',
          columns: []
        });
      });

      test('should handle partial index creation', async () => {
        // Third index fails
        const indexError = new Error('Third index failed');
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockResolvedValueOnce({}) // Table created
          .mockResolvedValueOnce({}) // Index 1 success
          .mockResolvedValueOnce({}) // Index 2 success
          .mockRejectedValueOnce(indexError); // Index 3 fails

        await runEmailVerificationMigration(mockReq, mockRes);

        // Should have attempted 2 successful indexes before failure
        expect(mockClient.query).toHaveBeenCalledTimes(4);
        expect(mockClient.release).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
      });
    });

    describe('Console Output', () => {
      test('should log all migration steps', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ exists: false }] })
          .mockResolvedValue({ rows: [] });

        await runEmailVerificationMigration(mockReq, mockRes);

        // Verify console output order
        const consoleCalls = consoleLogSpy.mock.calls.map(call => call[0]);
        expect(consoleCalls).toEqual([
          '[MIGRATION] Starting email_verification_tokens table creation...',
          '[MIGRATION] Creating email_verification_tokens table...',
          '[MIGRATION] Table created successfully',
          '[MIGRATION] Creating indexes...',
          '[MIGRATION] Indexes created successfully',
          '[MIGRATION] Adding email_verified_at column to users table...',
          '[MIGRATION] Column added successfully',
          '[MIGRATION] Migration completed successfully!'
        ]);
      });

      test('should log errors to console', async () => {
        const error = new Error('Test error');
        database.getClient.mockRejectedValue(error);

        await runEmailVerificationMigration(mockReq, mockRes);

        expect(consoleErrorSpy).toHaveBeenCalledWith('[MIGRATION] Migration failed:', error);
      });
    });
  });
});