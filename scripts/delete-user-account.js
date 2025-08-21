const database = require('../src/config/database');
const { logger } = require('../src/utils/logger');

/**
 * Admin script to delete a user account and all associated data
 * Usage: node scripts/delete-user-account.js <email>
 */

async function deleteUserAccount(email) {
  if (!email) {
    console.error('❌ Error: Email is required');
    console.log('Usage: node scripts/delete-user-account.js <email>');
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

    // Start transaction for safe deletion
    console.log('🗑️  Starting account deletion...');
    
    await database.transaction(async (client) => {
      // Delete vault entries first (foreign key constraint)
      try {
        const vaultEntriesResult = await client.query(
          'DELETE FROM vault_entries WHERE user_id = $1',
          [user.id]
        );
        console.log(`🗂️  Deleted ${vaultEntriesResult.rowCount} vault entries`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log('🗂️  vault_entries table does not exist - skipping');
        } else {
          throw error;
        }
      }

      // Delete vault sessions (if table exists)
      try {
        const vaultSessionsResult = await client.query(
          'DELETE FROM vault_sessions WHERE user_id = $1',
          [user.id]
        );
        console.log(`🔐 Deleted ${vaultSessionsResult.rowCount} vault sessions`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log('🔐 vault_sessions table does not exist - skipping');
        } else {
          throw error;
        }
      }

      // Delete user settings (if table exists)
      try {
        const userSettingsResult = await client.query(
          'DELETE FROM user_settings WHERE user_id = $1',
          [user.id]
        );
        console.log(`⚙️  Deleted ${userSettingsResult.rowCount} user settings`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log('⚙️  user_settings table does not exist - skipping');
        } else {
          throw error;
        }
      }

      // Delete password reset tokens (if table exists)
      try {
        const passwordResetResult = await client.query(
          'DELETE FROM password_reset_tokens WHERE user_id = $1',
          [user.id]
        );
        console.log(`🔑 Deleted ${passwordResetResult.rowCount} password reset tokens`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log('🔑 password_reset_tokens table does not exist - skipping');
        } else {
          throw error;
        }
      }

      // Delete master password reset tokens (if table exists)
      try {
        const masterPasswordResetResult = await client.query(
          'DELETE FROM master_password_reset_tokens WHERE user_id = $1',
          [user.id]
        );
        console.log(`🔐 Deleted ${masterPasswordResetResult.rowCount} master password reset tokens`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log('🔐 master_password_reset_tokens table does not exist - skipping');
        } else {
          throw error;
        }
      }

      // Finally, delete the user account
      const userDeleteResult = await client.query(
        'DELETE FROM users WHERE id = $1',
        [user.id]
      );
      console.log(`👤 Deleted user account: ${userDeleteResult.rowCount} user deleted`);
    });

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
  console.log('🗑️  Admin Account Deletion Script');
  console.log('Usage: node scripts/delete-user-account.js <email>');
  console.log('Example: node scripts/delete-user-account.js user@example.com');
  process.exit(1);
}

// Confirm deletion
console.log('⚠️  WARNING: This will permanently delete the user account and ALL associated data!');
console.log(`📧 Email to delete: ${email}`);
console.log('🔄 Starting deletion in 3 seconds...');

setTimeout(() => {
  deleteUserAccount(email);
}, 3000); 