import { create } from 'zustand'

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

interface NotificationState {
  notifications: Notification[]
  stats: NotificationStats | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  updateNotification: (id: string, updates: Partial<Notification>) => void
  removeNotification: (id: string) => void
  setStats: (stats: NotificationStats) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  stats: null,
  isLoading: false,
  error: null,

  setNotifications: (notifications) => set({ notifications }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications]
  })),
  
  updateNotification: (id, updates) => set((state) => ({
    notifications: state.notifications.map(notification =>
      notification.id === id ? { ...notification, ...updates } : notification
    )
  })),
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  
  setStats: (stats) => set({ stats }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n =>
      n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
    )
  })),
  
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ 
      ...n, 
      read: true, 
      read_at: n.read_at || new Date().toISOString() 
    }))
  })),
  
  clearAll: () => set({
    notifications: [],
    stats: null,
    isLoading: false,
    error: null
  })
})) 