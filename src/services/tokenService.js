const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-testing';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-for-testing';
    this.accessTokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    
    // In-memory blacklist for development (should use Redis in production)
    this.blacklistedTokens = new Set();
  }

  /**
   * Generate a JWT access token
   * @param {object} user - User object containing id, email, role
   * @returns {Promise<string>} - JWT access token
   */
  async generateAccessToken(user) {
    try {
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      };

      return jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: 'lockr-backend',
        audience: 'lockr-client'
      });
    } catch (error) {
      throw new Error(`Access token generation failed: ${error.message}`);
    }
  }

  /**
   * Generate a JWT refresh token
   * @param {object} user - User object containing id, email
   * @returns {Promise<string>} - JWT refresh token
   */
  async generateRefreshToken(user) {
    try {
      const payload = {
        id: user.id,
        email: user.email,
        type: 'refresh',
        jti: crypto.randomUUID() // Unique token ID for blacklisting
      };

      return jwt.sign(payload, this.jwtRefreshSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'lockr-backend',
        audience: 'lockr-client'
      });
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify and decode an access token
   * @param {string} token - JWT access token
   * @returns {Promise<object>} - Decoded token payload
   */
  async verifyAccessToken(token) {
    try {
      this._validateTokenFormat(token);
      
      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      // First decode without verification to check type
      const unverified = jwt.decode(token);
      if (unverified && unverified.type !== 'access') {
        throw new Error('Invalid token type');
      }

      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'lockr-backend',
        audience: 'lockr-client'
      });

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Verify and decode a refresh token
   * @param {string} token - JWT refresh token
   * @returns {Promise<object>} - Decoded token payload
   */
  async verifyRefreshToken(token) {
    try {
      this._validateTokenFormat(token);
      
      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      // First decode without verification to check type
      const unverified = jwt.decode(token);
      if (unverified && unverified.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const decoded = jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'lockr-backend',
        audience: 'lockr-client'
      });

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Blacklist a token (for logout or security purposes)
   * @param {string} token - JWT token to blacklist
   * @returns {Promise<void>}
   */
  async blacklistToken(token) {
    try {
      this._validateTokenFormat(token);
      
      // Try to decode to ensure it's a valid token before blacklisting
      const decoded = jwt.decode(token);
      if (!decoded) {
        throw new Error('Cannot blacklist invalid token');
      }

      this.blacklistedTokens.add(token);
    } catch (error) {
      if (error.message === 'Invalid token') {
        throw new Error('Cannot blacklist invalid token');
      }
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   * @returns {Promise<boolean>} - True if blacklisted
   */
  async isTokenBlacklisted(token) {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Refresh an access token using a valid refresh token
   * @param {string} refreshToken - Valid refresh token
   * @returns {Promise<object>} - New access and refresh tokens
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify the refresh token
      const decoded = await this.verifyRefreshToken(refreshToken);
      
      // Create user object from decoded token
      const user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      // Generate new tokens
      const newAccessToken = await this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user);

      // Blacklist the old refresh token
      await this.blacklistToken(refreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract user ID from a token without full verification
   * @param {string} token - JWT token
   * @returns {Promise<string>} - User ID
   */
  async extractUserIdFromToken(token) {
    try {
      const decoded = await this.verifyAccessToken(token);
      return decoded.id;
    } catch (error) {
      throw new Error(`Failed to extract user ID: ${error.message}`);
    }
  }

  /**
   * Clear the token blacklist (for testing purposes)
   */
  clearBlacklist() {
    this.blacklistedTokens.clear();
  }

  /**
   * Validate JWT token format
   * @private
   * @param {string} token - Token to validate
   */
  _validateTokenFormat(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token');
    }
  }
}

module.exports = { TokenService }; 