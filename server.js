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
  const scheduledTaskService = require('./src/services/scheduledTaskService');
  
  // Initialize the scheduled task service
  scheduledTaskService.initialize().then(() => {
    logger.info('Scheduled tasks initialized successfully');
    console.log('✅ Scheduled tasks initialized:');
    console.log('   - Breach monitoring: Weekly on Monday at 9 AM UTC');
    console.log('   - Password expiry checks: Daily at 8 AM UTC');
  }).catch(error => {
    logger.error('Failed to initialize scheduled tasks', { error: error.message });
    console.error('❌ Failed to initialize scheduled tasks:', error.message);
  });
}

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    await database.connect();
    logger.info('Database connected successfully');

    // Run migrations automatically
    try {
      console.log('🔄 Running database migrations...');
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('node migrations/run.js', (error, stdout, stderr) => {
          if (error) {
            console.warn('⚠️ Migration warning:', error.message);
            // Don't fail if migrations have issues - continue starting server
          }
          if (stdout) console.log('📋 Migration output:', stdout);
          if (stderr) console.warn('⚠️ Migration stderr:', stderr);
          resolve();
        });
      });
      console.log('✅ Database migrations completed');
    } catch (migrationError) {
      console.warn('⚠️ Migration failed, continuing with server startup:', migrationError.message);
    }

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