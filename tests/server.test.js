// Mock dependencies before requiring the server file
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

jest.mock('../src/config/database', () => ({
  connect: jest.fn(),
  close: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('../src/app', () => ({
  listen: jest.fn()
}));

jest.mock('../src/services/passwordExpiryService', () => ({
  runScheduledPasswordExpiryCheck: jest.fn()
}));

describe('Server', () => {
  let database, logger, app, cron, passwordExpiryService;
  let originalConsole = {};
  let processListeners = {};

  beforeAll(() => {
    // Store original console methods
    originalConsole.log = console.log;
    originalConsole.error = console.error;
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Store original process listeners
    processListeners.SIGTERM = process.listeners('SIGTERM');
    processListeners.SIGINT = process.listeners('SIGINT');
    processListeners.uncaughtException = process.listeners('uncaughtException');
    processListeners.unhandledRejection = process.listeners('unhandledRejection');
  });

  beforeEach(() => {
    // Get the mocked modules
    database = require('../src/config/database');
    logger = require('../src/utils/logger').logger;
    app = require('../src/app');
    cron = require('node-cron');
    passwordExpiryService = require('../src/services/passwordExpiryService');
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Remove any process listeners added by previous tests
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    
    // Setup default mock implementations
    const mockServer = { on: jest.fn() };
    database.connect.mockResolvedValue();
    database.close.mockResolvedValue();
    app.listen.mockImplementation((port, callback) => {
      if (callback) callback();
      return mockServer;
    });

    passwordExpiryService.runScheduledPasswordExpiryCheck.mockResolvedValue({
      summary: {
        usersProcessed: 10,
        usersWithExpiredPasswords: 3,
        totalNotificationsSent: 3
      }
    });
  });

  afterAll(() => {
    // Restore original console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    
    // Remove all test-added listeners
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    
    // Restore original process listeners
    processListeners.SIGTERM?.forEach(listener => process.on('SIGTERM', listener));
    processListeners.SIGINT?.forEach(listener => process.on('SIGINT', listener));
    processListeners.uncaughtException?.forEach(listener => process.on('uncaughtException', listener));
    processListeners.unhandledRejection?.forEach(listener => process.on('unhandledRejection', listener));
  });

  describe('Server startup', () => {
    test('should start server with default port 3000', async () => {
      delete require.cache[require.resolve('../src/server')];
      
      database.connect.mockResolvedValue();
      
      // Import server module and call exported initializer explicitly
      const { startServer } = require('../src/server');
      await startServer();
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(database.connect).toHaveBeenCalled();
      expect(app.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    test('should start server with custom port from environment', async () => {
      // Set PORT before requiring the module (since it's read at module load time)
      process.env.PORT = '4000';
      
      // Clear the require cache first
      delete require.cache[require.resolve('../src/server')];
      delete require.cache[require.resolve('../src/app')];
      
      database.connect.mockResolvedValue();
      
      // Now require the server module and start explicitly
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert custom port applied
      const listenArgs = app.listen.mock.calls[0];
      expect(listenArgs[0]).toBe(4000);
      delete process.env.PORT;
    });

    test('should log server startup information', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      database.connect.mockResolvedValue();
      
      delete require.cache[require.resolve('../src/server')];
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔒 Lockr server running on port'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🌍 Environment: production'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🔐 Security features: ENABLED'));
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should handle database connection failure', async () => {
      database.connect.mockRejectedValue(new Error('Database connection failed'));
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      delete require.cache[require.resolve('../src/server')];
      const { startServer, initializeScheduledTasks } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(logger.error).toHaveBeenCalledWith('Failed to start server', expect.any(Object));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ Failed to start server:'), expect.any(String));
      expect(mockExit).toHaveBeenCalledWith(1);
      
      mockExit.mockRestore();
    });
  });

  describe('Scheduled tasks', () => {
    test('should initialize scheduled tasks', async () => {
      const { initializeScheduledTasks } = require('../src/server');
      initializeScheduledTasks();
      
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 9 * * *',
        expect.any(Function),
        expect.objectContaining({
          scheduled: true,
          timezone: "America/New_York"
        })
      );
      expect(logger.info).toHaveBeenCalledWith('Scheduled tasks initialized', expect.any(Object));
    });

    test('should execute password expiry check successfully', async () => {
      const { initializeScheduledTasks } = require('../src/server');
      initializeScheduledTasks();
      expect(cron.schedule).toHaveBeenCalled();
      const scheduledFunction = cron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(passwordExpiryService.runScheduledPasswordExpiryCheck).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Scheduled password expiry check completed successfully',
        expect.objectContaining({
          usersProcessed: 10,
          usersWithExpiredPasswords: 3,
          totalNotificationsSent: 3
        })
      );
    });

    test('should handle password expiry check failure', async () => {
      passwordExpiryService.runScheduledPasswordExpiryCheck.mockRejectedValue(
        new Error('Password expiry check failed')
      );
      database.connect.mockResolvedValue();
      
      delete require.cache[require.resolve('../src/server')];
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(cron.schedule).toHaveBeenCalled();
      
      // Get the scheduled function and execute it
      const scheduledFunction = cron.schedule.mock.calls[0][1];
      await scheduledFunction();

      expect(logger.error).toHaveBeenCalledWith(
        'Scheduled password expiry check failed',
        expect.objectContaining({ error: 'Password expiry check failed' })
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ Scheduled password expiry check failed:'), expect.any(String)
      );
    });
  });

  describe('Server error handling', () => {
    test('should handle EADDRINUSE error', async () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const mockServer = { on: jest.fn() };
      
      database.connect.mockResolvedValue();
      app.listen.mockImplementation((port, callback) => {
        if (callback) callback();
        return mockServer;
      });
      
      mockServer.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          const error = new Error('Address already in use');
          error.code = 'EADDRINUSE';
          setTimeout(() => handler(error), 50);
        }
      });
      
      delete require.cache[require.resolve('../src/server')];
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('❌ Port 3000 is already in use'));
      expect(mockExit).toHaveBeenCalledWith(1);
      
      mockExit.mockRestore();
    });

    test('should handle generic server errors', async () => {
      const mockServer = { on: jest.fn() };
      
      database.connect.mockResolvedValue();
      app.listen.mockImplementation((port, callback) => {
        if (callback) callback();
        return mockServer;
      });
      
      mockServer.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          const error = new Error('Generic server error');
          error.code = 'EOTHER';
          setTimeout(() => handler(error), 50);
        }
      });
      
      delete require.cache[require.resolve('../src/server')];
      const { startServer } = require('../src/server');
      await startServer();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(logger.error).toHaveBeenCalledWith('Server error', expect.objectContaining({
        error: 'Generic server error',
        code: 'EOTHER'
      }));
    });
  });

});