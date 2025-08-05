/**
 * UserSettingsRepository Integration Tests
 * Tests real service operations with database and settings management
 */

const userSettingsRepository = require('../../src/models/userSettingsRepository');
const userRepository = require('../../src/models/userRepository');
const database = require('../../src/config/database');
const { CryptoService } = require('../../src/services/cryptoService');

describe('UserSettingsRepository Integration Tests', () => {
  let testUser;
  let cryptoService;

  beforeAll(async () => {
    await database.connect();
    cryptoService = new CryptoService();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await database.query('DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%settings-integration%']);
    await database.query('DELETE FROM users WHERE email LIKE $1', ['%settings-integration%']);

    // Create test user
    const userData = {
      email: 'settings-integration-test@example.com',
      password: 'SecurePassword123!',
      name: 'Settings Integration Test User'
    };

    // Hash the password before creating the user
    const passwordHash = await cryptoService.hashPassword(userData.password);
    const userDataWithHash = {
      ...userData,
      passwordHash
    };
    delete userDataWithHash.password;

    testUser = await userRepository.create(userDataWithHash);
  });

  describe('Default Settings', () => {
    test('should return default settings when no settings exist', async () => {
      const settings = await userSettingsRepository.getByUserId(testUser.id);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(30);
      expect(settings.requirePasswordConfirmation).toBe(true);
      expect(settings.autoLockTimeout).toBe(15);
      expect(settings.clipboardTimeout).toBe(30);
      expect(settings.showPasswordStrength).toBe(true);
      expect(settings.autoSave).toBe(true);
      expect(settings.theme).toBe('system');
      expect(settings.compactView).toBe(false);
      expect(settings.securityAlerts).toBe(true);
      expect(settings.passwordExpiry).toBe(true);
      expect(settings.breachAlerts).toBe(true);
      expect(settings.vaultActivity).toBe(true);
      expect(settings.accountUpdates).toBe(true);
      expect(settings.systemMaintenance).toBe(true);
    });

    test('should return default settings object from getDefaultSettings', () => {
      const defaultSettings = userSettingsRepository.getDefaultSettings();

      expect(defaultSettings).toBeDefined();
      expect(defaultSettings.sessionTimeout).toBe(30);
      expect(defaultSettings.requirePasswordConfirmation).toBe(true);
      expect(defaultSettings.autoLockTimeout).toBe(15);
      expect(defaultSettings.clipboardTimeout).toBe(30);
      expect(defaultSettings.showPasswordStrength).toBe(true);
      expect(defaultSettings.autoSave).toBe(true);
      expect(defaultSettings.theme).toBe('system');
      expect(defaultSettings.compactView).toBe(false);
      expect(defaultSettings.securityAlerts).toBe(true);
      expect(defaultSettings.passwordExpiry).toBe(true);
      expect(defaultSettings.breachAlerts).toBe(true);
      expect(defaultSettings.vaultActivity).toBe(true);
      expect(defaultSettings.accountUpdates).toBe(true);
      expect(defaultSettings.systemMaintenance).toBe(true);
    });
  });

  describe('Settings Creation', () => {
    test('should create user settings with defaults', async () => {
      const settings = await userSettingsRepository.create(testUser.id);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(30);
      expect(settings.requirePasswordConfirmation).toBe(true);
      expect(settings.autoLockTimeout).toBe(15);
      expect(settings.clipboardTimeout).toBe(30);
      expect(settings.showPasswordStrength).toBe(true);
      expect(settings.autoSave).toBe(true);
      expect(settings.theme).toBe('system');
      expect(settings.compactView).toBe(false);
      expect(settings.securityAlerts).toBe(true);
      expect(settings.passwordExpiry).toBe(true);
      expect(settings.breachAlerts).toBe(true);
      expect(settings.vaultActivity).toBe(true);
      expect(settings.accountUpdates).toBe(true);
      expect(settings.systemMaintenance).toBe(true);
      expect(settings.createdAt).toBeDefined();
      expect(settings.updatedAt).toBeDefined();

      // Verify settings are stored in database
      const dbSettings = await database.query('SELECT * FROM user_settings WHERE user_id = $1', [testUser.id]);
      expect(dbSettings.rows).toHaveLength(1);
      expect(dbSettings.rows[0].user_id).toBe(testUser.id);
    });

    test('should create user settings with custom values', async () => {
      const customSettings = {
        sessionTimeout: 60,
        requirePasswordConfirmation: false,
        autoLockTimeout: 30,
        clipboardTimeout: 60,
        showPasswordStrength: false,
        autoSave: false,
        theme: 'dark',
        compactView: true,
        securityAlerts: false,
        passwordExpiry: false,
        breachAlerts: false,
        vaultActivity: false,
        accountUpdates: false,
        systemMaintenance: false
      };

      const settings = await userSettingsRepository.create(testUser.id, customSettings);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(60);
      expect(settings.requirePasswordConfirmation).toBe(false);
      expect(settings.autoLockTimeout).toBe(30);
      expect(settings.clipboardTimeout).toBe(60);
      expect(settings.showPasswordStrength).toBe(false);
      expect(settings.autoSave).toBe(false);
      expect(settings.theme).toBe('dark');
      expect(settings.compactView).toBe(true);
      expect(settings.securityAlerts).toBe(false);
      expect(settings.passwordExpiry).toBe(false);
      expect(settings.breachAlerts).toBe(false);
      expect(settings.vaultActivity).toBe(false);
      expect(settings.accountUpdates).toBe(false);
      expect(settings.systemMaintenance).toBe(false);
    });

    test('should merge custom settings with defaults', async () => {
      const partialSettings = {
        sessionTimeout: 45,
        theme: 'light',
        compactView: true
      };

      const settings = await userSettingsRepository.create(testUser.id, partialSettings);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(45); // Custom value
      expect(settings.theme).toBe('light'); // Custom value
      expect(settings.compactView).toBe(true); // Custom value
      expect(settings.requirePasswordConfirmation).toBe(true); // Default value
      expect(settings.autoLockTimeout).toBe(15); // Default value
      expect(settings.clipboardTimeout).toBe(30); // Default value
      expect(settings.showPasswordStrength).toBe(true); // Default value
      expect(settings.autoSave).toBe(true); // Default value
      expect(settings.securityAlerts).toBe(true); // Default value
      expect(settings.passwordExpiry).toBe(true); // Default value
      expect(settings.breachAlerts).toBe(true); // Default value
      expect(settings.vaultActivity).toBe(true); // Default value
      expect(settings.accountUpdates).toBe(true); // Default value
      expect(settings.systemMaintenance).toBe(true); // Default value
    });
  });

  describe('Settings Retrieval', () => {
    test('should retrieve existing user settings', async () => {
      // Create settings first
      const createdSettings = await userSettingsRepository.create(testUser.id, {
        sessionTimeout: 60,
        theme: 'dark'
      });

      // Retrieve settings
      const retrievedSettings = await userSettingsRepository.getByUserId(testUser.id);

      expect(retrievedSettings).toBeDefined();
      expect(retrievedSettings.sessionTimeout).toBe(60);
      expect(retrievedSettings.theme).toBe('dark');
      expect(retrievedSettings.createdAt).toBeDefined();
      expect(retrievedSettings.updatedAt).toBeDefined();
    });

    test('should return default settings for non-existent user', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const settings = await userSettingsRepository.getByUserId(fakeUserId);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(30);
      expect(settings.requirePasswordConfirmation).toBe(true);
      expect(settings.autoLockTimeout).toBe(15);
      expect(settings.clipboardTimeout).toBe(30);
      expect(settings.showPasswordStrength).toBe(true);
      expect(settings.autoSave).toBe(true);
      expect(settings.theme).toBe('system');
      expect(settings.compactView).toBe(false);
      expect(settings.securityAlerts).toBe(true);
      expect(settings.passwordExpiry).toBe(true);
      expect(settings.breachAlerts).toBe(true);
      expect(settings.vaultActivity).toBe(true);
      expect(settings.accountUpdates).toBe(true);
      expect(settings.systemMaintenance).toBe(true);
    });
  });

  describe('Settings Updates', () => {
    test('should update existing user settings', async () => {
      // Create initial settings
      await userSettingsRepository.create(testUser.id, {
        sessionTimeout: 30,
        theme: 'system'
      });

      // Update settings
      const updateData = {
        sessionTimeout: 60,
        theme: 'dark',
        compactView: true
      };

      const updatedSettings = await userSettingsRepository.update(testUser.id, updateData);

      expect(updatedSettings).toBeDefined();
      expect(updatedSettings.sessionTimeout).toBe(60);
      expect(updatedSettings.theme).toBe('dark');
      expect(updatedSettings.compactView).toBe(true);
      expect(updatedSettings.requirePasswordConfirmation).toBe(true); // Should remain unchanged
      expect(updatedSettings.autoLockTimeout).toBe(15); // Should remain unchanged
      expect(updatedSettings.clipboardTimeout).toBe(30); // Should remain unchanged
      expect(updatedSettings.showPasswordStrength).toBe(true); // Should remain unchanged
      expect(updatedSettings.autoSave).toBe(true); // Should remain unchanged
      expect(updatedSettings.securityAlerts).toBe(true); // Should remain unchanged
      expect(updatedSettings.passwordExpiry).toBe(true); // Should remain unchanged
      expect(updatedSettings.breachAlerts).toBe(true); // Should remain unchanged
      expect(updatedSettings.vaultActivity).toBe(true); // Should remain unchanged
      expect(updatedSettings.accountUpdates).toBe(true); // Should remain unchanged
      expect(updatedSettings.systemMaintenance).toBe(true); // Should remain unchanged
    });

    test('should create settings if they do not exist during update', async () => {
      const updateData = {
        sessionTimeout: 45,
        theme: 'light'
      };

      const settings = await userSettingsRepository.update(testUser.id, updateData);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(45);
      expect(settings.theme).toBe('light');
      expect(settings.requirePasswordConfirmation).toBe(true); // Default value
      expect(settings.autoLockTimeout).toBe(15); // Default value
      expect(settings.clipboardTimeout).toBe(30); // Default value
      expect(settings.showPasswordStrength).toBe(true); // Default value
      expect(settings.autoSave).toBe(true); // Default value
      expect(settings.compactView).toBe(false); // Default value
      expect(settings.securityAlerts).toBe(true); // Default value
      expect(settings.passwordExpiry).toBe(true); // Default value
      expect(settings.breachAlerts).toBe(true); // Default value
      expect(settings.vaultActivity).toBe(true); // Default value
      expect(settings.accountUpdates).toBe(true); // Default value
      expect(settings.systemMaintenance).toBe(true); // Default value
    });

    test('should handle partial updates', async () => {
      // Create initial settings
      await userSettingsRepository.create(testUser.id, {
        sessionTimeout: 30,
        theme: 'system',
        compactView: false
      });

      // Update only one field
      const updateData = {
        sessionTimeout: 90
      };

      const updatedSettings = await userSettingsRepository.update(testUser.id, updateData);

      expect(updatedSettings).toBeDefined();
      expect(updatedSettings.sessionTimeout).toBe(90); // Updated
      expect(updatedSettings.theme).toBe('system'); // Unchanged
      expect(updatedSettings.compactView).toBe(false); // Unchanged
    });

    test('should handle null values in updates', async () => {
      // Create initial settings
      await userSettingsRepository.create(testUser.id, {
        sessionTimeout: 30,
        theme: 'system'
      });

      // Update with null values (should keep existing values)
      const updateData = {
        sessionTimeout: null,
        theme: null
      };

      const updatedSettings = await userSettingsRepository.update(testUser.id, updateData);

      expect(updatedSettings).toBeDefined();
      expect(updatedSettings.sessionTimeout).toBe(30); // Should remain unchanged
      expect(updatedSettings.theme).toBe('system'); // Should remain unchanged
    });
  });

  describe('Settings Deletion', () => {
    test('should delete existing user settings', async () => {
      // Create settings first
      await userSettingsRepository.create(testUser.id);

      // Verify settings exist
      const existingSettings = await userSettingsRepository.getByUserId(testUser.id);
      expect(existingSettings.sessionTimeout).toBe(30); // Not default (actually stored)

      // Delete settings
      const deleted = await userSettingsRepository.delete(testUser.id);
      expect(deleted).toBe(true);

      // Verify settings are deleted (should return defaults)
      const settingsAfterDelete = await userSettingsRepository.getByUserId(testUser.id);
      expect(settingsAfterDelete.sessionTimeout).toBe(30); // Default value
    });

    test('should return false when deleting non-existent settings', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const deleted = await userSettingsRepository.delete(fakeUserId);
      expect(deleted).toBe(false);
    });
  });

  describe('Data Transformation', () => {
    test('should transform database row to settings object', () => {
      const mockDbRow = {
        user_id: 'test-user-id',
        session_timeout: 45,
        require_password_confirmation: false,
        auto_lock_timeout: 20,
        clipboard_timeout: 45,
        show_password_strength: false,
        auto_save: false,
        theme: 'dark',
        compact_view: true,
        security_alerts: false,
        password_expiry: false,
        breach_alerts: false,
        vault_activity: false,
        account_updates: false,
        system_maintenance: false,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z')
      };

      const settings = userSettingsRepository.transformDbToSettings(mockDbRow);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(45);
      expect(settings.requirePasswordConfirmation).toBe(false);
      expect(settings.autoLockTimeout).toBe(20);
      expect(settings.clipboardTimeout).toBe(45);
      expect(settings.showPasswordStrength).toBe(false);
      expect(settings.autoSave).toBe(false);
      expect(settings.theme).toBe('dark');
      expect(settings.compactView).toBe(true);
      expect(settings.securityAlerts).toBe(false);
      expect(settings.passwordExpiry).toBe(false);
      expect(settings.breachAlerts).toBe(false);
      expect(settings.vaultActivity).toBe(false);
      expect(settings.accountUpdates).toBe(false);
      expect(settings.systemMaintenance).toBe(false);
      expect(settings.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(settings.updatedAt).toEqual(new Date('2024-01-02T00:00:00Z'));
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Try to create settings with invalid user ID
      const invalidUserId = 'invalid-uuid';
      
      await expect(userSettingsRepository.create(invalidUserId))
        .rejects.toThrow();
    });

    test('should handle update errors gracefully', async () => {
      // Try to update settings with invalid user ID
      const invalidUserId = 'invalid-uuid';
      
      await expect(userSettingsRepository.update(invalidUserId, { sessionTimeout: 60 }))
        .rejects.toThrow();
    });

    test('should handle delete errors gracefully', async () => {
      // Try to delete settings with invalid user ID
      const invalidUserId = 'invalid-uuid';
      
      await expect(userSettingsRepository.delete(invalidUserId))
        .rejects.toThrow();
    });
  });

  describe('Multiple Users', () => {
    test('should handle settings for multiple users independently', async () => {
      // Create second user
      const user2 = await userRepository.create({
        email: 'settings-integration-test2@example.com',
        passwordHash: await cryptoService.hashPassword('Password123!'),
        name: 'Test User 2'
      });

      // Create different settings for each user
      const settings1 = await userSettingsRepository.create(testUser.id, {
        sessionTimeout: 30,
        theme: 'light'
      });

      const settings2 = await userSettingsRepository.create(user2.id, {
        sessionTimeout: 60,
        theme: 'dark'
      });

      // Verify settings are independent
      expect(settings1.sessionTimeout).toBe(30);
      expect(settings1.theme).toBe('light');
      expect(settings2.sessionTimeout).toBe(60);
      expect(settings2.theme).toBe('dark');

      // Retrieve settings and verify they're correct
      const retrieved1 = await userSettingsRepository.getByUserId(testUser.id);
      const retrieved2 = await userSettingsRepository.getByUserId(user2.id);

      expect(retrieved1.sessionTimeout).toBe(30);
      expect(retrieved1.theme).toBe('light');
      expect(retrieved2.sessionTimeout).toBe(60);
      expect(retrieved2.theme).toBe('dark');

      // Clean up
      await userRepository.delete(user2.id);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty settings object', async () => {
      const settings = await userSettingsRepository.create(testUser.id, {});

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(30); // Default value
      expect(settings.theme).toBe('system'); // Default value
    });

    test('should handle undefined settings', async () => {
      const settings = await userSettingsRepository.create(testUser.id, undefined);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(30); // Default value
      expect(settings.theme).toBe('system'); // Default value
    });

    test('should handle settings with extra fields', async () => {
      const settingsWithExtra = {
        sessionTimeout: 45,
        theme: 'dark',
        extraField: 'should be ignored'
      };

      const settings = await userSettingsRepository.create(testUser.id, settingsWithExtra);

      expect(settings).toBeDefined();
      expect(settings.sessionTimeout).toBe(45);
      expect(settings.theme).toBe('dark');
      expect(settings).not.toHaveProperty('extraField');
    });

    test('should handle all boolean settings', async () => {
      const booleanSettings = {
        requirePasswordConfirmation: false,
        showPasswordStrength: false,
        autoSave: false,
        compactView: true,
        securityAlerts: false,
        passwordExpiry: false,
        breachAlerts: false,
        vaultActivity: false,
        accountUpdates: false,
        systemMaintenance: false
      };

      const settings = await userSettingsRepository.create(testUser.id, booleanSettings);

      expect(settings.requirePasswordConfirmation).toBe(false);
      expect(settings.showPasswordStrength).toBe(false);
      expect(settings.autoSave).toBe(false);
      expect(settings.compactView).toBe(true);
      expect(settings.securityAlerts).toBe(false);
      expect(settings.passwordExpiry).toBe(false);
      expect(settings.breachAlerts).toBe(false);
      expect(settings.vaultActivity).toBe(false);
      expect(settings.accountUpdates).toBe(false);
      expect(settings.systemMaintenance).toBe(false);
    });

    test('should handle all numeric settings', async () => {
      const numericSettings = {
        sessionTimeout: 120,
        autoLockTimeout: 45,
        clipboardTimeout: 90
      };

      const settings = await userSettingsRepository.create(testUser.id, numericSettings);

      expect(settings.sessionTimeout).toBe(120);
      expect(settings.autoLockTimeout).toBe(45);
      expect(settings.clipboardTimeout).toBe(90);
    });

    test('should handle theme variations', async () => {
      const themes = ['system', 'light', 'dark'];

      for (let i = 0; i < themes.length; i++) {
        const theme = themes[i];
        
        // Create a new user for each theme to avoid unique constraint violation
        const themeUser = await userRepository.create({
          email: `settings-integration-theme-${i}@example.com`,
          passwordHash: await cryptoService.hashPassword('Password123!'),
          name: `Theme Test User ${i}`
        });

        const settings = await userSettingsRepository.create(themeUser.id, { theme });
        expect(settings.theme).toBe(theme);

        // Clean up
        await userRepository.delete(themeUser.id);
      }
    });
  });
}); 