import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  frontendNotificationService, 
  GetNotificationsParams, 
  TestNotificationData 
} from '@/services/frontendNotificationService'
import { useNotificationStore } from '@/stores/notificationStore'
import { useEffect } from 'react'
import { toast } from 'sonner'

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notifications'] as const,
  notifications: (params?: GetNotificationsParams) => ['notifications', 'list', params] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  stats: () => ['notifications', 'stats'] as const,
}

// Helper to check if user is authenticated
const isAuthenticated = () => {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('lockr_access_token')
}

// Fetch notifications
export const useNotifications = (params?: GetNotificationsParams) => {
  const { setNotifications, setLoading, setError } = useNotificationStore()

  const query = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.notifications(params),
    queryFn: () => frontendNotificationService.getNotifications(params),
    enabled: isAuthenticated(), // Enable when user is authenticated
    refetchInterval: 10000, // Reduced from 60 seconds to 10 seconds for more responsive notifications
    staleTime: 5000, // Reduced from 30 seconds to 5 seconds for fresher data
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('not authenticated') || error.message.includes('Session expired')) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    retryOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Update store when data changes (using useEffect to prevent infinite loops)
  useEffect(() => {
    if (query.data?.data) {
      setNotifications(query.data.data)
      setError(null)
    }
    if (query.error) {
      const errorMessage = query.error.message
      setError(errorMessage)
      
      // Only show toast for non-authentication errors to avoid spam
      if (!errorMessage.includes('not authenticated') && !errorMessage.includes('Session expired')) {
        console.error('Failed to fetch notifications:', errorMessage)
      }
    }
    setLoading(query.isLoading)
  }, [query.data, query.error, query.isLoading, setNotifications, setError, setLoading])

  return query
}

// Fetch unread count
export const useUnreadCount = () => {
  const { setUnreadCount } = useNotificationStore()

  const query = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: () => frontendNotificationService.getUnreadCount(),
    enabled: isAuthenticated(), // Enable when user is authenticated
    refetchInterval: 15000, // Reduced from 45 seconds to 15 seconds for more responsive unread count
    staleTime: 5000, // Reduced from 30 seconds to 5 seconds for fresher data
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('not authenticated') || error.message.includes('Session expired')) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    retryOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Update store when data changes
  useEffect(() => {
    if (query.data?.data?.unreadCount !== undefined) {
      setUnreadCount(query.data.data.unreadCount)
    }
  }, [query.data, setUnreadCount])

  return query
}

// Fetch notification stats
export const useNotificationStats = () => {
  const { setStats } = useNotificationStore()

  const query = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.stats(),
    queryFn: () => frontendNotificationService.getStats(),
    enabled: isAuthenticated(), // Enable when user is authenticated
    refetchInterval: 30000, // Reduced from 60 seconds to 30 seconds for more responsive stats
    staleTime: 15000, // Reduced from 30 seconds to 15 seconds for fresher data
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('not authenticated') || error.message.includes('Session expired')) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    retryOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Update store when data changes
  useEffect(() => {
    if (query.data?.data) {
      setStats(query.data.data)
    }
  }, [query.data, setStats])

  return query
}

// Mark notification as read
export const useMarkAsRead = () => {
  const queryClient = useQueryClient()
  const { markAsRead, notifications } = useNotificationStore()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // Find the notification to check if it's a mock notification
      const notification = notifications.find(n => n.id === notificationId)
      
      // Check if this is a mock notification (has test-user as user_id)
      if (notification && notification.user_id === 'test-user') {
        // Handle mock notifications locally without API call
        return Promise.resolve({ 
          success: true, 
          data: { ...notification, read: true, read_at: new Date().toISOString() }, 
          message: 'Mock notification marked as read' 
        })
      }
      
      // For real notifications, call the backend API
      return frontendNotificationService.markAsRead(notificationId)
    },
    onSuccess: (data, notificationId) => {
      // Update local state (works for both mock and real notifications)
      markAsRead(notificationId)
      
      // Invalidate and refetch related queries (only needed for real notifications, but harmless for mock)
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      
      // Show success feedback
      toast.success('Notification marked as read')
    },
    onError: (error) => {
      // Show error feedback
      const errorMessage = error.message
      if (!errorMessage.includes('not authenticated') && !errorMessage.includes('Session expired')) {
        toast.error('Failed to mark notification as read')
      }
      console.error('Failed to mark notification as read:', errorMessage)
    },
  })
}

// Mark all notifications as read
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient()
  const { markAllAsRead, notifications } = useNotificationStore()

  return useMutation({
    mutationFn: async () => {
      // Check if all notifications are mock notifications (have test-user as user_id)
      const allMockNotifications = notifications.every(n => n.user_id === 'test-user')
      
      if (allMockNotifications && notifications.length > 0) {
        // Handle all mock notifications locally without API call
        return Promise.resolve({ 
          success: true, 
          data: { updatedCount: notifications.filter(n => !n.read).length }, 
          message: 'Mock notifications marked as read' 
        })
      }
      
      // Debug authentication state for real API calls (development only)
      const token = localStorage.getItem('lockr_access_token')
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Auth token present:', !!token)
      }
      
      if (!token) {
        throw new Error('No authentication token found')
      }
      
      try {
        const result = await frontendNotificationService.markAllAsRead()
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ markAllAsRead successful:', result)
        }
        return result
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ markAllAsRead failed:', error)
        }
        throw error
      }
    },
    onSuccess: (data) => {
      // Update local state (works for both mock and real notifications)
      markAllAsRead()
      
      // Invalidate and refetch related queries (only needed for real notifications, but harmless for mock)
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      
      // Show success feedback
      const count = data.data?.updatedCount || 0
      toast.success(`${count} notification${count !== 1 ? 's' : ''} marked as read`)
    },
    onError: (error) => {
      // Show error feedback
      const errorMessage = error.message
      if (!errorMessage.includes('not authenticated') && !errorMessage.includes('Session expired')) {
        toast.error('Failed to mark all notifications as read')
      }
      console.error('Failed to mark all notifications as read:', errorMessage)
    },
  })
}

// Delete notification
export const useDeleteNotification = () => {
  const queryClient = useQueryClient()
  const { removeNotification, notifications } = useNotificationStore()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // Find the notification to check if it's a mock notification
      const notification = notifications.find(n => n.id === notificationId)
      
      // Check if this is a mock notification (has test-user as user_id)
      if (notification && notification.user_id === 'test-user') {
        // Handle mock notifications locally without API call
        return Promise.resolve({ 
          success: true, 
          data: { deleted: true, id: notificationId }, 
          message: 'Mock notification deleted' 
        })
      }
      
      // For real notifications, call the backend API
      return frontendNotificationService.deleteNotification(notificationId)
    },
    onSuccess: (data, notificationId) => {
      // Update local state (works for both mock and real notifications)
      removeNotification(notificationId)
      
      // Invalidate and refetch related queries (only needed for real notifications, but harmless for mock)
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      
      // Show success feedback
      toast.success('Notification deleted')
    },
    onError: (error) => {
      // Show error feedback
      const errorMessage = error.message
      if (!errorMessage.includes('not authenticated') && !errorMessage.includes('Session expired')) {
        toast.error('Failed to delete notification')
      }
      console.error('Failed to delete notification:', errorMessage)
    },
  })
}

// Delete all notifications
export const useDeleteAllNotifications = () => {
  const queryClient = useQueryClient()
  const { clearAll, notifications } = useNotificationStore()

  return useMutation({
    mutationFn: async () => {
      // Check if all notifications are mock notifications (have test-user as user_id)
      const allMockNotifications = notifications.every(n => n.user_id === 'test-user')
      
      if (allMockNotifications && notifications.length > 0) {
        // Handle all mock notifications locally without API call
        return Promise.resolve({ 
          success: true, 
          data: { deletedCount: notifications.length }, 
          message: 'All mock notifications deleted' 
        })
      }
      
      // For real notifications, we'll need to implement backend endpoint
      // For now, handle mixed or all real notifications by deleting each one
      // This is a fallback until we have a proper delete-all endpoint
      const deletePromises = notifications.filter(n => n.user_id !== 'test-user')
        .map(notification => frontendNotificationService.deleteNotification(notification.id))
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises)
        return { 
          success: true, 
          data: { deletedCount: deletePromises.length }, 
          message: 'All notifications deleted' 
        }
      }
      
      return { 
        success: true, 
        data: { deletedCount: 0 }, 
        message: 'No notifications to delete' 
      }
    },
    onSuccess: (data) => {
      // Clear all notifications from local state
      clearAll()
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      
      // Show success feedback
      const count = data.data?.deletedCount || 0
      if (count > 0) {
        toast.success(`${count} notification${count !== 1 ? 's' : ''} deleted`)
      } else {
        toast.info('No notifications to delete')
      }
    },
    onError: (error) => {
      // Show error feedback
      const errorMessage = error.message
      if (!errorMessage.includes('not authenticated') && !errorMessage.includes('Session expired')) {
        toast.error('Failed to delete all notifications')
      }
      console.error('Failed to delete all notifications:', errorMessage)
    },
  })
}

// Function to generate a simple UUID v4
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Send test notification
export const useSendTestNotification = () => {
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  return useMutation({
    mutationFn: async (data: TestNotificationData) => {
      try {
        // Try to call the backend API first
        const response = await frontendNotificationService.sendTestNotification(data)
        return response
      } catch (error) {
        // Fall back to local mock notification if backend fails (e.g., in production)
        const mockNotification = {
          id: generateUUID(),
          user_id: 'test-user',
          type: data.type,
          subtype: data.subtype,
          title: data.title || `Test ${data.type} notification`,
          message: data.message || `This is a test ${data.subtype} notification`,
          data: {},
          priority: data.priority || 'medium',
          read: false,
          read_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        return Promise.resolve({ 
          success: true, 
          data: { inApp: mockNotification }, 
          message: 'Test notification created (local mock)' 
        })
      }
    },
    onSuccess: (response) => {
      // Add new notification to local state
      addNotification(response.data.inApp)
      
      // Show success feedback
      toast.success('Test notification sent')
    },
    onError: (error) => {
      // Show error feedback
      toast.error('Failed to send test notification')
      console.error('Failed to send test notification:', error.message)
    },
  })
}

// Clear all notifications hook
export const useClearAllNotifications = () => {
  const queryClient = useQueryClient()
  const { clearAll } = useNotificationStore()

  return useMutation({
    mutationFn: async () => {
      return frontendNotificationService.clearAllNotifications()
    },
    onSuccess: () => {
      clearAll()
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      toast.success('All notifications cleared')
    },
    onError: (error) => {
      toast.error('Failed to clear notifications')
      console.error('Failed to clear notifications:', error.message)
    },
  })
}

// Fetch notification preferences
export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => frontendNotificationService.getNotificationPreferences(),
    enabled: isAuthenticated(),
    staleTime: 60000, // 1 minute
  })
}

// Update notification preferences
export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (preferences: any) => {
      return frontendNotificationService.updateNotificationPreferences(preferences)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      toast.success('Preferences updated')
    },
    onError: (error) => {
      toast.error('Failed to update preferences')
      console.error('Failed to update preferences:', error.message)
    },
  })
}

// Re-export the notification store hook
export { useNotificationStore } from '@/stores/notificationStore' 