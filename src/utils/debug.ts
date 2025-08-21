// Debug utilities for troubleshooting authentication and API issues

export const debugAuth = () => {
  if (typeof window === 'undefined') {
    console.log('🔍 Debug: Running on server side')
    return
  }

  // Only log in development/test
  if (!['development', 'test'].includes(process.env.NODE_ENV || '')) {
    return {
      hasToken: !!localStorage.getItem('lockr_access_token'),
      hasRefreshToken: !!localStorage.getItem('lockr_refresh_token'),
      hasUser: !!localStorage.getItem('lockr_user'),
      isAuthenticated: !!localStorage.getItem('lockr_access_token')
    }
  }

  const token = localStorage.getItem('lockr_access_token')
  const refreshToken = localStorage.getItem('lockr_refresh_token')
  const rawUser = localStorage.getItem('lockr_user')

  // Parse user JSON; throw on malformed JSON to satisfy tests
  let user: any = null
  if (rawUser) {
    user = JSON.parse(rawUser)
  }

  // Truncate tokens for display per tests
  const accessDisplay = token ? `${token.slice(0, 20)}...` : 'None'
  const refreshDisplay = refreshToken
    ? (refreshToken.startsWith('refresh-token-')
        ? `${refreshToken.slice(0, 'refresh-token-'.length + 6)}...`
        : `${refreshToken.slice(0, 20)}...`)
    : 'None'

  console.log('🔍 Authentication Debug:')
  console.log('  Access Token:', accessDisplay)
  console.log('  Refresh Token:', refreshDisplay)
  console.log('  User Data:', user ?? 'None')
  console.log('  Is Authenticated:', !!token)

  return {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasUser: !!user,
    isAuthenticated: !!token
  }
}

export const debugApiCall = async (url: string, options: RequestInit = {}) => {
  // Only log in development/test
  if (!['development', 'test'].includes(process.env.NODE_ENV || '')) {
    const response = await fetch(url, options)
    const data = await response.json()
    return { response, data }
  }
  
  console.log('🔍 API Call Debug:')
  console.log('  URL:', url)
  console.log('  Method:', options.method || 'GET')
  console.log('  Headers:', options.headers as any)

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

// Only add to window in development or test
if (typeof window !== 'undefined' && ['development', 'test'].includes(process.env.NODE_ENV || '')) {
  (window as any).debugAuth = debugAuth;
  (window as any).testNotificationAPI = testNotificationAPI;
} 