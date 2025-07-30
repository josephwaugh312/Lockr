require('dotenv').config();
const app = require('./src/app');
const database = require('./src/config/database');
const { logger } = require('./src/utils/logger');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close database connections
    await database.close();
    logger.info('Database connections closed');
    
    // Exit process
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Background database connection retry
let dbRetryInterval = null;
let dbRetryCount = 0;
const MAX_DB_RETRIES = 10;

async function attemptDatabaseConnection() {
  try {
    await database.connect();
    logger.info('Database connection established successfully');
    
    // Clear retry interval if it exists
    if (dbRetryInterval) {
      clearInterval(dbRetryInterval);
      dbRetryInterval = null;
    }
    
    dbRetryCount = 0;
    return true;
  } catch (error) {
    dbRetryCount++;
    logger.error(`Database connection attempt ${dbRetryCount} failed`, {
      error: error.message,
      retryCount: dbRetryCount,
      maxRetries: MAX_DB_RETRIES
    });
    
    if (dbRetryCount >= MAX_DB_RETRIES) {
      logger.error('Max database connection retries reached, stopping retry attempts');
      if (dbRetryInterval) {
        clearInterval(dbRetryInterval);
        dbRetryInterval = null;
      }
      return false;
    }
    
    return false;
  }
}

// Initialize scheduled tasks
function initializeScheduledTasks() {
  try {
    const passwordExpiryService = require('./src/services/passwordExpiryService');
    
    // Schedule password expiry check to run daily at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
      // Only run if database is connected
      if (!database.isConnected) {
        logger.warn('Skipping scheduled password expiry check - database not connected');
        return;
      }
      
      logger.info('Starting scheduled password expiry check for all users');
      console.log('⏰ Running scheduled password expiry check...');
      
      try {
        const result = await passwordExpiryService.runScheduledPasswordExpiryCheck();
        
        logger.info('Scheduled password expiry check completed successfully', {
          usersProcessed: result.summary.usersProcessed,
          usersWithExpiredPasswords: result.summary.usersWithExpiredPasswords,
          totalNotificationsSent: result.summary.totalNotificationsSent
        });
        
        console.log(`✅ Password expiry check completed:`);
        console.log(`   - Users processed: ${result.summary.usersProcessed}`);
        console.log(`   - Users with expired passwords: ${result.summary.usersWithExpiredPasswords}`);
        console.log(`   - Notifications sent: ${result.summary.totalNotificationsSent}`);
        
      } catch (error) {
        logger.error('Scheduled password expiry check failed', {
          error: error.message,
          stack: error.stack
        });
        console.error('❌ Scheduled password expiry check failed:', error.message);
      }
    }, {
      scheduled: true,
      timezone: "America/New_York" // Adjust timezone as needed
    });
    
    logger.info('Scheduled tasks initialized', {
      passwordExpiryCheck: 'Daily at 9:00 AM EST'
    });
  } catch (error) {
    logger.error('Failed to initialize scheduled tasks', {
      error: error.message,
      stack: error.stack
    });
    console.error('❌ Failed to initialize scheduled tasks:', error.message);
    // Don't crash the server if scheduled tasks fail to initialize
  }
}

// Initialize database and start server
async function startServer() {
  try {
    // Try to connect to database, but don't fail if it doesn't work
    let dbConnected = false;
    try {
      await database.connect();
      dbConnected = true;
      logger.info('Database connected successfully on startup');
    } catch (error) {
      logger.warn('Database connection failed on startup, will retry in background', {
        error: error.message
      });
      console.log('⚠️  Database connection failed on startup, retrying in background...');
      
      // Start background retry
      dbRetryInterval = setInterval(async () => {
        const connected = await attemptDatabaseConnection();
        if (connected) {
          console.log('✅ Database connection established in background');
        }
      }, 30000); // Retry every 30 seconds
    }

    // Initialize scheduled tasks (they'll check for database connection before running)
    initializeScheduledTasks();

    // Start HTTP server regardless of database connection
    const server = app.listen(PORT, () => {
      console.log(`🔒 Lockr server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔐 Security features: ${process.env.NODE_ENV === 'production' ? 'ENABLED' : 'DEV MODE'}`);
      console.log(`💾 Database: ${dbConnected ? 'Connected' : 'Retrying in background'}`);
      console.log(`⏰ Scheduled Tasks: Initialized`);
      
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV,
        databaseConnected: dbConnected,
        pid: process.pid
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error', { error: error.message, code: error.code });
      
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason?.message || reason,
    stack: reason?.stack 
  });
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer(); 