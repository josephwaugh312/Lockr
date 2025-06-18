const notificationService = require('../../src/services/notificationService');
const { NOTIFICATION_TYPES, NOTIFICATION_SUBTYPES, PRIORITY_LEVELS } = require('../../src/services/notificationService');
const database = require('../../src/config/database');

describe('NotificationService', () => {
  let testUserId;

  beforeAll(async () => {
    // Create a test user for notifications
    const client = await database.getClient();
    try {
      // Use a proper length password hash (argon2 format is typically 60+ chars)
      const properPasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$pqZvvL4G1QUb7eJ7yQ5HrWvOj3J1oJRlZFRfZZrQwpQ';
      const result = await client.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        ['test@notification.com', properPasswordHash, 'user']
      );
      testUserId = result.rows[0].id;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Clean up test data
    const client = await database.getClient();
    try {
      await client.query('DELETE FROM notifications WHERE user_id = $1', [testUserId]);
      await client.query('DELETE FROM users WHERE id = $1', [testUserId]);
    } finally {
      client.release();
    }
    
    // Close the database connection pool to prevent Jest from hanging
    await database.close();
  });

  describe('sendSecurityAlert', () => {
    it('should create a security notification in database', async () => {
      const result = await notificationService.sendSecurityAlert(
        testUserId,
        NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN,
        {
          templateData: {
            location: 'Test Location',
            ipAddress: '127.0.0.1'
          }
        }
      );

      expect(result).toBeDefined();
      expect(result.inApp).toBeDefined();
      expect(result.inApp.type).toBe(NOTIFICATION_TYPES.SECURITY);
      expect(result.inApp.subtype).toBe(NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN);
      expect(result.inApp.title).toBe('New Device Login');
      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.HIGH);
      expect(result.inApp.read).toBe(false);
    });

    it('should create a critical security notification', async () => {
      const result = await notificationService.sendSecurityAlert(
        testUserId,
        NOTIFICATION_SUBTYPES.SUSPICIOUS_LOGIN
      );

      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.CRITICAL);
      expect(result.inApp.title).toBe('Suspicious Login Attempt');
    });
  });

  describe('sendAccountNotification', () => {
    it('should create a welcome notification', async () => {
      const result = await notificationService.sendAccountNotification(
        testUserId,
        NOTIFICATION_SUBTYPES.WELCOME,
        {
          templateData: {
            email: 'test@notification.com'
          }
        }
      );

      expect(result.inApp.type).toBe(NOTIFICATION_TYPES.ACCOUNT);
      expect(result.inApp.subtype).toBe(NOTIFICATION_SUBTYPES.WELCOME);
      expect(result.inApp.title).toBe('Welcome to Lockr!');
      expect(result.inApp.priority).toBe(PRIORITY_LEVELS.LOW);
    });
  });

  describe('getUserNotifications', () => {
    it('should retrieve user notifications', async () => {
      // First create a notification
      await notificationService.sendAccountNotification(
        testUserId,
        NOTIFICATION_SUBTYPES.EMAIL_VERIFIED
      );

      const notifications = await notificationService.getUserNotifications(testUserId);

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0]).toHaveProperty('id');
      expect(notifications[0]).toHaveProperty('user_id');
      expect(notifications[0]).toHaveProperty('type');
      expect(notifications[0]).toHaveProperty('title');
    });

    it('should filter notifications by type', async () => {
      const securityNotifications = await notificationService.getUserNotifications(testUserId, {
        type: NOTIFICATION_TYPES.SECURITY
      });

      securityNotifications.forEach(notification => {
        expect(notification.type).toBe(NOTIFICATION_TYPES.SECURITY);
      });
    });

    it('should filter unread notifications only', async () => {
      const unreadNotifications = await notificationService.getUserNotifications(testUserId, {
        unreadOnly: true
      });

      unreadNotifications.forEach(notification => {
        expect(notification.read).toBe(false);
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      // Create a notification
      const result = await notificationService.sendAccountNotification(
        testUserId,
        NOTIFICATION_SUBTYPES.EMAIL_VERIFIED
      );

      const notificationId = result.inApp.id;

      // Mark as read
      const updatedNotification = await notificationService.markAsRead(notificationId, testUserId);

      expect(updatedNotification.read).toBe(true);
      expect(updatedNotification.id).toBe(notificationId);
    });
  });

  describe('getUnreadCount', () => {
    it('should return correct unread count', async () => {
      // Get initial count
      const initialCount = await notificationService.getUnreadCount(testUserId);

      // Create a new notification
      await notificationService.sendAccountNotification(
        testUserId,
        NOTIFICATION_SUBTYPES.EMAIL_VERIFIED
      );

      // Check count increased
      const newCount = await notificationService.getUnreadCount(testUserId);
      expect(newCount).toBe(initialCount + 1);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      // Create some notifications
      await notificationService.sendAccountNotification(testUserId, NOTIFICATION_SUBTYPES.EMAIL_VERIFIED);
      await notificationService.sendSecurityAlert(testUserId, NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN);

      // Mark all as read
      const result = await notificationService.markAllAsRead(testUserId);

      expect(result.updatedCount).toBeGreaterThan(0);

      // Verify unread count is 0
      const unreadCount = await notificationService.getUnreadCount(testUserId);
      expect(unreadCount).toBe(0);
    });
  });

  describe('constants', () => {
    it('should export notification constants', () => {
      expect(NOTIFICATION_TYPES).toBeDefined();
      expect(NOTIFICATION_TYPES.SECURITY).toBe('security');
      expect(NOTIFICATION_TYPES.ACCOUNT).toBe('account');

      expect(NOTIFICATION_SUBTYPES).toBeDefined();
      expect(NOTIFICATION_SUBTYPES.NEW_DEVICE_LOGIN).toBe('new_device_login');
      expect(NOTIFICATION_SUBTYPES.WELCOME).toBe('welcome');

      expect(PRIORITY_LEVELS).toBeDefined();
      expect(PRIORITY_LEVELS.LOW).toBe('low');
      expect(PRIORITY_LEVELS.CRITICAL).toBe('critical');
    });
  });
}); 