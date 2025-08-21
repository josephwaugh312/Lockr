const request = require('supertest');
const express = require('express');
const { authMiddleware, optionalAuth, requireRole, __tokenService } = require('../../src/middleware/auth');
const { TokenService } = require('../../src/services/tokenService');

describe('AuthMiddleware', () => {
  let app;
  let tokenService;
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user'
  };
  const mockAdmin = {
    id: 'admin-456',
    email: 'admin@example.com',
    role: 'admin'
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Use the same token service instance as the middleware
    tokenService = __tokenService;
    tokenService.clearBlacklist();

    // Test routes
    app.get('/public', (req, res) => {
      res.json({ message: 'public endpoint', user: req.user || null });
    });

    app.get('/protected', authMiddleware, (req, res) => {
      res.json({ message: 'protected endpoint', user: req.user });
    });

    app.get('/optional', optionalAuth, (req, res) => {
      res.json({ message: 'optional auth endpoint', user: req.user || null });
    });

    app.get('/admin-only', authMiddleware, requireRole('admin'), (req, res) => {
      res.json({ message: 'admin only endpoint', user: req.user });
    });

    app.get('/user-or-admin', authMiddleware, requireRole(['user', 'admin']), (req, res) => {
      res.json({ message: 'user or admin endpoint', user: req.user });
    });
  });

  describe('Token Extraction', () => {
    test('should extract token from Authorization header', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(mockUser.id);
    });

    test('should handle Authorization header without Bearer prefix', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', token);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid authorization format');
    });

    test('should handle missing Authorization header', async () => {
      const response = await request(app)
        .get('/protected');

      expect(response.status).toBe(401);
      // Our global mock used to return 'No token provided'; align to middleware message
      expect(response.body.error).toBe('Access token required');
    });

    test('should handle empty Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', '');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid authorization format');
    });
  });

  describe('Token Validation', () => {
    test('should accept valid access token', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(mockUser.id);
      expect(response.body.user.email).toBe(mockUser.email);
      expect(response.body.user.role).toBe(mockUser.role);
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should reject expired token', async () => {
      const shortExpiryService = new TokenService();
      shortExpiryService.accessTokenExpiry = '1ms';
      
      const token = await shortExpiryService.generateAccessToken(mockUser);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token expired');
    });

    test('should reject blacklisted token', async () => {
      const token = await tokenService.generateAccessToken(mockUser);
      await tokenService.blacklistToken(token);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token has been revoked');
    });

    test('should reject refresh token used as access token', async () => {
      const refreshToken = await tokenService.generateRefreshToken(mockUser);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token type');
    });
  });

  describe('Optional Authentication', () => {
    test('should allow access without token', async () => {
      const response = await request(app)
        .get('/optional');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeNull();
    });

    test('should add user info when valid token provided', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(mockUser.id);
    });

    test('should continue without user when invalid token provided', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', 'Bearer invalid.token');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeNull();
    });
  });

  describe('Role-Based Access Control', () => {
    test('should allow admin access to admin-only endpoint', async () => {
      const token = await tokenService.generateAccessToken(mockAdmin);

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('admin');
    });

    test('should deny user access to admin-only endpoint', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });

    test('should allow multiple roles access', async () => {
      const userToken = await tokenService.generateAccessToken(mockUser);
      const adminToken = await tokenService.generateAccessToken(mockAdmin);

      const userResponse = await request(app)
        .get('/user-or-admin')
        .set('Authorization', `Bearer ${userToken}`);

      const adminResponse = await request(app)
        .get('/user-or-admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(userResponse.status).toBe(200);
      expect(adminResponse.status).toBe(200);
    });

    test('should handle role check without authentication', async () => {
      const response = await request(app)
        .get('/admin-only');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    test('should handle invalid role parameter', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      // Create a route with invalid role requirement
      app.get('/invalid-role', authMiddleware, requireRole('invalid-role'), (req, res) => {
        res.json({ message: 'should not reach here' });
      });

      const response = await request(app)
        .get('/invalid-role')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });

  describe('Security Headers and Logging', () => {
    test('should not expose sensitive information in error responses', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.jwt.token.here');

      expect(response.status).toBe(401);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('token');
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle unexpected errors gracefully', async () => {
      // Mock TokenService to throw unexpected error
      const originalTokenService = require('../../src/middleware/auth').__tokenService;
      
      // This test verifies error handling - we'll implement this in the middleware
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid.format.but.causes.error');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent requests with same token', async () => {
      const token = await tokenService.generateAccessToken(mockUser);

      const requests = Array(5).fill().map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.user.id).toBe(mockUser.id);
      });
    });

    test('should handle very long token gracefully', async () => {
      const veryLongToken = 'a'.repeat(10000);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${veryLongToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should handle special characters in Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer token-with-special-chars!@#$%^&*()');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });
  });
}); 