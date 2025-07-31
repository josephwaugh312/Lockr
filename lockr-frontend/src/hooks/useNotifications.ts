import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  notificationService, 
  GetNotificationsParams, 
  TestNotificationData 
} from '@/services/notificationService'
import { useNotificationStore } from '@/stores/notificationStore'

export const NOTIFICATION_QUERY_KEYS = {
  all: ['notifications'] as const,
  notifications: (params?: GetNotificationsParams) => ['notifications', 'list', params] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  stats: () => ['notifications', 'stats'] as const,
}

// Fetch notifications
export const useNotifications = (params?: GetNotificationsParams) => {
  const { setNotifications, setLoading, setError } = useNotificationStore()

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.notifications(params),
    queryFn: () => notificationService.getNotifications(params),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    select: (data) => {
      // Update store when data changes
      setNotifications(data.data)
      setLoading(false)
      setError(null)
      return data
    },
    onError: (error: any) => {
      setError(error.message)
      setLoading(false)
    },
  })
}

// Fetch unread count
export const useUnreadCount = () => {
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000,
  })
}

// Fetch notification stats
export const useNotificationStats = () => {
  const { setStats } = useNotificationStore()

  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.stats(),
    queryFn: () => notificationService.getStats(),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
    select: (data) => {
      setStats(data.data)
      return data
    },
  })
}

// Mark notification as read
export const useMarkAsRead = () => {
  const queryClient = useQueryClient()
  const { markAsRead } = useNotificationStore()

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: (data, notificationId) => {
      // Update local state
      markAsRead(notificationId)
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount() })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.stats() })
    },
  })
}

// Mark all notifications as read
export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient()
  const { markAllAsRead } = useNotificationStore()

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      // Update local state
      markAllAsRead()
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount() })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.stats() })
    },
  })
}

// Delete notification
export const useDeleteNotification = () => {
  const queryClient = useQueryClient()
  const { removeNotification } = useNotificationStore()

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.deleteNotification(notificationId),
    onSuccess: (data, notificationId) => {
      // Update local state
      removeNotification(notificationId)
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount() })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.stats() })
    },
  })
}

// Send test notification
export const useSendTestNotification = () => {
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  return useMutation({
    mutationFn: (data: TestNotificationData) => notificationService.sendTestNotification(data),
    onSuccess: (response) => {
      // Add new notification to local state
      addNotification(response.data.inApp)
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount() })
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.stats() })
    },
  })
} 