const express = require('express');
const router = express.Router();
const vaultController = require('../controllers/vaultController');
const { authMiddleware } = require('../middleware/auth');

// All vault routes require authentication
router.use(authMiddleware);

// Vault management (doesn't require unlocked vault)
router.post('/unlock', vaultController.unlockVault);

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

// Master password management (requires unlocked vault)
router.post('/change-master-password', vaultController.requireUnlockedVault, vaultController.changeMasterPassword);

module.exports = router; 