/**
 * Email Service Tests
 * Comprehensive test suite for the email service
 */

// Set environment variables before any imports
process.env.RESEND_API_KEY = 'test-api-key';
process.env.FROM_EMAIL = 'test@lockrr.app';
process.env.FRONTEND_URL = 'https://app.lockr.com';

// Mock dependencies before importing
jest.mock('resend');
jest.mock('../../src/utils/logger');

describe('EmailService', () => {
  let emailService;
  let EmailService;
  let mockResendInstance;
  let mockDatabaseClient;
  let mockGetClient;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Ensure environment variables are set for each test
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.FROM_EMAIL = 'test@lockrr.app';
    process.env.FRONTEND_URL = 'https://app.lockr.com';
    
    // Setup mock Resend instance
    mockResendInstance = {
      emails: {
        send: jest.fn()
      },
      batch: {
        send: jest.fn()
      }
    };
    
    const { Resend } = require('resend');
    Resend.mockReturnValue(mockResendInstance);

    // Setup mock database client
    mockDatabaseClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockGetClient = jest.fn().mockResolvedValue(mockDatabaseClient);
    
    // Use doMock for dynamic mocking
    jest.doMock('../../src/config/database', () => ({
      getClient: mockGetClient,
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      pool: null,
      isConnected: false
    }));

    // Import EmailService after mocking
    EmailService = require('../../src/services/emailService');
    emailService = new EmailService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      const service = new EmailService();
      expect(service.resend).toBeNull();
      expect(service.initialized).toBe(false);
      expect(service.fromEmail).toBe('test@lockrr.app');
    });

    test('should use default email when FROM_EMAIL not set', () => {
      delete process.env.FROM_EMAIL;
      const service = new EmailService();
      expect(service.fromEmail).toBe('noreply@lockrr.app');
      process.env.FROM_EMAIL = 'test@lockrr.app';
    });
  });

  describe('initialize', () => {
    test('should initialize successfully with API key', async () => {
      await emailService.initialize();
      
      expect(emailService.initialized).toBe(true);
      expect(emailService.resend).toBeTruthy();
    });

    test('should throw error when API key is missing', async () => {
      delete process.env.RESEND_API_KEY;
      
      // Need to reimport after changing env
      jest.resetModules();
      jest.doMock('../../src/config/database', () => ({
        getClient: jest.fn(),
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(true)
      }));
      
      const FreshEmailService = require('../../src/services/emailService');
      const service = new FreshEmailService();
      
      await expect(service.initialize()).rejects.toThrow('RESEND_API_KEY environment variable is required');
      expect(service.initialized).toBe(false);
      
      process.env.RESEND_API_KEY = 'test-api-key';
    });

    test('should handle Resend initialization errors', async () => {
      const { Resend } = require('resend');
      Resend.mockImplementation(() => {
        throw new Error('Resend connection failed');
      });

      const service = new EmailService();
      await expect(service.initialize()).rejects.toThrow('Resend connection failed');
      expect(service.initialized).toBe(false);
      
      // Reset Resend mock
      Resend.mockReturnValue(mockResendInstance);
    });
  });

  describe('getUserEmail', () => {
    test('should retrieve user email successfully', async () => {
      const mockUser = {
        email: 'user@example.com',
        name: 'Test User'
      };
      mockDatabaseClient.query.mockResolvedValue({ rows: [mockUser] });

      const result = await emailService.getUserEmail('123e4567-e89b-12d3-a456-426614174000');

      expect(mockGetClient).toHaveBeenCalled();
      expect(mockDatabaseClient.query).toHaveBeenCalledWith(
        'SELECT email, name FROM users WHERE id = $1',
        ['123e4567-e89b-12d3-a456-426614174000']
      );
      expect(mockDatabaseClient.release).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    test('should throw error when user not found', async () => {
      mockDatabaseClient.query.mockResolvedValue({ rows: [] });

      await expect(emailService.getUserEmail('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow('User not found');
      expect(mockDatabaseClient.release).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      mockDatabaseClient.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(emailService.getUserEmail('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow('Database connection failed');
      expect(mockDatabaseClient.release).toHaveBeenCalled();
    });

    test('should handle client acquisition errors', async () => {
      mockGetClient.mockRejectedValue(new Error('No database connection'));

      await expect(emailService.getUserEmail('123e4567-e89b-12d3-a456-426614174000')).rejects.toThrow('No database connection');
    });
  });

  // All template generation tests work fine - they don't need database
  describe('generateSecurityAlertTemplate', () => {
    test('should generate new_device_login template', () => {
      const data = {
        firstName: 'John',
        loginTime: '2024-01-15 10:00:00',
        location: 'New York, USA',
        device: 'Chrome on Windows',
        ipAddress: '192.168.1.1'
      };

      const result = emailService.generateSecurityAlertTemplate('new_device_login', data);

      expect(result.subject).toBe('New Device Login - Lockrr Security Alert');
      expect(result.html).toContain('New Device Login');
      expect(result.html).toContain('Hello John');
      expect(result.html).toContain('New York, USA');
      expect(result.html).toContain('Chrome on Windows');
      expect(result.html).toContain('192.168.1.1');
    });

    test('should generate multiple_failed_logins template', () => {
      const data = {
        firstName: 'Jane',
        timestamp: '2024-01-15 11:00:00',
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0 Firefox',
        attemptCount: 5
      };

      const result = emailService.generateSecurityAlertTemplate('multiple_failed_logins', data);

      expect(result.subject).toBe('Multiple Failed Login Attempts - Lockrr Security Alert');
      expect(result.html).toContain('Multiple Failed Login Attempts');
      expect(result.html).toContain('Hello Jane');
      expect(result.html).toContain('10.0.0.1');
      expect(result.html).toContain('5 attempts detected');
    });

    test('should generate suspicious_login template', () => {
      const data = {
        firstName: 'Bob',
        loginTime: '2024-01-15 12:00:00',
        location: 'Unknown Location',
        ipAddress: '192.168.100.1',
        reason: 'Unusual geographic location'
      };

      const result = emailService.generateSecurityAlertTemplate('suspicious_login', data);

      expect(result.subject).toBe('Lockrr Security Notice - Login Activity Detected');
      expect(result.html).toContain('Suspicious Login Attempt');
      expect(result.html).toContain('Hello Bob');
      expect(result.html).toContain('Unknown Location');
      expect(result.html).toContain('Unusual geographic location');
    });

    test('should handle missing data gracefully', () => {
      const result = emailService.generateSecurityAlertTemplate('new_device_login', {});

      expect(result.subject).toBe('New Device Login - Lockrr Security Alert');
      expect(result.html).toContain('Hello there');
      expect(result.html).toContain('Unknown');
    });

    test('should generate master_password_reset template', () => {
      const data = {
        firstName: 'Alice',
        resetTime: '2024-01-15 13:00:00',
        ipAddress: '10.10.10.10'
      };

      const result = emailService.generateSecurityAlertTemplate('master_password_reset', data);

      expect(result.subject).toBe('Master Password Successfully Reset - Lockrr');
      expect(result.html).toBeDefined();
    });

    test('should generate password_reset template', () => {
      const data = {
        firstName: 'Charlie',
        resetTime: '2024-01-15 14:00:00'
      };

      const result = emailService.generateSecurityAlertTemplate('password_reset', data);

      expect(result.subject).toBeDefined();
      expect(result.html).toBeDefined();
    });

    test('should generate vault_wipe_warning template', () => {
      const data = {
        firstName: 'David',
        requestTime: '2024-01-15 15:00:00'
      };

      const result = emailService.generateSecurityAlertTemplate('vault_wipe_warning', data);

      expect(result.subject).toBeDefined();
      expect(result.html).toBeDefined();
    });

    test('should generate two_factor_enabled template', () => {
      const data = {
        firstName: 'Eve',
        enabledTime: '2024-01-15 16:00:00'
      };

      const result = emailService.generateSecurityAlertTemplate('two_factor_enabled', data);

      expect(result.subject).toBeDefined();
      expect(result.html).toBeDefined();
    });

    test('should generate two_factor_disabled template', () => {
      const data = {
        firstName: 'Frank',
        disabledTime: '2024-01-15 17:00:00'
      };

      const result = emailService.generateSecurityAlertTemplate('two_factor_disabled', data);

      expect(result.subject).toBeDefined();
      expect(result.html).toBeDefined();
    });

    test('should return default template for unknown type', () => {
      const result = emailService.generateSecurityAlertTemplate('unknown_type', {});

      expect(result.subject).toBeDefined();
      expect(result.html).toBeDefined();
    });
  });

  describe('sendNotificationEmail', () => {
    test('should send security notification email successfully', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockDatabaseClient.query.mockResolvedValue({ rows: [mockUser] });
      mockResendInstance.emails.send.mockResolvedValue({ id: 'email-123' });
      emailService.initialized = true;
      emailService.resend = mockResendInstance;

      const result = await emailService.sendNotificationEmail({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'security',
        subtype: 'new_device_login',
        title: 'New Device Login',
        message: 'A new device has logged in',
        templateData: {
          firstName: 'Test',
          location: 'New York'
        }
      });

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@lockrr.app',
        to: 'user@example.com',
        subject: 'New Device Login - Lockrr Security Alert',
        html: expect.stringContaining('New Device Login')
      });
      expect(result).toEqual({
        success: true,
        emailId: 'email-123',
        recipient: 'user@example.com'
      });
    });

    test('should auto-initialize if not initialized', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockDatabaseClient.query.mockResolvedValue({ rows: [mockUser] });
      mockResendInstance.emails.send.mockResolvedValue({ id: 'email-456' });
      emailService.initialized = false;

      const result = await emailService.sendNotificationEmail({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'account',
        subtype: 'password_changed',
        title: 'Password Changed'
      });

      expect(emailService.initialized).toBe(true);
      expect(result.success).toBe(true);
    });

    test('should handle email sending errors', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockDatabaseClient.query.mockResolvedValue({ rows: [mockUser] });
      mockResendInstance.emails.send.mockRejectedValue(new Error('Email failed'));
      emailService.initialized = true;
      emailService.resend = mockResendInstance;

      await expect(emailService.sendNotificationEmail({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'security',
        subtype: 'suspicious_login'
      })).rejects.toThrow('Email failed');
    });

    test('should send system notification with custom template', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockDatabaseClient.query.mockResolvedValue({ rows: [mockUser] });
      mockResendInstance.emails.send.mockResolvedValue({ id: 'email-789' });
      emailService.initialized = true;
      emailService.resend = mockResendInstance;

      const result = await emailService.sendNotificationEmail({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'system',
        subtype: 'maintenance',
        title: 'System Maintenance',
        message: 'Scheduled maintenance'
      });

      expect(result.success).toBe(true);
    });

    test('should use default template for unknown type', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'Test User'
      };
      mockDatabaseClient.query.mockResolvedValue({ rows: [mockUser] });
      mockResendInstance.emails.send.mockResolvedValue({ id: 'email-999' });
      emailService.initialized = true;
      emailService.resend = mockResendInstance;

      const result = await emailService.sendNotificationEmail({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'unknown',
        subtype: 'test',
        title: 'Test Notification',
        message: 'This is a test'
      });

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@lockrr.app',
        to: 'user@example.com',
        subject: 'Test Notification',
        html: expect.stringContaining('This is a test')
      });
      expect(result.success).toBe(true);
    });
  });

  describe('generateAccountNotificationTemplate', () => {
    test('should generate account notification template', () => {
      const data = {
        firstName: 'John',
        changeTime: '2024-01-15 10:00:00'
      };

      const result = emailService.generateAccountNotificationTemplate('password_changed', data);

      expect(result.subject).toBe('Account Notification - Lockr');
      expect(result.html).toContain('Account');
    });

    test('should generate email_changed template', () => {
      const data = {
        firstName: 'Jane',
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com'
      };

      const result = emailService.generateAccountNotificationTemplate('email_changed', data);

      expect(result.subject).toBe('Account Notification - Lockr');
      expect(result.html).toBeDefined();
    });

    test('should return default template for unknown subtype', () => {
      const result = emailService.generateAccountNotificationTemplate('unknown', {});

      expect(result.subject).toBe('Account Notification - Lockr');
      expect(result.html).toContain('Account');
    });
  });

  describe('generateSystemNotificationTemplate', () => {
    test('should generate maintenance template', () => {
      const data = {
        maintenanceTime: '2024-01-20 00:00:00',
        duration: '2 hours'
      };

      const result = emailService.generateSystemNotificationTemplate('maintenance', data);

      expect(result.subject).toBe('System Notification - Lockrr');
      expect(result.html).toContain('System');
    });

    test('should generate update template', () => {
      const data = {
        version: '2.0.0',
        features: ['New feature 1', 'New feature 2']
      };

      const result = emailService.generateSystemNotificationTemplate('update', data);

      expect(result.subject).toBe('System Notification - Lockrr');
      expect(result.html).toBeDefined();
    });

    test('should generate incident template', () => {
      const data = {
        incidentTime: '2024-01-15 15:00:00',
        description: 'Service disruption'
      };

      const result = emailService.generateSystemNotificationTemplate('incident', data);

      expect(result.subject).toBe('System Notification - Lockrr');
      expect(result.html).toBeDefined();
    });

    test('should return default template for unknown subtype', () => {
      const result = emailService.generateSystemNotificationTemplate('unknown', {});

      expect(result.subject).toBe('System Notification - Lockrr');
      expect(result.html).toContain('System Notification');
    });
  });

  describe('sendCustomEmail', () => {
    test('should send custom email successfully', async () => {
      mockResendInstance.emails.send.mockResolvedValue({ id: 'custom-123' });
      emailService.initialized = true;
      emailService.resend = mockResendInstance;

      const result = await emailService.sendCustomEmail({
        to: 'custom@example.com',
        subject: 'Custom Subject',
        html: '<p>Custom HTML</p>'
      });

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@lockrr.app',
        to: 'custom@example.com',
        subject: 'Custom Subject',
        html: '<p>Custom HTML</p>',
        text: null
      });
      expect(result).toEqual({
        success: true,
        emailId: 'custom-123',
        recipient: 'custom@example.com'
      });
    });

    test('should auto-initialize if not initialized', async () => {
      mockResendInstance.emails.send.mockResolvedValue({ id: 'custom-456' });
      emailService.initialized = false;

      const result = await emailService.sendCustomEmail({
        to: 'custom@example.com',
        subject: 'Subject',
        html: '<p>HTML</p>',
        text: 'Plain text'
      });

      expect(emailService.initialized).toBe(true);
      expect(result.success).toBe(true);
    });

    test('should handle email sending errors', async () => {
      mockResendInstance.emails.send.mockRejectedValue(new Error('SMTP error'));
      emailService.initialized = true;
      emailService.resend = mockResendInstance;

      await expect(emailService.sendCustomEmail({
        to: 'custom@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      })).rejects.toThrow('SMTP error');
    });
  });

  describe('close', () => {
    test('should close and reset initialized flag', async () => {
      await emailService.initialize();
      expect(emailService.initialized).toBe(true);
      
      await emailService.close();
      expect(emailService.initialized).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle undefined template data', () => {
      const result = emailService.generateSecurityAlertTemplate('new_device_login');
      
      expect(result.subject).toBe('New Device Login - Lockrr Security Alert');
      expect(result.html).toContain('Hello there');
    });

    test('should handle long user agent strings', () => {
      const data = {
        userAgent: 'A'.repeat(100)
      };

      const result = emailService.generateSecurityAlertTemplate('multiple_failed_logins', data);
      
      expect(result.html).toContain('A'.repeat(50) + '...');
    });

    test('should handle missing frontend URL', () => {
      delete process.env.FRONTEND_URL;
      
      const result = emailService.generateSecurityAlertTemplate('new_device_login', {});
      
      expect(result.html).toContain('/dashboard');
      
      process.env.FRONTEND_URL = 'https://app.lockr.com';
    });
  });
});