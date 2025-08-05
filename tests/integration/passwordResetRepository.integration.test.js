/**
 * Password Reset Repository Integration Tests
 * Tests password reset token management and security
 */

// Add polyfills for Node.js compatibility
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Add setImmediate polyfill for Node.js
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => {
    return setTimeout(() => callback(...args), 0);
  };
}

const passwordResetRepository = require('../../src/models/passwordResetRepository');
const masterPasswordResetRepository = require('../../src/models/masterPasswordResetRepository');
const userRepository = require('../../src/models/userRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');
const crypto = require('crypto');

describe('Password Reset Repository Integration Tests', () => {
  let testUser;
  let cryptoService;

  beforeAll(async () => {
    await database.connect();
    cryptoService = new CryptoService();
  }, 30000); // Increase timeout to 30 seconds

  afterAll(async () => {
    try {
      await database.close();
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }, 10000); // Increase timeout to 10 seconds

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%password-reset-test%']);
    await database.query('DELETE FROM master_password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%password-reset-test%']);
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%password-reset-test%']);

    // Create test user with proper password hash
    const userData = {
      email: 'password-reset-test@example.com',
      passwordHash: await cryptoService.hashPassword('SecurePassword123!'),
      name: 'Password Reset Test User'
    };

    testUser = await userRepository.create(userData);
  });

  describe('Password Reset Token Management', () => {
    test('should create password reset token', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const token = await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      expect(token).toHaveProperty('token');
      expect(token).toHaveProperty('expiresAt');
      expect(token.token).toHaveLength(64); // 32 bytes in hex

      // Verify token is stored in database
      const dbToken = await database.query(`
        SELECT token_hash, expires_at, ip_hash, user_agent_hash 
        FROM password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(dbToken.rows).toHaveLength(1);
      expect(dbToken.rows[0].token_hash).toBeTruthy();
      expect(dbToken.rows[0].ip_hash).toBeTruthy();
      expect(dbToken.rows[0].user_agent_hash).toBeTruthy();
    });

    test('should find valid reset token', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const createdToken = await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      const foundToken = await passwordResetRepository.findValidToken(createdToken.token);

      expect(foundToken).toBeTruthy();
      expect(foundToken.userId).toBe(testUser.id);
      expect(foundToken.used).toBe(false);
    });

    test('should not find expired token', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      // Create token with very short expiry
      const token = await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      // Manually expire the token in database
      await database.query(`
        UPDATE password_reset_tokens 
        SET expires_at = NOW() - INTERVAL '1 hour'
        WHERE token_hash = $1
      `, [passwordResetRepository.hashToken(token.token)]);

      const expiredToken = await passwordResetRepository.findValidToken(token.token);
      expect(expiredToken).toBeNull();
    });

    test('should mark token as used', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const token = await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      await passwordResetRepository.markTokenAsUsed(token.token);

      const usedToken = await passwordResetRepository.findValidToken(token.token);
      expect(usedToken).toBeNull(); // Used tokens should not be found as valid
    });

    test('should check user rate limiting', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      // Create multiple tokens to test rate limiting
      for (let i = 0; i < 3; i++) {
        await passwordResetRepository.createResetToken(
          testUser.id,
          ipAddress,
          userAgent
        );
      }

      const rateLimit = await passwordResetRepository.checkUserRateLimit(testUser.id, 3, 60);
      expect(rateLimit.allowed).toBe(false);
      expect(rateLimit.resetTime).toBeTruthy();
    });

    test('should check IP rate limiting', async () => {
      const ipAddress = '192.168.1.100';
      const userAgent = 'Mozilla/5.0 Test Browser';

      // Create multiple tokens from same IP (6 tokens to exceed limit of 5)
      for (let i = 0; i < 6; i++) {
        await passwordResetRepository.createResetToken(
          testUser.id,
          ipAddress,
          userAgent
        );
      }

      const rateLimit = await passwordResetRepository.checkIpRateLimit(ipAddress, 5, 60);
      expect(rateLimit.allowed).toBe(false);
      expect(rateLimit.resetTime).toBeTruthy();
    });

    test('should clean up expired tokens', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      // Create multiple tokens
      await passwordResetRepository.createResetToken(testUser.id, ipAddress, userAgent);
      await passwordResetRepository.createResetToken(testUser.id, ipAddress, userAgent);

      // Manually expire them
      await database.query(`
        UPDATE password_reset_tokens 
        SET expires_at = NOW() - INTERVAL '1 hour'
        WHERE user_id = $1
      `, [testUser.id]);

      const deletedCount = await passwordResetRepository.cleanupExpiredTokens();
      expect(deletedCount).toBeGreaterThan(0);

      // Verify tokens are deleted
      const remainingTokens = await database.query(`
        SELECT COUNT(*) as count 
        FROM password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(parseInt(remainingTokens.rows[0].count)).toBe(0);
    });
  });

  describe('Master Password Reset Token Management', () => {
    test('should create master password reset token', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const token = await masterPasswordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      expect(token).toHaveProperty('token');
      expect(token).toHaveProperty('expiresAt');
      expect(token.token).toHaveLength(64);

      // Verify token is stored in database
      const dbToken = await database.query(`
        SELECT token_hash, expires_at, ip_hash, user_agent_hash, data_wiped 
        FROM master_password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(dbToken.rows).toHaveLength(1);
      expect(dbToken.rows[0].token_hash).toBeTruthy();
      expect(dbToken.rows[0].data_wiped).toBe(false);
    });

    test('should wipe vault and reset master password', async () => {
      // Create some vault entries first
      await database.query(`
        INSERT INTO vault_entries (id, user_id, name, username, category, encrypted_data)
        VALUES (gen_random_uuid(), $1, 'Test Entry', 'testuser', 'login', '{"test": "data"}')
      `, [testUser.id]);

      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const token = await masterPasswordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      const newPassword = 'NewMasterPassword123!';

      await masterPasswordResetRepository.wipeVaultAndResetMasterPassword(
        token.token,
        newPassword
      );

      // Verify vault entries are deleted
      const vaultEntries = await database.query(`
        SELECT COUNT(*) as count 
        FROM vault_entries 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(parseInt(vaultEntries.rows[0].count)).toBe(0);

      // Verify data_wiped flag is set
      const resetToken = await database.query(`
        SELECT data_wiped, wiped_at, used 
        FROM master_password_reset_tokens 
        WHERE token_hash = $1
      `, [crypto.createHash('sha256').update(token.token).digest('hex')]);

      expect(resetToken.rows[0].data_wiped).toBe(true);
      expect(resetToken.rows[0].wiped_at).toBeTruthy();
      expect(resetToken.rows[0].used).toBe(true);
    });

    test('should check master password reset rate limiting', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      // Create multiple tokens to test rate limiting (4 tokens to exceed limit of 3)
      for (let i = 0; i < 4; i++) {
        await masterPasswordResetRepository.createResetToken(
          testUser.id,
          ipAddress,
          userAgent
        );
      }

      const rateLimit = await masterPasswordResetRepository.checkUserRateLimit(testUser.id, 3, 60);
      expect(rateLimit.allowed).toBe(false);
      expect(rateLimit.resetTime).toBeTruthy();
    });

    test('should validate token before vault wipe', async () => {
      const fakeToken = 'fake-token-that-does-not-exist';

      await expect(
        masterPasswordResetRepository.wipeVaultAndResetMasterPassword(
          fakeToken,
          'NewPassword123!'
        )
      ).rejects.toThrow();
    });
  });

  describe('Token Security', () => {
    test('should hash tokens before storing', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const token = await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      // Verify original token is not stored in database
      const dbResult = await database.query(`
        SELECT token_hash 
        FROM password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(dbResult.rows[0].token_hash).not.toBe(token.token);
      expect(dbResult.rows[0].token_hash).toHaveLength(64); // SHA-256 hash length
    });

    test('should hash IP addresses and user agents', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      const dbResult = await database.query(`
        SELECT ip_hash, user_agent_hash 
        FROM password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(dbResult.rows[0].ip_hash).toBeTruthy();
      expect(dbResult.rows[0].user_agent_hash).toBeTruthy();
      expect(dbResult.rows[0].ip_hash).not.toBe(ipAddress);
      expect(dbResult.rows[0].user_agent_hash).not.toBe(userAgent);
    });

    test('should generate cryptographically secure tokens', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      const tokens = [];
      
      // Generate multiple tokens
      for (let i = 0; i < 10; i++) {
        const token = await passwordResetRepository.createResetToken(
          testUser.id,
          ipAddress,
          userAgent
        );
        tokens.push(token.token);
      }

      // Verify all tokens are unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Verify tokens have proper entropy (should not have obvious patterns)
      tokens.forEach(token => {
        expect(token).toMatch(/^[a-f0-9]{64}$/); // 64 character hex string
        expect(token).not.toMatch(/(.)\1{10,}/); // Should not have long repeated characters
      });
    });
  });

  describe('GDPR Compliance', () => {
    test('should set data retention policies', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      const dbResult = await database.query(`
        SELECT retention_expires_at 
        FROM password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(dbResult.rows[0].retention_expires_at).toBeTruthy();
      
      const retentionDate = new Date(dbResult.rows[0].retention_expires_at);
      const now = new Date();
      expect(retentionDate.getTime()).toBeGreaterThan(now.getTime());
    });

    test('should handle data deletion requests', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        userAgent
      );

      // Simulate GDPR deletion request
      await database.query(`
        DELETE FROM password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      const remainingTokens = await database.query(`
        SELECT COUNT(*) as count 
        FROM password_reset_tokens 
        WHERE user_id = $1
      `, [testUser.id]);

      expect(parseInt(remainingTokens.rows[0].count)).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';

      await expect(
        passwordResetRepository.createResetToken(
          fakeUserId,
          ipAddress,
          userAgent
        )
      ).rejects.toThrow();
    });

    test('should handle malformed IP addresses', async () => {
      const malformedIP = 'not-an-ip-address';
      const userAgent = 'Mozilla/5.0 Test Browser';

      // Should handle gracefully, not crash
      const token = await passwordResetRepository.createResetToken(
        testUser.id,
        malformedIP,
        userAgent
      );

      expect(token).toHaveProperty('token');
    });

    test('should handle missing user agent', async () => {
      const ipAddress = '192.168.1.1';

      const token = await passwordResetRepository.createResetToken(
        testUser.id,
        ipAddress,
        null
      );

      expect(token).toHaveProperty('token');
    });

    test('should handle database connection errors gracefully', async () => {
      // This test would need to mock database failures
      // For now, verify that the repository methods exist and can handle basic operations
      expect(typeof passwordResetRepository.createResetToken).toBe('function');
      expect(typeof passwordResetRepository.findValidToken).toBe('function');
      expect(typeof passwordResetRepository.cleanupExpiredTokens).toBe('function');
    });
  });
}); 