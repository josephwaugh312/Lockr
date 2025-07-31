const cron = require('node-cron');
const { logger } = require('../utils/logger');
const breachMonitoringService = require('./breachMonitoringService');
const passwordExpiryService = require('./passwordExpiryService');

class ScheduledTaskService {
  constructor() {
    this.tasks = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize scheduled tasks
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    logger.info('Initializing scheduled tasks...');

    // Schedule breach monitoring (weekly on Monday at 9 AM)
    this.scheduleBreachMonitoring();

    // Schedule password expiry checks (daily at 8 AM)
    this.schedulePasswordExpiryChecks();

    this.isInitialized = true;
    logger.info('Scheduled tasks initialized successfully');
  }

  /**
   * Schedule automated breach monitoring
   */
  scheduleBreachMonitoring() {
    const task = cron.schedule('0 9 * * 1', async () => {
      logger.info('Running scheduled breach monitoring...');
      
      try {
        const results = await breachMonitoringService.checkAllUsersForBreaches();
        logger.info('Scheduled breach monitoring completed', results);
      } catch (error) {
        logger.error('Scheduled breach monitoring failed', {
          error: error.message
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.tasks.set('breach-monitoring', task);
    logger.info('Breach monitoring scheduled for Mondays at 9 AM UTC');
  }

  /**
   * Schedule password expiry checks
   */
  schedulePasswordExpiryChecks() {
    const task = cron.schedule('0 8 * * *', async () => {
      logger.info('Running scheduled password expiry checks...');
      
      try {
        const results = await passwordExpiryService.runScheduledPasswordExpiryCheck();
        logger.info('Scheduled password expiry checks completed', results);
      } catch (error) {
        logger.error('Scheduled password expiry checks failed', {
          error: error.message
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.tasks.set('password-expiry', task);
    logger.info('Password expiry checks scheduled for daily at 8 AM UTC');
  }

  /**
   * Manually trigger breach monitoring
   */
  async triggerBreachMonitoring() {
    logger.info('Manually triggering breach monitoring...');
    
    try {
      const results = await breachMonitoringService.checkAllUsersForBreaches();
      logger.info('Manual breach monitoring completed', results);
      return results;
    } catch (error) {
      logger.error('Manual breach monitoring failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Manually trigger password expiry checks
   */
  async triggerPasswordExpiryChecks() {
    logger.info('Manually triggering password expiry checks...');
    
    try {
      const results = await passwordExpiryService.runScheduledPasswordExpiryCheck();
      logger.info('Manual password expiry checks completed', results);
      return results;
    } catch (error) {
      logger.error('Manual password expiry checks failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get status of all scheduled tasks
   */
  getTaskStatus() {
    const status = {};
    
    for (const [name, task] of this.tasks) {
      status[name] = {
        scheduled: task.running,
        nextRun: task.nextDate ? task.nextDate().toISOString() : null
      };
    }
    
    return status;
  }

  /**
   * Stop all scheduled tasks
   */
  stopAllTasks() {
    logger.info('Stopping all scheduled tasks...');
    
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
    
    this.isInitialized = false;
  }
}

// Export singleton instance
module.exports = new ScheduledTaskService(); 