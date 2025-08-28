const database = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * TEMPORARY: Run email verification table migration
 * This endpoint creates the missing email_verification_tokens table
 * Remove this after running the migration
 */
async function runEmailVerificationMigration(req, res) {
  console.log('[MIGRATION] Starting email_verification_tokens table creation...');
  
  try {
    const client = await database.getClient();
    
    try {
      // Check if table already exists
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'email_verification_tokens'
        );
      `;
      
      const tableExists = await client.query(checkTableQuery);
      
      if (tableExists.rows[0].exists) {
        console.log('[MIGRATION] Table email_verification_tokens already exists');
        return res.json({
          success: true,
          message: 'Table email_verification_tokens already exists'
        });
      }
      
      // Create the table
      console.log('[MIGRATION] Creating email_verification_tokens table...');
      const createTableQuery = `
        CREATE TABLE email_verification_tokens (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      await client.query(createTableQuery);
      console.log('[MIGRATION] Table created successfully');
      
      // Create indexes
      console.log('[MIGRATION] Creating indexes...');
      const indexQueries = [
        'CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);',
        'CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);',
        'CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);',
        'CREATE INDEX idx_email_verification_tokens_used ON email_verification_tokens(used);'
      ];
      
      for (const indexQuery of indexQueries) {
        await client.query(indexQuery);
      }
      console.log('[MIGRATION] Indexes created successfully');
      
      // Add email_verified_at column to users table if it doesn't exist
      console.log('[MIGRATION] Adding email_verified_at column to users table...');
      const addColumnQuery = `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;
      `;
      
      await client.query(addColumnQuery);
      console.log('[MIGRATION] Column added successfully');
      
      // Verify the table was created
      const verifyQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'email_verification_tokens'
        ORDER BY ordinal_position;
      `;
      
      const columns = await client.query(verifyQuery);
      
      console.log('[MIGRATION] Migration completed successfully!');
      logger.info('Email verification migration completed', {
        columns: columns.rows
      });
      
      return res.json({
        success: true,
        message: 'Migration completed successfully',
        tableCreated: 'email_verification_tokens',
        columns: columns.rows
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    logger.error('Email verification migration failed', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
}

module.exports = {
  runEmailVerificationMigration
};