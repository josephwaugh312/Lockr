require('dotenv').config();
const database = require('./src/config/database');

async function checkMigrations() {
  try {
    await database.connect();
    
    // Check for duplicates
    const duplicates = await database.query(`
      SELECT filename, COUNT(*) 
      FROM schema_migrations 
      GROUP BY filename 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('Duplicate migrations found:');
      duplicates.rows.forEach(row => {
        console.log(`  ${row.filename} (count: ${row.count})`);
      });
    } else {
      console.log('No duplicate migrations found');
    }
    
    // Show all migrations
    const allMigrations = await database.query(`
      SELECT filename FROM schema_migrations ORDER BY filename
    `);
    
    console.log('\nAll migrations in database:');
    allMigrations.rows.forEach(row => {
      console.log(`  ${row.filename}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkMigrations(); 