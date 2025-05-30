const crypto = require('crypto');

/**
 * Simple in-memory user store for testing
 * This will be replaced with a proper database in production
 */
class UserStore {
  constructor() {
    this.users = new Map();
  }

  /**
   * Create a new user
   * @param {object} userData - User data
   * @returns {object} - Created user
   */
  async create(userData) {
    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email: userData.email.toLowerCase(),
      passwordHash: userData.passwordHash,
      role: userData.role || 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.users.set(userId, user);
    this.users.set(`email:${user.email}`, userId); // Email index

    return user;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {object|null} - User object or null
   */
  async findByEmail(email) {
    const userId = this.users.get(`email:${email.toLowerCase()}`);
    if (!userId) return null;
    return this.users.get(userId);
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {object|null} - User object or null
   */
  async findById(id) {
    return this.users.get(id) || null;
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} updateData - Data to update
   * @returns {object|null} - Updated user or null
   */
  async update(id, updateData) {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = {
      ...user,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {boolean} - True if deleted, false if not found
   */
  async delete(id) {
    const user = this.users.get(id);
    if (!user) return false;

    this.users.delete(id);
    this.users.delete(`email:${user.email}`);
    return true;
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {boolean} - True if exists
   */
  async emailExists(email) {
    return this.users.has(`email:${email.toLowerCase()}`);
  }

  /**
   * Clear all users (for testing)
   */
  clear() {
    this.users.clear();
  }

  /**
   * Get user count
   * @returns {number} - Number of users
   */
  count() {
    // Count only user records (not email indexes)
    let count = 0;
    for (const [key] of this.users) {
      if (!key.startsWith('email:')) {
        count++;
      }
    }
    return count;
  }
}

// Export singleton instance
module.exports = new UserStore(); 