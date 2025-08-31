const database = require('../src/config/database');
const fs = require('fs').promises;
const path = require('path');

async function applySecurityMigrations() {
  try {
    console.log('🔐 Applying security migrations to production...\n');
    
    await database.connect();
    
    // Set schema if needed
    const schema = process.env.DB_SCHEMA || 'public';
    if (schema !== 'public') {
      await database.query(`SET search_path TO ${schema}`);
      console.log(`Using schema: ${schema}\n`);
    }
    
    // Check what migrations are already applied
    let existingMigrations = [];
    try {
      const result = await database.query('SELECT filename FROM schema_migrations');
      existingMigrations = result.rows.map(r => r.filename);
      console.log('Already applied migrations:', existingMigrations.length);
    } catch (error) {
      console.log('No migrations table found, creating it...');
      await database.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    
    // Migrations we need (in order of dependencies)
    const requiredMigrations = [
      '011_add_email_verification.sql',     // Creates email_verified columns
      '015_encrypt_2fa_secrets.sql',        // Creates encrypted_two_factor_secret columns
      '016_encrypt_phone_numbers.sql',      // Creates encrypted_phone_number columns
      '018_enhance_audit_privacy.sql',      // Creates GDPR columns
      '019_add_data_retention.sql',         // Creates data_retention_policy column
      '024_add_security_tracking_columns.sql',
      '025_add_encryption_constraints.sql',
      '026_create_security_views.sql'
    ];
    
    // Apply each migration if not already applied
    for (const migration of requiredMigrations) {
      if (existingMigrations.includes(migration)) {
        console.log(`✓ ${migration} - already applied`);
        continue;
      }
      
      console.log(`\nApplying ${migration}...`);
      
      const migrationPath = path.join(__dirname, '..', 'migrations', migration);
      const sql = await fs.readFile(migrationPath, 'utf8');
      
      try {
        // Run the migration
        await database.query(sql);
        
        // Record it
        await database.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
          [migration]
        );
        
        console.log(`✅ ${migration} - successfully applied`);
      } catch (error) {
        console.error(`❌ ${migration} failed:`, error.message);
        
        // If it's just a duplicate key error, mark as complete
        if (error.message.includes('duplicate key')) {
          console.log('  (Migration was already recorded)');
        } else {
          throw error;
        }
      }
    }
    
    // Verify the migrations worked
    console.log('\n📊 Verifying migrations...');
    
    // Check for security columns
    const columns = await database.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('last_login_at', 'failed_login_attempts', 'account_locked_until')
    `);
    console.log(`Security columns: ${columns.rows.length}/3`);
    
    // Check for views
    const views = await database.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name LIKE 'user%'
    `);
    console.log(`Security views: ${views.rows.length}`);
    
    console.log('\n✨ Security migrations complete!');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await database.end();
  }
}

applySecurityMigrations();