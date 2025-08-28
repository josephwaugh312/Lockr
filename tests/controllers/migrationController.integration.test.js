/**
 * Integration tests for migrationController.js
 * These tests work with the actual test database
 */

const { Pool } = require('pg');
const { runEmailVerificationMigration } = require('../../src/controllers/migrationController');

describe('MigrationController Integration Tests', () => {
  let pool;
  let mockReq;
  let mockRes;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeAll(async () => {
    // Create a direct connection to test database
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'lockr_test',
      user: process.env.DB_USER || 'lockr_user',
      password: process.env.DB_PASSWORD || 'lockr_test_password',
      ssl: false
    });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Setup mock request and response
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes)
    };

    // Drop the table if it exists to test creation path
    try {
      await pool.query('DROP TABLE IF EXISTS email_verification_tokens CASCADE');
      // Also remove the column from users table
      await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at');
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Table Creation Tests', () => {
    test('should create table when it does not exist', async () => {
      await runEmailVerificationMigration(mockReq, mockRes);

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
      expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Migration completed successfully!');

      // Verify table was actually created
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'email_verification_tokens'
        );
      `);
      expect(result.rows[0].exists).toBe(true);
    });

    test('should return success when table already exists', async () => {
      // Create the table first
      await pool.query(`
        CREATE TABLE email_verification_tokens (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await runEmailVerificationMigration(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Table email_verification_tokens already exists'
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('[MIGRATION] Table email_verification_tokens already exists');
    });

    test('should create all indexes successfully', async () => {
      await runEmailVerificationMigration(mockReq, mockRes);

      // Verify indexes were created
      const indexResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'email_verification_tokens'
        AND indexname LIKE 'idx_%';
      `);

      const indexNames = indexResult.rows.map(row => row.indexname);
      expect(indexNames).toContain('idx_email_verification_tokens_user_id');
      expect(indexNames).toContain('idx_email_verification_tokens_token');
      expect(indexNames).toContain('idx_email_verification_tokens_expires_at');
      expect(indexNames).toContain('idx_email_verification_tokens_used');
    });

    test('should add email_verified_at column to users table', async () => {
      await runEmailVerificationMigration(mockReq, mockRes);

      // Verify column was added to users table
      const columnResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'email_verified_at';
      `);

      expect(columnResult.rows.length).toBe(1);
    });
  });
});