import { Notification, NotificationStats } from '@/stores/notificationStore'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002/api/v1'

// Debug: Log the API base URL
console.log('🔍 API_BASE_URL:', API_BASE_URL)

// Get auth token from localStorage
const getAuthToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('lockr_access_token')
}

// Check if user is authenticated
const isAuthenticated = () => {
  return !!getAuthToken()
}

// Create headers with auth token
const getHeaders = () => {
  const token = getAuthToken()
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  }
}

// Enhanced fetch with better error handling
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  // Check authentication before making request
  if (!isAuthenticated()) {
    throw new Error('User not authenticated. Please log in again.')
  }

  try {
    const token = localStorage.getItem('lockr_access_token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      ...options
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    // Handle specific error cases
    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch (jsonError) {
        // If JSON parsing fails, try to get text response (for rate limiting messages)
        try {
          const textResponse = await response.text()
          errorData = { error: textResponse }
        } catch (textError) {
          errorData = { error: 'Unknown error' }
        }
      }
      
      if (response.status === 401) {
        // Token expired or invalid - clear auth data and redirect
        localStorage.removeItem('lockr_access_token')
        localStorage.removeItem('lockr_refresh_token')
        localStorage.removeItem('lockr_user')
        
        // SECURITY: Clear vault encryption key to lock vault
        sessionStorage.removeItem('lockr_encryption_key')
        
        // Dispatch session expired event for vault cleanup
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('session-expired'))
        }
        
        if (typeof window !== 'undefined') {
          window.location.href = '/authentication/signin'
        }
        
        throw new Error('Session expired. Please log in again.')
      } else if (response.status === 403) {
        throw new Error('Access denied. You do not have permission to perform this action.')
      } else if (response.status === 404) {
        throw new Error('Resource not found.')
      } else if (response.status === 429) {
        throw new Error('Too many requests. Please try again later.')
      } else if (response.status >= 500) {
        throw new Error('Server error. Please try again later.')
      }
      
      throw new Error(errorData.error || `Request failed with status ${response.status}`)
    }

    return response
  } catch (error) {
    console.error('🚨 Network error:', error)
    
    // Handle network-level errors (CORS, connection issues, etc.)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      // Check if it's a CORS issue
      if (url.includes('localhost:3002')) {
        throw new Error('Cannot connect to the server. Please make sure the backend is running on port 3002.')
      }
      throw new Error('Network error. Please check your internet connection and try again.')
    }
    
    // Re-throw other errors (like our custom errors from above)
    throw error
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

class FrontendNotificationService {
  // Test connectivity to the backend
  async testConnectivity(): Promise<boolean> {
    try {
      console.log('🧪 Testing connectivity to:', `${API_BASE_URL.replace('/api/v1', '')}/health`)
      const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('🧪 Health check response:', {
        status: response.status,
        ok: response.ok
      })
      
      return response.ok
    } catch (error) {
      console.error('🚨 Connectivity test failed:', error)
      return false
    }
  }

  async getNotifications(params: GetNotificationsParams = {}): Promise<GetNotificationsResponse> {
    const searchParams = new URLSearchParams()
    
    if (params.type) searchParams.append('type', params.type)
    if (params.read !== undefined) searchParams.append('read', params.read.toString())
    if (params.priority) searchParams.append('priority', params.priority)
    if (params.limit) searchParams.append('limit', params.limit.toString())
    if (params.offset) searchParams.append('offset', params.offset.toString())

    const response = await fetchWithAuth(`${API_BASE_URL}/notifications?${searchParams}`)

    return response.json()
  }

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/notifications/unread-count`)

    return response.json()
  }

  async getStats(): Promise<StatsResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/notifications/stats`)

    return response.json()
  }

  async markAsRead(notificationId: string): Promise<MarkAsReadResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}/read`, { method: 'PATCH' })

    return response.json()
  }

  async markAllAsRead(): Promise<MarkAllAsReadResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/notifications/mark-all-read`, { method: 'PATCH' })

    return response.json()
  }

  async deleteNotification(notificationId: string): Promise<DeleteNotificationResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/notifications/${notificationId}`, { method: 'DELETE' })

    return response.json()
  }

  async sendTestNotification(data: TestNotificationData): Promise<TestNotificationResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/notifications/test`, {
      method: 'POST',
      body: JSON.stringify(data)
    })

    return response.json()
  }
}

export const frontendNotificationService = new FrontendNotificationService() 