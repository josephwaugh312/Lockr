// Mock dependencies before importing the service
jest.mock('node-cron', () => ({
  schedule: jest.fn((cronExpression, callback, options) => ({
    cronExpression,
    callback,
    options,
    running: true,
    stop: jest.fn(),
    nextDate: jest.fn(() => new Date('2024-01-16T09:00:00Z'))
  }))
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/services/breachMonitoringService', () => ({
  checkAllUsersForBreaches: jest.fn()
}));

jest.mock('../../src/services/passwordExpiryService', () => ({
  runScheduledPasswordExpiryCheck: jest.fn()
}));

// Import modules after mocks are set up
const cron = require('node-cron');
const { logger } = require('../../src/utils/logger');
const breachMonitoringService = require('../../src/services/breachMonitoringService');
const passwordExpiryService = require('../../src/services/passwordExpiryService');

// Import the service after all mocks are in place
const scheduledTaskService = require('../../src/services/scheduledTaskService');

describe('ScheduledTaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service state
    scheduledTaskService.isInitialized = false;
    scheduledTaskService.tasks.clear();
  });

  describe('initialize', () => {
    it('should initialize scheduled tasks successfully', async () => {
      await scheduledTaskService.initialize();

      expect(scheduledTaskService.isInitialized).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Initializing scheduled tasks...');
      expect(logger.info).toHaveBeenCalledWith('Scheduled tasks initialized successfully');
      
      // Check that cron.schedule was called for both tasks
      expect(cron.schedule).toHaveBeenCalledTimes(2);
      
      // Check breach monitoring schedule
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 9 * * 1', // Mondays at 9 AM
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
      
      // Check password expiry schedule  
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 8 * * *', // Daily at 8 AM
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );

      expect(logger.info).toHaveBeenCalledWith('Breach monitoring scheduled for Mondays at 9 AM UTC');
      expect(logger.info).toHaveBeenCalledWith('Password expiry checks scheduled for daily at 8 AM UTC');
    });

    it('should not reinitialize if already initialized', async () => {
      // First initialization
      await scheduledTaskService.initialize();
      jest.clearAllMocks();
      
      // Second initialization attempt
      await scheduledTaskService.initialize();

      expect(logger.info).not.toHaveBeenCalledWith('Initializing scheduled tasks...');
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should store tasks in the tasks Map', async () => {
      await scheduledTaskService.initialize();

      expect(scheduledTaskService.tasks.size).toBe(2);
      expect(scheduledTaskService.tasks.has('breach-monitoring')).toBe(true);
      expect(scheduledTaskService.tasks.has('password-expiry')).toBe(true);
    });
  });

  describe('scheduleBreachMonitoring', () => {
    it('should schedule breach monitoring with correct cron expression', () => {
      scheduledTaskService.scheduleBreachMonitoring();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 9 * * 1',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );

      expect(scheduledTaskService.tasks.has('breach-monitoring')).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Breach monitoring scheduled for Mondays at 9 AM UTC');
    });

    it('should execute breach monitoring callback successfully', async () => {
      const mockResults = {
        totalUsers: 10,
        breachesFound: 2,
        notificationsSent: 5
      };
      breachMonitoringService.checkAllUsersForBreaches.mockResolvedValueOnce(mockResults);

      scheduledTaskService.scheduleBreachMonitoring();

      // Get the scheduled callback function
      const callback = cron.schedule.mock.calls[0][1];
      
      // Execute the callback
      await callback();

      expect(logger.info).toHaveBeenCalledWith('Running scheduled breach monitoring...');
      expect(breachMonitoringService.checkAllUsersForBreaches).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Scheduled breach monitoring completed', mockResults);
    });

    it('should handle breach monitoring callback errors', async () => {
      const error = new Error('Breach monitoring failed');
      breachMonitoringService.checkAllUsersForBreaches.mockRejectedValueOnce(error);

      scheduledTaskService.scheduleBreachMonitoring();

      // Get and execute the callback
      const callback = cron.schedule.mock.calls[0][1];
      await callback();

      expect(logger.info).toHaveBeenCalledWith('Running scheduled breach monitoring...');
      expect(logger.error).toHaveBeenCalledWith('Scheduled breach monitoring failed', {
        error: 'Breach monitoring failed'
      });
    });
  });

  describe('schedulePasswordExpiryChecks', () => {
    it('should schedule password expiry checks with correct cron expression', () => {
      scheduledTaskService.schedulePasswordExpiryChecks();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 8 * * *',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );

      expect(scheduledTaskService.tasks.has('password-expiry')).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Password expiry checks scheduled for daily at 8 AM UTC');
    });

    it('should execute password expiry callback successfully', async () => {
      const mockResults = {
        usersProcessed: 15,
        notificationsSent: 8,
        errors: 0
      };
      passwordExpiryService.runScheduledPasswordExpiryCheck.mockResolvedValueOnce(mockResults);

      scheduledTaskService.schedulePasswordExpiryChecks();

      // Get the scheduled callback function
      const callback = cron.schedule.mock.calls[0][1];
      
      // Execute the callback
      await callback();

      expect(logger.info).toHaveBeenCalledWith('Running scheduled password expiry checks...');
      expect(passwordExpiryService.runScheduledPasswordExpiryCheck).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Scheduled password expiry checks completed', mockResults);
    });

    it('should handle password expiry callback errors', async () => {
      const error = new Error('Password expiry check failed');
      passwordExpiryService.runScheduledPasswordExpiryCheck.mockRejectedValueOnce(error);

      scheduledTaskService.schedulePasswordExpiryChecks();

      // Get and execute the callback
      const callback = cron.schedule.mock.calls[0][1];
      await callback();

      expect(logger.info).toHaveBeenCalledWith('Running scheduled password expiry checks...');
      expect(logger.error).toHaveBeenCalledWith('Scheduled password expiry checks failed', {
        error: 'Password expiry check failed'
      });
    });
  });

  describe('triggerBreachMonitoring', () => {
    it('should manually trigger breach monitoring successfully', async () => {
      const mockResults = {
        totalUsers: 5,
        breachesFound: 1,
        notificationsSent: 2
      };
      breachMonitoringService.checkAllUsersForBreaches.mockResolvedValueOnce(mockResults);

      const result = await scheduledTaskService.triggerBreachMonitoring();

      expect(logger.info).toHaveBeenCalledWith('Manually triggering breach monitoring...');
      expect(breachMonitoringService.checkAllUsersForBreaches).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Manual breach monitoring completed', mockResults);
      expect(result).toEqual(mockResults);
    });

    it('should handle manual breach monitoring errors', async () => {
      const error = new Error('Manual breach monitoring failed');
      breachMonitoringService.checkAllUsersForBreaches.mockRejectedValueOnce(error);

      await expect(scheduledTaskService.triggerBreachMonitoring()).rejects.toThrow('Manual breach monitoring failed');

      expect(logger.info).toHaveBeenCalledWith('Manually triggering breach monitoring...');
      expect(logger.error).toHaveBeenCalledWith('Manual breach monitoring failed', {
        error: 'Manual breach monitoring failed'
      });
    });
  });

  describe('triggerPasswordExpiryChecks', () => {
    it('should manually trigger password expiry checks successfully', async () => {
      const mockResults = {
        usersProcessed: 8,
        notificationsSent: 3,
        errors: 1
      };
      passwordExpiryService.runScheduledPasswordExpiryCheck.mockResolvedValueOnce(mockResults);

      const result = await scheduledTaskService.triggerPasswordExpiryChecks();

      expect(logger.info).toHaveBeenCalledWith('Manually triggering password expiry checks...');
      expect(passwordExpiryService.runScheduledPasswordExpiryCheck).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Manual password expiry checks completed', mockResults);
      expect(result).toEqual(mockResults);
    });

    it('should handle manual password expiry check errors', async () => {
      const error = new Error('Manual password expiry check failed');
      passwordExpiryService.runScheduledPasswordExpiryCheck.mockRejectedValueOnce(error);

      await expect(scheduledTaskService.triggerPasswordExpiryChecks()).rejects.toThrow('Manual password expiry check failed');

      expect(logger.info).toHaveBeenCalledWith('Manually triggering password expiry checks...');
      expect(logger.error).toHaveBeenCalledWith('Manual password expiry checks failed', {
        error: 'Manual password expiry check failed'
      });
    });
  });

  describe('getTaskStatus', () => {
    it('should return empty status when no tasks are scheduled', () => {
      const status = scheduledTaskService.getTaskStatus();
      expect(status).toEqual({});
    });

    it('should return status of all scheduled tasks', async () => {
      await scheduledTaskService.initialize();

      const status = scheduledTaskService.getTaskStatus();

      expect(status).toEqual({
        'breach-monitoring': {
          scheduled: true,
          nextRun: '2024-01-16T09:00:00.000Z'
        },
        'password-expiry': {
          scheduled: true,
          nextRun: '2024-01-16T09:00:00.000Z'
        }
      });
    });

    it('should handle tasks without nextDate method', async () => {
      // Mock a task without nextDate
      const taskWithoutNextDate = {
        running: false,
        nextDate: null
      };
      
      scheduledTaskService.tasks.set('test-task', taskWithoutNextDate);

      const status = scheduledTaskService.getTaskStatus();

      expect(status['test-task']).toEqual({
        scheduled: false,
        nextRun: null
      });
    });

    it('should handle tasks with nextDate returning null', async () => {
      // Mock a task with nextDate returning null
      const taskWithNullNextDate = {
        running: true,
        nextDate: jest.fn(() => null)
      };
      
      scheduledTaskService.tasks.set('test-task', taskWithNullNextDate);

      const status = scheduledTaskService.getTaskStatus();

      expect(status['test-task']).toEqual({
        scheduled: true,
        nextRun: null
      });
    });
  });

  describe('stopAllTasks', () => {
    it('should stop no tasks when none are scheduled', () => {
      scheduledTaskService.stopAllTasks();

      expect(logger.info).toHaveBeenCalledWith('Stopping all scheduled tasks...');
      expect(scheduledTaskService.isInitialized).toBe(false);
    });

    it('should stop all scheduled tasks', async () => {
      await scheduledTaskService.initialize();
      
      // Get references to the mock tasks
      const breachTask = scheduledTaskService.tasks.get('breach-monitoring');
      const passwordTask = scheduledTaskService.tasks.get('password-expiry');

      scheduledTaskService.stopAllTasks();

      expect(logger.info).toHaveBeenCalledWith('Stopping all scheduled tasks...');
      expect(breachTask.stop).toHaveBeenCalled();
      expect(passwordTask.stop).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Stopped scheduled task: breach-monitoring');
      expect(logger.info).toHaveBeenCalledWith('Stopped scheduled task: password-expiry');
      expect(scheduledTaskService.isInitialized).toBe(false);
    });

    it('should handle tasks with no stop method gracefully', () => {
      // Add a task without stop method
      const taskWithoutStop = { running: true };
      scheduledTaskService.tasks.set('faulty-task', taskWithoutStop);

      expect(() => scheduledTaskService.stopAllTasks()).not.toThrow();
      expect(scheduledTaskService.isInitialized).toBe(false);
    });
  });

  describe('singleton behavior', () => {
    it('should maintain state across multiple imports', () => {
      // The service should be a singleton, so state should persist
      scheduledTaskService.isInitialized = true;
      scheduledTaskService.tasks.set('test', 'value');

      // Re-require the module
      const anotherReference = require('../../src/services/scheduledTaskService');
      
      expect(anotherReference.isInitialized).toBe(true);
      expect(anotherReference.tasks.get('test')).toBe('value');
      expect(anotherReference).toBe(scheduledTaskService); // Same instance
    });
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      // Access the constructor through a new instance (for testing purposes)
      const ScheduledTaskService = require('../../src/services/scheduledTaskService').constructor;
      const instance = new ScheduledTaskService();

      expect(instance.tasks).toBeInstanceOf(Map);
      expect(instance.tasks.size).toBe(0);
      expect(instance.isInitialized).toBe(false);
    });
  });

  describe('task scheduling integration', () => {
    it('should schedule tasks with correct timezone and options', async () => {
      await scheduledTaskService.initialize();

      // Verify both tasks were scheduled with correct options
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 9 * * 1',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 8 * * *',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
    });

    it('should store cron task objects correctly', async () => {
      await scheduledTaskService.initialize();

      const breachTask = scheduledTaskService.tasks.get('breach-monitoring');
      const passwordTask = scheduledTaskService.tasks.get('password-expiry');

      expect(breachTask.cronExpression).toBe('0 9 * * 1');
      expect(passwordTask.cronExpression).toBe('0 8 * * *');
      expect(breachTask.options).toEqual({ scheduled: true, timezone: 'UTC' });
      expect(passwordTask.options).toEqual({ scheduled: true, timezone: 'UTC' });
    });
  });

  describe('error handling in scheduled callbacks', () => {
    it('should not crash when breach monitoring service throws', async () => {
      breachMonitoringService.checkAllUsersForBreaches.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      scheduledTaskService.scheduleBreachMonitoring();
      const callback = cron.schedule.mock.calls[0][1];

      // Should not throw
      await expect(callback()).resolves.toBeUndefined();
      
      expect(logger.error).toHaveBeenCalledWith('Scheduled breach monitoring failed', {
        error: 'Service unavailable'
      });
    });

    it('should not crash when password expiry service throws', async () => {
      passwordExpiryService.runScheduledPasswordExpiryCheck.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      scheduledTaskService.schedulePasswordExpiryChecks();
      const callback = cron.schedule.mock.calls[0][1];

      // Should not throw
      await expect(callback()).resolves.toBeUndefined();
      
      expect(logger.error).toHaveBeenCalledWith('Scheduled password expiry checks failed', {
        error: 'Service unavailable'
      });
    });
  });
});