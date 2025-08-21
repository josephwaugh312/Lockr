// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock window
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock console.log to avoid spam
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Mock window dispatchEvent
window.dispatchEvent = jest.fn();

const { frontendNotificationService } = require('../../src/services/frontendNotificationService.ts');

describe('FrontendNotificationService', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    global.fetch.mockClear();
    
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue('test-token');
    localStorageMock.removeItem.mockImplementation(() => {});
    
    // Reset window location
    window.location.href = '';
    
    // Mock successful response by default
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, data: {} }),
    });
  });

  describe('testConnectivity', () => {
    test('should return true for successful health check', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await frontendNotificationService.testConnectivity();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/health',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    });

    test('should return false for failed health check', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await frontendNotificationService.testConnectivity();

      expect(result).toBe(false);
    });

    test('should return false for network error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await frontendNotificationService.testConnectivity();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        '🚨 Connectivity test failed:',
        expect.any(Error)
      );
    });
  });

  describe('getNotifications', () => {
    test('should fetch notifications with default parameters', async () => {
      const mockResponse = {
        success: true,
        data: [{ id: '1', title: 'Test Notification' }],
        pagination: { limit: 50, offset: 0, count: 1 }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await frontendNotificationService.getNotifications();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/v1/notifications?',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    test('should fetch notifications with query parameters', async () => {
      const params = {
        type: 'security',
        read: false,
        priority: 'high',
        limit: 10,
        offset: 5
      };

      await frontendNotificationService.getNotifications(params);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/v1/notifications?type=security&read=false&priority=high&limit=10&offset=5',
        expect.any(Object)
      );
    });

    test('should handle different parameter types', async () => {
      const params = {
        type: 'account',
        read: true,
        priority: 'low'
      };

      await frontendNotificationService.getNotifications(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=account&read=true&priority=low'),
        expect.any(Object)
      );
    });
  });

  describe('getUnreadCount', () => {
    test('should fetch unread count', async () => {
      const mockResponse = {
        success: true,
        data: { unreadCount: 5 }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await frontendNotificationService.getUnreadCount();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/v1/notifications/unread-count',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('getStats', () => {
    test('should fetch notification stats', async () => {
      const mockResponse = {
        success: true,
        data: {
          total: 100,
          unread: 10,
          byType: { security: 50, account: 30, system: 20 }
        }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await frontendNotificationService.getStats();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/v1/notifications/stats',
        expect.any(Object)
      );
    });
  });

  describe('markAsRead', () => {
    test('should mark notification as read', async () => {
      const notificationId = 'notification-123';
      const mockResponse = {
        success: true,
        data: { id: notificationId, read: true },
        message: 'Notification marked as read'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await frontendNotificationService.markAsRead(notificationId);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/api/v1/notifications/${notificationId}/read`,
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('markAllAsRead', () => {
    test('should mark all notifications as read', async () => {
      const mockResponse = {
        success: true,
        data: { updatedCount: 5 },
        message: 'All notifications marked as read'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await frontendNotificationService.markAllAsRead();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/v1/notifications/mark-all-read',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('deleteNotification', () => {
    test('should delete notification', async () => {
      const notificationId = 'notification-123';
      const mockResponse = {
        success: true,
        data: { deleted: true, id: notificationId },
        message: 'Notification deleted'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await frontendNotificationService.deleteNotification(notificationId);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3002/api/v1/notifications/${notificationId}`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('sendTestNotification', () => {
    test('should send test notification', async () => {
      const testData = {
        type: 'security',
        subtype: 'login_attempt',
        title: 'Test Security Alert',
        message: 'This is a test security notification',
        priority: 'high',
        channels: ['in_app', 'email']
      };

      const mockResponse = {
        success: true,
        data: {
          inApp: { id: 'test-123', title: 'Test Security Alert' },
          email: { sent: true },
        },
        message: 'Test notification sent'
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await frontendNotificationService.sendTestNotification(testData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/v1/notifications/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testData),
        })
      );
    });
  });

  describe('Authentication handling', () => {
    test('should throw error when user is not authenticated', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('User not authenticated. Please log in again.');
    });

    test('should throw error when no token found in localStorage', async () => {
      // Mock isAuthenticated to return true but getItem to return null
      localStorageMock.getItem
        .mockReturnValueOnce('test-token') // First call for isAuthenticated
        .mockReturnValueOnce(null);       // Second call in fetchWithAuth

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('No authentication token found');
    });

    test('should handle 401 unauthorized response', async () => {
      // First mock successful response.ok check, then the detailed error handling
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ error: 'Unauthorized' }),
      });

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('API request failed: 401');
    });

    test('should handle 403 forbidden response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({ error: 'Forbidden' }),
      });

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('API request failed: 403');
    });

    test('should handle 404 not found response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ error: 'Not Found' }),
      });

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('API request failed: 404');
    });

    test('should handle 429 rate limit response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({ error: 'Too Many Requests' }),
      });

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('API request failed: 429');
    });

    test('should handle 500 server error response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal Server Error' }),
      });

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('API request failed: 500');
    });

    test('should handle generic error response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 418,
        json: jest.fn().mockResolvedValue({ error: 'I am a teapot' }),
      });

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('API request failed: 418');
    });
  });

  describe('Network error handling', () => {
    test('should handle localhost connection errors', async () => {
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('Cannot connect to the server. Please make sure the backend is running on port 3002.');
    });

    test('should handle network errors for non-localhost', async () => {
      // Mock the API base URL to not include localhost:3002
      const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com/api/v1';
      
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      // Re-import to get the new env variable
      jest.resetModules();
      const { frontendNotificationService: newService } = require('../../src/services/frontendNotificationService.ts');

      await expect(newService.getNotifications())
        .rejects.toThrow('Network error. Please check your internet connection and try again.');
      
      // Restore env
      process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    });

    test('should re-throw custom errors', async () => {
      const customError = new Error('Custom error message');
      global.fetch.mockRejectedValue(customError);

      await expect(frontendNotificationService.getNotifications())
        .rejects.toThrow('Custom error message');

      expect(console.error).toHaveBeenCalledWith('🚨 Network error:', customError);
    });
  });

  describe('Request configuration', () => {
    test('should include proper headers in requests', async () => {
      await frontendNotificationService.getNotifications();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    test('should merge custom headers with default headers', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      // This test is indirect since we can't easily mock the internal fetchWithAuth,
      // but we can verify the service methods work with the expected patterns
      const testData = { type: 'security', subtype: 'test' };
      await frontendNotificationService.sendTestNotification(testData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    test('should use correct HTTP methods for different operations', async () => {
      const notificationId = 'test-123';

      // Test GET
      await frontendNotificationService.getNotifications();
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      );

      // Test PATCH
      await frontendNotificationService.markAsRead(notificationId);
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );

      // Test DELETE
      await frontendNotificationService.deleteNotification(notificationId);
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );

      // Test POST
      await frontendNotificationService.sendTestNotification({ type: 'security', subtype: 'test' });
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('URL construction', () => {
    test('should construct correct API URLs', async () => {
      await frontendNotificationService.getNotifications();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications'),
        expect.any(Object)
      );

      await frontendNotificationService.getUnreadCount();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/unread-count'),
        expect.any(Object)
      );

      await frontendNotificationService.getStats();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/stats'),
        expect.any(Object)
      );
    });

    test('should handle query parameters in URL construction', async () => {
      const params = {
        type: 'security',
        read: false,
        limit: 25
      };

      await frontendNotificationService.getNotifications(params);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\?.*type=security.*read=false.*limit=25/),
        expect.any(Object)
      );
    });
  });
});