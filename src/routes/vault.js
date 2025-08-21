const express = require('express');
const router = express.Router();
const vaultController = require('../controllers/vaultController');
const { authMiddleware, requireEmailVerification } = require('../middleware/auth');

// All vault routes require authentication and email verification
router.use(authMiddleware);
router.use(requireEmailVerification);

// Vault management (doesn't require unlocked vault)
router.post('/unlock', vaultController.unlockVault);
router.post('/lock', vaultController.lockVault);

// Password generation (doesn't require unlocked vault)
router.post('/generate-password', vaultController.generatePassword);

// Import/Export (requires unlocked vault)
router.post('/export', vaultController.exportVault);
router.post('/import', vaultController.importVault);

// Testing/debugging routes
router.post('/clear-notification-tracking', vaultController.clearNotificationTracking);

// Helper middleware: require encryption key for these route-level endpoints
function requireEncryptionKey(req, res, next) {
  const key = req.body?.encryptionKey || req.query?.encryptionKey;
  if (!key) {
    return res.status(400).json({
      error: 'Encryption key is required for vault operations',
      timestamp: new Date().toISOString()
    });
  }
  next();
}

// Entry management (stateless - encryption key provided in request body)
router.post('/entries', requireEncryptionKey, vaultController.createEntry);
router.post('/entries/list', requireEncryptionKey, vaultController.getEntries); // Changed to POST for encryption key
router.get('/entries/:id', vaultController.getEntry);
router.put('/entries/:id', vaultController.updateEntry);
router.delete('/entries/:id', vaultController.deleteEntry);

// Search (requires encryption key in request body)
router.post('/search', vaultController.searchEntries);

// Password expiry checking (requires encryption key in request body)
router.post('/expiring-passwords', vaultController.checkExpiringPasswords);

// Master password management (requires encryption key in request body)
router.post('/change-master-password', vaultController.changeMasterPassword);

// Debug endpoints (development only)
router.post('/reset-master-password-hash', vaultController.resetMasterPasswordHash);

module.exports = router; 