const database = require('../config/database');
const { logger } = require('../utils/logger');

class InAppNotificationService {
  constructor() {
    // No need for separate client - use shared pool
  }

  async create(notificationData) {
    try {
      const {
        userId,
        type,
        subtype,
        title,
        message,
        data = {},
        priority = 'medium'
      } = notificationData;

      const query = `
        INSERT INTO notifications (
          user_id, type, subtype, title, message, data, priority, read, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `;

      const values = [
        userId,
        type,
        subtype,
        title,
        message,
        JSON.stringify(data),
        priority,
        false
      ];

      const client = await database.getClient();
      try {
        const result = await client.query(query, values);
        const notification = result.rows[0];

        // PostgreSQL JSONB is automatically parsed by pg library, no need to parse again
        // notification.data is already an object

        logger.info('In-app notification created', {
          id: notification.id,
          userId,
          type,
          subtype
        });

        return notification;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to create in-app notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        unreadOnly = false,
        type = null,
        priority = null
      } = options;

      let query = `
        SELECT * FROM notifications 
        WHERE user_id = $1
      `;
      const values = [userId];
      let paramCount = 1;

      if (unreadOnly) {
        query += ` AND read = false`;
      }

      if (type) {
        paramCount++;
        query += ` AND type = $${paramCount}`;
        values.push(type);
      }

      if (priority) {
        paramCount++;
        query += ` AND priority = $${paramCount}`;
        values.push(priority);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      values.push(limit, offset);

      const client = await database.getClient();
      try {
        const result = await client.query(query, values);
        // PostgreSQL JSONB is automatically parsed by pg library, no need to parse again
        const notifications = result.rows;

        return notifications;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get user notifications:', error);
      throw error;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      const query = `
        UPDATE notifications 
        SET read = true, read_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      const client = await database.getClient();
      try {
        const result = await client.query(query, [notificationId, userId]);
        
        if (result.rows.length === 0) {
          throw new Error('Notification not found or access denied');
        }

        const notification = result.rows[0];
        // PostgreSQL JSONB is automatically parsed by pg library, no need to parse again

        logger.info('Notification marked as read', {
          id: notificationId,
          userId
        });

        return notification;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      const query = `
        UPDATE notifications 
        SET read = true, read_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND read = false
      `;

      const client = await database.getClient();
      try {
        const result = await client.query(query, [userId]);
        
        logger.info('All notifications marked as read', {
          userId,
          updatedCount: result.rowCount
        });

        return { updatedCount: result.rowCount };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = $1 AND read = false
      `;

      const client = await database.getClient();
      try {
        const result = await client.query(query, [userId]);
        return parseInt(result.rows[0].count);
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId, userId) {
    try {
      const query = `
        DELETE FROM notifications 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      const client = await database.getClient();
      try {
        const result = await client.query(query, [notificationId, userId]);
        
        if (result.rows.length === 0) {
          throw new Error('Notification not found or access denied');
        }

        logger.info('Notification deleted', {
          id: notificationId,
          userId
        });

        return { deleted: true, id: notificationId };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      throw error;
    }
  }

  async deleteOldNotifications(olderThanDays = 30) {
    try {
      const query = `
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
        AND read = true
      `;

      const client = await database.getClient();
      try {
        const result = await client.query(query);
        
        logger.info('Old notifications cleaned up', {
          deletedCount: result.rowCount,
          olderThanDays
        });

        return { deletedCount: result.rowCount };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to delete old notifications:', error);
      throw error;
    }
  }

  async getNotificationStats(userId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN read = false THEN 1 END) as unread,
          COUNT(CASE WHEN type = 'security' THEN 1 END) as security_alerts,
          COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical
        FROM notifications 
        WHERE user_id = $1
      `;

      const client = await database.getClient();
      try {
        const result = await client.query(query, [userId]);
        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get notification stats:', error);
      throw error;
    }
  }
}

module.exports = InAppNotificationService;
