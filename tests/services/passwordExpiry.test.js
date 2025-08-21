// Mock all dependencies before importing anything - using jest.doMock for better control
const mockUserSettingsRepo = {
  getByUserId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockVaultRepo = {
  getAllByUserId: jest.fn()
};

const mockUserRepo = {
  getAllActiveUsers: jest.fn()
};

const mockNotificationService = {
  sendNotification: jest.fn(),
  sendSecurityAlert: jest.fn(),
  NOTIFICATION_SUBTYPES: {
    PASSWORD_EXPIRY_WARNING: 'PASSWORD_EXPIRY_WARNING'
  }
};

const mockLogger = {
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
};

// Use jest.doMock to ensure these mocks are applied before any imports
jest.doMock('../../src/utils/logger', () => mockLogger);
jest.doMock('../../src/services/notificationService', () => mockNotificationService);
jest.doMock('../../src/models/vaultRepository', () => mockVaultRepo);
jest.doMock('../../src/models/userSettingsRepository', () => mockUserSettingsRepo);
jest.doMock('../../src/models/userRepository', () => mockUserRepo);

// Mock database to prevent real connections
jest.doMock('../../src/config/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  testConnection: jest.fn(),
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }
}));

// DON'T import modules here - import them dynamically in tests

describe('PasswordExpiryService', () => {
  let passwordExpiryService;
  
  beforeAll(() => {
    // Clear the module cache to ensure fresh imports
    jest.resetModules();
    // Import the service after all mocks are set up
    passwordExpiryService = require('../../src/services/passwordExpiryService');
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks to default behavior
    mockUserSettingsRepo.getByUserId.mockReset();
    mockVaultRepo.getAllByUserId.mockReset();
    mockUserRepo.getAllActiveUsers.mockReset();
    mockNotificationService.sendSecurityAlert.mockReset();
    mockNotificationService.sendNotification.mockReset();
  });

  describe('categorizePasswordAge', () => {
    it('should categorize healthy passwords correctly', () => {
      expect(passwordExpiryService.categorizePasswordAge(30)).toBe('healthy');
      expect(passwordExpiryService.categorizePasswordAge(0)).toBe('healthy');
      expect(passwordExpiryService.categorizePasswordAge(74)).toBe('healthy');
    });

    it('should categorize warning passwords correctly', () => {
      expect(passwordExpiryService.categorizePasswordAge(75)).toBe('warning');
      expect(passwordExpiryService.categorizePasswordAge(80)).toBe('warning');
      expect(passwordExpiryService.categorizePasswordAge(89)).toBe('warning');
    });

    it('should categorize critical passwords correctly', () => {
      expect(passwordExpiryService.categorizePasswordAge(90)).toBe('critical');
      expect(passwordExpiryService.categorizePasswordAge(100)).toBe('critical');
      expect(passwordExpiryService.categorizePasswordAge(119)).toBe('critical');
    });

    it('should categorize expired passwords correctly', () => {
      expect(passwordExpiryService.categorizePasswordAge(120)).toBe('expired');
      expect(passwordExpiryService.categorizePasswordAge(150)).toBe('expired');
      expect(passwordExpiryService.categorizePasswordAge(365)).toBe('expired');
    });
  });

  describe('calculateHealthScore', () => {
    it('should return 100 for no summary', () => {
      expect(passwordExpiryService.calculateHealthScore(null)).toBe(100);
      expect(passwordExpiryService.calculateHealthScore(undefined)).toBe(100);
    });

    it('should return 100 for all healthy passwords', () => {
      const summary = { healthy: 10, warning: 0, critical: 0, expired: 0 };
      expect(passwordExpiryService.calculateHealthScore(summary)).toBe(100);
    });

    it('should return 70 for all warning passwords', () => {
      const summary = { healthy: 0, warning: 10, critical: 0, expired: 0 };
      expect(passwordExpiryService.calculateHealthScore(summary)).toBe(70);
    });

    it('should return 30 for all critical passwords', () => {
      const summary = { healthy: 0, warning: 0, critical: 10, expired: 0 };
      expect(passwordExpiryService.calculateHealthScore(summary)).toBe(30);
    });

    it('should return 0 for all expired passwords', () => {
      const summary = { healthy: 0, warning: 0, critical: 0, expired: 10 };
      expect(passwordExpiryService.calculateHealthScore(summary)).toBe(0);
    });

    it('should calculate mixed password health correctly', () => {
      const summary = { healthy: 5, warning: 3, critical: 1, expired: 1 };
      // (5*100 + 3*70 + 1*30 + 1*0) / 10 = (500 + 210 + 30 + 0) / 10 = 74
      expect(passwordExpiryService.calculateHealthScore(summary)).toBe(74);
    });

    it('should return 100 for zero total passwords', () => {
      const summary = { healthy: 0, warning: 0, critical: 0, expired: 0 };
      expect(passwordExpiryService.calculateHealthScore(summary)).toBe(100);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate info recommendation for no summary', () => {
      const recommendations = passwordExpiryService.generateRecommendations(null);
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toEqual({
        priority: 'info',
        message: 'No password data available for analysis.',
        action: 'add_passwords'
      });
    });

    it('should generate high priority recommendation for expired passwords', () => {
      const summary = { expired: 3, critical: 0, warning: 0 };
      const recommendations = passwordExpiryService.generateRecommendations(summary);
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toEqual({
        priority: 'high',
        message: 'Update 3 expired passwords immediately',
        action: 'update_expired'
      });
    });

    it('should generate medium priority recommendation for critical passwords', () => {
      const summary = { expired: 0, critical: 2, warning: 0 };
      const recommendations = passwordExpiryService.generateRecommendations(summary);
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toEqual({
        priority: 'medium',
        message: '2 passwords are due for update',
        action: 'update_critical'
      });
    });

    it('should generate low priority recommendation for warning passwords', () => {
      const summary = { expired: 0, critical: 0, warning: 5 };
      const recommendations = passwordExpiryService.generateRecommendations(summary);
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toEqual({
        priority: 'low',
        message: 'Consider updating 5 aging passwords',
        action: 'update_warning'
      });
    });

    it('should handle singular forms correctly', () => {
      const summary1 = { expired: 1, critical: 0, warning: 0 };
      const recommendations1 = passwordExpiryService.generateRecommendations(summary1);
      expect(recommendations1[0].message).toBe('Update 1 expired password immediately');

      const summary2 = { expired: 0, critical: 1, warning: 0 };
      const recommendations2 = passwordExpiryService.generateRecommendations(summary2);
      expect(recommendations2[0].message).toBe('1 password is due for update');

      const summary3 = { expired: 0, critical: 0, warning: 1 };
      const recommendations3 = passwordExpiryService.generateRecommendations(summary3);
      expect(recommendations3[0].message).toBe('Consider updating 1 aging password');
    });

    it('should generate multiple recommendations for multiple categories', () => {
      const summary = { expired: 2, critical: 3, warning: 1 };
      const recommendations = passwordExpiryService.generateRecommendations(summary);
      
      expect(recommendations).toHaveLength(3);
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[1].priority).toBe('medium');
      expect(recommendations[2].priority).toBe('low');
    });

    it('should generate positive message when all passwords are healthy', () => {
      const summary = { expired: 0, critical: 0, warning: 0, healthy: 10 };
      const recommendations = passwordExpiryService.generateRecommendations(summary);
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toEqual({
        priority: 'info',
        message: 'All passwords are up to date! Great job maintaining good security hygiene.',
        action: 'maintain'
      });
    });
  });

  describe('checkPasswordExpiry', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return disabled status when user settings disable password expiry', async () => {
      mockUserSettingsRepo.getByUserId.mockResolvedValueOnce({ passwordExpiry: false });

      const result = await passwordExpiryService.checkPasswordExpiry(mockUserId);

      expect(result).toEqual({
        enabled: false,
        message: 'Password expiry notifications are disabled'
      });
      expect(mockUserSettingsRepo.getByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockVaultRepo.getAllByUserId).not.toHaveBeenCalled();
    });

    it('should return disabled status when user settings are null', async () => {
      mockUserSettingsRepo.getByUserId.mockResolvedValueOnce(null);

      const result = await passwordExpiryService.checkPasswordExpiry(mockUserId);

      expect(result).toEqual({
        enabled: false,
        message: 'Password expiry notifications are disabled'
      });
    });

    it('should handle empty vault correctly', async () => {
      mockUserSettingsRepo.getByUserId.mockResolvedValueOnce({ passwordExpiry: true });
      mockVaultRepo.getAllByUserId.mockResolvedValueOnce([]);

      const result = await passwordExpiryService.checkPasswordExpiry(mockUserId);

      expect(result).toEqual({
        enabled: true,
        totalEntries: 0,
        expiredPasswords: [],
        warningPasswords: [],
        criticalPasswords: []
      });
    });

    it('should handle null vault correctly', async () => {
      mockUserSettingsRepo.getByUserId.mockResolvedValueOnce({ passwordExpiry: true });
      mockVaultRepo.getAllByUserId.mockResolvedValueOnce(null);

      const result = await passwordExpiryService.checkPasswordExpiry(mockUserId);

      expect(result).toEqual({
        enabled: true,
        totalEntries: 0,
        expiredPasswords: [],
        warningPasswords: [],
        criticalPasswords: []
      });
    });

    it('should categorize passwords by age correctly', async () => {
      const now = new Date();
      const mockVaultEntries = [
        {
          id: 'entry1',
          name: 'Healthy Password',
          website: 'example.com',
          updatedAt: new Date(now - 30 * 24 * 60 * 60 * 1000), // 30 days old
          createdAt: new Date(now - 35 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'entry2',
          name: 'Warning Password',
          website: 'warning.com',
          updatedAt: new Date(now - 80 * 24 * 60 * 60 * 1000), // 80 days old
          createdAt: new Date(now - 85 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'entry3',
          name: 'Critical Password',
          website: 'critical.com',
          updatedAt: new Date(now - 100 * 24 * 60 * 60 * 1000), // 100 days old
          createdAt: new Date(now - 105 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'entry4',
          name: 'Expired Password',
          website: 'expired.com',
          updatedAt: new Date(now - 130 * 24 * 60 * 60 * 1000), // 130 days old
          createdAt: new Date(now - 135 * 24 * 60 * 60 * 1000)
        }
      ];

      mockUserSettingsRepo.getByUserId.mockResolvedValueOnce({ passwordExpiry: true });
      mockVaultRepo.getAllByUserId.mockResolvedValueOnce(mockVaultEntries);

      const result = await passwordExpiryService.checkPasswordExpiry(mockUserId);

      expect(result.enabled).toBe(true);
      expect(result.totalEntries).toBe(4);
      expect(result.expiredPasswords).toHaveLength(1);
      expect(result.criticalPasswords).toHaveLength(1);
      expect(result.warningPasswords).toHaveLength(1);
      
      expect(result.expiredPasswords[0]).toEqual({
        entryId: 'entry4',
        name: 'Expired Password',
        website: 'expired.com',
        daysSinceChange: 130,
        lastChanged: expect.any(String),
        category: 'expired'
      });

      expect(result.summary).toEqual({
        expired: 1,
        critical: 1,
        warning: 1,
        healthy: 1
      });
    });

    it('should use createdAt when updatedAt is not available', async () => {
      const now = new Date();
      const mockVaultEntries = [
        {
          id: 'entry1',
          name: 'Old Entry',
          website: 'old.com',
          updatedAt: null,
          createdAt: new Date(now - 100 * 24 * 60 * 60 * 1000) // 100 days old
        }
      ];

      mockUserSettingsRepo.getByUserId.mockResolvedValueOnce({ passwordExpiry: true });
      mockVaultRepo.getAllByUserId.mockResolvedValueOnce(mockVaultEntries);

      const result = await passwordExpiryService.checkPasswordExpiry(mockUserId);

      expect(result.criticalPasswords).toHaveLength(1);
      expect(result.criticalPasswords[0].daysSinceChange).toBe(100);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockUserSettingsRepo.getByUserId.mockRejectedValueOnce(error);

      await expect(passwordExpiryService.checkPasswordExpiry(mockUserId))
        .rejects.toThrow('Database error');

      expect(mockLogger.logger.error).toHaveBeenCalledWith('Error checking password expiry', {
        error: 'Database error',
        userId: mockUserId
      });
    });
  });

  describe('sendPasswordExpiryNotifications', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should not send notifications when password expiry is disabled', async () => {
      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce({ enabled: false });

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result).toEqual({
        sent: false,
        reason: 'Password expiry notifications disabled'
      });
      expect(mockNotificationService.sendSecurityAlert).not.toHaveBeenCalled();
    });

    it('should send expired password notifications', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: [
          { entryId: 'entry1', name: 'Test Password 1', daysSinceChange: 130 },
          { entryId: 'entry2', name: 'Test Password 2', daysSinceChange: 140 }
        ],
        criticalPasswords: [],
        warningPasswords: []
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockResolvedValueOnce();

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result.sent).toBe(true);
      expect(result.notificationsSent).toBe(1);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toEqual({
        type: 'expired',
        count: 2,
        sent: true
      });

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        mockUserId,
        'PASSWORD_EXPIRY_WARNING',
        {
          templateData: {
            severity: 'expired',
            count: 2,
            passwords: mockExpiryData.expiredPasswords.slice(0, 5),
            totalExpired: 2,
            message: '2 passwords are overdue for update',
            timestamp: expect.any(String)
          }
        }
      );
    });

    it('should send critical password notifications', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: [],
        criticalPasswords: [
          { entryId: 'entry1', name: 'Test Password', daysSinceChange: 95 }
        ],
        warningPasswords: []
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockResolvedValueOnce();

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result.sent).toBe(true);
      expect(result.notificationsSent).toBe(1);
      expect(result.notifications[0]).toEqual({
        type: 'critical',
        count: 1,
        sent: true
      });

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        mockUserId,
        'PASSWORD_EXPIRY_WARNING',
        expect.objectContaining({
          templateData: expect.objectContaining({
            severity: 'critical',
            count: 1,
            message: '1 password needs urgent update'
          })
        })
      );
    });

    it('should send warning password notifications', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: [],
        criticalPasswords: [],
        warningPasswords: [
          { entryId: 'entry1', name: 'Test Password 1', daysSinceChange: 80 },
          { entryId: 'entry2', name: 'Test Password 2', daysSinceChange: 85 }
        ]
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockResolvedValueOnce();

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result.sent).toBe(true);
      expect(result.notifications[0]).toEqual({
        type: 'warning',
        count: 2,
        sent: true
      });

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        mockUserId,
        'PASSWORD_EXPIRY_WARNING',
        expect.objectContaining({
          templateData: expect.objectContaining({
            severity: 'warning',
            message: '2 passwords should be updated soon',
            passwords: mockExpiryData.warningPasswords.slice(0, 3)
          })
        })
      );
    });

    it('should send multiple notification types', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: [{ entryId: 'entry1', name: 'Expired', daysSinceChange: 130 }],
        criticalPasswords: [{ entryId: 'entry2', name: 'Critical', daysSinceChange: 95 }],
        warningPasswords: [{ entryId: 'entry3', name: 'Warning', daysSinceChange: 80 }]
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockResolvedValue();

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result.sent).toBe(true);
      expect(result.notificationsSent).toBe(3);
      expect(result.notifications).toHaveLength(3);
      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledTimes(3);
    });

    it('should handle notification errors gracefully', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: [{ entryId: 'entry1', name: 'Test', daysSinceChange: 130 }],
        criticalPasswords: [],
        warningPasswords: []
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockRejectedValueOnce(new Error('Notification failed'));

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result.sent).toBe(false);
      expect(result.notificationsSent).toBe(0);
      expect(mockLogger.logger.error).toHaveBeenCalledWith('Failed to send expired password notification', {
        error: 'Notification failed',
        userId: mockUserId
      });
    });

    it('should handle critical password notification errors gracefully', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: [],
        criticalPasswords: [{ entryId: 'entry1', name: 'Critical Test', daysSinceChange: 95 }],
        warningPasswords: []
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockRejectedValueOnce(new Error('Critical notification failed'));

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result.sent).toBe(false);
      expect(result.notificationsSent).toBe(0);
      expect(mockLogger.logger.error).toHaveBeenCalledWith('Failed to send critical password notification', {
        error: 'Critical notification failed',
        userId: mockUserId
      });
    });

    it('should handle warning password notification errors gracefully', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: [],
        criticalPasswords: [],
        warningPasswords: [{ entryId: 'entry1', name: 'Warning Test', daysSinceChange: 80 }]
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockRejectedValueOnce(new Error('Warning notification failed'));

      const result = await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(result.sent).toBe(false);
      expect(result.notificationsSent).toBe(0);
      expect(mockLogger.logger.error).toHaveBeenCalledWith('Failed to send warning password notification', {
        error: 'Warning notification failed',
        userId: mockUserId
      });
    });

    it('should limit password examples to 5 for expired and critical, 3 for warning', async () => {
      const mockExpiryData = {
        enabled: true,
        expiredPasswords: Array(10).fill().map((_, i) => ({ entryId: `exp${i}`, name: `Expired ${i}`, daysSinceChange: 130 })),
        criticalPasswords: Array(8).fill().map((_, i) => ({ entryId: `crit${i}`, name: `Critical ${i}`, daysSinceChange: 95 })),
        warningPasswords: Array(6).fill().map((_, i) => ({ entryId: `warn${i}`, name: `Warning ${i}`, daysSinceChange: 80 }))
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);
      mockNotificationService.sendSecurityAlert.mockResolvedValue();

      await passwordExpiryService.sendPasswordExpiryNotifications(mockUserId);

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenNthCalledWith(1,
        mockUserId,
        'PASSWORD_EXPIRY_WARNING',
        expect.objectContaining({
          templateData: expect.objectContaining({
            passwords: expect.arrayContaining([
              expect.objectContaining({ name: 'Expired 0' }),
              expect.objectContaining({ name: 'Expired 4' })
            ])
          })
        })
      );

      // Check that passwords array is limited to 5 for expired
      const expiredCall = mockNotificationService.sendSecurityAlert.mock.calls.find(
        call => call[2].templateData.severity === 'expired'
      );
      expect(expiredCall[2].templateData.passwords).toHaveLength(5);

      // Check that passwords array is limited to 3 for warning
      const warningCall = mockNotificationService.sendSecurityAlert.mock.calls.find(
        call => call[2].templateData.severity === 'warning'
      );
      expect(warningCall[2].templateData.passwords).toHaveLength(3);
    });

    it('should handle errors from checkPasswordExpiry', async () => {
      const error = new Error('Check failed');
      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockRejectedValueOnce(error);

      await expect(passwordExpiryService.sendPasswordExpiryNotifications(mockUserId))
        .rejects.toThrow('Check failed');

      expect(mockLogger.logger.error).toHaveBeenCalledWith('Error sending password expiry notifications', {
        error: 'Check failed',
        userId: mockUserId
      });
    });
  });

  describe('getPasswordHealthStats', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should return disabled status when password expiry is disabled', async () => {
      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce({ enabled: false });

      const result = await passwordExpiryService.getPasswordHealthStats(mockUserId);

      expect(result).toEqual({
        enabled: false,
        message: 'Password expiry monitoring is disabled'
      });
    });

    it('should return health stats for enabled monitoring', async () => {
      const mockExpiryData = {
        enabled: true,
        totalEntries: 10,
        summary: {
          expired: 1,
          critical: 2,
          warning: 3,
          healthy: 4
        }
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);

      const result = await passwordExpiryService.getPasswordHealthStats(mockUserId);

      expect(result).toEqual({
        enabled: true,
        totalPasswords: 10,
        healthScore: 67, // (4*100 + 3*70 + 2*30 + 1*0) / 10
        breakdown: mockExpiryData.summary,
        recommendations: expect.any(Array)
      });
    });

    it('should handle missing summary gracefully', async () => {
      const mockExpiryData = {
        enabled: true,
        totalEntries: 0
      };

      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockResolvedValueOnce(mockExpiryData);

      const result = await passwordExpiryService.getPasswordHealthStats(mockUserId);

      expect(result.breakdown).toEqual({
        expired: 0,
        critical: 0,
        warning: 0,
        healthy: 0
      });
      expect(result.healthScore).toBe(100);
    });

    it('should handle errors', async () => {
      const error = new Error('Stats failed');
      jest.spyOn(passwordExpiryService, 'checkPasswordExpiry')
        .mockRejectedValueOnce(error);

      await expect(passwordExpiryService.getPasswordHealthStats(mockUserId))
        .rejects.toThrow('Stats failed');

      expect(mockLogger.logger.error).toHaveBeenCalledWith('Error getting password health stats', {
        error: 'Stats failed',
        userId: mockUserId
      });
    });
  });

  describe('performManualExpiryCheck', () => {
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should perform manual check and return results', async () => {
      const mockNotificationResult = {
        sent: true,
        notificationsSent: 2,
        notifications: [
          { type: 'expired', count: 1, sent: true },
          { type: 'critical', count: 1, sent: true }
        ],
        summary: { expired: 1, critical: 1, warning: 0, healthy: 3 }
      };

      jest.spyOn(passwordExpiryService, 'sendPasswordExpiryNotifications')
        .mockResolvedValueOnce(mockNotificationResult);

      const result = await passwordExpiryService.performManualExpiryCheck(mockUserId);

      expect(result).toEqual({
        success: true,
        message: 'Password expiry check completed',
        ...mockNotificationResult
      });

      expect(mockLogger.logger.info).toHaveBeenCalledWith('Manual password expiry check completed', {
        userId: mockUserId,
        notificationsSent: 2,
        summary: mockNotificationResult.summary
      });
    });

    it('should handle errors in manual check', async () => {
      const error = new Error('Manual check failed');
      jest.spyOn(passwordExpiryService, 'sendPasswordExpiryNotifications')
        .mockRejectedValueOnce(error);

      await expect(passwordExpiryService.performManualExpiryCheck(mockUserId))
        .rejects.toThrow('Manual check failed');

      expect(mockLogger.logger.error).toHaveBeenCalledWith('Error in manual password expiry check', {
        error: 'Manual check failed',
        userId: mockUserId
      });
    });
  });

  describe('runScheduledPasswordExpiryCheck', () => {
    const mockUsers = [
      { id: '550e8400-e29b-41d4-a716-446655440001', email: 'user1@test.com' },
      { id: '550e8400-e29b-41d4-a716-446655440002', email: 'user2@test.com' },
      { id: '550e8400-e29b-41d4-a716-446655440003', email: 'user3@test.com' }
    ];

    it('should process all users successfully', async () => {
      mockUserRepo.getAllActiveUsers.mockResolvedValueOnce(mockUsers);

      jest.spyOn(passwordExpiryService, 'sendPasswordExpiryNotifications')
        .mockResolvedValueOnce({ sent: true, notificationsSent: 2, notifications: [] })
        .mockResolvedValueOnce({ sent: false, reason: 'disabled' })
        .mockResolvedValueOnce({ sent: true, notificationsSent: 1, notifications: [] });

      const result = await passwordExpiryService.runScheduledPasswordExpiryCheck();

      expect(result.success).toBe(true);
      expect(result.summary).toEqual({
        usersProcessed: 3,
        usersWithExpiredPasswords: 2,
        totalNotificationsSent: 3,
        completedAt: expect.any(String)
      });

      expect(result.results).toHaveLength(3);
      expect(result.results[0]).toEqual({
        userId: '550e8400-e29b-41d4-a716-446655440001',
        email: 'user1@test.com',
        notifications: [],
        sent: true
      });

      expect(mockLogger.logger.info).toHaveBeenCalledWith('Starting scheduled password expiry check for all users');
      expect(mockLogger.logger.info).toHaveBeenCalledWith('Scheduled password expiry check completed', result.summary);
    });

    it('should handle individual user processing errors gracefully', async () => {
      mockUserRepo.getAllActiveUsers.mockResolvedValueOnce(mockUsers.slice(0, 2));

      jest.spyOn(passwordExpiryService, 'sendPasswordExpiryNotifications')
        .mockResolvedValueOnce({ sent: true, notificationsSent: 1, notifications: [] })
        .mockRejectedValueOnce(new Error('User processing failed'));

      const result = await passwordExpiryService.runScheduledPasswordExpiryCheck();

      expect(result.success).toBe(true);
      expect(result.summary.usersProcessed).toBe(1);
      expect(result.summary.usersWithExpiredPasswords).toBe(1);
      expect(result.results).toHaveLength(1);

      expect(mockLogger.logger.error).toHaveBeenCalledWith('Failed to process password expiry for user', {
        userId: '550e8400-e29b-41d4-a716-446655440002',
        email: 'user2@test.com',
        error: 'User processing failed'
      });
    });

    it('should handle database error when getting users', async () => {
      const error = new Error('Database error');
      mockUserRepo.getAllActiveUsers.mockRejectedValueOnce(error);

      await expect(passwordExpiryService.runScheduledPasswordExpiryCheck())
        .rejects.toThrow('Database error');

      expect(mockLogger.logger.error).toHaveBeenCalledWith('Scheduled password expiry check failed', {
        error: 'Database error'
      });
    });

    it('should handle empty user list', async () => {
      mockUserRepo.getAllActiveUsers.mockResolvedValueOnce([]);

      const result = await passwordExpiryService.runScheduledPasswordExpiryCheck();

      expect(result.success).toBe(true);
      expect(result.summary).toEqual({
        usersProcessed: 0,
        usersWithExpiredPasswords: 0,
        totalNotificationsSent: 0,
        completedAt: expect.any(String)
      });
      expect(result.results).toEqual([]);
    });
  });
});