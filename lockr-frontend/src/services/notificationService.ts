import { Notification, NotificationStats } from '@/stores/notificationStore'

const API_BASE_URL = 'http://localhost:3002/api'

// Get auth token from localStorage
const getAuthToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

// Create headers with auth token
const getHeaders = () => {
  const token = getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  }
}

export interface GetNotificationsParams {
  type?: 'security' | 'account' | 'system'
  read?: boolean
  priority?: 'low' | 'medium' | 'high' | 'critical'
  limit?: number
  offset?: number
}

export interface GetNotificationsResponse {
  success: boolean
  data: Notification[]
  pagination: {
    limit: number
    offset: number
    count: number
  }
}

export interface UnreadCountResponse {
  success: boolean
  data: {
    unreadCount: number
  }
}

export interface StatsResponse {
  success: boolean
  data: NotificationStats
}

export interface MarkAsReadResponse {
  success: boolean
  data: Notification
  message: string
}

export interface MarkAllAsReadResponse {
  success: boolean
  data: {
    updatedCount: number
  }
  message: string
}

export interface DeleteNotificationResponse {
  success: boolean
  data: {
    deleted: boolean
    id: string
  }
  message: string
}

export interface TestNotificationData {
  type: 'security' | 'account'
  subtype: string
  title?: string
  message?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  channels?: string[]
}

export interface TestNotificationResponse {
  success: boolean
  data: {
    inApp: Notification
    email?: any
    sms?: any
  }
  message: string
}

class NotificationService {
  async getNotifications(params: GetNotificationsParams = {}): Promise<GetNotificationsResponse> {
    const searchParams = new URLSearchParams()
    
    if (params.type) searchParams.append('type', params.type)
    if (params.read !== undefined) searchParams.append('read', params.read.toString())
    if (params.priority) searchParams.append('priority', params.priority)
    if (params.limit) searchParams.append('limit', params.limit.toString())
    if (params.offset) searchParams.append('offset', params.offset.toString())

    const response = await fetch(`${API_BASE_URL}/notifications?${searchParams}`, {
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.statusText}`)
    }

    return response.json()
  }

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch unread count: ${response.statusText}`)
    }

    return response.json()
  }

  async getStats(): Promise<StatsResponse> {
    const response = await fetch(`${API_BASE_URL}/notifications/stats`, {
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`)
    }

    return response.json()
  }

  async markAsRead(notificationId: string): Promise<MarkAsReadResponse> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to mark notification as read: ${response.statusText}`)
    }

    return response.json()
  }

  async markAllAsRead(): Promise<MarkAllAsReadResponse> {
    const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
      method: 'PATCH',
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to mark all notifications as read: ${response.statusText}`)
    }

    return response.json()
  }

  async deleteNotification(notificationId: string): Promise<DeleteNotificationResponse> {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to delete notification: ${response.statusText}`)
    }

    return response.json()
  }

  async sendTestNotification(data: TestNotificationData): Promise<TestNotificationResponse> {
    const response = await fetch(`${API_BASE_URL}/notifications/test`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`Failed to send test notification: ${response.statusText}`)
    }

    return response.json()
  }
}

export const notificationService = new NotificationService() 