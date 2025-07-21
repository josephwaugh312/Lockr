// Debug utilities for troubleshooting authentication and API issues

export const debugAuth = () => {
  if (typeof window === 'undefined') {
    console.log('🔍 Debug: Running on server side')
    return
  }

  const token = localStorage.getItem('lockr_access_token')
  const refreshToken = localStorage.getItem('lockr_refresh_token')
  const user = localStorage.getItem('lockr_user')

  console.log('🔍 Authentication Debug:')
  console.log('  Access Token:', token ? `${token.substring(0, 20)}...` : 'None')
  console.log('  Refresh Token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'None')
  console.log('  User Data:', user ? JSON.parse(user) : 'None')
  console.log('  Is Authenticated:', !!token)

  return {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasUser: !!user,
    isAuthenticated: !!token
  }
}

export const debugApiCall = async (url: string, options: RequestInit = {}) => {
  console.log('🔍 API Call Debug:')
  console.log('  URL:', url)
  console.log('  Method:', options.method || 'GET')
  console.log('  Headers:', options.headers)

  try {
    const response = await fetch(url, options)
    console.log('  Response Status:', response.status)
    console.log('  Response OK:', response.ok)
    
    const data = await response.json()
    console.log('  Response Data:', data)
    
    return { response, data }
  } catch (error) {
    console.error('  API Call Error:', error)
    throw error
  }
}

export const testNotificationAPI = async () => {
  const authInfo = debugAuth()
  
  if (!authInfo.isAuthenticated) {
    console.log('❌ Cannot test API - not authenticated')
    return
  }

  const token = localStorage.getItem('lockr_access_token')
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002/api/v1'

  console.log('🧪 Testing Notification API endpoints...')

  // First test basic connectivity
  try {
    console.log('🔗 Testing basic connectivity...')
    const healthResponse = await fetch(`${baseUrl.replace('/api/v1', '')}/health`)
    console.log('🔗 Health check:', healthResponse.ok ? '✅ OK' : '❌ Failed')
  } catch (error) {
    console.error('🔗 Health check failed:', error)
  }

  try {
    // Test unread count
    console.log('📊 Testing unread count...')
    await debugApiCall(`${baseUrl}/notifications/unread-count`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    // Test notifications list
    console.log('📋 Testing notifications list...')
    await debugApiCall(`${baseUrl}/notifications?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    // Test mark all as read
    console.log('✅ Testing mark all as read...')
    await debugApiCall(`${baseUrl}/notifications/mark-all-read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('🚨 API Test Failed:', error)
  }
}

// Add to window for easy access in browser console
if (typeof window !== 'undefined') {
  (window as any).debugAuth = debugAuth;
  (window as any).testNotificationAPI = testNotificationAPI;
} 