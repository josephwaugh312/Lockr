const { Pool } = require('pg');
const { logger } = require('../utils/logger');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection pool
   */
  async connect() {
    if (this.pool) {
      return this.pool;
    }

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        let config;
        
        // Try to use DATABASE_URL first (Railway default), then fall back to individual vars
        if (process.env.DATABASE_URL) {
          config = {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            options: '-c search_path=public',
            // Connection pool settings
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000, // Increased from 2000 to 10000ms for Railway
            statement_timeout: 30000,
            application_name: 'lockr-backend'
          };
        } else {
          // Use individual environment variables
          config = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'lockr_dev',
            user: process.env.DB_USER || 'lockr_user',
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            options: '-c search_path=public',
            // Connection pool settings
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
            connectionTimeoutMillis: 10000, // Increased from 2000 to 10000ms for Railway
            // Query timeout
            statement_timeout: 30000, // 30 seconds query timeout
            // Connection security
            application_name: 'lockr-backend'
          };
        }

        this.pool = new Pool(config);

        // Handle connection errors
        this.pool.on('error', (err) => {
          logger.error('Unexpected database pool error', { error: err.message, stack: err.stack });
          this.isConnected = false;
        });

        this.pool.on('connect', (client) => {
          logger.info('New database client connected', { 
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
          });
          this.isConnected = true;
        });

        // Test the connection
        await this.testConnection();
        
        logger.info('Database connection pool initialized successfully', {
          host: config.host,
          port: config.port,
          database: config.database,
          ssl: !!config.ssl,
          retryCount: retryCount
        });

        return this.pool;
      } catch (error) {
        retryCount++;
        logger.error(`Database connection attempt ${retryCount} failed`, { 
          error: error.message, 
          stack: error.stack,
          retryCount,
          maxRetries
        });
        
        if (retryCount >= maxRetries) {
          logger.error('Max database connection retries reached', { 
            error: error.message,
            retryCount,
            maxRetries
          });
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        logger.info(`Retrying database connection in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      // Add timeout to prevent hanging
      const connectionPromise = this.pool.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timeout')), 15000);
      });

      const client = await Promise.race([connectionPromise, timeoutPromise]);
      
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();

      logger.info('Database connection test successful', {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].version.split(' ')[0] // Just PostgreSQL version number
      });

      this.isConnected = true;
      return true;
    } catch (error) {
      logger.error('Database connection test failed', { 
        error: error.message, 
        stack: error.stack 
      });
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Execute a query with automatic connection handling
   * @param {string} text - SQL query
   * @param {array} params - Query parameters
   * @returns {object} - Query result
   */
  async query(text, params = []) {
    if (!this.pool) {
      await this.connect();
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Database query executed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params: params.length,
        rows: result.rowCount,
        duration: `${duration}ms`
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params: params.length,
        duration: `${duration}ms`,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for manual transaction management
   * @returns {object} - Database client
   */
  async getClient() {
    if (!this.pool) {
      await this.connect();
    }
    
    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   * @param {function} callback - Transaction callback function
   * @returns {*} - Transaction result
   */
  async transaction(callback) {
    if (!this.pool) {
      await this.connect();
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      logger.debug('Database transaction completed successfully');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database transaction rolled back', { 
        error: error.message, 
        code: error.code 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool statistics
   * @returns {object} - Pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return { connected: false };
    }

    return {
      connected: this.isConnected,
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Close all database connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection pool closed');
    }
  }

  /**
   * Health check for monitoring
   * @returns {object} - Health status
   */
  async healthCheck() {
    try {
      if (!this.pool) {
        return { status: 'unhealthy', error: 'Pool not initialized' };
      }

      const start = Date.now();
      await this.testConnection();
      const responseTime = Date.now() - start;

      const stats = this.getPoolStats();
      
      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        pool: stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        pool: this.getPoolStats()
      };
    }
  }
}

// Export singleton instance
module.exports = new Database(); 