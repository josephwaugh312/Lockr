const database = require('../src/config/database');
const { logger } = require('../src/utils/logger');

/**
 * Simple admin script to delete a user account
 * Usage: node scripts/delete-user-account-simple.js <email>
 */

async function deleteUserAccount(email) {
  if (!email) {
    console.error('❌ Error: Email is required');
    console.log('Usage: node scripts/delete-user-account-simple.js <email>');
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Find the user first
    const userResult = await database.query(
      'SELECT id, email, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user:`, {
      id: user.id,
      email: user.email,
      createdAt: user.created_at
    });

    console.log('🗑️  Starting account deletion...');
    
    // Delete vault entries first (the most important data)
    try {
      const vaultEntriesResult = await database.query(
        'DELETE FROM vault_entries WHERE user_id = $1',
        [user.id]
      );
      console.log(`🗂️  Deleted ${vaultEntriesResult.rowCount} vault entries`);
    } catch (error) {
      if (error.code === '42P01') {
        console.log('🗂️  vault_entries table does not exist - skipping');
      } else {
        console.log('🗂️  Error deleting vault entries:', error.message);
      }
    }

    // Delete the user account (this will cascade delete related records if foreign keys are set)
    const userDeleteResult = await database.query(
      'DELETE FROM users WHERE id = $1',
      [user.id]
    );
    console.log(`👤 Deleted user account: ${userDeleteResult.rowCount} user deleted`);

    console.log(`✅ Successfully deleted account for: ${email}`);
    console.log('🎯 Account deletion complete! You can now register again.');
    
    // Log the deletion for audit purposes
    logger.info('Admin account deletion completed', {
      deletedEmail: email,
      deletedUserId: user.id,
      timestamp: new Date().toISOString(),
      adminAction: true
    });

  } catch (error) {
    console.error('❌ Error deleting user account:', error);
    logger.error('Admin account deletion failed', {
      email,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Close database connection properly
    try {
      await database.pool.end();
    } catch (e) {
      // Ignore connection close errors
    }
    process.exit(0);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.log('🗑️  Simple Admin Account Deletion Script');
  console.log('Usage: node scripts/delete-user-account-simple.js <email>');
  console.log('Example: node scripts/delete-user-account-simple.js user@example.com');
  process.exit(1);
}

// Confirm deletion
console.log('⚠️  WARNING: This will permanently delete the user account and ALL associated data!');
console.log(`📧 Email to delete: ${email}`);
console.log('🔄 Starting deletion in 2 seconds...');

setTimeout(() => {
  deleteUserAccount(email);
}, 2000); 