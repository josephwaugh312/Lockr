#!/usr/bin/env node

/**
 * Test Database Initialization Script
 * Sets up and verifies database schema before running tests
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class TestDatabaseInitializer {
  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'lockr_test',
      user: process.env.DB_USER || 'lockr_user',
      password: process.env.DB_PASSWORD || 'lockr_test_password',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
      max: 5
    };
    
    this.pool = null;
    this.requiredTables = [
      'users',
      'vault_entries', 
      'notifications',
      'password_reset_tokens',
      'user_settings'
    ];
  }

  async initialize(options = {}) {
    const startTime = Date.now();
    console.log('🔧 Initializing test database...');
    
    try {
      // Step 1: Test basic connection
      console.log('📡 Testing database connection...');
      await this.testConnection();
      console.log('✅ Database connection successful');
      
      // Step 2: Check database exists
      console.log('🗄️  Verifying database exists...');
      await this.verifyDatabase();
      console.log('✅ Database verified');
      
      // Step 3: Check schema and tables
      console.log('📋 Checking database schema...');
      const schemaStatus = await this.checkSchema();
      
      if (!schemaStatus.complete) {
        console.log('🔨 Setting up missing database schema...');
        await this.setupSchema(options);
        console.log('✅ Database schema setup complete');
      } else {
        console.log('✅ Database schema already complete');
      }
      
      // Step 4: Verify all tables are accessible
      console.log('🔍 Verifying table access...');
      await this.verifyTableAccess();
      console.log('✅ All tables accessible');
      
      // Step 5: Clean existing test data
      if (options.clean !== false) {
        console.log('🧹 Cleaning existing test data...');
        await this.cleanTestData();
        console.log('✅ Test data cleaned');
      }
      
      // Step 6: Test basic operations
      console.log('⚡ Testing basic database operations...');
      await this.testBasicOperations();
      console.log('✅ Basic operations verified');
      
      const duration = Date.now() - startTime;
      console.log(`🎉 Database initialization completed in ${duration}ms`);
      
      return {
        success: true,
        duration,
        config: this.sanitizeConfig(),
        tables: schemaStatus.tables
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Database initialization failed after ${duration}ms:`, error.message);
      
      return {
        success: false,
        error: error.message,
        duration,
        troubleshooting: this.getTroubleshootingTips(error)
      };
    } finally {
      await this.cleanup();
    }
  }

  async testConnection() {
    this.pool = new Pool(this.config);
    
    const client = await this.pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version()');
    
    console.log(`  Database: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    console.log(`  Time: ${result.rows[0].current_time}`);
    
    client.release();
  }

  async verifyDatabase() {
    const client = await this.pool.connect();
    
    try {
      // Check if we can access the database
      const result = await client.query('SELECT current_database()');
      const dbName = result.rows[0].current_database;
      
      if (dbName !== this.config.database) {
        throw new Error(`Connected to wrong database: ${dbName} (expected: ${this.config.database})`);
      }
      
    } finally {
      client.release();
    }
  }

  async checkSchema() {
    const client = await this.pool.connect();
    
    try {
      // Check which tables exist
      const tablesResult = await client.query(`
        SELECT table_name, table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      const existingTables = tablesResult.rows.map(row => row.table_name);
      const missingTables = this.requiredTables.filter(table => !existingTables.includes(table));
      
      console.log(`  Found ${existingTables.length} tables: ${existingTables.join(', ')}`);
      
      if (missingTables.length > 0) {
        console.log(`  Missing ${missingTables.length} tables: ${missingTables.join(', ')}`);
      }
      
      return {
        complete: missingTables.length === 0,
        tables: existingTables,
        missing: missingTables
      };
      
    } finally {
      client.release();
    }
  }

  async setupSchema(options = {}) {
    // Look for schema files in common locations
    const schemaPaths = [
      path.join(process.cwd(), 'database', 'schema.sql'),
      path.join(process.cwd(), 'sql', 'schema.sql'),
      path.join(process.cwd(), 'migrations', '001_initial_schema.sql'),
      path.join(process.cwd(), 'src', 'database', 'schema.sql')
    ];
    
    let schemaFile = null;
    
    for (const schemaPath of schemaPaths) {
      if (fs.existsSync(schemaPath)) {
        schemaFile = schemaPath;
        break;
      }
    }
    
    if (!schemaFile && !options.createBasicSchema) {
      console.warn('⚠️  No schema file found. Creating basic schema...');
      await this.createBasicSchema();
      return;
    }
    
    if (schemaFile) {
      console.log(`  Using schema file: ${schemaFile}`);
      const schemaSql = fs.readFileSync(schemaFile, 'utf8');
      await this.executeSchema(schemaSql);
    } else {
      await this.createBasicSchema();
    }
  }

  async createBasicSchema() {
    const client = await this.pool.connect();
    
    try {
      // Create basic schema for testing
      const basicSchema = `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          name VARCHAR(255),
          master_password_hash VARCHAR(255),
          encryption_key_encrypted TEXT,
          two_factor_secret VARCHAR(32),
          two_factor_enabled BOOLEAN DEFAULT FALSE,
          backup_codes TEXT[],
          encrypted_phone_number TEXT,
          data_retention_policy JSONB DEFAULT '{}',
          email_verified BOOLEAN DEFAULT FALSE,
          email_verified_at TIMESTAMP,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Vault entries table
        CREATE TABLE IF NOT EXISTS vault_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          username VARCHAR(255),
          password_encrypted TEXT,
          website VARCHAR(500),
          notes_encrypted TEXT,
          category VARCHAR(50) DEFAULT 'General',
          favorite BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Notifications table
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          priority VARCHAR(20) DEFAULT 'MEDIUM',
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Password resets table (renamed from password_resets)
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          ip_hash VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- User settings table
        CREATE TABLE IF NOT EXISTS user_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          vault_activity BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_vault_entries_user_id ON vault_entries(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
      `;
      
      await client.query(basicSchema);
      console.log('  Basic schema created successfully');
      
    } finally {
      client.release();
    }
  }

  async executeSchema(schemaSql) {
    const client = await this.pool.connect();
    
    try {
      // Split SQL into individual statements and execute
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (error) {
          // Log but don't fail on expected errors (like table already exists)
          if (!error.message.includes('already exists')) {
            console.warn(`  Warning executing statement: ${error.message}`);
          }
        }
      }
      
    } finally {
      client.release();
    }
  }

  async verifyTableAccess() {
    const client = await this.pool.connect();
    
    try {
      for (const table of this.requiredTables) {
        // Test basic operations on each table
        await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ✓ ${table} - accessible`);
      }
    } finally {
      client.release();
    }
  }

  async cleanTestData() {
    const client = await this.pool.connect();
    
    try {
      // Clean in reverse dependency order
      const cleanOrder = ['notifications', 'password_reset_tokens', 'user_settings', 'vault_entries', 'users'];
      
      await client.query('BEGIN');
      
      for (const table of cleanOrder) {
        try {
          const result = await client.query(`DELETE FROM ${table}`);
          console.log(`  ✓ ${table} - ${result.rowCount} rows deleted`);
        } catch (error) {
          console.warn(`  Warning cleaning ${table}: ${error.message}`);
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async testBasicOperations() {
    const client = await this.pool.connect();
    
    try {
      // Test a simple insert/select/delete cycle
      const testData = {
        email: 'test.init@example.com',
        password_hash: '$argon2id$v=19$m=65536,t=3,p=4$randomsalt123456789012345678901234$randomhashvalue123456789012345678901234567890123456789012345678901234', // Valid argon2 hash format
        name: 'Test User'
      };
      
      // Insert
      const insertResult = await client.query(`
        INSERT INTO users (email, password_hash, name)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [testData.email, testData.password_hash, testData.name]);
      
      const userId = insertResult.rows[0].id;
      console.log(`  ✓ Insert test - User ID: ${userId}`);
      
      // Select
      const selectResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      console.log(`  ✓ Select test - Found user: ${selectResult.rows[0].email}`);
      
      // Delete
      const deleteResult = await client.query('DELETE FROM users WHERE id = $1', [userId]);
      console.log(`  ✓ Delete test - Rows affected: ${deleteResult.rowCount}`);
      
    } finally {
      client.release();
    }
  }

  getTroubleshootingTips(error) {
    const tips = [];
    
    if (error.code === 'ECONNREFUSED') {
      tips.push('PostgreSQL server is not running or not accepting connections');
      tips.push(`Check if PostgreSQL is running on ${this.config.host}:${this.config.port}`);
      tips.push('Try: sudo systemctl status postgresql (Linux) or brew services list (Mac)');
    }
    
    if (error.code === '28P01') {
      tips.push('Authentication failed - check username and password');
      tips.push(`Verify user '${this.config.user}' has access to database '${this.config.database}'`);
    }
    
    if (error.code === '3D000') {
      tips.push(`Database '${this.config.database}' does not exist`);
      tips.push(`Create it with: CREATE DATABASE ${this.config.database};`);
    }
    
    if (error.message.includes('timeout')) {
      tips.push('Connection timeout - database may be overloaded');
      tips.push('Try increasing connectionTimeoutMillis or reducing max connections');
    }
    
    if (tips.length === 0) {
      tips.push('Check PostgreSQL logs for more details');
      tips.push('Verify database configuration in environment variables');
    }
    
    return tips;
  }

  sanitizeConfig() {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      ssl: this.config.ssl
    };
  }

  async cleanup() {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    clean: !args.includes('--no-clean'),
    createBasicSchema: args.includes('--create-basic-schema'),
    verbose: args.includes('--verbose')
  };
  
  if (options.verbose) {
    process.env.VERBOSE_TESTS = 'true';
  }
  
  console.log('🧪 Test Database Initializer');
  console.log('============================');
  
  const initializer = new TestDatabaseInitializer();
  const result = await initializer.initialize(options);
  
  if (result.success) {
    console.log('\n✅ Database ready for testing!');
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Tables: ${result.tables?.length || 0}`);
    process.exit(0);
  } else {
    console.log('\n❌ Database initialization failed');
    console.log(`   Error: ${result.error}`);
    console.log(`   Duration: ${result.duration}ms`);
    
    if (result.troubleshooting) {
      console.log('\n💡 Troubleshooting tips:');
      result.troubleshooting.forEach((tip, i) => {
        console.log(`   ${i + 1}. ${tip}`);
      });
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = TestDatabaseInitializer;