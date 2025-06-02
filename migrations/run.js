#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const database = require('../src/config/database');
const { logger } = require('../src/utils/logger');

class MigrationRunner {
  constructor() {
    this.migrationsDir = __dirname;
    this.migrationTable = 'schema_migrations';
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64)
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename 
      ON ${this.migrationTable}(filename);
    `;

    try {
      await database.query(createTableSQL);
      logger.info('Migration tracking table initialized');
    } catch (error) {
      logger.error('Failed to initialize migration table', { error: error.message });
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations() {
    try {
      const result = await database.query(
        `SELECT filename FROM ${this.migrationTable} ORDER BY filename`
      );
      return result.rows.map(row => row.filename);
    } catch (error) {
      logger.error('Failed to get executed migrations', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Natural sort order
    } catch (error) {
      logger.error('Failed to read migration files', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(filepath) {
    const crypto = require('crypto');
    const content = await fs.readFile(filepath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute a single migration
   */
  async executeMigration(filename) {
    const filepath = path.join(this.migrationsDir, filename);
    
    try {
      const migrationSQL = await fs.readFile(filepath, 'utf8');
      const checksum = await this.calculateChecksum(filepath);

      logger.info(`Executing migration: ${filename}`);
      
      // Execute migration in a transaction
      await database.transaction(async (client) => {
        // Execute the migration SQL
        await client.query(migrationSQL);
        
        // Record the migration
        await client.query(
          `INSERT INTO ${this.migrationTable} (filename, checksum) VALUES ($1, $2)`,
          [filename, checksum]
        );
      });

      logger.info(`Migration completed: ${filename}`);
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, { 
        error: error.message,
        code: error.code,
        detail: error.detail
      });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      // Connect to database
      await database.connect();
      
      // Initialize migration table
      await this.initializeMigrationTable();

      // Get executed and available migrations
      const [executedMigrations, availableMigrations] = await Promise.all([
        this.getExecutedMigrations(),
        this.getMigrationFiles()
      ]);

      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations:`, {
        migrations: pendingMigrations
      });

      // Execute pending migrations
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      logger.info('All migrations completed successfully', {
        executed: pendingMigrations.length
      });

    } catch (error) {
      logger.error('Migration process failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status() {
    try {
      await database.connect();
      await this.initializeMigrationTable();

      const [executedMigrations, availableMigrations] = await Promise.all([
        this.getExecutedMigrations(),
        this.getMigrationFiles()
      ]);

      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration)
      );

      console.log('\n=== Migration Status ===');
      console.log(`Executed: ${executedMigrations.length}`);
      console.log(`Pending: ${pendingMigrations.length}`);
      console.log(`Total: ${availableMigrations.length}`);
      
      if (executedMigrations.length > 0) {
        console.log('\nExecuted Migrations:');
        executedMigrations.forEach(migration => {
          console.log(`  ✓ ${migration}`);
        });
      }

      if (pendingMigrations.length > 0) {
        console.log('\nPending Migrations:');
        pendingMigrations.forEach(migration => {
          console.log(`  ⏳ ${migration}`);
        });
      }

      console.log('');

    } catch (error) {
      logger.error('Failed to get migration status', { error: error.message });
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'migrate';
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'migrate':
        await runner.runMigrations();
        break;
      case 'status':
        await runner.status();
        break;
      default:
        console.log('Usage: node migrations/run.js [migrate|status]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MigrationRunner; 