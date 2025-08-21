import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from './page'

// Mock Next.js router
const mockPush = jest.fn()
const mockBack = jest.fn()
const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ 
    push: mockPush, 
    back: mockBack, 
    refresh: mockRefresh 
  }),
}))

// Mock Next Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock components
jest.mock('../../components/ItemModal', () => {
  return function ItemModal({ isOpen }: any) {
    if (!isOpen) return null
    return <div data-testid="item-modal">Modal</div>
  }
})

jest.mock('../../components/NotificationToast', () => {
  return function NotificationToast({ message }: any) {
    if (!message) return null
    return <div data-testid="notification-toast">{message}</div>
  }
})

jest.mock('../../components/ResponsiveDashboard', () => {
  return function ResponsiveDashboard({ children }: any) {
    return <div data-testid="responsive-dashboard">{children}</div>
  }
})

jest.mock('../../components/notifications/NotificationBell', () => {
  return function NotificationBell() {
    return <div data-testid="notification-bell">Bell</div>
  }
})

// Mock hooks
jest.mock('../../hooks/useAutoLock', () => ({
  useAutoLock: () => ({
    manualLock: jest.fn(),
    resetTimer: jest.fn(),
    clearTimers: jest.fn(),
  }),
}))

jest.mock('../../hooks/useClipboardManager', () => ({
  useClipboardManager: () => ({
    copyToClipboard: jest.fn().mockResolvedValue(undefined),
    clearClipboard: jest.fn(),
  }),
}))

jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ data: [], isLoading: false, error: null }),
  useUnreadCount: () => ({ data: 0, isLoading: false, error: null }),
  useNotificationStats: () => ({ data: { total: 0, unread: 0 }, isLoading: false, error: null }),
}))

jest.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({ 
    unreadCount: 0, 
    addNotification: jest.fn(), 
    markAsRead: jest.fn() 
  }),
}))

// Mock encryption
jest.mock('../../lib/encryption', () => ({
  deriveEncryptionKey: jest.fn().mockResolvedValue('mock-encryption-key'),
  encryptData: jest.fn((data) => `encrypted-${data}`),
  decryptData: jest.fn((data) => data.replace('encrypted-', '')),
}))

// Mock API utilities
const mockApiRequest = jest.fn()
jest.mock('../../lib/utils', () => ({
  ...jest.requireActual('../../lib/utils'),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  API_BASE_URL: 'http://localhost:3002/api/v1',
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
})

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
})

// Mock fetch
global.fetch = jest.fn()

describe('Dashboard - Basic Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  test('renders dashboard when user is authenticated', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_access_token') return 'mock-token'
      if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
      return null
    })

    render(<Dashboard />)
    
    // Check for basic dashboard structure
    expect(screen.getByTestId('responsive-dashboard')).toBeInTheDocument()
  })

  test('shows vault locked state when no encryption key', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_access_token') return 'mock-token'
      if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
      return null
    })

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/Vault Locked/i)).toBeInTheDocument()
    })
    
    expect(screen.getByPlaceholderText('Enter your master password')).toBeInTheDocument()
  })

  test('redirects to login when not authenticated', async () => {
    mockLocalStorage.getItem.mockReturnValue(null)

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/authentication/signin')
    })
  })

  test('loads vault items when encryption key exists', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_access_token') return 'mock-token'
      if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
      return null
    })
    
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_encryption_key') return 'mock-key'
      return null
    })
    
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] })
    })

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/vault/entries/list'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  test('handles API errors gracefully', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_access_token') return 'mock-token'
      if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
      return null
    })
    
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_encryption_key') return 'mock-key'
      return null
    })
    
    mockApiRequest.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' })
    })

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalled()
    })
    
    // Component should handle error gracefully
    expect(screen.getByTestId('responsive-dashboard')).toBeInTheDocument()
  })

  test('handles session expiry with 403 status', async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_access_token') return 'mock-token'
      if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
      return null
    })
    
    mockSessionStorage.getItem.mockImplementation((key) => {
      if (key === 'lockr_encryption_key') return 'mock-key'
      return null
    })
    
    mockApiRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Session expired' })
    })

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalled()
    })
    
    // The component handles 403 errors by setting vault state to locked
    // which happens asynchronously
    await waitFor(() => {
      const lockedText = screen.queryByText(/Vault Locked/i)
      const errorText = screen.queryByText(/session expired/i)
      expect(lockedText || errorText).toBeTruthy()
    })
  })
})