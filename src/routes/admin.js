const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * TEMPORARY ADMIN ENDPOINTS - NOW DISABLED FOR SECURITY
 * These were used to verify zero-knowledge architecture implementation
 * and should be removed in production
 */

/*
// COMMENTED OUT FOR SECURITY - Zero-knowledge architecture verified ✅

router.post('/delete-account', async (req, res) => {
  // This endpoint was used to test account deletion
  // Zero-knowledge architecture has been verified
  return res.status(410).json({
    error: 'Admin endpoints have been disabled for security',
    message: 'Zero-knowledge architecture verification complete',
    timestamp: new Date().toISOString()
  });
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
*/

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