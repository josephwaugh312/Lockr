/**
 * Master Password Reset Tests for AuthController
 * Tests the critical master password reset flow that wipes vault data
 */

// Mock dependencies first
jest.mock('../../src/models/userRepository');
jest.mock('../../src/models/masterPasswordResetRepository');
jest.mock('../../src/models/vaultRepository');
jest.mock('../../src/services/notificationService');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/validation', () => ({
  validateMasterPasswordResetRequest: jest.fn(),
  validateMasterPasswordResetCompletion: jest.fn()
}));

// Create mock instance for CryptoService
let mockCryptoServiceInstance;

// Use isolated modules to ensure clean loading
let authController;
let userRepository;
let masterPasswordResetRepository;
let vaultRepository;
let notificationService;
let logger;
let securityEvents;
let validateMasterPasswordResetRequest;
let validateMasterPasswordResetCompletion;

beforeAll(() => {
  // Create mock instance for CryptoService
  mockCryptoServiceInstance = {
    hashPassword: jest.fn(),
    deriveKeyFromPassword: jest.fn(),
    encrypt: jest.fn(),
    verifyPassword: jest.fn()
  };
  
  // Mock cryptoService module
  jest.mock('../../src/services/cryptoService', () => ({
    CryptoService: jest.fn().mockImplementation(() => mockCryptoServiceInstance)
  }));
  
  jest.isolateModules(() => {
    authController = require('../../src/controllers/authController');
    userRepository = require('../../src/models/userRepository');
    masterPasswordResetRepository = require('../../src/models/masterPasswordResetRepository');
    vaultRepository = require('../../src/models/vaultRepository');
    notificationService = require('../../src/services/notificationService');
    const loggerModule = require('../../src/utils/logger');
    logger = loggerModule.logger;
    securityEvents = loggerModule.securityEvents;
    const validationModule = require('../../src/utils/validation');
    validateMasterPasswordResetRequest = validationModule.validateMasterPasswordResetRequest;
    validateMasterPasswordResetCompletion = validationModule.validateMasterPasswordResetCompletion;
  });
});

describe.skip('AuthController - Master Password Reset Functions', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup crypto service mock methods
    mockCryptoServiceInstance.hashPassword.mockResolvedValue('hashed-password');
    mockCryptoServiceInstance.deriveKeyFromPassword.mockResolvedValue('derived-key');
    mockCryptoServiceInstance.encrypt.mockResolvedValue({ encrypted: 'data' });
    
    // Setup request and response objects
    req = {
      body: {},
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('Test User Agent')
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('requestMasterPasswordReset', () => {
    test('should initiate master password reset with confirmation', async () => {
      req.body = {
        email: 'test@example.com',
        confirmed: true
      };

      validateMasterPasswordResetRequest.mockReturnValue({ isValid: true });
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };
      
      userRepository.findByEmail.mockResolvedValue(mockUser);
      masterPasswordResetRepository.checkIpRateLimit.mockResolvedValue({ allowed: true, count: 1 });
      masterPasswordResetRepository.checkUserRateLimit.mockResolvedValue({ allowed: true, count: 1 });
      masterPasswordResetRepository.createResetToken.mockResolvedValue({
        token: 'reset-token-123',
        expiresAt: new Date(Date.now() + 3600000)
      });
      notificationService.sendPasswordResetNotification = jest.fn().mockResolvedValue(true);

      await authController.requestMasterPasswordReset(req, res);

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(masterPasswordResetRepository.createResetToken).toHaveBeenCalledWith(
        'user-123',
        '192.168.1.1',
        'Test User Agent'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('vault reset link')
      }));
    });

    test('should reject without confirmation', async () => {
      req.body = {
        email: 'test@example.com',
        confirmed: false
      };

      validateMasterPasswordResetRequest.mockReturnValue({ isValid: true });

      await authController.requestMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('requires confirmation'),
        warning: expect.stringContaining('ZERO-KNOWLEDGE')
      }));
    });

    test('should handle validation errors', async () => {
      req.body = {
        email: 'invalid-email',
        confirmed: true
      };

      validateMasterPasswordResetRequest.mockReturnValue({
        isValid: false,
        errors: ['Please provide a valid email address']
      });

      await authController.requestMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Please provide a valid email address'
      }));
    });

    test('should handle IP rate limiting', async () => {
      req.body = {
        email: 'test@example.com',
        confirmed: true
      };

      validateMasterPasswordResetRequest.mockReturnValue({ isValid: true });
      masterPasswordResetRepository.checkIpRateLimit.mockResolvedValue({
        allowed: false,
        count: 6
      });

      await authController.requestMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Too many reset requests. Please try again later.',
        retryAfter: 3600
      }));
      expect(logger.warn).toHaveBeenCalledWith(
        'Master password reset rate limit exceeded by IP',
        expect.any(Object)
      );
    });

    test('should handle user rate limiting silently', async () => {
      req.body = {
        email: 'test@example.com',
        confirmed: true
      };

      validateMasterPasswordResetRequest.mockReturnValue({ isValid: true });
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };
      
      userRepository.findByEmail.mockResolvedValue(mockUser);
      masterPasswordResetRepository.checkIpRateLimit.mockResolvedValue({ allowed: true });
      masterPasswordResetRepository.checkUserRateLimit.mockResolvedValue({
        allowed: false,
        count: 4
      });

      await authController.requestMasterPasswordReset(req, res);

      // Should still return success to prevent enumeration
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('If an account')
      }));
      expect(logger.warn).toHaveBeenCalledWith(
        'Master password reset rate limit exceeded by user',
        expect.any(Object)
      );
    });

    test('should handle non-existent user gracefully', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        confirmed: true
      };

      validateMasterPasswordResetRequest.mockReturnValue({ isValid: true });
      userRepository.findByEmail.mockResolvedValue(null);
      masterPasswordResetRepository.checkIpRateLimit.mockResolvedValue({ allowed: true });

      await authController.requestMasterPasswordReset(req, res);

      // Should return success to prevent email enumeration
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('If an account')
      }));
      expect(logger.info).toHaveBeenCalledWith(
        'Master password reset requested for non-existent email',
        expect.any(Object)
      );
    });

    test('should handle service errors', async () => {
      req.body = {
        email: 'test@example.com',
        confirmed: true
      };

      validateMasterPasswordResetRequest.mockReturnValue({ isValid: true });
      userRepository.findByEmail.mockRejectedValue(new Error('Database error'));
      masterPasswordResetRepository.checkIpRateLimit.mockResolvedValue({ allowed: true });

      await authController.requestMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to process vault reset request'
      }));
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('completeMasterPasswordReset', () => {
    test('should complete master password reset and wipe vault', async () => {
      req.body = {
        token: 'a'.repeat(64),
        newMasterPassword: 'NewSecureP@ssw0rd123!',
        confirmed: true
      };

      validateMasterPasswordResetCompletion.mockReturnValue({ isValid: true });
      
      const mockResetToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'a'.repeat(64)
      };
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };
      
      const mockWipeResult = {
        entriesWiped: 42,
        timestamp: new Date()
      };

      masterPasswordResetRepository.findValidResetToken.mockResolvedValue(mockResetToken);
      userRepository.findById.mockResolvedValue(mockUser);
      masterPasswordResetRepository.wipeVaultAndResetMasterPassword.mockResolvedValue(mockWipeResult);
      vaultRepository.createEntry.mockResolvedValue({ id: 'test-entry' });
      masterPasswordResetRepository.cleanupExpiredTokens.mockResolvedValue();
      notificationService.sendSecurityAlert.mockResolvedValue();

      await authController.completeMasterPasswordReset(req, res);

      expect(masterPasswordResetRepository.findValidResetToken).toHaveBeenCalledWith('a'.repeat(64));
      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      // Note: hashPassword is called but the result isn't used in zero-knowledge architecture
      expect(mockCryptoServiceInstance.hashPassword).toHaveBeenCalledWith('NewSecureP@ssw0rd123!');
      expect(mockCryptoServiceInstance.deriveKeyFromPassword).toHaveBeenCalledWith(
        'NewSecureP@ssw0rd123!',
        'test@example.com'
      );
      expect(masterPasswordResetRepository.wipeVaultAndResetMasterPassword).toHaveBeenCalledWith(
        'user-123',
        'token-123'
      );
      expect(vaultRepository.createEntry).toHaveBeenCalled(); // Test entry creation
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('reset successfully'),
        entriesWiped: 42
      }));
      expect(logger.error).toHaveBeenCalledWith(
        'VAULT DATA WIPED - Master password reset completed',
        expect.any(Object)
      );
      expect(securityEvents.masterPasswordReset).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        42,
        '192.168.1.1'
      );
    });

    test('should handle invalid reset token', async () => {
      req.body = {
        token: 'invalid-token',
        newMasterPassword: 'NewPassword123!',
        confirmed: true
      };

      validateMasterPasswordResetCompletion.mockReturnValue({ isValid: true });
      masterPasswordResetRepository.findValidResetToken.mockResolvedValue(null);

      await authController.completeMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid or expired reset token'
      }));
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid or expired master password reset token used',
        expect.any(Object)
      );
    });

    test('should handle non-existent user for token', async () => {
      req.body = {
        token: 'valid-token',
        newMasterPassword: 'NewPassword123!',
        confirmed: true
      };

      validateMasterPasswordResetCompletion.mockReturnValue({ isValid: true });
      
      const mockResetToken = {
        id: 'token-123',
        userId: 'user-123',
        token: 'valid-token'
      };

      masterPasswordResetRepository.findValidResetToken.mockResolvedValue(mockResetToken);
      userRepository.findById.mockResolvedValue(null);

      await authController.completeMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid reset token'
      }));
      expect(logger.error).toHaveBeenCalledWith(
        'Master password reset token references non-existent user',
        expect.any(Object)
      );
    });

    test('should handle validation errors', async () => {
      req.body = {
        token: 'token',
        newMasterPassword: 'weak',
        confirmed: true
      };

      validateMasterPasswordResetCompletion.mockReturnValue({
        isValid: false,
        errors: ['Password too weak', 'Must be at least 12 characters']
      });

      await authController.completeMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Password too weak, Must be at least 12 characters'
      }));
    });

    test('should continue even if test entry creation fails', async () => {
      req.body = {
        token: 'valid-token',
        newMasterPassword: 'NewPassword123!',
        confirmed: true
      };

      validateMasterPasswordResetCompletion.mockReturnValue({ isValid: true });
      
      const mockResetToken = {
        id: 'token-123',
        userId: 'user-123'
      };
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };
      
      const mockWipeResult = {
        entriesWiped: 10,
        timestamp: new Date()
      };

      masterPasswordResetRepository.findValidResetToken.mockResolvedValue(mockResetToken);
      userRepository.findById.mockResolvedValue(mockUser);
      masterPasswordResetRepository.wipeVaultAndResetMasterPassword.mockResolvedValue(mockWipeResult);
      vaultRepository.createEntry.mockRejectedValue(new Error('Failed to create entry'));
      masterPasswordResetRepository.cleanupExpiredTokens.mockResolvedValue();

      await authController.completeMasterPasswordReset(req, res);

      // Should still succeed even if test entry fails
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('reset successfully')
      }));
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create test validation entry',
        expect.any(Object)
      );
    });

    test('should handle notification failures gracefully', async () => {
      req.body = {
        token: 'valid-token',
        newMasterPassword: 'NewPassword123!',
        confirmed: true
      };

      validateMasterPasswordResetCompletion.mockReturnValue({ isValid: true });
      
      const mockResetToken = { id: 'token-123', userId: 'user-123' };
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockWipeResult = { entriesWiped: 5, timestamp: new Date() };

      masterPasswordResetRepository.findValidResetToken.mockResolvedValue(mockResetToken);
      userRepository.findById.mockResolvedValue(mockUser);
      masterPasswordResetRepository.wipeVaultAndResetMasterPassword.mockResolvedValue(mockWipeResult);
      vaultRepository.createEntry.mockResolvedValue({ id: 'test' });
      notificationService.sendSecurityAlert.mockRejectedValue(new Error('Notification failed'));
      masterPasswordResetRepository.cleanupExpiredTokens.mockResolvedValue();

      await authController.completeMasterPasswordReset(req, res);

      // Should still succeed even if notification fails
      expect(res.status).toHaveBeenCalledWith(200);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send master password reset notification:',
        expect.any(Error)
      );
    });

    test('should handle complete failure gracefully', async () => {
      req.body = {
        token: 'valid-token',
        newMasterPassword: 'NewPassword123!',
        confirmed: true
      };

      validateMasterPasswordResetCompletion.mockReturnValue({ isValid: true });
      masterPasswordResetRepository.findValidResetToken.mockRejectedValue(new Error('Database connection failed'));

      await authController.completeMasterPasswordReset(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Failed to reset master password'
      }));
      expect(logger.error).toHaveBeenCalledWith(
        'Master password reset completion error',
        expect.any(Object)
      );
    });
  });
});