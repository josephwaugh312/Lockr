const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { authMiddleware } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Middleware to check validation errors
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// Get user notifications
router.get('/', 
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater'),
    query('unread_only').optional().isBoolean().withMessage('unread_only must be a boolean'),
    query('type').optional().isIn(['security', 'account', 'system']).withMessage('Invalid notification type'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority level')
  ],
  checkValidation,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        unreadOnly: req.query.unread_only === 'true',
        type: req.query.type || null,
        priority: req.query.priority || null
      };

      const notifications = await notificationService.getUserNotifications(userId, options);

      res.json({
        success: true,
        data: notifications,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          count: notifications.length
        }
      });
    } catch (error) {
      logger.error('Failed to get notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications'
      });
    }
  }
);

// Get unread notification count
router.get('/unread-count',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const count = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { unreadCount: count }
      });
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count'
      });
    }
  }
);

// Get notification statistics
router.get('/stats',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const stats = await notificationService.inAppService.getNotificationStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification statistics'
      });
    }
  }
);

// Mark notification as read
router.patch('/:id/read',
  authMiddleware,
  [
    param('id').isUUID().withMessage('Invalid notification ID')
  ],
  checkValidation,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;

      const notification = await notificationService.markAsRead(notificationId, userId);

      res.json({
        success: true,
        data: notification,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  }
);

// Mark all notifications as read
router.patch('/mark-all-read',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        data: result,
        message: `${result.updatedCount} notifications marked as read`
      });
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  }
);

// Delete a notification
router.delete('/:id',
  authMiddleware,
  [
    param('id').isUUID().withMessage('Invalid notification ID')
  ],
  checkValidation,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;

      const result = await notificationService.inAppService.deleteNotification(notificationId, userId);

      res.json({
        success: true,
        data: result,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  }
);

// Test notification endpoint (for development/testing)
router.post('/test',
  authMiddleware,
  [
    body('type').isIn(['security', 'account']).withMessage('Type must be security or account'),
    body('subtype').notEmpty().withMessage('Subtype is required'),
    body('title').optional().isString().withMessage('Title must be a string'),
    body('message').optional().isString().withMessage('Message must be a string'),
    body('channels').optional().isArray().withMessage('Channels must be an array'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority level')
  ],
  checkValidation,
  async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Test notifications not allowed in production'
        });
      }

      const userId = req.user.id;
      const { type, subtype, title, message, channels, priority } = req.body;

      let result;
      if (type === 'security') {
        result = await notificationService.sendSecurityAlert(userId, subtype, {
          title,
          message,
          channels,
          priority
        });
      } else if (type === 'account') {
        result = await notificationService.sendAccountNotification(userId, subtype, {
          title,
          message,
          channels,
          priority
        });
      }

      res.json({
        success: true,
        data: result,
        message: 'Test notification sent successfully'
      });
    } catch (error) {
      logger.error('Failed to send test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error.message
      });
    }
  }
);

module.exports = router; 