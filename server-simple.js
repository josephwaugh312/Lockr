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

// Initialize scheduled tasks
function initializeScheduledTasks() {
  const passwordExpiryService = require('./src/services/passwordExpiryService');
  
  // Schedule password expiry check to run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
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
}

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    await database.connect();
    logger.info('Database connected successfully');

    // Initialize scheduled tasks after database connection
    initializeScheduledTasks();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🔒 Lockr server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔐 Security features: ${process.env.NODE_ENV === 'production' ? 'ENABLED' : 'DEV MODE'}`);
      console.log(`💾 Database: Connected`);
      console.log(`⏰ Scheduled Tasks: Initialized`);
      
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV,
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