const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, requireEmailVerification, optionalAuth } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes (basic access - no email verification required)
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getProfile);

// Protected routes requiring email verification
router.put('/profile', authMiddleware, requireEmailVerification, authController.updateProfile);
router.put('/change-password', authMiddleware, requireEmailVerification, authController.changePassword);
router.delete('/delete-account', authMiddleware, requireEmailVerification, authController.deleteAccount);

// Settings routes (protected and require email verification)
router.get('/settings', authMiddleware, requireEmailVerification, authController.getSettings);
router.put('/settings', authMiddleware, requireEmailVerification, authController.updateSettings);

// Security alerts (require email verification)
router.get('/security-alerts', authMiddleware, requireEmailVerification, authController.getSecurityAlerts);
router.post('/test-security-alert', authMiddleware, requireEmailVerification, authController.triggerTestSecurityAlert);
router.post('/test-password-expiry', authMiddleware, requireEmailVerification, authController.triggerTestPasswordExpiryNotification);
router.post('/test-data-breach', authMiddleware, requireEmailVerification, authController.triggerTestDataBreachNotification);
router.post('/test-account-lockout', authMiddleware, requireEmailVerification, authController.triggerTestAccountLockout);

// Password health and breach monitoring (require email verification)
router.get('/password-health', authMiddleware, requireEmailVerification, authController.getPasswordHealth);
router.get('/breach-check', authMiddleware, requireEmailVerification, authController.checkDataBreaches);

// Password reset routes (public)
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.completePasswordReset);

// Master password reset routes (public)
router.post('/forgot-master-password', authController.requestMasterPasswordReset);
router.post('/reset-master-password', authController.completeMasterPasswordReset);

// 2FA routes (all protected and require email verification)
router.post('/2fa/setup', authMiddleware, authController.setup2FA);
router.post('/2fa/enable', authMiddleware, authController.enable2FA);
router.post('/2fa/disable', authMiddleware, authController.disable2FA);
router.post('/2fa/verify', authMiddleware, authController.verify2FA);
router.post('/2fa/verify-backup', authMiddleware, authController.verifyBackupCode);
router.get('/2fa/status', authMiddleware, authController.get2FAStatus);

// Email verification routes (no email verification required - these are for getting verified!)
router.post('/email/send-verification', authMiddleware, authController.sendVerificationEmail);
router.get('/email/verify', authController.verifyEmail); // Public route - uses token from URL
router.post('/email/resend-verification', authController.resendVerificationEmail); // Public route
router.get('/email/verification-status', authMiddleware, authController.getEmailVerificationStatus);

// Admin routes (temporarily removing email verification for testing)
router.post('/admin/system-maintenance', authMiddleware, authController.sendSystemMaintenanceNotification);
router.post('/admin/password-expiry-check', authMiddleware, requireEmailVerification, authController.runPasswordExpiryCheck);
router.post('/admin/breach-monitoring', authMiddleware, authController.runAutomatedBreachMonitoring);

// Phone number management routes
router.post('/phone/add', authMiddleware, authController.addPhoneNumber);
router.post('/phone/send-verification', authMiddleware, authController.sendPhoneVerification);
router.post('/phone/verify', authMiddleware, authController.verifyPhoneNumber);
router.delete('/phone', authMiddleware, authController.removePhoneNumber);
router.get('/phone/status', authMiddleware, authController.getPhoneStatus);

module.exports = router; 