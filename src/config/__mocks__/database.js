/**
 * Mock Database Module
 * Provides isolated mock for database operations in tests
 */

const mockDatabase = {
  getClient: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  close: jest.fn(),
  pool: null,
  isConnected: false,
  
  // Add method to reset the mock
  __reset: function() {
    this.getClient.mockReset();
    this.connect.mockReset();
    this.disconnect.mockReset();
    this.close.mockReset();
    this.isConnected = false;
    this.pool = null;
  }
};

// Default mock implementation
mockDatabase.getClient.mockImplementation(() => {
  return Promise.resolve({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn()
  });
})

mockDatabase.connect.mockResolvedValue(true);
mockDatabase.disconnect.mockResolvedValue(true);
mockDatabase.close.mockResolvedValue(true);

module.exports = mockDatabase;