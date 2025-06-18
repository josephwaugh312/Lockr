const request = require('supertest');
const app = require('../../src/app');
const database = require('../../src/config/database');
const { TokenService } = require('../../src/services/tokenService');

describe('Notification API Routes', () => {
  let testUser;
  let authToken;
  let testNotifications = [];
  let tokenService;

  beforeAll(async () => {
    // Initialize token service
    tokenService = new TokenService();

    // Create a test user
    const client = await database.getClient();
    try {
      const hashedPassword = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$pqZvvL4G1QUb7eJ7yQ5HrWvOj3J1oJRlZFRfZZrQwpQ';
      const result = await client.query(
        'INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, $3, $4) RETURNING *',
        ['test.notifications@lockr.com', hashedPassword, 'user', 'Test User']
      );
      testUser = result.rows[0];

      // Generate proper access token using TokenService
      authToken = await tokenService.generateAccessToken({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role
      });

      // Create some test notifications
      const notificationQueries = [
        {
          type: 'security',
          subtype: 'new_device_login',
          title: 'New Device Login',
          message: 'Login from new device detected',
          priority: 'high'
        },
        {
          type: 'security',
          subtype: 'suspicious_login',
          title: 'Suspicious Login Attempt',
          message: 'Suspicious login attempt blocked',
          priority: 'critical'
        },
        {
          type: 'account',
          subtype: 'welcome',
          title: 'Welcome to Lockr!',
          message: 'Your account has been created successfully',
          priority: 'low'
        },
        {
          type: 'account',
          subtype: 'email_verified',
          title: 'Email Verified',
          message: 'Your email has been verified',
          priority: 'medium'
        }
      ];

      for (const notif of notificationQueries) {
        const notificationResult = await client.query(
          'INSERT INTO notifications (user_id, type, subtype, title, message, priority, read, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
          [testUser.id, notif.type, notif.subtype, notif.title, notif.message, notif.priority, false, JSON.stringify({})]
        );
        testNotifications.push(notificationResult.rows[0]);
      }
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Clean up test data
    const client = await database.getClient();
    try {
      await client.query('DELETE FROM notifications WHERE user_id = $1', [testUser.id]);
      await client.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    } finally {
      client.release();
    }
    await database.close();
  });

  describe('GET /api/notifications', () => {
    it('should get user notifications with authentication', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(4);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.limit).toBe(50);
      expect(response.body.pagination.offset).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain('token');
    });

    it('should filter notifications by type', async () => {
      const response = await request(app)
        .get('/api/notifications?type=security')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      response.body.data.forEach(notification => {
        expect(notification.type).toBe('security');
      });
    });

    it('should filter notifications by priority', async () => {
      const response = await request(app)
        .get('/api/notifications?priority=critical')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].priority).toBe('critical');
    });

    it('should filter unread notifications only', async () => {
      const response = await request(app)
        .get('/api/notifications?unread_only=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(notification => {
        expect(notification.read).toBe(false);
      });
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/notifications?limit=2&offset=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.offset).toBe(1);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/notifications?limit=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should get unread notification count', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.unreadCount).toBe(4);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('should get notification statistics', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('unread');
      expect(response.body.data).toHaveProperty('security_alerts');
      expect(response.body.data).toHaveProperty('critical');
      expect(parseInt(response.body.data.total)).toBe(4);
      expect(parseInt(response.body.data.unread)).toBe(4);
      expect(parseInt(response.body.data.security_alerts)).toBe(2);
      expect(parseInt(response.body.data.critical)).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/stats')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const notificationId = testNotifications[0].id;
      
      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.read).toBe(true);
      expect(response.body.message).toBe('Notification marked as read');
    });

    it('should require authentication', async () => {
      const notificationId = testNotifications[1].id;
      
      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate notification ID format', async () => {
      const response = await request(app)
        .patch('/api/notifications/invalid-id/read')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .patch(`/api/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Notification not found');
    });
  });

  describe('PATCH /api/notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .patch('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBeGreaterThan(0);
      expect(response.body.message).toContain('notifications marked as read');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .patch('/api/notifications/mark-all-read')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification', async () => {
      const notificationId = testNotifications[2].id;
      
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(response.body.message).toBe('Notification deleted successfully');
    });

    it('should require authentication', async () => {
      const notificationId = testNotifications[3].id;
      
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate notification ID format', async () => {
      const response = await request(app)
        .delete('/api/notifications/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .delete(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Notification not found');
    });
  });

  describe('POST /api/notifications/test', () => {
    beforeEach(() => {
      // Set to development mode for test endpoint
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      // Reset NODE_ENV
      delete process.env.NODE_ENV;
    });

    it('should send a test security notification', async () => {
      const testData = {
        type: 'security',
        subtype: 'new_device_login',
        title: 'Test Security Alert',
        message: 'This is a test security notification',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.message).toBe('Test notification sent successfully');
    });

    it('should send a test account notification', async () => {
      const testData = {
        type: 'account',
        subtype: 'email_verified',
        title: 'Test Account Notification',
        message: 'This is a test account notification',
        priority: 'medium'
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.message).toBe('Test notification sent successfully');
    });

    it('should require authentication', async () => {
      const testData = {
        type: 'security',
        subtype: 'new_device_login'
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .send(testData)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should validate request body', async () => {
      const invalidData = {
        type: 'invalid_type',
        subtype: ''
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });

    it('should block test notifications in production', async () => {
      process.env.NODE_ENV = 'production';

      const testData = {
        type: 'security',
        subtype: 'new_device_login'
      };

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Test notifications not allowed in production');
    });
  });
}); 