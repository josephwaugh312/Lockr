/**
 * Transaction-based test isolation helper
 * Ensures each test runs in its own transaction that gets rolled back
 */

const database = require('../../src/config/database');

class TransactionTestHelper {
  constructor() {
    this.transactionClient = null;
    this.originalQuery = null;
    this.originalGetClient = null;
    this.originalPoolConnect = null;
  }

  /**
   * Start a transaction for the current test
   * This should be called in beforeEach
   */
  async beginTransaction() {
    try {
      // Get a dedicated client for this transaction
      this.transactionClient = await database.pool.connect();
      
      // Start the transaction
      await this.transactionClient.query('BEGIN');
      
      // Override the database.query method to use our transaction client
      this.originalQuery = database.query;
      database.query = async (text, params) => {
        return this.transactionClient.query(text, params);
      };
      
      // Override the pool.query method as well
      database.pool.originalQuery = database.pool.query;
      database.pool.query = async (text, params) => {
        return this.transactionClient.query(text, params);
      };

      // Override database.getClient to return a proxy using the transaction client
      this.originalGetClient = database.getClient;
      database.getClient = async () => {
        const client = this.transactionClient;
        return {
          query: (text, params) => client.query(text, params),
          release: () => { /* no-op inside transaction */ }
        };
      };

      // Override pool.connect to reuse the transaction client to avoid cross-connection visibility issues
      this.originalPoolConnect = database.pool.connect;
      database.pool.connect = async () => {
        const client = this.transactionClient;
        // Return a proxy that matches pg client interface with no-op release
        return {
          query: (text, params) => client.query(text, params),
          release: () => { /* no-op inside transaction */ }
        };
      };

      console.log('🔄 Transaction started for test');
    } catch (error) {
      console.error('❌ Failed to start transaction:', error.message);
      throw error;
    }
  }

  /**
   * Rollback the transaction and clean up
   * This should be called in afterEach
   */
  async rollbackTransaction() {
    try {
      if (this.transactionClient) {
        // Rollback the transaction
        await this.transactionClient.query('ROLLBACK');
        
        // Release the client back to the pool
        this.transactionClient.release();
        this.transactionClient = null;
        
        // Restore the original query methods
        if (this.originalQuery) {
          database.query = this.originalQuery;
          this.originalQuery = null;
        }
        
        if (database.pool.originalQuery) {
          database.pool.query = database.pool.originalQuery;
          delete database.pool.originalQuery;
        }

        if (this.originalGetClient) {
          database.getClient = this.originalGetClient;
          this.originalGetClient = null;
        }

        if (this.originalPoolConnect) {
          database.pool.connect = this.originalPoolConnect;
          this.originalPoolConnect = null;
        }

        console.log('✅ Transaction rolled back');
      }
    } catch (error) {
      console.error('❌ Failed to rollback transaction:', error.message);
      // Try to release the client anyway
      if (this.transactionClient) {
        try {
          this.transactionClient.release();
        } catch (releaseError) {
          console.error('❌ Failed to release client:', releaseError.message);
        }
        this.transactionClient = null;
      }
      throw error;
    }
  }

  /**
   * Create a savepoint (useful for nested transactions within a test)
   */
  async createSavepoint(name = 'test_savepoint') {
    if (!this.transactionClient) {
      throw new Error('No active transaction to create savepoint in');
    }
    await this.transactionClient.query(`SAVEPOINT ${name}`);
    return name;
  }

  /**
   * Rollback to a savepoint
   */
  async rollbackToSavepoint(name) {
    if (!this.transactionClient) {
      throw new Error('No active transaction to rollback savepoint in');
    }
    await this.transactionClient.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  /**
   * Get the transaction client for direct queries if needed
   */
  getTransactionClient() {
    return this.transactionClient;
  }
}

/**
 * Convenience function to set up transaction isolation for a test suite
 * Usage in test files:
 * 
 * const { setupTransactionTests } = require('../helpers/transactionTestHelper');
 * 
 * describe('My Test Suite', () => {
 *   setupTransactionTests();
 *   
 *   test('my test', async () => {
 *     // Test code here - all DB operations will be rolled back
 *   });
 * });
 */
function setupTransactionTests() {
  const helper = new TransactionTestHelper();
  
  beforeEach(async () => {
    await helper.beginTransaction();
  });
  
  afterEach(async () => {
    await helper.rollbackTransaction();
  });
  
  // Return helper in case tests need direct access
  return helper;
}

module.exports = {
  TransactionTestHelper,
  setupTransactionTests
};
