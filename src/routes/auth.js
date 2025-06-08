const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/change-password', authMiddleware, authController.changePassword);
router.delete('/delete-account', authMiddleware, authController.deleteAccount);

// Settings routes (protected)
router.get('/settings', authMiddleware, authController.getSettings);
router.put('/settings', authMiddleware, authController.updateSettings);

// 2FA routes (all protected)
router.post('/2fa/setup', authMiddleware, authController.setup2FA);
router.post('/2fa/enable', authMiddleware, authController.enable2FA);
router.post('/2fa/disable', authMiddleware, authController.disable2FA);
router.post('/2fa/verify', authMiddleware, authController.verify2FA);
router.post('/2fa/verify-backup', authMiddleware, authController.verifyBackupCode);
router.get('/2fa/status', authMiddleware, authController.get2FAStatus);

module.exports = router; 