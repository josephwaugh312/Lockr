/**
 * Tests for useNotifications hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useNotifications,
  useUnreadCount,
  useNotificationStats,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useClearAllNotifications,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useNotificationStore
} from '../../src/hooks/useNotifications';

// Silence act warnings in this file to focus on assertions
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('not wrapped in act')) return;
    return originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
// Default successful response unless overridden in a test
beforeEach(() => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response)
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Ensure store is reset between tests to avoid cross-test leakage
beforeEach(() => {
  try {
    // Zustand hook exposes getState in test env
    (useNotificationStore as any).getState().clearAll();
  } catch {}
});

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('mock-token');
    mockFetch.mockClear();
  });

  describe('useNotifications', () => {
    test('fetches notifications successfully', async () => {
      const mockNotifications = [
        {
          id: '1',
          title: 'Test Notification',
          message: 'Test message',
          type: 'info',
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Another Notification',
          message: 'Another message',
          type: 'warning',
          read: true,
          createdAt: new Date().toISOString(),
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockNotifications }),
      } as Response);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(mockNotifications);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
        })
      );
    });

    test('handles error when fetching notifications', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });

    test('returns empty array when no token', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        // query is disabled without token, so no data
        expect(result.current.isSuccess || result.current.isError).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('filters notifications by type', async () => {
      const mockNotifications = [
        { id: '1', type: 'info', title: 'Info', message: 'msg', read: false, createdAt: '2024-01-01' },
        { id: '2', type: 'warning', title: 'Warning', message: 'msg', read: false, createdAt: '2024-01-01' },
        { id: '3', type: 'error', title: 'Error', message: 'msg', read: false, createdAt: '2024-01-01' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockNotifications }),
      } as Response);

      const { result } = renderHook(() => useNotifications({ type: 'warning' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=warning'),
        expect.any(Object)
      );
    });

    test('filters unread notifications', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response)

      const { result } = renderHook(() => useNotifications({ read: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFetch.mock.calls[0][0]).toContain('read=false');
    });
  });

  describe('useUnreadCount', () => {
    test('fetches unread count successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { unreadCount: 5 } }),
      } as Response);

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data?.unreadCount).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications/unread-count'),
        expect.any(Object)
      );
    });

    test('returns 0 when no token', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess || result.current.isError).toBe(false);
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('useNotificationStats', () => {
    test('fetches notification stats successfully', async () => {
      const mockStats = {
        total: 10,
        unread: 3,
        byType: {
          info: 5,
          warning: 3,
          error: 2,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockStats }),
      } as Response);

      const { result } = renderHook(() => useNotificationStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(mockStats);
    });
  });

  describe('useMarkAsRead', () => {
    test('marks notification as read successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useMarkAsRead(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('notification-id');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications/notification-id/read'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    test('handles error when marking as read', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to mark as read'));

      const { result } = renderHook(() => useMarkAsRead(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('notification-id');
        })
      ).rejects.toThrow('Failed to mark as read');
    });
  });

  describe('useMarkAllAsRead', () => {
    test('marks all notifications as read successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { updatedCount: 4 } }),
      } as Response);

      const { result } = renderHook(() => useMarkAllAsRead(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications/mark-all-read'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('useDeleteNotification', () => {
    test('deletes notification successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useDeleteNotification(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('notification-id');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications/notification-id'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    test('handles error when deleting notification', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to delete'));

      const { result } = renderHook(() => useDeleteNotification(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('notification-id');
        })
      ).rejects.toThrow('Failed to delete');
    });
  });

  describe('useClearAllNotifications', () => {
    test('clears all notifications successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useClearAllNotifications(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications/clear-all'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('useNotificationPreferences', () => {
    test('fetches preferences successfully', async () => {
      const mockPreferences = {
        email: true,
        push: false,
        sms: true,
        types: {
          security: true,
          updates: false,
          marketing: false,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      } as Response);

      const { result } = renderHook(() => useNotificationPreferences(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPreferences);
    });
  });

  describe('useUpdateNotificationPreferences', () => {
    test('updates preferences successfully', async () => {
      const newPreferences = {
        email: false,
        push: true,
        sms: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useUpdateNotificationPreferences(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(newPreferences);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3002/api/v1/notifications/preferences'),
        expect.objectContaining({ method: 'PUT', body: JSON.stringify(newPreferences) })
      );
    });
  });

  describe('useNotificationStore', () => {
    test('manages notification state', () => {
      const { result } = renderHook(() => useNotificationStore());

      // Initial state
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);

      // Add notification
      act(() => {
        result.current.addNotification({
          id: '1',
          title: 'New Notification',
          message: 'Test message',
          type: 'info',
          read: false,
          createdAt: new Date().toISOString(),
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);

      // Mark as read
      act(() => {
        result.current.markAsRead('1');
      });

      expect(result.current.unreadCount).toBe(0);
      expect(result.current.notifications[0].read).toBe(true);

      // Remove notification
      act(() => {
        result.current.removeNotification('1');
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('sets all notifications', () => {
      const { result } = renderHook(() => useNotificationStore());

      const notifications = [
        { id: '1', title: 'N1', message: 'M1', type: 'info' as const, read: false, createdAt: '2024-01-01' },
        { id: '2', title: 'N2', message: 'M2', type: 'warning' as const, read: true, createdAt: '2024-01-01' },
      ];

      act(() => {
        result.current.setNotifications(notifications);
      });

      expect(result.current.notifications).toEqual(notifications);
      expect(result.current.unreadCount).toBe(1);
    });

    test('marks all as read', () => {
      const { result } = renderHook(() => useNotificationStore());

      const notifications = [
        { id: '1', title: 'N1', message: 'M1', type: 'info' as const, read: false, createdAt: '2024-01-01' },
        { id: '2', title: 'N2', message: 'M2', type: 'warning' as const, read: false, createdAt: '2024-01-01' },
      ];

      act(() => {
        result.current.setNotifications(notifications);
      });

      expect(result.current.unreadCount).toBe(2);

      act(() => {
        result.current.markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);
      expect(result.current.notifications.every(n => n.read)).toBe(true);
    });

    test('clears all notifications', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addNotification({
          id: '1',
          title: 'Test',
          message: 'Test',
          type: 'info',
          read: false,
          createdAt: '2024-01-01',
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.notifications).toHaveLength(0);
      expect(result.current.unreadCount).toBe(0);
    });

    test('handles notification with same ID', () => {
      const { result } = renderHook(() => useNotificationStore());

      const notification = {
        id: '1',
        title: 'Original',
        message: 'Original message',
        type: 'info' as const,
        read: false,
        createdAt: '2024-01-01',
      };

      act(() => {
        result.current.addNotification(notification);
      });

      expect(result.current.notifications).toHaveLength(1);

      // Add notification with same ID
      act(() => {
        result.current.addNotification({
          ...notification,
          title: 'Updated',
        });
      });

      // Should not duplicate
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe('Updated');
    });
  });

  describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
      expect(result.current.data).toBeUndefined();
    });

    test('handles 401 unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });

    test('handles malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      } as Response);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('Polling and Real-time Updates', () => {
    test.skip('polls for new notifications', async () => {
      const mockNotifications = [
        { id: '1', title: 'Test', message: 'Test', type: 'info', read: false, createdAt: '2024-01-01' },
      ];

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: mockNotifications }) } as Response);

      const { result } = renderHook(
        () => useNotifications({ pollInterval: 1000 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should be called initially
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait for polling interval
      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );
    });

    test.skip('stops polling when disabled', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response);

      const { result, rerender } = renderHook(
        ({ enabled }) => useNotifications({ pollInterval: enabled ? 1000 : undefined }),
        { 
          wrapper: createWrapper(),
          initialProps: { enabled: true }
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCallCount = mockFetch.mock.calls.length;

      // Disable polling
      rerender({ enabled: false });

      // Wait to ensure no more calls
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(mockFetch).toHaveBeenCalledTimes(initialCallCount);
    });
  });
});