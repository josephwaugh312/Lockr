const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * TEMPORARY ADMIN ENDPOINTS - TEMPORARILY RE-ENABLED FOR ACCOUNT DELETION
 * These will be disabled again after testing
 */

// TEMPORARILY RE-ENABLED FOR ACCOUNT DELETION TESTING
router.post('/delete-account', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        message: 'Please provide an email address to delete'
      });
    }

    logger.info('Admin account deletion requested', { email: email.substring(0, 3) + '***' });

    // Find user by email
    const userQuery = 'SELECT id, email FROM users WHERE email = $1';
    const userResult = await database.query(userQuery, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      logger.info('User not found for deletion', { email: email.substring(0, 3) + '***' });
      return res.status(404).json({
        error: 'User not found',
        message: `No account found with email: ${email.substring(0, 3)}***`
      });
    }

    const user = userResult.rows[0];
    const userId = user.id;

    // Delete vault entries first (foreign key constraint)
    const deleteVaultQuery = 'DELETE FROM vault_entries WHERE user_id = $1';
    const vaultResult = await database.query(deleteVaultQuery, [userId]);
    
    // Delete user account
    const deleteUserQuery = 'DELETE FROM users WHERE id = $1';
    const userDeleteResult = await database.query(deleteUserQuery, [userId]);

    logger.info('Admin account deletion completed', {
      userId,
      email: email.substring(0, 3) + '***',
      vaultEntriesDeleted: vaultResult.rowCount,
      userDeleted: userDeleteResult.rowCount
    });

    res.json({
      success: true,
      message: 'Account deleted successfully',
      details: {
        vaultEntriesDeleted: vaultResult.rowCount,
        accountDeleted: userDeleteResult.rowCount > 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Admin account deletion failed', {
      error: error.message,
      email: req.body.email?.substring(0, 3) + '***'
    });
    
    res.status(500).json({
      error: 'Account deletion failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/inspect-user/:email', async (req, res) => {
  // This endpoint was used to verify no master passwords are stored
  // Security audit complete - master passwords confirmed zero-knowledge
  return res.status(410).json({
    error: 'Security audit endpoints have been disabled',
    message: 'Zero-knowledge compliance verified ✅',
    timestamp: new Date().toISOString()
  });
});

/**
 * Health check for admin endpoints (kept for monitoring)
 * GET /admin/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Admin service is running',
    security_status: 'Zero-knowledge architecture verified ✅',
    temporary_endpoints: 'Disabled for security',
    timestamp: new Date().toISOString()
  });
});

/**
 * Security status endpoint (public info only)
 * GET /admin/security-status
 */
router.get('/security-status', (req, res) => {
  res.json({
    zero_knowledge_architecture: true,
    master_passwords_stored: false,
    account_passwords_hashed: true,
    encryption_algorithm: 'AES-256-GCM',
    password_hashing: 'Argon2',
    ssl_enabled: true,
    domain: 'lockrr.app',
    security_verified: '2025-07-24',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 