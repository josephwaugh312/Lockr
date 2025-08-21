import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Notification {
  id: string
  user_id: string
  type: 'security' | 'account' | 'system'
  subtype: string
  title: string
  message: string
  data: Record<string, any>
  priority: 'low' | 'medium' | 'high' | 'critical'
  read: boolean
  read_at: string | null
  created_at: string
  updated_at: string
}

export interface NotificationStats {
  total: string
  unread: string
  security_alerts: string
  critical: string
}

interface NotificationData {
  notifications: Notification[]
  unreadCount: number
  stats: NotificationStats | null
  isLoading: boolean
  error: string | null
}

interface NotificationState extends NotificationData {
  // Actions
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  updateNotification: (id: string, updates: Partial<Notification>) => void
  removeNotification: (id: string) => void
  setUnreadCount: (count: number) => void
  setStats: (stats: NotificationStats) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  resetToMockData: () => void
}

// Function to generate initial mock notifications
const getInitialMockNotifications = (): Notification[] => [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    user_id: 'test-user',
    type: 'security',
    subtype: 'suspicious_login',
    title: 'Suspicious Login Detected',
    message: 'We detected a login attempt from an unusual location (New York, US). If this was you, you can ignore this message.',
    data: { location: 'New York, US', ip: '192.168.1.1' },
    priority: 'high',
    read: false,
    read_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    user_id: 'test-user',
    type: 'account',
    subtype: 'password_changed',
    title: 'Password Changed',
    message: 'Your account password was successfully changed.',
    data: {},
    priority: 'medium',
    read: false,
    read_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
  },
  {
    id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    user_id: 'test-user',
    type: 'system',
    subtype: 'maintenance',
    title: 'Scheduled Maintenance',
    message: 'System maintenance is scheduled for tonight at 2:00 AM EST. Expected downtime: 30 minutes.',
    data: { scheduled_time: '2024-01-20T02:00:00Z' },
    priority: 'low',
    read: true,
    read_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  },
  {
    id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
    user_id: 'test-user',
    type: 'security',
    subtype: 'weak_password',
    title: 'Weak Password Detected',
    message: 'We found 3 passwords in your vault that are considered weak. Consider updating them for better security.',
    data: { weak_count: 3 },
    priority: 'medium',
    read: false,
    read_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
  }
]

const initialState: NotificationData = {
  notifications: [],
  unreadCount: 0,
  stats: {
    total: '0',
    unread: '0',
    security_alerts: '0',
    critical: '0'
  },
  isLoading: false,
  error: null
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setNotifications: (notifications) => set(() => {
        const unreadCount = notifications.filter(n => !n.read).length
        const stats = {
          total: notifications.length.toString(),
          unread: unreadCount.toString(),
          security_alerts: notifications.filter(n => n.type === 'security').length.toString(),
          critical: notifications.filter(n => n.priority === 'critical').length.toString()
        }
        return {
          notifications,
          unreadCount,
          stats
        }
      }),
      
      addNotification: (notification) => set((state) => {
        // Deduplicate by id: replace existing, otherwise prepend
        const existingIndex = state.notifications.findIndex(n => n.id === notification.id)
        let newNotifications: Notification[]
        if (existingIndex !== -1) {
          newNotifications = state.notifications.slice()
          newNotifications[existingIndex] = { ...state.notifications[existingIndex], ...notification }
        } else {
          newNotifications = [notification, ...state.notifications]
        }
        const unreadCount = newNotifications.filter(n => !n.read).length
        const stats = {
          total: newNotifications.length.toString(),
          unread: unreadCount.toString(),
          security_alerts: newNotifications.filter(n => n.type === 'security').length.toString(),
          critical: newNotifications.filter(n => n.priority === 'critical').length.toString()
        }
        return {
          notifications: newNotifications,
          unreadCount,
          stats
        }
      }),
      
      updateNotification: (id, updates) => set((state) => ({
        notifications: state.notifications.map(notification =>
          notification.id === id ? { ...notification, ...updates } : notification
        )
      })),
      
      removeNotification: (id) => set((state) => {
        const newNotifications = state.notifications.filter(n => n.id !== id)
        const unreadCount = newNotifications.filter(n => !n.read).length
        const stats = {
          total: newNotifications.length.toString(),
          unread: unreadCount.toString(),
          security_alerts: newNotifications.filter(n => n.type === 'security').length.toString(),
          critical: newNotifications.filter(n => n.priority === 'critical').length.toString()
        }
        return {
          notifications: newNotifications,
          unreadCount,
          stats
        }
      }),
      
      setUnreadCount: (count) => set({ unreadCount: count }),
      
      setStats: (stats) => set({ stats }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      markAsRead: (id) => set((state) => {
        const newNotifications = state.notifications.map(n =>
          n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
        const unreadCount = newNotifications.filter(n => !n.read).length
        const stats = {
          total: newNotifications.length.toString(),
          unread: unreadCount.toString(),
          security_alerts: newNotifications.filter(n => n.type === 'security').length.toString(),
          critical: newNotifications.filter(n => n.priority === 'critical').length.toString()
        }
        return {
          notifications: newNotifications,
          unreadCount,
          stats
        }
      }),
      
      markAllAsRead: () => set((state) => {
        const newNotifications = state.notifications.map(n => ({ 
          ...n, 
          read: true, 
          read_at: n.read_at || new Date().toISOString() 
        }))
        const stats = {
          total: newNotifications.length.toString(),
          unread: '0',
          security_alerts: newNotifications.filter(n => n.type === 'security').length.toString(),
          critical: newNotifications.filter(n => n.priority === 'critical').length.toString()
        }
        return {
          notifications: newNotifications,
          unreadCount: 0,
          stats
        }
      }),
      
      clearAll: () => set({
        notifications: [],
        unreadCount: 0,
        stats: {
          total: '0',
          unread: '0',
          security_alerts: '0',
          critical: '0'
        },
        isLoading: false,
        error: null
      }),
      
      resetToMockData: () => set({
        notifications: getInitialMockNotifications(),
        unreadCount: getInitialMockNotifications().filter(n => !n.read).length,
        stats: {
          total: getInitialMockNotifications().length.toString(),
          unread: getInitialMockNotifications().filter(n => !n.read).length.toString(),
          security_alerts: getInitialMockNotifications().filter(n => n.type === 'security').length.toString(),
          critical: getInitialMockNotifications().filter(n => n.priority === 'critical').length.toString()
        },
        isLoading: false,
        error: null
      })
    }),
    {
      name: 'lockr-notifications',
      onRehydrateStorage: () => (state) => {
        // Initialize with mock data if no persisted data exists
        if (state && state.notifications.length === 0) {
          const mockNotifications = getInitialMockNotifications()
          const unreadCount = mockNotifications.filter(n => !n.read).length
          const stats = {
            total: mockNotifications.length.toString(),
            unread: unreadCount.toString(),
            security_alerts: mockNotifications.filter(n => n.type === 'security').length.toString(),
            critical: mockNotifications.filter(n => n.priority === 'critical').length.toString()
          }
          
          state.notifications = mockNotifications
          state.unreadCount = unreadCount
          state.stats = stats
        }
      }
    }
  )
) 