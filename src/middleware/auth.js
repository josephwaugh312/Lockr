const { TokenService } = require('../services/tokenService');
const { logger } = require('../utils/logger');

// Initialize token service
const tokenService = new TokenService();

/**
 * Extract token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} - Extracted token or null
 */
function extractTokenFromHeader(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader.trim() === '') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Invalid authorization format');
  }

  return parts[1];
}

/**
 * Required authentication middleware
 * Validates JWT access token and adds user to req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        timestamp: new Date().toISOString()
      });
    }

    // Verify the access token
    const decoded = await tokenService.verifyAccessToken(token);
    
    // Add user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };

    // Log successful authentication
    logger.info('User authenticated', {
      userId: decoded.id,
      email: decoded.email,
      endpoint: req.path,
      method: req.method,
      ip: req.ip
    });

    next();
  } catch (error) {
    // Log authentication failure
    logger.warn('Authentication failed', {
      error: error.message,
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Map specific error messages
    let errorMessage = 'Authentication failed';
    let statusCode = 401;

    if (error.message === 'Invalid authorization format') {
      errorMessage = 'Invalid authorization format';
    } else if (error.message === 'Invalid token') {
      errorMessage = 'Invalid token';
    } else if (error.message === 'Token expired') {
      errorMessage = 'Token expired';
    } else if (error.message === 'Token has been revoked') {
      errorMessage = 'Token has been revoked';
    } else if (error.message === 'Invalid token type') {
      errorMessage = 'Invalid token type';
    }

    return res.status(statusCode).json({
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to req.user if valid token provided, otherwise continues without user
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      // No token provided, continue without user
      return next();
    }

    // Try to verify the access token
    const decoded = await tokenService.verifyAccessToken(token);
    
    // Add user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };

    // Log successful optional authentication
    logger.info('Optional authentication successful', {
      userId: decoded.id,
      endpoint: req.path,
      method: req.method,
      ip: req.ip
    });

    next();
  } catch (error) {
    // For optional auth, log but don't block the request
    logger.debug('Optional authentication failed', {
      error: error.message,
      endpoint: req.path,
      method: req.method,
      ip: req.ip
    });

    // Continue without user
    next();
  }
};

/**
 * Role-based access control middleware
 * Must be used after authMiddleware
 * @param {string|Array} allowedRoles - Role(s) that can access the endpoint
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          error: 'Access token required',
          timestamp: new Date().toISOString()
        });
      }

      // Normalize allowedRoles to array
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      const userRole = req.user.role;

      // Check if user's role is in allowed roles
      if (!roles.includes(userRole)) {
        logger.warn('Access denied - insufficient permissions', {
          userId: req.user.id,
          userRole: userRole,
          requiredRoles: roles,
          endpoint: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          timestamp: new Date().toISOString()
        });
      }

      // Log successful role check
      logger.info('Role-based access granted', {
        userId: req.user.id,
        userRole: userRole,
        endpoint: req.path,
        method: req.method,
        ip: req.ip
      });

      next();
    } catch (error) {
      logger.error('Role check error', {
        error: error.message,
        userId: req.user?.id,
        endpoint: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(500).json({
        error: 'Authorization check failed',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Middleware to blacklist current token (for logout)
 */
const blacklistToken = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (token) {
      await tokenService.blacklistToken(token);
      
      logger.info('Token blacklisted', {
        userId: req.user?.id,
        endpoint: req.path,
        method: req.method,
        ip: req.ip
      });
    }

    next();
  } catch (error) {
    logger.error('Token blacklist error', {
      error: error.message,
      userId: req.user?.id,
      endpoint: req.path,
      method: req.method,
      ip: req.ip
    });

    // Continue even if blacklisting fails
    next();
  }
};

/**
 * Middleware to require email verification
 * Blocks access if user's email is not verified
 */
const requireEmailVerification = async (req, res, next) => {
  try {
    // First ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user's email is verified
    const userRepository = require('../models/userRepository');
    const user = await userRepository.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email verification required',
        message: 'Please verify your email address to access this feature',
        emailVerified: false,
        timestamp: new Date().toISOString()
      });
    }

    // Email is verified, continue to next middleware
    next();
  } catch (error) {
    logger.error('Email verification check failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

// Export for testing purposes
const __tokenService = tokenService;

module.exports = {
  authMiddleware,
  optionalAuth,
  requireRole,
  blacklistToken,
  extractTokenFromHeader,
  __tokenService,
  requireEmailVerification
}; 