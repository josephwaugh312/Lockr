describe('BreachMonitoringService', () => {
  let breachMonitoringService;
  let axios;
  let notificationService;
  let userRepository;
  let userSettingsRepository;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Set up mocks
    jest.mock('axios');
    jest.mock('../../src/services/notificationService');
    jest.mock('../../src/models/userRepository');
    jest.mock('../../src/models/userSettingsRepository');
    jest.mock('../../src/config/database', () => ({
      pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
      query: jest.fn(),
      testConnection: jest.fn()
    }));
    jest.mock('../../src/utils/logger', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    }));

    // Import mocked modules
    axios = require('axios');
    axios.get = jest.fn();
    
    notificationService = require('../../src/services/notificationService');
    notificationService.sendSecurityAlert = jest.fn();
    notificationService.NOTIFICATION_SUBTYPES = {
      DATA_BREACH_ALERT: 'DATA_BREACH_ALERT'
    };
    
    userRepository = require('../../src/models/userRepository');
    userRepository.getAllActiveUsers = jest.fn();
    
    userSettingsRepository = require('../../src/models/userSettingsRepository');
    userSettingsRepository.getByUserId = jest.fn();
    
    const loggerModule = require('../../src/utils/logger');
    logger = loggerModule.logger;
    
    // Set API key
    process.env.HIBP_API_KEY = 'test-api-key';
    
    // Import service after all mocks are set
    breachMonitoringService = require('../../src/services/breachMonitoringService');
  });

  afterEach(() => {
    delete process.env.HIBP_API_KEY;
  });

  describe('checkEmailBreaches', () => {
    const mockEmail = 'test@example.com';
    const mockBreachData = [
      {
        Name: 'TestBreach',
        BreachDate: '2024-01-15',
        PwnCount: 1000000,
        DataClasses: ['Email addresses', 'Passwords'],
        Description: 'Test breach description',
        Domain: 'test.com',
        IsVerified: true,
        IsSensitive: false
      }
    ];

    it('should successfully check email breaches with API key', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: mockBreachData
      });

      const result = await breachMonitoringService.checkEmailBreaches(mockEmail);

      expect(axios.get).toHaveBeenCalledWith(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(mockEmail)}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Lockr-PasswordManager/1.0',
            'hibp-api-version': '3',
            'hibp-api-key': 'test-api-key'
          })
        })
      );
      expect(result).toEqual(mockBreachData);
    });

    it('should return empty array when no breaches found (404)', async () => {
      axios.get.mockResolvedValueOnce({
        status: 404,
        data: null
      });

      const result = await breachMonitoringService.checkEmailBreaches(mockEmail);
      expect(result).toEqual([]);
    });

    it('should handle rate limiting (429)', async () => {
      const error = new Error('Rate limited');
      error.response = { 
        status: 429,
        headers: { 'retry-after': '60' }
      };
      axios.get.mockRejectedValueOnce(error);

      await expect(breachMonitoringService.checkEmailBreaches(mockEmail))
        .rejects.toThrow('Rate limit exceeded. Please try again later.');

      expect(logger.warn).toHaveBeenCalledWith(
        'HaveIBeenPwned rate limit exceeded',
        expect.objectContaining({
          email: 'tes***',
          retryAfter: '60'
        })
      );
    });

    it('should return demo data when API key required (401)', async () => {
      const error = new Error('Unauthorized');
      error.response = { status: 401 };
      axios.get.mockRejectedValueOnce(error);

      const result = await breachMonitoringService.checkEmailBreaches(mockEmail);

      expect(logger.warn).toHaveBeenCalledWith(
        'HaveIBeenPwned API key required, using demo data',
        expect.objectContaining({
          email: 'tes***'
        })
      );
      expect(result).toEqual(expect.any(Array));
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('Name');
      expect(result[0]).toHaveProperty('BreachDate');
    });

    it('should return empty array for other errors', async () => {
      const error = new Error('Network error');
      error.response = { status: 500 };
      axios.get.mockRejectedValueOnce(error);

      const result = await breachMonitoringService.checkEmailBreaches(mockEmail);

      expect(logger.error).toHaveBeenCalledWith(
        'Error checking email breaches',
        expect.objectContaining({
          error: 'Network error',
          email: 'tes***',
          status: 500
        })
      );
      expect(result).toEqual([]);
    });

    it('should work without API key', async () => {
      delete process.env.HIBP_API_KEY;
      // Re-import service to get fresh instance without API key
      jest.resetModules();
      jest.mock('axios');
      const axiosNew = require('axios');
      axiosNew.get = jest.fn();
      
      const serviceNew = require('../../src/services/breachMonitoringService');
      
      axiosNew.get.mockResolvedValueOnce({
        status: 200,
        data: mockBreachData
      });

      await serviceNew.checkEmailBreaches(mockEmail);

      expect(axiosNew.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'hibp-api-key': expect.any(String)
          })
        })
      );
    });
  });

  describe('getDemoBreachData', () => {
    it('should return demo breach data', () => {
      const result = breachMonitoringService.getDemoBreachData('test@example.com');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(2);
      
      result.forEach(breach => {
        expect(breach).toHaveProperty('Name');
        expect(breach).toHaveProperty('BreachDate');
        expect(breach).toHaveProperty('PwnCount');
        expect(breach).toHaveProperty('DataClasses');
        expect(breach).toHaveProperty('Description');
        expect(breach).toHaveProperty('Domain');
        expect(breach).toHaveProperty('IsVerified');
        expect(breach).toHaveProperty('IsSensitive');
      });
    });
  });

  describe('getBreachDetails', () => {
    const mockBreachName = 'TestBreach';
    const mockBreachDetails = {
      Name: 'TestBreach',
      BreachDate: '2024-01-15',
      PwnCount: 1000000,
      DataClasses: ['Email addresses', 'Passwords'],
      Description: 'Detailed test breach description',
      Domain: 'test.com',
      IsVerified: true,
      IsSensitive: false,
      LogoPath: 'https://example.com/logo.png'
    };

    it('should successfully get breach details', async () => {
      axios.get.mockResolvedValueOnce({
        data: mockBreachDetails
      });

      const result = await breachMonitoringService.getBreachDetails(mockBreachName);

      expect(axios.get).toHaveBeenCalledWith(
        `https://haveibeenpwned.com/api/v3/breach/${encodeURIComponent(mockBreachName)}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Lockr-PasswordManager/1.0',
            'hibp-api-version': '3',
            'hibp-api-key': 'test-api-key'
          })
        })
      );
      expect(result).toEqual(mockBreachDetails);
    });

    it('should handle errors when getting breach details', async () => {
      const error = new Error('Network error');
      error.response = { status: 500 };
      axios.get.mockRejectedValueOnce(error);

      await expect(breachMonitoringService.getBreachDetails(mockBreachName))
        .rejects.toThrow('Network error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting breach details',
        expect.objectContaining({
          error: 'Network error',
          breachName: mockBreachName,
          status: 500
        })
      );
    });
  });

  describe('sendBreachNotification', () => {
    const mockUserId = 'user123';
    const mockBreach = {
      Name: 'TestBreach',
      BreachDate: '2024-01-15',
      AddedDate: '2024-01-16',
      PwnCount: 1000000,
      DataClasses: ['Email addresses', 'Passwords', 'Names', 'Phone numbers', 'Addresses'],
      Description: 'Test breach description',
      Domain: 'test.com',
      IsVerified: true,
      IsSensitive: false,
      IsRetired: false,
      IsSpamList: false,
      LogoPath: 'https://example.com/logo.png'
    };

    it('should send breach notification with all data', async () => {
      notificationService.sendSecurityAlert.mockResolvedValueOnce();

      await breachMonitoringService.sendBreachNotification(mockUserId, mockBreach);

      expect(notificationService.sendSecurityAlert).toHaveBeenCalledWith(
        mockUserId,
        'DATA_BREACH_ALERT',
        expect.objectContaining({
          title: 'Data Breach: TestBreach',
          message: 'Your email was found in the TestBreach breach. Compromised data: Email addresses, Passwords, Names...'
        })
      );
    });

    it('should handle breach with no data classes', async () => {
      const breachWithoutDataClasses = {
        ...mockBreach,
        DataClasses: null
      };

      notificationService.sendSecurityAlert.mockResolvedValueOnce();

      await breachMonitoringService.sendBreachNotification(mockUserId, breachWithoutDataClasses);

      expect(notificationService.sendSecurityAlert).toHaveBeenCalledWith(
        mockUserId,
        'DATA_BREACH_ALERT',
        expect.objectContaining({
          message: expect.stringContaining('Unknown data types')
        })
      );
    });

    it('should handle breach with few data classes', async () => {
      const breachWithFewDataClasses = {
        ...mockBreach,
        DataClasses: ['Email addresses', 'Passwords']
      };

      notificationService.sendSecurityAlert.mockResolvedValueOnce();

      await breachMonitoringService.sendBreachNotification(mockUserId, breachWithFewDataClasses);

      expect(notificationService.sendSecurityAlert).toHaveBeenCalledWith(
        mockUserId,
        'DATA_BREACH_ALERT',
        expect.objectContaining({
          message: expect.stringContaining('Email addresses, Passwords')
        })
      );
    });
  });

  describe('checkAndNotifyRecentBreaches', () => {
    const mockUserId = 'user123';
    const mockEmail = 'test@example.com';
    
    const mockRecentBreach = {
      Name: 'RecentBreach',
      BreachDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      AddedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      PwnCount: 500000,
      DataClasses: ['Email addresses', 'Passwords', 'Names', 'Phone numbers'],
      Description: 'Recent breach description',
      Domain: 'recent.com',
      IsVerified: true,
      IsSensitive: false,
      IsRetired: false,
      IsSpamList: false,
      LogoPath: 'https://example.com/logo.png'
    };

    const mockOldBreach = {
      Name: 'OldBreach',
      BreachDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      PwnCount: 1000000,
      DataClasses: ['Email addresses'],
      Description: 'Old breach description',
      Domain: 'old.com',
      IsVerified: true,
      IsSensitive: false
    };

    it('should notify about recent breaches only', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: [mockRecentBreach, mockOldBreach]
      });

      notificationService.sendSecurityAlert.mockResolvedValue();

      const result = await breachMonitoringService.checkAndNotifyRecentBreaches(mockUserId, mockEmail);

      expect(result).toEqual({
        breachesFound: 2,
        recentBreaches: 1,
        notificationsSent: 1,
        breaches: [{
          name: 'RecentBreach',
          date: mockRecentBreach.BreachDate,
          accounts: 500000,
          dataClasses: ['Email addresses', 'Passwords', 'Names', 'Phone numbers']
        }]
      });

      expect(notificationService.sendSecurityAlert).toHaveBeenCalledTimes(1);
    });

    it('should return zero notifications when no breaches found', async () => {
      axios.get.mockResolvedValueOnce({
        status: 404,
        data: null
      });

      const result = await breachMonitoringService.checkAndNotifyRecentBreaches(mockUserId, mockEmail);

      expect(result).toEqual({
        breachesFound: 0,
        recentBreaches: 0,
        notificationsSent: 0
      });

      expect(notificationService.sendSecurityAlert).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: [mockRecentBreach]
      });

      notificationService.sendSecurityAlert.mockRejectedValueOnce(new Error('Notification failed'));

      const result = await breachMonitoringService.checkAndNotifyRecentBreaches(mockUserId, mockEmail);

      expect(result.notificationsSent).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send breach notification',
        expect.objectContaining({
          error: 'Notification failed',
          userId: mockUserId,
          breachName: 'RecentBreach'
        })
      );
    });
  });

  describe('performManualBreachCheck', () => {
    const mockUserId = 'user123';
    const mockEmail = 'test@example.com';

    const mockRecentBreach = {
      Name: 'RecentBreach',
      BreachDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      PwnCount: 500000,
      DataClasses: ['Email addresses', 'Passwords']
    };

    const mockOldBreach = {
      Name: 'OldBreach',
      BreachDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      PwnCount: 1000000,
      DataClasses: ['Email addresses']
    };

    it('should return clean status when no breaches found', async () => {
      axios.get.mockResolvedValueOnce({
        status: 404,
        data: null
      });

      const result = await breachMonitoringService.performManualBreachCheck(mockUserId, mockEmail);

      expect(result).toEqual({
        status: 'clean',
        message: 'No data breaches found for this email address',
        breachesFound: 0,
        breaches: []
      });
    });

    it('should return clean status for old breaches only', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: [mockOldBreach]
      });

      const result = await breachMonitoringService.performManualBreachCheck(mockUserId, mockEmail);

      expect(result).toEqual({
        status: 'clean',
        message: 'No recent data breaches found (older breaches detected but not recent)',
        breachesFound: 1,
        recentBreaches: 0,
        breaches: []
      });
    });

    it('should return breaches_found status for recent breaches', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: [mockRecentBreach, mockOldBreach]
      });
      
      notificationService.sendSecurityAlert.mockResolvedValueOnce();

      const result = await breachMonitoringService.performManualBreachCheck(mockUserId, mockEmail);

      expect(result.status).toBe('breaches_found');
      expect(result.breachesFound).toBe(2);
      expect(result.recentBreaches).toBe(1);
      expect(result.notificationsSent).toBe(1);
    });
  });

  describe('checkAllUsersForBreaches', () => {
    const mockUsers = [
      { id: 'user1', email: 'user1@example.com' },
      { id: 'user2', email: 'user2@example.com' },
      { id: 'user3', email: 'user3@example.com' }
    ];

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should check all active users with breach alerts enabled', async () => {
      userRepository.getAllActiveUsers.mockResolvedValueOnce(mockUsers);
      
      userSettingsRepository.getByUserId
        .mockResolvedValueOnce({ breachAlerts: true })
        .mockResolvedValueOnce({ breachAlerts: false })
        .mockResolvedValueOnce({ breachAlerts: true });

      // Mock the API calls for each user check
      axios.get
        .mockResolvedValueOnce({ status: 200, data: [{ 
          Name: 'Breach1',
          BreachDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          PwnCount: 1000,
          DataClasses: ['Email addresses']
        }] })
        .mockResolvedValueOnce({ status: 404, data: null });

      notificationService.sendSecurityAlert.mockResolvedValue();

      const resultPromise = breachMonitoringService.checkAllUsersForBreaches();
      
      // Fast-forward through all timers
      await jest.runAllTimersAsync();
      
      const result = await resultPromise;

      expect(result.totalUsers).toBe(3);
      expect(result.usersChecked).toBe(2);
      expect(userSettingsRepository.getByUserId).toHaveBeenCalledTimes(3);
    });

    it('should handle no active users', async () => {
      userRepository.getAllActiveUsers.mockResolvedValueOnce([]);

      const result = await breachMonitoringService.checkAllUsersForBreaches();

      expect(result).toEqual({
        totalUsers: 0,
        usersChecked: 0,
        breachesFound: 0,
        notificationsSent: 0,
        errors: 0
      });

      expect(logger.info).toHaveBeenCalledWith('No active users found for breach monitoring');
    });

    it('should handle database error', async () => {
      userRepository.getAllActiveUsers.mockRejectedValueOnce(new Error('Database error'));

      const result = await breachMonitoringService.checkAllUsersForBreaches();

      expect(result).toEqual({
        status: 'error',
        message: 'Failed to run automated breach monitoring',
        error: 'Database error'
      });
    });
  });
});