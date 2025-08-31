const database = require('../src/config/database');

async function checkSchemaIssue() {
  console.log('🔍 Checking database schema configuration...\n');
  
  try {
    await database.connect();
    
    // Check current schema
    const currentSchema = await database.query('SELECT current_schema()');
    console.log('Current schema:', currentSchema.rows[0].current_schema);
    
    // Check search path
    const searchPath = await database.query('SHOW search_path');
    console.log('Search path:', searchPath.rows[0].search_path);
    
    // Check all schemas
    console.log('\n📁 Available schemas:');
    const schemas = await database.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
    schemas.rows.forEach(s => console.log('  -', s.schema_name));
    
    // Check for users tables in all schemas
    console.log('\n📊 Users tables found:');
    const usersTables = await database.query(`
      SELECT table_schema, table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE c.table_schema = t.table_schema 
              AND c.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_name = 'users'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    `);
    
    for (const table of usersTables.rows) {
      console.log(`\n  Schema: ${table.table_schema}`);
      console.log(`  Columns: ${table.column_count}`);
      
      // Check for security columns in this table
      const securityCols = await database.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 
        AND table_name = 'users'
        AND column_name IN (
          'last_login_at', 
          'failed_login_attempts', 
          'account_locked_until',
          'password_changed_at',
          'encrypted_two_factor_secret'
        )
      `, [table.table_schema]);
      
      if (securityCols.rows.length > 0) {
        console.log('  Security columns found:');
        securityCols.rows.forEach(c => console.log('    ✓', c.column_name));
      } else {
        console.log('  ❌ No security columns in this schema');
      }
    }
    
    // Check which schema the app is actually using
    console.log('\n🔧 Testing actual table access:');
    try {
      const result = await database.query('SELECT COUNT(*) FROM users');
      console.log('  ✓ Can access users table directly');
      console.log('  User count:', result.rows[0].count);
    } catch (error) {
      console.log('  ❌ Cannot access users table directly');
    }
    
    // Check with lockr_schema
    try {
      const result = await database.query('SELECT COUNT(*) FROM lockr_schema.users');
      console.log('  ✓ Can access lockr_schema.users');
      console.log('  User count:', result.rows[0].count);
    } catch (error) {
      console.log('  ❌ No users table in lockr_schema');
    }
    
    // Check schema_migrations
    console.log('\n📝 Migration records:');
    try {
      const migrations = await database.query(`
        SELECT table_schema, COUNT(*) as migration_count
        FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
        GROUP BY table_schema
      `);
      migrations.rows.forEach(m => {
        console.log(`  ${m.table_schema}: ${m.migration_count} migration table(s)`);
      });
    } catch (error) {
      console.log('  Error checking migrations:', error.message);
    }
    
    console.log('\n💡 Diagnosis:');
    if (usersTables.rows.length > 1) {
      console.log('  ⚠️  Multiple users tables found - schema mismatch detected!');
      console.log('  The app and migrations are using different schemas.');
    } else if (usersTables.rows.length === 1) {
      const schema = usersTables.rows[0].table_schema;
      console.log(`  Users table is in schema: ${schema}`);
      if (schema === 'lockr_schema') {
        console.log('  ✓ Using lockr_schema as expected');
      } else {
        console.log('  ⚠️  Not using lockr_schema - possible configuration issue');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await database.close();
  }
}

checkSchemaIssue();