const { CryptoService } = require('../services/cryptoService');
const { __tokenService } = require('../middleware/auth');
const userStore = require('../models/userStore');
const { logger } = require('../utils/logger');
const {
  validateRegistrationData,
  validateLoginData,
  validatePasswordChangeData,
  validateAccountDeletionData,
  validateRefreshTokenData
} = require('../utils/validation');

// Initialize services
const cryptoService = new CryptoService();
const tokenService = __tokenService; // Use same instance as middleware

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
    const existingUser = await userStore.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists',
        timestamp: new Date().toISOString()
      });
    }

    // Hash password
    const passwordHash = await cryptoService.hashPassword(password);

    // Create user
    const userData = {
      email,
      passwordHash,
      role: 'user' // Default role, ignore any role provided in request
    };

    const newUser = await userStore.create(userData);

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

    const { email, password } = req.body;

    // Find user by email
    const user = await userStore.findByEmail(email);
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
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Return user data (without sensitive information) and tokens
    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role
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
    const user = await userStore.findById(userId);
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
    const user = await userStore.findById(userId);
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
    await userStore.update(userId, { passwordHash: newPasswordHash });

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
    const user = await userStore.findById(userId);
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
    await userStore.delete(userId);

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

module.exports = {
  register,
  login,
  logout,
  refresh,
  getProfile,
  changePassword,
  deleteAccount,
  handleJsonError
}; 