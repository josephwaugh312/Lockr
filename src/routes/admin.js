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
 * TEMPORARY SECURITY AUDIT ENDPOINT - Inspect user data storage
 * GET /admin/inspect-user/:email
 * Query: ?adminKey=temp-admin-key-123
 */
router.get('/inspect-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { adminKey } = req.query;

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

    console.log(`🔍 Inspecting user data for: ${email}`);
    
    // Get ALL user data to show what's actually stored
    const userResult = await database.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        email,
        timestamp: new Date().toISOString()
      });
    }

    const user = userResult.rows[0];

    // Show what columns exist and what's stored
    const storedData = {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash ? {
        stored: true,
        type: 'hashed',
        algorithm: 'argon2',
        preview: user.password_hash.substring(0, 20) + '...',
        full_length: user.password_hash.length
      } : null,
      master_password_hash: user.master_password_hash ? {
        stored: true,
        type: 'SECURITY VIOLATION',
        preview: user.master_password_hash.substring(0, 20) + '...'
      } : {
        stored: false,
        status: 'ZERO-KNOWLEDGE COMPLIANT ✅'
      },
      role: user.role,
      name: user.name,
      email_verified: user.email_verified,
      phone_number: user.phone_number,
      phone_verified: user.phone_verified,
      sms_opt_out: user.sms_opt_out,
      two_factor_enabled: user.two_factor_enabled,
      two_factor_secret: user.two_factor_secret ? 'STORED (encrypted)' : null,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    // Security analysis
    const securityAnalysis = {
      zero_knowledge_compliant: !user.master_password_hash,
      password_properly_hashed: user.password_hash && user.password_hash.startsWith('$argon2'),
      master_password_status: user.master_password_hash ? 
        '❌ SECURITY VIOLATION - Master password hash found!' : 
        '✅ SECURE - No master password hash stored',
      recommendations: []
    };

    if (user.master_password_hash) {
      securityAnalysis.recommendations.push('CRITICAL: Remove master password hash from database');
    }
    if (!user.password_hash || !user.password_hash.startsWith('$argon2')) {
      securityAnalysis.recommendations.push('WARNING: Account password should be hashed with Argon2');
    }
    if (securityAnalysis.zero_knowledge_compliant && securityAnalysis.password_properly_hashed) {
      securityAnalysis.recommendations.push('✅ Security implementation is correct');
    }

    console.log(`✅ User data inspection completed for: ${email}`);
    
    // Log the inspection for audit purposes
    logger.info('Security audit - user data inspection', {
      inspectedEmail: email,
      zeroKnowledgeCompliant: securityAnalysis.zero_knowledge_compliant,
      passwordProperlyHashed: securityAnalysis.password_properly_hashed,
      timestamp: new Date().toISOString(),
      adminAction: true,
      method: 'HTTP'
    });

    res.status(200).json({
      success: true,
      message: 'User data inspection completed',
      email: email,
      stored_data: storedData,
      security_analysis: securityAnalysis,
      database_schema_info: {
        table_name: 'users',
        columns_inspected: Object.keys(user),
        zero_knowledge_fields: [
          'master_password (not stored - client-side only)',
          'encryption_keys (derived client-side from master password)',
          'vault_data (encrypted with client-derived keys)'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error inspecting user data:', error);
    logger.error('Security audit failed', {
      email: req.params?.email,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to inspect user data',
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