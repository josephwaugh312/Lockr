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
  const { markAsRead } = useNotificationStore()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return frontendNotificationService.markAsRead(notificationId)
    },
    onSuccess: (data, notificationId) => {
      // Update local state
      markAsRead(notificationId)
      
      // Invalidate and refetch related queries
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
  const { markAllAsRead } = useNotificationStore()

  return useMutation({
    mutationFn: async () => {
      console.log('🔍 Starting markAllAsRead mutation...')
      
      // Debug authentication state
      const token = localStorage.getItem('lockr_access_token')
      console.log('🔍 Auth token present:', !!token)
      
      if (!token) {
        throw new Error('No authentication token found')
      }
      
      try {
        const result = await frontendNotificationService.markAllAsRead()
        console.log('✅ markAllAsRead successful:', result)
        return result
      } catch (error) {
        console.error('❌ markAllAsRead failed:', error)
        throw error
      }
    },
    onSuccess: (data) => {
      console.log('🎉 markAllAsRead onSuccess:', data)
      
      // Update local state
      markAllAsRead()
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      
      // Show success feedback
      const count = data.data?.updatedCount || 0
      toast.success(`${count} notification${count !== 1 ? 's' : ''} marked as read`)
    },
    onError: (error) => {
      console.error('💥 markAllAsRead onError:', error)
      
      // Show error feedback
      const errorMessage = error.message
      console.log('🔍 Error message:', errorMessage)
      console.log('🔍 Error type:', typeof error)
      console.log('🔍 Error constructor:', error.constructor.name)
      
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
  const { removeNotification } = useNotificationStore()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return frontendNotificationService.deleteNotification(notificationId)
    },
    onSuccess: (data, notificationId) => {
      // Update local state
      removeNotification(notificationId)
      
      // Invalidate and refetch related queries
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

// Send test notification
export const useSendTestNotification = () => {
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  return useMutation({
    mutationFn: async (data: TestNotificationData) => {
      // For now, create a mock notification locally
      // When backend is ready, uncomment the line below:
      // return frontendNotificationService.sendTestNotification(data)
      
      const mockNotification = {
        id: Date.now().toString(),
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
        message: 'Test notification created' 
      })
    },
    onSuccess: (response) => {
      // Add new notification to local state
      addNotification(response.data.inApp)
      
      // Show success feedback
      toast.success('Test notification sent')
      
      // Invalidate and refetch related queries (when API is enabled)
      // queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
    },
    onError: (error) => {
      // Show error feedback
      toast.error('Failed to send test notification')
      console.error('Failed to send test notification:', error.message)
    },
  })
} 