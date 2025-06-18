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

// Entry management (requires unlocked vault)
router.post('/entries', vaultController.requireUnlockedVault, vaultController.createEntry);
router.get('/entries', vaultController.requireUnlockedVault, vaultController.getEntries);
router.get('/entries/:id', vaultController.getEntry);
router.put('/entries/:id', vaultController.requireUnlockedVault, vaultController.updateEntry);
router.delete('/entries/:id', vaultController.requireUnlockedVault, vaultController.deleteEntry);

// Search (requires unlocked vault)
router.post('/search', vaultController.requireUnlockedVault, vaultController.searchEntries);

// Password expiry checking (requires unlocked vault)
router.get('/expiring-passwords', vaultController.requireUnlockedVault, vaultController.checkExpiringPasswords);

// Master password management (requires unlocked vault)
router.post('/change-master-password', vaultController.requireUnlockedVault, vaultController.changeMasterPassword);

// Debug endpoints (development only)
router.post('/reset-master-password-hash', vaultController.resetMasterPasswordHash);

module.exports = router; 