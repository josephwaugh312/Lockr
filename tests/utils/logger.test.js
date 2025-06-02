const { logger, securityEvents, sendSecurityAlert, SECURITY_ALERT_LEVELS } = require('../../src/utils/logger');

describe('Security Alerts', () => {
  beforeEach(() => {
    // Clear tracking data before each test
    securityEvents.clearOldAttempts();
  });

  describe('Security Alert Levels', () => {
    test('should have all required alert levels', () => {
      expect(SECURITY_ALERT_LEVELS.LOW).toBe('low');
      expect(SECURITY_ALERT_LEVELS.MEDIUM).toBe('medium');
      expect(SECURITY_ALERT_LEVELS.HIGH).toBe('high');
      expect(SECURITY_ALERT_LEVELS.CRITICAL).toBe('critical');
    });
  });

  describe('Failed Login Tracking', () => {
    test('should track failed login attempts', () => {
      const userId = 'user123';
      const ip = '192.168.1.1';
      const reason = 'Invalid password';

      // Should not trigger alert for first few attempts
      for (let i = 0; i < 4; i++) {
        securityEvents.failedLogin(userId, ip, reason);
      }

      // 5th attempt should trigger alert
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      securityEvents.failedLogin(userId, ip, reason);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH SECURITY ALERT'),
        expect.objectContaining({
          level: 'high',
          message: 'Multiple failed login attempts detected'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Failed Vault Unlock Tracking', () => {
    test('should track failed vault unlock attempts', () => {
      const userId = 'user123';
      const ip = '192.168.1.1';

      // Should not trigger alert for first 2 attempts
      securityEvents.failedVaultUnlock(userId, ip);
      securityEvents.failedVaultUnlock(userId, ip);

      // 3rd attempt should trigger alert
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      securityEvents.failedVaultUnlock(userId, ip);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MEDIUM SECURITY ALERT'),
        expect.objectContaining({
          level: 'medium',
          message: 'Multiple failed vault unlock attempts'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Suspicious Activity Detection', () => {
    test('should send high alert for suspicious activity', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      securityEvents.suspiciousActivity(
        'unusual_access_pattern',
        'user123',
        '192.168.1.1',
        { details: 'Multiple rapid requests' }
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH SECURITY ALERT'),
        expect.objectContaining({
          level: 'high',
          message: 'Suspicious activity: unusual_access_pattern'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limit Violations', () => {
    test('should send alert for high rate limit violations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      securityEvents.rateLimitViolation('192.168.1.1', '/api/auth/login', 25);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MEDIUM SECURITY ALERT'),
        expect.objectContaining({
          level: 'medium',
          message: 'High rate limit violation detected'
        })
      );

      consoleSpy.mockRestore();
    });

    test('should not send alert for low rate limit violations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      securityEvents.rateLimitViolation('192.168.1.1', '/api/auth/login', 10);
      
      // Should only log the violation, not trigger an alert
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('SECURITY ALERT'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Data Corruption Detection', () => {
    test('should send high alert for data corruption', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const error = new Error('Decryption failed');
      
      securityEvents.dataCorruption('user123', 'entry456', error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH SECURITY ALERT'),
        expect.objectContaining({
          level: 'high',
          message: 'Vault data corruption detected'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Critical Events', () => {
    test('should send critical alert for critical events', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      securityEvents.criticalEvent('system_breach', { severity: 'maximum' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL SECURITY ALERT'),
        expect.objectContaining({
          level: 'critical',
          message: 'Critical event: system_breach'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Attempt Tracking Cleanup', () => {
    test('should clear old attempts', () => {
      // Add some tracking data
      securityEvents.failedLogin('user1', '192.168.1.1', 'test');
      securityEvents.failedVaultUnlock('user2', '192.168.1.2');

      // Verify data exists
      expect(Object.keys(securityEvents._failedAttempts).length).toBeGreaterThan(0);
      expect(Object.keys(securityEvents._failedVaultAttempts).length).toBeGreaterThan(0);

      // Clear attempts
      securityEvents.clearOldAttempts();

      // Verify data is cleared
      expect(Object.keys(securityEvents._failedAttempts).length).toBe(0);
      expect(Object.keys(securityEvents._failedVaultAttempts).length).toBe(0);
    });
  });
}); 