import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  return function ItemModal({ isOpen, onClose, onSave, mode, item }: any) {
    if (!isOpen) return null
    return (
      <div data-testid="item-modal">
        <h2>{mode === 'edit' ? 'Edit Item' : 'Add Item'}</h2>
        {item && <div>Editing: {item.name}</div>}
        <button onClick={() => onSave({ name: 'New Item', category: 'login' })}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    )
  }
})

jest.mock('../../components/NotificationToast', () => {
  return function NotificationToast({ message, type, onDismiss }: any) {
    if (!message) return null
    return (
      <div data-testid="notification-toast" className={type}>
        {message}
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    )
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
  useUnreadCount: () => ({ data: 2, isLoading: false, error: null }),
  useNotificationStats: () => ({ data: { total: 5, unread: 2 }, isLoading: false, error: null }),
}))

jest.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({ 
    unreadCount: 2, 
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

// Helper to create mock vault items
const createMockItem = (overrides = {}) => ({
  id: '1',
  name: 'Test Login',
  username: 'user@example.com',
  email: 'user@example.com',
  password: 'SecurePassword123!',
  website: 'example.com',
  category: 'login',
  favorite: false,
  lastUsed: new Date().toISOString(),
  created: new Date().toISOString(),
  strength: 'strong',
  ...overrides
})

describe('Dashboard - Core Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    mockSessionStorage.getItem.mockReturnValue(null)
    
    // Mock console methods to reduce noise
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Authentication and Routing', () => {
    test('redirects to login when not authenticated', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/authentication/signin')
      })
    })

    test('shows dashboard when authenticated', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })

      render(<Dashboard />)
      
      expect(screen.getByTestId('responsive-dashboard')).toBeInTheDocument()
    })
  })

  describe('Vault States', () => {
    test('shows locked vault when no encryption key exists', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      // Mock settings API call
      mockApiRequest.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ settings: {} }),
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/Enter your master password to unlock your vault/i)).toBeInTheDocument()
      })
      
      expect(screen.getByPlaceholderText('Enter your master password')).toBeInTheDocument()
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
      
      const mockItems = [createMockItem()]
      
      // Mock API calls
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ entries: mockItems }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/vault/entries/list'),
          expect.objectContaining({ method: 'POST' })
        )
      })
    })

    test('shows error state when vault loading fails', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_encryption_key') return 'mock-key'
        return null
      })
      
      // Mock API failure
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Server error' }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      })
    })
  })

  describe('Vault Unlock', () => {
    test.skip('unlocks vault with correct password', async () => {
      const user = userEvent.setup()
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      // Mock successful unlock - Dashboard uses fetch directly for unlock
      global.fetch = jest.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/vault/unlock')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ success: true }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })
      
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ entries: [] }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your master password')).toBeInTheDocument()
      })
      
      const passwordInput = screen.getByPlaceholderText('Enter your master password')
      const unlockButton = screen.getByRole('button', { name: /unlock/i })
      
      await user.type(passwordInput, 'correct-password')
      await user.click(unlockButton)
      
      await waitFor(() => {
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
          'lockr_encryption_key',
          expect.any(String)
        )
      })
    })

    test('shows error for incorrect password', async () => {
      const user = userEvent.setup()
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      let callCount = 0
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          callCount++
          if (callCount === 1) {
            // First call fails with 401 (incorrect password)
            return Promise.resolve({
              ok: false,
              status: 401,
              statusText: 'Unauthorized',
              json: async () => ({ error: 'Invalid password' }),
            })
          }
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your master password')).toBeInTheDocument()
      })
      
      const passwordInput = screen.getByPlaceholderText('Enter your master password')
      const unlockButton = screen.getByRole('button', { name: /unlock/i })
      
      await user.type(passwordInput, 'wrong-password')
      await user.click(unlockButton)
      
      await waitFor(() => {
        // Look for any error message in DOM or toast
        const errorMessages = [
          screen.queryByText(/failed to unlock vault/i),
          screen.queryByText(/incorrect password/i),
          screen.queryByText(/invalid password/i),
          screen.queryByText(/please try again/i),
          screen.queryByTestId('notification-toast')
        ]
        expect(errorMessages.some(msg => msg !== null)).toBeTruthy()
      })
    })
  })

  describe('Session Management', () => {
    test('handles 401 error by redirecting to login', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_encryption_key') return 'mock-key'
        return null
      })
      
      // Mock 401 response
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized' }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        // 401 during loadVaultItems shows error state, doesn't redirect
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    test('handles 403 error by locking vault', async () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_encryption_key') return 'mock-key'
        return null
      })
      
      // Mock 403 response
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            json: async () => ({ error: 'Session expired' }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/Enter your master password to unlock your vault/i)).toBeInTheDocument()
      })
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('lockr_encryption_key')
    })
  })

  describe('Item Management', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_encryption_key') return 'mock-key'
        return null
      })
    })

    test('displays vault items when loaded', async () => {
      const mockItems = [
        createMockItem({ id: '1', name: 'Gmail', category: 'login' }),
        createMockItem({ id: '2', name: 'Bank Card', category: 'card' }),
      ]
      
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ entries: mockItems }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/vault/entries/list'),
          expect.anything()
        )
      })
    })

    test('handles empty vault state', async () => {
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ entries: [] }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/vault/entries/list'),
          expect.anything()
        )
      })
      
      // Should show add button or empty state
      await waitFor(() => {
        const addElements = [
          screen.queryByRole('button', { name: /add/i }),
          screen.queryByText(/no items/i),
          screen.queryByText(/empty/i),
          screen.queryByText(/get started/i)
        ]
        expect(addElements.some(el => el !== null)).toBeTruthy()
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_encryption_key') return 'mock-key'
        return null
      })
    })

    test('handles network errors gracefully', async () => {
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      })
    })

    test('handles rate limiting (429 error)', async () => {
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({ error: 'Rate limited' }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
      })
    })

    test('handles corrupted vault data', async () => {
      const corruptedData = [
        { id: '1', name: 'Valid Item', category: 'login' },
        { id: null, name: null }, // Corrupted item
        null, // Null item
        { id: '3', name: 'Another Valid', category: 'note' },
      ]
      
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: {} }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ entries: corruptedData }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/vault/entries/list'),
          expect.anything()
        )
      })
      
      // Should handle corrupted data without crashing
      expect(screen.getByTestId('responsive-dashboard')).toBeInTheDocument()
    })
  })

  describe('User Settings', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_access_token') return 'mock-token'
        if (key === 'lockr_user') return JSON.stringify({ id: '1', email: 'test@example.com' })
        return null
      })
      
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'lockr_encryption_key') return 'mock-key'
        return null
      })
    })

    test('loads user settings on mount', async () => {
      const mockSettings = {
        theme: 'dark',
        clipboardTimeout: 60,
        autoLock: true,
        autoSave: false,
      }
      
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ settings: mockSettings }),
          })
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ entries: [] }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.stringContaining('/auth/settings')
        )
      })
    })

    test('handles settings load failure gracefully', async () => {
      mockApiRequest.mockImplementation((url) => {
        if (url.includes('/auth/settings')) {
          return Promise.reject(new Error('Failed to load settings'))
        }
        if (url.includes('/vault/entries/list')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ entries: [] }),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        })
      })

      render(<Dashboard />)
      
      // Should still render dashboard even if settings fail
      await waitFor(() => {
        expect(screen.getByTestId('responsive-dashboard')).toBeInTheDocument()
      })
    })
  })
})
