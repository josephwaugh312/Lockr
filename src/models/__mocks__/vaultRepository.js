// Mock vaultRepository to prevent database calls in tests
class VaultRepository {
  constructor() {
    this.createEntry = jest.fn();
    this.getEntries = jest.fn();
    this.getEntry = jest.fn();
    this.updateEntry = jest.fn();
    this.deleteEntry = jest.fn();
    this.searchEntries = jest.fn();
    this.batchUpdateEntries = jest.fn();
    this.createSession = jest.fn();
    this.getSession = jest.fn();
    this.clearSession = jest.fn();
    
    // Legacy methods
    this.findById = jest.fn();
    this.update = jest.fn();
    this.delete = jest.fn();
    
    // In-memory session storage (mocked)
    this.sessions = new Map();
  }
}

// Export singleton instance like the real module
module.exports = new VaultRepository();