const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * TEMPORARY ADMIN ENDPOINT - Delete user account
 * POST /admin/delete-account
 * Body: { email: "user@example.com", adminKey: "temp-admin-key-123" }
 */
router.post('/delete-account', async (req, res) => {
  try {
    const { email, adminKey } = req.body;

    // Simple admin key protection (temporary)
    if (adminKey !== 'temp-admin-key-123') {
      return res.status(401).json({
        error: 'Invalid admin key',
        timestamp: new Date().toISOString()
      });
    }

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Find the user first
    const userResult = await database.query(
      'SELECT id, email, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ No user found with email: ${email}`);
      return res.status(404).json({
        error: 'User not found',
        email,
        timestamp: new Date().toISOString()
      });
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user:`, {
      id: user.id,
      email: user.email,
      createdAt: user.created_at
    });

    console.log('🗑️  Starting account deletion...');
    
    // Delete vault entries first (the most important data)
    let vaultEntriesDeleted = 0;
    try {
      const vaultEntriesResult = await database.query(
        'DELETE FROM vault_entries WHERE user_id = $1',
        [user.id]
      );
      vaultEntriesDeleted = vaultEntriesResult.rowCount;
      console.log(`🗂️  Deleted ${vaultEntriesDeleted} vault entries`);
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
    
    // Log the deletion for audit purposes
    logger.info('Admin account deletion completed via HTTP endpoint', {
      deletedEmail: email,
      deletedUserId: user.id,
      vaultEntriesDeleted,
      timestamp: new Date().toISOString(),
      adminAction: true,
      method: 'HTTP'
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
      deletedUser: {
        id: user.id,
        email: user.email
      },
      vaultEntriesDeleted,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deleting user account:', error);
    logger.error('Admin account deletion failed via HTTP endpoint', {
      email: req.body?.email,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check for admin endpoints
 * GET /admin/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Admin endpoints are available',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 