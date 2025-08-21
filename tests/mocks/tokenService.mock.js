// Complete mock implementation for tokenService
const jwt = require('jsonwebtoken');

class MockTokenService {
  constructor() {
    this.blacklist = new Set();
    this.secret = 'test-secret';
    this.refreshSecret = 'test-refresh-secret';
    this.accessExpiresIn = '15m';
    this.refreshExpiresIn = '7d';
  }

  async generateAccessToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user', type: 'access' },
      this.secret,
      { expiresIn: this.accessExpiresIn || '15m' }
    );
  }

  async generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user', type: 'refresh', jti: 'jti-' + Math.random().toString(36).slice(2) },
      this.refreshSecret,
      { expiresIn: this.refreshExpiresIn || '7d' }
    );
  }

  async generateTokens(user) {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token) {
    if (this.blacklist.has(token)) {
      throw new Error('Token has been revoked');
    }
    try {
      const unverified = jwt.decode(token);
      if (!unverified) {
        throw new Error('Invalid token');
      }
      if (unverified.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return jwt.verify(token, this.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') return Promise.reject(new Error('Token expired'))
      if (error.name === 'JsonWebTokenError') return Promise.reject(new Error('Invalid token'))
      throw error
    }
  }

  async verifyRefreshToken(token) {
    if (this.blacklist.has(token)) {
      throw new Error('Token has been revoked');
    }
    try {
      const unverified = jwt.decode(token);
      if (!unverified) {
        throw new Error('Invalid token');
      }
      if (unverified.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return jwt.verify(token, this.refreshSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') return Promise.reject(new Error('Token expired'))
      if (error.name === 'JsonWebTokenError') return Promise.reject(new Error('Invalid token'))
      throw error
    }
  }

  addToBlacklist(token) {
    this.blacklist.add(token);
    return true;
  }

  isTokenBlacklisted(token) {
    return this.blacklist.has(token);
  }

  clearBlacklist() {
    this.blacklist.clear();
  }

  async generateResetToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  async generateVerificationToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  async generateTempToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, temp: true },
      this.secret,
      { expiresIn: '5m' }
    );
  }

  async verifyTempToken(token) {
    const decoded = jwt.verify(token, this.secret);
    if (!decoded.temp) {
      throw new Error('Invalid temp token');
    }
    return decoded;
  }

  async blacklistToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Cannot blacklist invalid token');
    }
    const decoded = jwt.decode(token);
    if (!decoded) throw new Error('Cannot blacklist invalid token');
    this.blacklist.add(token);
    return true;
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = await this.verifyRefreshToken(refreshToken);
      // Blacklist the old refresh token
      this.blacklist.add(refreshToken);
      
      // Generate new tokens
      const user = { id: decoded.id, email: decoded.email, role: decoded.role };
      const accessToken = await this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user);
      
      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error.message === 'Token is blacklisted') {
        throw new Error('Token has been revoked');
      }
      throw error;
    }
  }

  async extractUserIdFromToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret);
      return decoded.id;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

// Export both as a class and as functions for flexibility
const mockTokenService = new MockTokenService();

module.exports = {
  TokenService: MockTokenService,
  __tokenService: mockTokenService,
  generateAccessToken: mockTokenService.generateAccessToken.bind(mockTokenService),
  generateRefreshToken: mockTokenService.generateRefreshToken.bind(mockTokenService),
  generateTokens: jest.fn(mockTokenService.generateTokens.bind(mockTokenService)),
  verifyAccessToken: mockTokenService.verifyAccessToken.bind(mockTokenService),
  verifyRefreshToken: mockTokenService.verifyRefreshToken.bind(mockTokenService),
  addToBlacklist: mockTokenService.addToBlacklist.bind(mockTokenService),
  isTokenBlacklisted: mockTokenService.isTokenBlacklisted.bind(mockTokenService),
  clearBlacklist: mockTokenService.clearBlacklist.bind(mockTokenService),
  generateResetToken: mockTokenService.generateResetToken.bind(mockTokenService),
  generateVerificationToken: mockTokenService.generateVerificationToken.bind(mockTokenService),
  generateTempToken: mockTokenService.generateTempToken.bind(mockTokenService),
  verifyTempToken: mockTokenService.verifyTempToken.bind(mockTokenService),
  blacklistToken: mockTokenService.blacklistToken.bind(mockTokenService),
  refreshAccessToken: mockTokenService.refreshAccessToken.bind(mockTokenService),
  extractUserIdFromToken: mockTokenService.extractUserIdFromToken.bind(mockTokenService)
};