const { CryptoService } = require('../services/cryptoService');
const { __tokenService } = require('../middleware/auth');
const userRepository = require('../models/userRepository');
const userSettingsRepository = require('../models/userSettingsRepository');
const TwoFactorService = require('../services/twoFactorService');
const { logger, securityEvents } = require('../utils/logger');
const { masterPasswordHashes } = require('./vaultController');
const {
  validateRegistrationData,
  validateLoginData,
  validatePasswordChangeData,
  validateAccountDeletionData,
  validateRefreshTokenData
} = require('../utils/validation');
const argon2 = require('argon2');
const { 
  generateTokens, 
  verifyRefreshToken, 
  addToBlacklist,
  isTokenBlacklisted 
} = require('../services/tokenService');
const { body, validationResult } = require('express-validator');

// Initialize services
const cryptoService = new CryptoService();
const tokenService = __tokenService; // Use same instance as middleware
const twoFactorService = new TwoFactorService();

/**
 * Register a new user
 * POST /auth/register
 */
const register = async (req, res) => {
  try {
    // Validate request data
    const validation = validateRegistrationData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { email, password, masterPassword } = req.body;

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists',
        timestamp: new Date().toISOString()
      });
    }

    // Hash password
    const passwordHash = await cryptoService.hashPassword(password);

    // Hash master password for vault operations
    const masterPasswordHash = await cryptoService.hashPassword(masterPassword);

    // Create user
    const userData = {
      email,
      passwordHash,
      role: 'user' // Default role, ignore any role provided in request
    };

    const newUser = await userRepository.create(userData);

    // Store master password hash for vault operations
    masterPasswordHashes.set(newUser.id, masterPasswordHash);

    // Generate tokens
    const userForToken = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    };

    const accessToken = await tokenService.generateAccessToken(userForToken);
    const refreshToken = await tokenService.generateRefreshToken(userForToken);

    // Log successful registration
    logger.info('User registered successfully', {
      userId: newUser.id,
      email: newUser.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Return user data (without sensitive information) and tokens
    const userResponse = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt
    };

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Registration error', {
      error: error.message,
      email: req.body?.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Registration failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Login user
 * POST /auth/login
 */
const login = async (req, res) => {
  try {
    // Validate request data
    const validation = validateLoginData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { email, password, twoFactorCode } = req.body;

    // Find user by email with 2FA data
    const user = await userRepository.findByEmailWith2FA(email);
    if (!user) {
      logger.warn('Login attempt with non-existent email', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
    }

    // Verify password
    const isValidPassword = await cryptoService.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        // Password is valid but 2FA is required
        return res.status(200).json({
          message: 'Two-factor authentication required',
          requires2FA: true,
          timestamp: new Date().toISOString()
        });
      }

      // Verify 2FA code
      const is2FAValid = await twoFactorService.verifyToken(twoFactorCode, user.twoFactorSecret);
      if (!is2FAValid) {
        logger.warn('Login attempt with invalid 2FA code', {
          userId: user.id,
          email: user.email,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          error: 'Invalid two-factor authentication code',
          timestamp: new Date().toISOString()
        });
      }

      logger.info('2FA verification successful during login', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    // Generate tokens
    const userForToken = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = await tokenService.generateAccessToken(userForToken);
    const refreshToken = await tokenService.generateRefreshToken(userForToken);

    // Log successful login
    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      with2FA: user.twoFactorEnabled,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Return user data (without sensitive information) and tokens
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled
    };

    res.status(200).json({
      message: 'Login successful',
      user: userResponse,
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Login error', {
      error: error.message,
      email: req.body?.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Login failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Logout user (blacklist token)
 * POST /auth/logout
 */
const logout = async (req, res) => {
  try {
    // Token is already validated by authMiddleware
    // User info is available in req.user
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    // Blacklist the token
    await tokenService.blacklistToken(token);

    logger.info('User logged out successfully', {
      userId: req.user.id,
      email: req.user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Logout error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Logout failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Refresh access token
 * POST /auth/refresh
 */
const refresh = async (req, res) => {
  try {
    // Validate request data
    const validation = validateRefreshTokenData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { refreshToken } = req.body;

    // Use TokenService to refresh tokens
    const newTokens = await tokenService.refreshAccessToken(refreshToken);

    logger.info('Tokens refreshed successfully', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      message: 'Tokens refreshed successfully',
      tokens: newTokens
    });

  } catch (error) {
    logger.warn('Token refresh failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(401).json({
      error: 'Invalid refresh token',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get current user profile
 * GET /auth/me
 */
const getProfile = async (req, res) => {
  try {
    // User info is available from authMiddleware
    const userId = req.user.id;

    // Get fresh user data from store
    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Return user data (without sensitive information)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      user: userResponse
    });

  } catch (error) {
    logger.error('Get profile error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to retrieve profile',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update user profile (name and email)
 * PUT /auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    // Validate at least one field is provided
    if (!name && !email) {
      return res.status(400).json({
        error: 'At least one field (name or email) is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate email format if provided
    if (email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        timestamp: new Date().toISOString()
      });
    }

    // Validate name length if provided
    if (name && (name.length < 1 || name.length > 255)) {
      return res.status(400).json({
        error: 'Name must be between 1 and 255 characters',
        timestamp: new Date().toISOString()
      });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({
          error: 'Email is already in use by another account',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Update user profile
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.toLowerCase().trim();

    const updatedUser = await userRepository.update(userId, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('User profile updated successfully', {
      userId: updatedUser.id,
      email: updatedUser.email,
      updatedFields: Object.keys(updateData),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Return updated user data (without sensitive information)
    const userResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };

    res.status(200).json({
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    logger.error('Profile update error', {
      error: error.message,
      userId: req.user?.id,
      updateData: Object.keys(req.body || {}),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      error: 'Failed to update profile',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Change user password
 * PUT /auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    // Validate request data
    const validation = validatePasswordChangeData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user data
    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Verify current password
    const isValidPassword = await cryptoService.verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Password change attempt with invalid current password', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Current password is incorrect',
        timestamp: new Date().toISOString()
      });
    }

    // Hash new password
    const newPasswordHash = await cryptoService.hashPassword(newPassword);

    // Update password
    await userRepository.update(userId, { passwordHash: newPasswordHash });

    logger.info('Password changed successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Password changed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Change password error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to change password',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Delete user account
 * DELETE /auth/delete-account
 */
const deleteAccount = async (req, res) => {
  try {
    // Validate request data
    const validation = validateAccountDeletionData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    const { password } = req.body;
    const userId = req.user.id;

    // Get user data
    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Verify password
    const isValidPassword = await cryptoService.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Account deletion attempt with invalid password', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Password is incorrect',
        timestamp: new Date().toISOString()
      });
    }

    // Delete user account
    await userRepository.delete(userId);

    // Blacklist current token
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    await tokenService.blacklistToken(token);

    logger.info('User account deleted successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Account deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Delete account error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to delete account',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Error handling middleware for JSON parsing
 */
const handleJsonError = (error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      error: 'Invalid JSON format',
      timestamp: new Date().toISOString()
    });
  }
  next(error);
};

/**
 * Generate 2FA setup data (QR code and secret)
 * POST /auth/2fa/setup
 */
const setup2FA = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const user = await userRepository.findByIdWith2FA(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA is already enabled for this account',
        timestamp: new Date().toISOString()
      });
    }

    // Generate secret and QR code
    const secretData = await twoFactorService.generateSecret(user.email);
    
    // Generate backup codes
    const backupCodesData = await twoFactorService.generateBackupCodes();

    logger.info('2FA setup initiated', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.status(200).json({
      secret: secretData.secret,
      qrCodeUrl: secretData.qrCodeUrl,
      manualEntryKey: secretData.manualEntryKey,
      backupCodes: backupCodesData.plainCodes,
      instructions: twoFactorService.getSetupInstructions()
    });

  } catch (error) {
    logger.error('2FA setup error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to setup 2FA',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Enable 2FA after verifying setup
 * POST /auth/2fa/enable
 */
const enable2FA = async (req, res) => {
  try {
    const { secret, token, backupCodes } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!secret || !token || !Array.isArray(backupCodes)) {
      return res.status(400).json({
        error: 'Secret, verification token, and backup codes are required',
        timestamp: new Date().toISOString()
      });
    }

    // Get user data
    const user = await userRepository.findByIdWith2FA(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA is already enabled for this account',
        timestamp: new Date().toISOString()
      });
    }

    // Verify the TOTP token
    const isValidToken = twoFactorService.verifyToken(token, secret);
    if (!isValidToken) {
      logger.warn('Invalid 2FA token during enable attempt', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Invalid verification code',
        timestamp: new Date().toISOString()
      });
    }

    // Hash backup codes for storage
    const hashedBackupCodes = [];
    for (const code of backupCodes) {
      const hashedCode = await argon2.hash(code, {
        type: argon2.argon2id,
        memoryCost: 2048,
        timeCost: 2,
        parallelism: 1,
      });
      hashedBackupCodes.push(hashedCode);
    }

    // Enable 2FA in database
    const updatedUser = await userRepository.enable2FA(userId, secret, hashedBackupCodes);

    logger.info('2FA enabled successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.status(200).json({
      message: '2FA enabled successfully',
      twoFactorEnabled: true,
      enabledAt: updatedUser.twoFactorEnabledAt
    });

  } catch (error) {
    logger.error('2FA enable error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to enable 2FA',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Disable 2FA
 * POST /auth/2fa/disable
 */
const disable2FA = async (req, res) => {
  try {
    const { password, token } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!password) {
      return res.status(400).json({
        error: 'Current password is required to disable 2FA',
        timestamp: new Date().toISOString()
      });
    }

    // Get user data
    const user = await userRepository.findByIdWith2FA(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA is not enabled for this account',
        timestamp: new Date().toISOString()
      });
    }

    // Verify password
    const isValidPassword = await cryptoService.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      logger.warn('Invalid password during 2FA disable attempt', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Invalid password',
        timestamp: new Date().toISOString()
      });
    }

    // If token provided, verify it; if not provided, this might be a backup code scenario
    if (token) {
      const isValidToken = twoFactorService.verifyToken(token, user.twoFactorSecret);
      if (!isValidToken) {
        logger.warn('Invalid 2FA token during disable attempt', {
          userId: user.id,
          email: user.email,
          ip: req.ip
        });

        return res.status(400).json({
          error: 'Invalid 2FA code',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Disable 2FA in database
    await userRepository.disable2FA(userId);

    logger.info('2FA disabled successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.status(200).json({
      message: '2FA disabled successfully',
      twoFactorEnabled: false
    });

  } catch (error) {
    logger.error('2FA disable error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to disable 2FA',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Verify 2FA token (for login or sensitive operations)
 * POST /auth/2fa/verify
 */
const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!token) {
      return res.status(400).json({
        error: 'Verification token is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get user data
    const user = await userRepository.findByIdWith2FA(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA is not enabled for this account',
        timestamp: new Date().toISOString()
      });
    }

    // Verify the TOTP token
    const isValidToken = twoFactorService.verifyToken(token, user.twoFactorSecret);
    if (!isValidToken) {
      logger.warn('Invalid 2FA token verification', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Invalid verification code',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('2FA token verified successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.status(200).json({
      message: '2FA verification successful',
      verified: true
    });

  } catch (error) {
    logger.error('2FA verification error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to verify 2FA',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Verify backup code
 * POST /auth/2fa/verify-backup
 */
const verifyBackupCode = async (req, res) => {
  try {
    const { backupCode } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!backupCode) {
      return res.status(400).json({
        error: 'Backup code is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get user data
    const user = await userRepository.findByIdWith2FA(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA is not enabled for this account',
        timestamp: new Date().toISOString()
      });
    }

    // Verify the backup code
    const verification = await twoFactorService.verifyBackupCode(backupCode, user.twoFactorBackupCodes);
    if (!verification.valid) {
      logger.warn('Invalid backup code verification', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Invalid backup code',
        timestamp: new Date().toISOString()
      });
    }

    // Remove the used backup code
    const updatedBackupCodes = twoFactorService.removeUsedBackupCode(
      user.twoFactorBackupCodes, 
      verification.usedIndex
    );

    // Update backup codes in database
    await userRepository.updateBackupCodes(userId, updatedBackupCodes);

    logger.info('Backup code verified and consumed', {
      userId: user.id,
      email: user.email,
      remainingCodes: updatedBackupCodes.length,
      ip: req.ip
    });

    res.status(200).json({
      message: 'Backup code verification successful',
      verified: true,
      remainingBackupCodes: updatedBackupCodes.length
    });

  } catch (error) {
    logger.error('Backup code verification error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to verify backup code',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get 2FA status for user
 * GET /auth/2fa/status
 */
const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const user = await userRepository.findByIdWith2FA(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      twoFactorEnabled: user.twoFactorEnabled,
      enabledAt: user.twoFactorEnabledAt,
      backupCodesRemaining: user.twoFactorBackupCodes?.length || 0
    });

  } catch (error) {
    logger.error('Get 2FA status error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to get 2FA status',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get user settings
 * GET /auth/settings
 */
const getSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user settings
    const settings = await userSettingsRepository.getByUserId(userId);

    logger.info('User settings retrieved', {
      userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      service: 'lockr-backend'
    });

    res.status(200).json({
      message: 'Settings retrieved successfully',
      settings
    });

  } catch (error) {
    logger.error('Get settings error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
      service: 'lockr-backend'
    });

    res.status(500).json({
      error: 'Failed to get settings',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update user settings
 * PUT /auth/settings
 */
const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;

    // Validate settings
    const validationErrors = validateSettings(settings);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: validationErrors.join(', '),
        timestamp: new Date().toISOString()
      });
    }

    // Update user settings
    const updatedSettings = await userSettingsRepository.update(userId, settings);

    logger.info('User settings updated', {
      userId,
      updatedFields: Object.keys(settings),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      service: 'lockr-backend'
    });

    res.status(200).json({
      message: 'Settings updated successfully',
      settings: updatedSettings
    });

  } catch (error) {
    logger.error('Update settings error', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip,
      service: 'lockr-backend'
    });

    res.status(500).json({
      error: 'Failed to update settings',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Validate settings data
 * @param {Object} settings - Settings object to validate
 * @returns {Array} Array of validation errors
 */
const validateSettings = (settings) => {
  const errors = [];

  // Validate session timeout
  if (settings.sessionTimeout !== undefined) {
    if (!Number.isInteger(settings.sessionTimeout) || 
        (settings.sessionTimeout <= 0 && settings.sessionTimeout !== -1)) {
      errors.push('Session timeout must be a positive integer or -1 for never');
    }
  }

  // Validate auto lock timeout
  if (settings.autoLockTimeout !== undefined) {
    if (!Number.isInteger(settings.autoLockTimeout) || 
        (settings.autoLockTimeout <= 0 && settings.autoLockTimeout !== -1)) {
      errors.push('Auto-lock timeout must be a positive integer or -1 for never');
    }
  }

  // Validate clipboard timeout
  if (settings.clipboardTimeout !== undefined) {
    if (!Number.isInteger(settings.clipboardTimeout) || 
        (settings.clipboardTimeout <= 0 && settings.clipboardTimeout !== -1)) {
      errors.push('Clipboard timeout must be a positive integer or -1 for never');
    }
  }

  // Validate theme
  if (settings.theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(settings.theme)) {
      errors.push('Theme must be light, dark, or system');
    }
  }

  // Validate boolean fields
  const booleanFields = [
    'requirePasswordConfirmation',
    'showPasswordStrength', 
    'autoSave',
    'compactView',
    'securityAlerts',
    'passwordExpiry',
    'breachAlerts'
  ];

  booleanFields.forEach(field => {
    if (settings[field] !== undefined && typeof settings[field] !== 'boolean') {
      errors.push(`${field} must be a boolean value`);
    }
  });

  return errors;
};

module.exports = {
  register,
  login,
  logout,
  refresh,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  handleJsonError,
  setup2FA,
  enable2FA,
  disable2FA,
  verify2FA,
  verifyBackupCode,
  get2FAStatus,
  getSettings,
  updateSettings
}; 