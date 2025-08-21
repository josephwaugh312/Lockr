const { TokenService } = require('../../src/services/tokenService');

describe('TokenService', () => {
  let tokenService;
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user'
  };

  beforeEach(() => {
    tokenService = new TokenService();
    // Clear any blacklisted tokens before each test
    tokenService.clearBlacklist();
  });

  describe('Access Token Generation', () => {
    test('should generate valid access token', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    test('should include user data in access token payload', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      const decoded = await tokenService.verifyAccessToken(token);

      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.type).toBe('access');
    });

    test('should set correct expiration for access token', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      const decoded = await tokenService.verifyAccessToken(token);

      const now = Math.floor(Date.now() / 1000);
      const expectedExpiry = now + (15 * 60); // 15 minutes
      
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5); // Allow 5 second margin
    });

    test('should include issued at timestamp', async () => {
      const before = Math.floor(Date.now() / 1000);
      const token = await tokenService.generateAccessToken(mockUser);
      const after = Math.floor(Date.now() / 1000);
      
      const decoded = await tokenService.verifyAccessToken(token);

      expect(decoded.iat).toBeGreaterThanOrEqual(before);
      expect(decoded.iat).toBeLessThanOrEqual(after);
    });
  });

  describe('Refresh Token Generation', () => {
    test('should generate valid refresh token', async () => {
      const token = await tokenService.generateRefreshToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    test('should include user data in refresh token payload', async () => {
      const token = await tokenService.generateRefreshToken(mockUser);
      const decoded = await tokenService.verifyRefreshToken(token);

      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe('refresh');
    });

    test('should set correct expiration for refresh token', async () => {
      const token = await tokenService.generateRefreshToken(mockUser);
      const decoded = await tokenService.verifyRefreshToken(token);

      const now = Math.floor(Date.now() / 1000);
      const expectedExpiry = now + (7 * 24 * 60 * 60); // 7 days
      
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5); // Allow 5 second margin
    });

    test('should include unique token ID for refresh tokens', async () => {
      const token1 = await tokenService.generateRefreshToken(mockUser);
      const token2 = await tokenService.generateRefreshToken(mockUser);
      
      const decoded1 = await tokenService.verifyRefreshToken(token1);
      const decoded2 = await tokenService.verifyRefreshToken(token2);

      expect(decoded1.jti).toBeDefined();
      expect(decoded2.jti).toBeDefined();
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });
  });

  describe('Token Validation', () => {
    test('should verify valid access token', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      const decoded = await tokenService.verifyAccessToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockUser.id);
    });

    test('should verify valid refresh token', async () => {
      const token = await tokenService.generateRefreshToken(mockUser);
      const decoded = await tokenService.verifyRefreshToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockUser.id);
    });

    test('should reject invalid token signature', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      const invalidToken = token.slice(0, -5) + 'XXXXX'; // Corrupt signature

      await expect(tokenService.verifyAccessToken(invalidToken))
        .rejects.toThrow('Invalid token');
    });

    test('should reject malformed token', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      await expect(tokenService.verifyAccessToken(malformedToken))
        .rejects.toThrow('Invalid token');
    });

    test('should reject access token when verifying as refresh token', async () => {
      const accessToken = await tokenService.generateAccessToken(mockUser);

      await expect(tokenService.verifyRefreshToken(accessToken))
        .rejects.toThrow('Invalid token type');
    });

    test('should reject refresh token when verifying as access token', async () => {
      const refreshToken = await tokenService.generateRefreshToken(mockUser);

      await expect(tokenService.verifyAccessToken(refreshToken))
        .rejects.toThrow('Invalid token type');
    });
  });

  describe('Token Blacklisting', () => {
    test('should blacklist token successfully', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      
      await tokenService.blacklistToken(token);
      
      await expect(tokenService.verifyAccessToken(token))
        .rejects.toThrow('Token has been revoked');
    });

    test('should blacklist refresh token successfully', async () => {
      const token = await tokenService.generateRefreshToken(mockUser);
      
      await tokenService.blacklistToken(token);
      
      await expect(tokenService.verifyRefreshToken(token))
        .rejects.toThrow('Token has been revoked');
    });

    test('should check if token is blacklisted', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      
      expect(await tokenService.isTokenBlacklisted(token)).toBe(false);
      
      await tokenService.blacklistToken(token);
      
      expect(await tokenService.isTokenBlacklisted(token)).toBe(true);
    });

    test('should handle blacklisting invalid token gracefully', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(tokenService.blacklistToken(invalidToken))
        .rejects.toThrow('Cannot blacklist invalid token');
    });
  });

  describe('Token Refresh', () => {
    test('should refresh access token with valid refresh token', async () => {
      const refreshToken = await tokenService.generateRefreshToken(mockUser);
      
      const newTokens = await tokenService.refreshAccessToken(refreshToken);

      expect(newTokens).toBeDefined();
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      
      // Verify new tokens are valid
      const accessDecoded = await tokenService.verifyAccessToken(newTokens.accessToken);
      const refreshDecoded = await tokenService.verifyRefreshToken(newTokens.refreshToken);
      
      expect(accessDecoded.id).toBe(mockUser.id);
      expect(refreshDecoded.id).toBe(mockUser.id);
    });

    test('should blacklist old refresh token when refreshing', async () => {
      const oldRefreshToken = await tokenService.generateRefreshToken(mockUser);
      
      await tokenService.refreshAccessToken(oldRefreshToken);
      
      // Old refresh token should now be blacklisted
      await expect(tokenService.verifyRefreshToken(oldRefreshToken))
        .rejects.toThrow('Token has been revoked');
    });

    test('should reject refresh with blacklisted refresh token', async () => {
      const refreshToken = await tokenService.generateRefreshToken(mockUser);
      
      await tokenService.blacklistToken(refreshToken);
      
      await expect(tokenService.refreshAccessToken(refreshToken))
        .rejects.toThrow('Token has been revoked');
    });
  });

  describe('Security Features', () => {
    test('should reject expired access token', async () => {
      // Create a token service with very short expiry
      const shortExpiryService = new TokenService();
      shortExpiryService.accessTokenExpiry = '1ms';
      
      const token = await shortExpiryService.generateAccessToken(mockUser);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await expect(shortExpiryService.verifyAccessToken(token))
        .rejects.toThrow('Token expired');
    });

    test('should extract user ID from token', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      
      const userId = await tokenService.extractUserIdFromToken(token);
      
      expect(userId).toBe(mockUser.id);
    });

    test('should validate token format before processing', async () => {
      const invalidFormats = [
        '',
        'not-a-token',
        'only.two.parts',
        'too.many.parts.here.token'
      ];

      for (const invalidToken of invalidFormats) {
        await expect(tokenService.verifyAccessToken(invalidToken))
          .rejects.toThrow('Invalid token');
      }
    });
  });

  describe('Token Generation', () => {
    test('should generate both access and refresh tokens', async () => {
      const tokens = await tokenService.generateTokens(mockUser);
      
      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      
      // Verify both tokens are valid
      const decodedAccess = await tokenService.verifyAccessToken(tokens.accessToken);
      const decodedRefresh = await tokenService.verifyRefreshToken(tokens.refreshToken);
      
      expect(decodedAccess.id).toBe(mockUser.id);
      expect(decodedRefresh.id).toBe(mockUser.id);
    });
  });

  describe('Blacklist Backward Compatibility', () => {
    test('should support addToBlacklist alias method', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      
      // Use the alias method
      await tokenService.addToBlacklist(token);
      
      // Verify token is blacklisted
      const isBlacklisted = await tokenService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    test('should handle blacklisting with invalid token error', async () => {
      // Mock _validateTokenFormat to throw 'Invalid token'
      const originalValidate = tokenService._validateTokenFormat;
      tokenService._validateTokenFormat = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(tokenService.blacklistToken('bad.token'))
        .rejects.toThrow('Cannot blacklist invalid token');

      // Restore original function
      tokenService._validateTokenFormat = originalValidate;
    });
  });

  describe('Error Handling', () => {
    test('should handle access token generation failure', async () => {
      // Mock jwt.sign to throw an error
      const jwt = require('jsonwebtoken');
      const originalSign = jwt.sign;
      jwt.sign = jest.fn().mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(tokenService.generateAccessToken(mockUser))
        .rejects.toThrow('Access token generation failed: JWT signing failed');

      // Restore original function
      jwt.sign = originalSign;
    });

    test('should handle refresh token generation failure', async () => {
      // Mock jwt.sign to throw an error
      const jwt = require('jsonwebtoken');
      const originalSign = jwt.sign;
      jwt.sign = jest.fn().mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(tokenService.generateRefreshToken(mockUser))
        .rejects.toThrow('Refresh token generation failed: JWT signing failed');

      // Restore original function
      jwt.sign = originalSign;
    });

    test('should handle token expired error', async () => {
      // Mock jwt.verify to throw TokenExpiredError
      const jwt = require('jsonwebtoken');
      const originalVerify = jwt.verify;
      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(tokenService.verifyAccessToken('expired.token.here'))
        .rejects.toThrow('Token expired');

      // Restore original function
      jwt.verify = originalVerify;
    });

    test('should handle failed user ID extraction', async () => {
      // This will trigger the catch block in extractUserIdFromToken by passing an invalid token
      await expect(tokenService.extractUserIdFromToken('invalid.token.format'))
        .rejects.toThrow('Failed to extract user ID');
    });

    test('should handle expired refresh token error', async () => {
      // Mock jwt.verify to throw TokenExpiredError for refresh token
      const jwt = require('jsonwebtoken');
      const originalVerify = jwt.verify;
      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(tokenService.verifyRefreshToken('expired.refresh.token'))
        .rejects.toThrow('Token expired');

      // Restore original function
      jwt.verify = originalVerify;
    });

    test('should handle invalid refresh token error', async () => {
      // Mock jwt.verify to throw JsonWebTokenError for refresh token
      const jwt = require('jsonwebtoken');
      const originalVerify = jwt.verify;
      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await expect(tokenService.verifyRefreshToken('invalid.refresh.token'))
        .rejects.toThrow('Invalid token');

      // Restore original function
      jwt.verify = originalVerify;
    });
  });
}); 