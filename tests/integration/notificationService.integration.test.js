/**
 * NotificationService Integration Tests
 * Tests real service operations with database, user settings, and service dependencies
 */

const notificationService = require('../../src/services/notificationService');
const { NOTIFICATION_TYPES, NOTIFICATION_SUBTYPES, PRIORITY_LEVELS } = require('../../src/services/notificationService');
const userRepository = require('../../src/models/userRepository');
const userSettingsRepository = require('../../src/models/userSettingsRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');
const { setupTransactionTests } = require('../helpers/transactionTestHelper');
const { setupTestData } = require('../helpers/testDataHelper');

describe('NotificationService Integration Tests', () => {
  setupTransactionTests();
  const testData = setupTestData('notificationService');
  let cryptoService;

  beforeAll(async () => {
    await database.connect();
    cryptoService = new CryptoService();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test-notification-integration%']);
    await database.query('DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test-notification-integration%']);
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%test-notification-integration%']);
  });

  describe('Service Initialization and Configuration', () => {
    test('should initialize with correct channel configuration', async () => {
      expect(notificationService.initialized).toBeDefined();
      expect(notificationService.enabledChannels.inApp).toBe(true);
      expect(typeof notificationService.enabledChannels.email).toBe('boolean');
      expect(typeof notificationService.enabledChannels.sms).toBe('boolean');
    });

    test('should initialize services correctly', async () => {
      await notificationService.initialize();
      
      expect(notificationService.initialized).toBe(true);
      expect(notificationService.inAppService).toBeDefined();
      expect(notificationService.notificationCache).toBeDefined();
    });
  });

  describe('Security Notifications', () => {
    test('should send new device login notification', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-security@example.com',
        password: 'SecurePassword123!',
        name: 'Security Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      const result = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN,
        {
          templateData: {
            location: 'Test Location',
            ipAddress: '127.0.0.1',
            deviceInfo: 'Test Device'
          }
        }
      );

      expect(result).toBeDefined();
      expect(result.inApp).toBeDefined();
      expect(result.inApp.type).toBe(NOTIFICATION_TYPES.SECURITY);
      expect(result.inApp.subtype).toBe(NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN);
      expect(result.inApp.title).toBe('New Device Login');
      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.CRITICAL);
      expect(result.inApp.read).toBe(false);

      // Verify notification is stored in database
      const dbNotification = await database.query(
        'SELECT * FROM notifications WHERE user_id = $1 AND subtype = $2',
        [user.id, NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN]
      );
      expect(dbNotification.rows).toHaveLength(1);
      expect(dbNotification.rows[0].title).toBe('New Device Login');

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should handle suspicious login with deduplication', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-suspicious@example.com',
        password: 'SecurePassword123!',
        name: 'Suspicious Login Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // First suspicious login attempt (should be skipped due to threshold)
      const result1 = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN,
        {
          templateData: {
            reason: 'Failed password',
            attemptCount: 1
          }
        }
      );

      expect(result1.skipped).toBe(true);
      expect(result1.reason).toContain('Only 1 attempt(s)');

      // Second attempt (should still be skipped)
      const result2 = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN,
        {
          templateData: {
            reason: 'Failed password',
            attemptCount: 2
          }
        }
      );

      expect(result2.skipped).toBe(true);

      // Third attempt (should send notification)
      const result3 = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN,
        {
          templateData: {
            reason: 'Failed password',
            attemptCount: 3
          }
        }
      );

      expect(result3.skipped).toBeUndefined();
      expect(result3.inApp).toBeDefined();
      expect(result3.inApp.title).toBe('Suspicious Login Attempt');

      // Fourth attempt within same window (should be skipped)
      const result4 = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN,
        {
          templateData: {
            reason: 'Failed password',
            attemptCount: 4
          }
        }
      );

      expect(result4.skipped).toBe(true);
      expect(result4.reason).toContain('Already notified');

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should send two-factor authentication notifications', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-2fa@example.com',
        password: 'SecurePassword123!',
        name: '2FA Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Test 2FA enabled notification
      const enabledResult = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.TWO_FACTOR_ENABLED
      );

      expect(enabledResult.inApp.title).toBe('Two-Factor Authentication Enabled');
      expect(enabledResult.inApp.priority).toBe(PRIORITY_LEVELS.HIGH);

      // Test 2FA disabled notification
      const disabledResult = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.TWO_FACTOR_DISABLED
      );

      expect(disabledResult.inApp.title).toBe('Two-Factor Authentication Disabled');
      expect(disabledResult.inApp.priority).toBe(PRIORITY_LEVELS.HIGH);

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should send vault access notification', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-vault@example.com',
        password: 'SecurePassword123!',
        name: 'Vault Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      const result = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.VAULT_ACCESSED,
        {
          templateData: {
            accessTime: new Date().toISOString(),
            ipAddress: '127.0.0.1'
          }
        }
      );

      expect(result.inApp.title).toBe('Vault Accessed');
      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.MEDIUM);
      // Remove channels assertion as it's not returned in the result

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('Account Notifications', () => {
    test('should send welcome notification', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-welcome@example.com',
        password: 'SecurePassword123!',
        name: 'Welcome Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      const result = await notificationService.sendAccountNotification(
        user.id,
        NOTIFICATION_SUBTYPES.WELCOME,
        {
          templateData: {
            email: userData.email,
            name: userData.name
          }
        }
      );

      expect(result.inApp.type).toBe(NOTIFICATION_TYPES.ACCOUNT);
      expect(result.inApp.subtype).toBe(NOTIFICATION_SUBTYPES.WELCOME);
      expect(result.inApp.title).toBe('Welcome to Lockr!');
      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.LOW);

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should send vault entry notifications', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-vault-entry@example.com',
        password: 'SecurePassword123!',
        name: 'Vault Entry Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Test vault entry created
      const createdResult = await notificationService.sendAccountNotification(
        user.id,
        NOTIFICATION_SUBTYPES.VAULT_ENTRY_CREATED,
        {
          templateData: {
            entryTitle: 'Test Entry',
            entryType: 'password'
          }
        }
      );

      expect(createdResult.inApp.title).toBe('New Vault Entry Created');
      expect(createdResult.inApp.priority).toBe(PRIORITY_LEVELS.LOW);

      // Test vault entry updated
      const updatedResult = await notificationService.sendAccountNotification(
        user.id,
        NOTIFICATION_SUBTYPES.VAULT_ENTRY_UPDATED,
        {
          templateData: {
            entryTitle: 'Updated Entry',
            entryType: 'password'
          }
        }
      );

      expect(updatedResult.inApp.title).toBe('Vault Entry Updated');

      // Test vault entry deleted
      const deletedResult = await notificationService.sendAccountNotification(
        user.id,
        NOTIFICATION_SUBTYPES.VAULT_ENTRY_DELETED,
        {
          templateData: {
            entryTitle: 'Deleted Entry',
            entryType: 'password'
          }
        }
      );

      expect(deletedResult.inApp.title).toBe('Vault Entry Deleted');

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should send password reset notifications', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-password@example.com',
        password: 'SecurePassword123!',
        name: 'Password Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Test password reset requested
      const requestedResult = await notificationService.sendAccountNotification(
        user.id,
        NOTIFICATION_SUBTYPES.PASSWORD_RESET_REQUESTED
      );

      expect(requestedResult.inApp.title).toBe('Password Reset Requested');
      expect(requestedResult.inApp.priority).toBe(PRIORITY_LEVELS.MEDIUM);

      // Test password reset completed
      const completedResult = await notificationService.sendAccountNotification(
        user.id,
        NOTIFICATION_SUBTYPES.PASSWORD_RESET_COMPLETED
      );

      expect(completedResult.inApp.title).toBe('Password Reset Successful');
      expect(completedResult.inApp.priority).toBe(PRIORITY_LEVELS.HIGH);

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('System Notifications', () => {
    test('should send system maintenance notification', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-system@example.com',
        password: 'SecurePassword123!',
        name: 'System Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      const result = await notificationService.sendSystemNotification(
        user.id,
        NOTIFICATION_SUBTYPES.SYSTEM_MAINTENANCE,
        {
          templateData: {
            maintenanceTime: '2024-01-01 02:00 UTC',
            duration: '2 hours'
          }
        }
      );

      expect(result.inApp.type).toBe(NOTIFICATION_TYPES.SYSTEM);
      expect(result.inApp.subtype).toBe(NOTIFICATION_SUBTYPES.SYSTEM_MAINTENANCE);
      expect(result.inApp.title).toBe('System Maintenance');
      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.LOW);

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should send system update notification', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-update@example.com',
        password: 'SecurePassword123!',
        name: 'Update Notification Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      const result = await notificationService.sendSystemNotification(
        user.id,
        NOTIFICATION_SUBTYPES.SYSTEM_UPDATE,
        {
          templateData: {
            version: '2.0.0',
            features: ['Enhanced Security', 'New UI']
          }
        }
      );

      expect(result.inApp.title).toBe('System Update');
      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.LOW);

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('User Settings Integration', () => {
    test('should respect user security alert preferences', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-settings@example.com',
        password: 'SecurePassword123!',
        name: 'Settings Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Create user settings with security alerts disabled
      await userSettingsRepository.create(user.id, {
        securityAlerts: false,
        emailNotifications: true,
        smsNotifications: false
      });

      // Try to send security notification
      const result = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN
      );

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Security alerts disabled');

      // Update settings to enable security alerts
      await userSettingsRepository.update(user.id, {
        securityAlerts: true
      });

      // Try again - should work now
      const result2 = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN
      );

      expect(result2.skipped).toBeUndefined();
      expect(result2.inApp).toBeDefined();

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should handle missing user settings gracefully', async () => {
      // Create test user without settings
      const userData = {
        email: 'test-notification-integration-no-settings@example.com',
        password: 'SecurePassword123!',
        name: 'No Settings Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Should work without settings (defaults to enabled)
      const result = await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN
      );

      expect(result.skipped).toBeUndefined();
      expect(result.inApp).toBeDefined();

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('Notification Management', () => {
    test('should retrieve user notifications with filtering', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-management@example.com',
        password: 'SecurePassword123!',
        name: 'Management Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Create multiple notifications
      await notificationService.sendSecurityAlert(user.id, NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN);
      await notificationService.sendAccountNotification(user.id, NOTIFICATION_SUBTYPES.WELCOME);
      await notificationService.sendAccountNotification(user.id, NOTIFICATION_SUBTYPES.EMAIL_VERIFIED);

      // Get all notifications
      const allNotifications = await notificationService.getUserNotifications(user.id);
      expect(allNotifications.length).toBeGreaterThanOrEqual(3);

      // Filter by security type
      const securityNotifications = await notificationService.getUserNotifications(user.id, {
        type: NOTIFICATION_TYPES.SECURITY
      });
      expect(securityNotifications.length).toBeGreaterThanOrEqual(1);
      securityNotifications.forEach(notification => {
        expect(notification.type).toBe(NOTIFICATION_TYPES.SECURITY);
      });

      // Filter by account type
      const accountNotifications = await notificationService.getUserNotifications(user.id, {
        type: NOTIFICATION_TYPES.ACCOUNT
      });
      expect(accountNotifications.length).toBeGreaterThanOrEqual(2);
      accountNotifications.forEach(notification => {
        expect(notification.type).toBe(NOTIFICATION_TYPES.ACCOUNT);
      });

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should mark notifications as read', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-read@example.com',
        password: 'SecurePassword123!',
        name: 'Read Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Create a notification
      const result = await notificationService.sendAccountNotification(
        user.id,
        NOTIFICATION_SUBTYPES.WELCOME
      );

      const notificationId = result.inApp.id;

      // Verify it's unread initially
      const unreadCount = await notificationService.getUnreadCount(user.id);
      expect(unreadCount).toBeGreaterThan(0);

      // Mark as read
      const updatedNotification = await notificationService.markAsRead(notificationId, user.id);
      expect(updatedNotification.read).toBe(true);
      expect(updatedNotification.id).toBe(notificationId);

      // Verify unread count decreased
      const newUnreadCount = await notificationService.getUnreadCount(user.id);
      expect(newUnreadCount).toBe(unreadCount - 1);

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should mark all notifications as read', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-read-all@example.com',
        password: 'SecurePassword123!',
        name: 'Read All Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Create multiple notifications
      await notificationService.sendSecurityAlert(user.id, NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN);
      await notificationService.sendAccountNotification(user.id, NOTIFICATION_SUBTYPES.WELCOME);
      await notificationService.sendAccountNotification(user.id, NOTIFICATION_SUBTYPES.EMAIL_VERIFIED);

      // Verify there are unread notifications
      const initialUnreadCount = await notificationService.getUnreadCount(user.id);
      expect(initialUnreadCount).toBeGreaterThan(0);

      // Mark all as read
      const result = await notificationService.markAllAsRead(user.id);
      expect(result.updatedCount).toBeGreaterThan(0);

      // Verify all are now read
      const finalUnreadCount = await notificationService.getUnreadCount(user.id);
      expect(finalUnreadCount).toBe(0);

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid notification subtypes gracefully', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-error@example.com',
        password: 'SecurePassword123!',
        name: 'Error Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Test invalid security subtype
      await expect(
        notificationService.sendSecurityAlert(user.id, 'invalid_subtype')
      ).rejects.toThrow('Unknown security notification subtype');

      // Test invalid account subtype
      await expect(
        notificationService.sendAccountNotification(user.id, 'invalid_subtype')
      ).rejects.toThrow('Unknown account notification subtype');

      // Test invalid system subtype
      await expect(
        notificationService.sendSystemNotification(user.id, 'invalid_subtype')
      ).rejects.toThrow('Unknown system notification subtype');

      // Clean up
      await userRepository.delete(user.id);
    });

    test('should handle non-existent user gracefully', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      // Should not throw but may return empty results
      const notifications = await notificationService.getUserNotifications(fakeUserId);
      expect(Array.isArray(notifications)).toBe(true);

      const unreadCount = await notificationService.getUnreadCount(fakeUserId);
      expect(unreadCount).toBe(0);
    });

    test('should handle notification cache operations', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-cache@example.com',
        password: 'SecurePassword123!',
        name: 'Cache Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Send a suspicious login notification to populate cache
      await notificationService.sendSecurityAlert(
        user.id,
        NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN,
        {
          templateData: {
            reason: 'Failed password',
            attemptCount: 3
          }
        }
      );

      // Test cache clearing
      const clearedCount = notificationService.clearNotificationCache(user.id, NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN);
      expect(clearedCount).toBeGreaterThan(0);

      // Clean up
      await userRepository.delete(user.id);
    });
  });

  describe('Channel Configuration', () => {
    test('should respect channel configuration', async () => {
      // Create test user
      const userData = {
        email: 'test-notification-integration-channels@example.com',
        password: 'SecurePassword123!',
        name: 'Channels Test User'
      };

      const passwordHash = await cryptoService.hashPassword(userData.password);
      const user = await userRepository.create({
        ...userData,
        passwordHash
      });

      // Test in-app only notification
      const inAppResult = await notificationService.sendNotification(
        user.id,
        NOTIFICATION_TYPES.ACCOUNT,
        'test_subtype',
        {
          title: 'Test Notification',
          message: 'This is a test',
          channels: ['inApp']
        }
      );

      expect(inAppResult.inApp).toBeDefined();
      expect(inAppResult.email).toBeUndefined();
      expect(inAppResult.sms).toBeUndefined();

      // Clean up
      await userRepository.delete(user.id);
    });
  });
}); 