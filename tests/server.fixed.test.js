// Fixed server test that properly handles the server module

// Add TextEncoder/TextDecoder polyfill for pg library
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock dependencies before requiring anything
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() })
}));

jest.mock('../src/config/database', () => ({
  connect: jest.fn().mockResolvedValue(),
  close: jest.fn().mockResolvedValue()
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('../src/services/passwordExpiryService', () => ({
  runScheduledPasswordExpiryCheck: jest.fn().mockResolvedValue({
    summary: {
      usersProcessed: 10,
      usersWithExpiredPasswords: 3,
      totalNotificationsSent: 3
    }
  })
}));

// Mock the app module
jest.mock('../src/app', () => {
  const mockApp = {
    listen: jest.fn((port, callback) => {
      // Immediately call the callback to simulate server started
      if (callback) callback();
      return { on: jest.fn() };
    })
  };
  return mockApp;
});

describe('Server - Fixed Tests', () => {
  let database, logger, app, cron;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mocked modules
    database = require('../src/config/database');
    logger = require('../src/utils/logger').logger;
    app = require('../src/app');
    cron = require('node-cron');
    
    // Clear the module cache to ensure fresh requires
    delete require.cache[require.resolve('../src/server')];
    
    // Reset environment
    delete process.env.PORT;
  });

  describe('Basic Server Functions', () => {
    test('should connect to database on startup', async () => {
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(database.connect).toHaveBeenCalled();
    });

    test('should listen on default port 3000', async () => {
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(app.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    test('should use PORT environment variable when set', async () => {
      process.env.PORT = '4000';
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 50));
      // server resolves env to number
      expect(app.listen).toHaveBeenCalledWith(4000, expect.any(Function));
    });

    test('should initialize scheduled tasks', async () => {
      const { initializeScheduledTasks } = require('../src/server');
      initializeScheduledTasks();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 9 * * *',
        expect.any(Function),
        expect.objectContaining({ scheduled: true, timezone: 'America/New_York' })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection failure', async () => {
      database.connect.mockRejectedValueOnce(new Error('Connection failed'));
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const { startServer } = require('../src/server');
      try { await startServer(); } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to start server',
        expect.objectContaining({ error: 'Connection failed' })
      );
      
      mockExit.mockRestore();
    });
  });

  describe('Scheduled Tasks', () => {
    test('should execute password expiry check', async () => {
      const passwordExpiryService = require('../src/services/passwordExpiryService');
      const { initializeScheduledTasks } = require('../src/server');
      initializeScheduledTasks();
      await new Promise(resolve => setTimeout(resolve, 10));
      const scheduledFunction = cron.schedule.mock.calls[0][1];
      
      // Execute it
      await scheduledFunction();
      
      expect(passwordExpiryService.runScheduledPasswordExpiryCheck).toHaveBeenCalled();
    });
  });
});