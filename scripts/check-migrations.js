const database = require('../src/config/database');

async function checkMigrations() {
  try {
    await database.connect();
    
    console.log('Checking migration status...\n');
    
    // Check if schema_migrations table exists
    const migrationTable = await database.query(`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_name = 'schema_migrations'
    `);
    
    if (migrationTable.rows[0].count === '0') {
      console.log('❌ Migration table does not exist');
      return;
    }
    
    // Get list of applied migrations
    const migrations = await database.query(`
      SELECT filename, executed_at 
      FROM schema_migrations 
      ORDER BY filename
    `);
    
    console.log('Applied Migrations:');
    migrations.rows.forEach(m => {
      console.log(`✓ ${m.filename}`);
    });
    
    // Check for security migrations specifically
    const securityMigrations = [
      '024_add_security_tracking_columns.sql',
      '025_add_encryption_constraints.sql',
      '026_create_security_views.sql'
    ];
    
    const appliedMigrations = migrations.rows.map(m => m.filename);
    
    console.log('\nSecurity Migration Status:');
    securityMigrations.forEach(m => {
      if (appliedMigrations.includes(m)) {
        console.log(`✅ ${m} - APPLIED`);
      } else {
        console.log(`❌ ${m} - NOT APPLIED`);
      }
    });
    
    // Check if security columns exist
    const columns = await database.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('last_login_at', 'failed_login_attempts', 'account_locked_until')
    `);
    
    console.log(`\nSecurity columns found: ${columns.rows.length}/3`);
    
    // Check if views exist
    const views = await database.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name LIKE 'user%'
    `);
    
    console.log(`Security views found: ${views.rows.length}`);
    
  } catch (error) {
    console.error('Error checking migrations:', error.message);
  } finally {
    await database.end();
  }
}

checkMigrations();