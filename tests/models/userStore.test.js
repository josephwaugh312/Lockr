const userStore = require('../../src/models/userStore');
const crypto = require('crypto');

describe('UserStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    userStore.clear();
  });

  describe('create', () => {
    test('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'user'
      };

      const user = await userStore.create(userData);

      expect(user).toHaveProperty('id');
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBe('hashed-password');
      expect(user.role).toBe('user');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('updatedAt');
    });

    test('should create user with default role when not specified', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      };

      const user = await userStore.create(userData);

      expect(user.role).toBe('user');
    });

    test('should normalize email to lowercase', async () => {
      const userData = {
        email: 'Test@Example.COM',
        passwordHash: 'hashed-password'
      };

      const user = await userStore.create(userData);

      expect(user.email).toBe('test@example.com');
    });

    test('should generate unique IDs for different users', async () => {
      const userData1 = { email: 'user1@example.com', passwordHash: 'hash1' };
      const userData2 = { email: 'user2@example.com', passwordHash: 'hash2' };

      const user1 = await userStore.create(userData1);
      const user2 = await userStore.create(userData2);

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('findByEmail', () => {
    test('should find user by email', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      };

      const createdUser = await userStore.create(userData);
      const foundUser = await userStore.findByEmail('test@example.com');

      expect(foundUser).toEqual(createdUser);
    });

    test('should find user by email case-insensitive', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      };

      const createdUser = await userStore.create(userData);
      const foundUser = await userStore.findByEmail('TEST@EXAMPLE.COM');

      expect(foundUser).toEqual(createdUser);
    });

    test('should return null for non-existent email', async () => {
      const foundUser = await userStore.findByEmail('nonexistent@example.com');

      expect(foundUser).toBeNull();
    });

    test('should return null for empty email', async () => {
      const foundUser = await userStore.findByEmail('');

      expect(foundUser).toBeNull();
    });
  });

  describe('findById', () => {
    test('should find user by ID', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashed-password'
      };

      const createdUser = await userStore.create(userData);
      const foundUser = await userStore.findById(createdUser.id);

      expect(foundUser).toEqual(createdUser);
    });

    test('should return null for non-existent ID', async () => {
      const foundUser = await userStore.findById('non-existent-id');

      expect(foundUser).toBeNull();
    });
  });

  describe('update', () => {
    test('should update user with new data', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'old-password'
      };

      const createdUser = await userStore.create(userData);
      const updateData = { passwordHash: 'new-password', role: 'admin' };
      
      const updatedUser = await userStore.update(createdUser.id, updateData);

      expect(updatedUser.passwordHash).toBe('new-password');
      expect(updatedUser.role).toBe('admin');
      expect(updatedUser.email).toBe('test@example.com'); // Should preserve existing data
      expect(new Date(updatedUser.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(createdUser.updatedAt).getTime());
    });

    test('should return null for non-existent user', async () => {
      const result = await userStore.update('non-existent-id', { role: 'admin' });

      expect(result).toBeNull();
    });

    test('should preserve original createdAt timestamp', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password'
      };

      const createdUser = await userStore.create(userData);
      const updatedUser = await userStore.update(createdUser.id, { role: 'admin' });

      expect(updatedUser.createdAt).toBe(createdUser.createdAt);
    });
  });

  describe('delete', () => {
    test('should delete existing user', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password'
      };

      const createdUser = await userStore.create(userData);
      const deleted = await userStore.delete(createdUser.id);

      expect(deleted).toBe(true);

      // Verify user is deleted
      const foundById = await userStore.findById(createdUser.id);
      const foundByEmail = await userStore.findByEmail('test@example.com');

      expect(foundById).toBeNull();
      expect(foundByEmail).toBeNull();
    });

    test('should return false for non-existent user', async () => {
      const result = await userStore.delete('non-existent-id');

      expect(result).toBe(false);
    });

    test('should remove email index when deleting user', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password'
      };

      const createdUser = await userStore.create(userData);
      await userStore.delete(createdUser.id);

      const emailExists = await userStore.emailExists('test@example.com');
      expect(emailExists).toBe(false);
    });
  });

  describe('emailExists', () => {
    test('should return true for existing email', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password'
      };

      await userStore.create(userData);
      const exists = await userStore.emailExists('test@example.com');

      expect(exists).toBe(true);
    });

    test('should return true for existing email case-insensitive', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password'
      };

      await userStore.create(userData);
      const exists = await userStore.emailExists('TEST@EXAMPLE.COM');

      expect(exists).toBe(true);
    });

    test('should return false for non-existent email', async () => {
      const exists = await userStore.emailExists('nonexistent@example.com');

      expect(exists).toBe(false);
    });
  });

  describe('count', () => {
    test('should return 0 for empty store', () => {
      const count = userStore.count();

      expect(count).toBe(0);
    });

    test('should return correct count after adding users', async () => {
      await userStore.create({ email: 'user1@example.com', passwordHash: 'pass1' });
      await userStore.create({ email: 'user2@example.com', passwordHash: 'pass2' });
      await userStore.create({ email: 'user3@example.com', passwordHash: 'pass3' });

      const count = userStore.count();

      expect(count).toBe(3);
    });

    test('should not count email indexes in user count', async () => {
      await userStore.create({ email: 'user1@example.com', passwordHash: 'pass1' });
      await userStore.create({ email: 'user2@example.com', passwordHash: 'pass2' });

      // Each user creates an email index, but count should only show actual users
      const count = userStore.count();

      expect(count).toBe(2);
    });

    test('should update count when users are deleted', async () => {
      const user1 = await userStore.create({ email: 'user1@example.com', passwordHash: 'pass1' });
      const user2 = await userStore.create({ email: 'user2@example.com', passwordHash: 'pass2' });

      expect(userStore.count()).toBe(2);

      await userStore.delete(user1.id);
      expect(userStore.count()).toBe(1);

      await userStore.delete(user2.id);
      expect(userStore.count()).toBe(0);
    });
  });

  describe('clear', () => {
    test('should clear all users from store', async () => {
      await userStore.create({ email: 'user1@example.com', passwordHash: 'pass1' });
      await userStore.create({ email: 'user2@example.com', passwordHash: 'pass2' });

      expect(userStore.count()).toBe(2);

      userStore.clear();

      expect(userStore.count()).toBe(0);
      expect(await userStore.emailExists('user1@example.com')).toBe(false);
      expect(await userStore.emailExists('user2@example.com')).toBe(false);
    });
  });

  describe('Integration tests', () => {
    test('should handle multiple users with same password hash', async () => {
      const user1 = await userStore.create({ email: 'user1@example.com', passwordHash: 'same-hash' });
      const user2 = await userStore.create({ email: 'user2@example.com', passwordHash: 'same-hash' });

      expect(user1.id).not.toBe(user2.id);
      expect(await userStore.findByEmail('user1@example.com')).toEqual(user1);
      expect(await userStore.findByEmail('user2@example.com')).toEqual(user2);
    });

    test('should handle user creation and retrieval workflow', async () => {
      const userData = {
        email: 'workflow@example.com',
        passwordHash: 'hashed-password',
        role: 'admin'
      };

      // Create user
      const createdUser = await userStore.create(userData);
      expect(createdUser.id).toBeDefined();

      // Find by email
      const foundByEmail = await userStore.findByEmail('workflow@example.com');
      expect(foundByEmail).toEqual(createdUser);

      // Find by ID
      const foundById = await userStore.findById(createdUser.id);
      expect(foundById).toEqual(createdUser);

      // Update user
      const updatedUser = await userStore.update(createdUser.id, { role: 'user' });
      expect(updatedUser.role).toBe('user');

      // Check email still exists
      expect(await userStore.emailExists('workflow@example.com')).toBe(true);

      // Delete user
      const deleted = await userStore.delete(createdUser.id);
      expect(deleted).toBe(true);

      // Verify user is gone
      expect(await userStore.findById(createdUser.id)).toBeNull();
      expect(await userStore.findByEmail('workflow@example.com')).toBeNull();
      expect(await userStore.emailExists('workflow@example.com')).toBe(false);
    });

    test('should handle concurrent operations safely', async () => {
      const operations = [];

      // Create multiple users concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(
          userStore.create({
            email: `user${i}@example.com`,
            passwordHash: `password${i}`
          })
        );
      }

      const users = await Promise.all(operations);

      expect(users).toHaveLength(10);
      expect(userStore.count()).toBe(10);

      // Verify all users have unique IDs
      const ids = users.map(user => user.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds).toHaveLength(10);
    });
  });
});