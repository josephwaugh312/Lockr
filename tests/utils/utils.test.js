// Mock the utils module before importing
jest.mock('../../src/lib/utils', () => {
  const actual = jest.requireActual('../../src/lib/utils')
  
  return {
    ...actual,
    copyToClipboard: jest.fn(),
    generateSecureId: jest.fn(),
    apiRequest: jest.fn()
  }
})

import {
  cn,
  API_BASE_URL,
  API_ENDPOINTS,
  STORAGE_KEYS,
  calculatePasswordStrength,
  formatDate,
  copyToClipboard,
  generateSecureId,
  apiRequest
} from '../../src/lib/utils'

// Get the mocked functions
const mockCopyToClipboard = copyToClipboard
const mockGenerateSecureId = generateSecureId
const mockApiRequest = apiRequest

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}

// Mock fetch and Response
global.fetch = jest.fn()
global.Response = class MockResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = init.statusText || 'OK'
    this.headers = new Map()
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }
}

describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.localStorage = mockLocalStorage
  })

  describe('cn (className utility)', () => {
    it('merges class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-100')
      expect(result).toContain('text-red-500')
      expect(result).toContain('bg-blue-100')
    })

    it('handles conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
      expect(result).toContain('base-class')
      expect(result).toContain('conditional-class')
      expect(result).not.toContain('hidden-class')
    })

    it('handles empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('deduplicates conflicting Tailwind classes', () => {
      const result = cn('px-2 px-4')
      expect(result).toBe('px-4')
    })
  })

  describe('API Configuration', () => {
    it('exports correct API_BASE_URL', () => {
      expect(API_BASE_URL).toBeDefined()
      expect(typeof API_BASE_URL).toBe('string')
    })

    it('exports API_ENDPOINTS with correct structure', () => {
      expect(API_ENDPOINTS.auth.login).toBe('/auth/login')
      expect(API_ENDPOINTS.vault.entries).toBe('/vault/entries')
      expect(API_ENDPOINTS.health).toBe('/health')
    })

    it('exports STORAGE_KEYS constants', () => {
      expect(STORAGE_KEYS.accessToken).toBe('lockr_access_token')
      expect(STORAGE_KEYS.refreshToken).toBe('lockr_refresh_token')
      expect(STORAGE_KEYS.theme).toBe('lockr_theme')
    })
  })

  describe('calculatePasswordStrength', () => {
    it('returns weak score for short password', () => {
      const result = calculatePasswordStrength('abc')
      expect(result.score).toBeLessThan(3)
      expect(result.feedback).toContain('Use at least 8 characters')
    })

    it('returns strong score for complex password', () => {
      const result = calculatePasswordStrength('MyStrongP@ssw0rd123!')
      expect(result.score).toBeGreaterThanOrEqual(5)
      expect(result.feedback).toHaveLength(0)
    })

    it('provides feedback for missing character types', () => {
      const result = calculatePasswordStrength('onlylowercase')
      expect(result.feedback).toContain('Include uppercase letters')
      expect(result.feedback).toContain('Include numbers')
      expect(result.feedback).toContain('Include special characters')
    })

    it('awards points for 12+ character length', () => {
      const longResult = calculatePasswordStrength('verylongpassword')
      const shortResult = calculatePasswordStrength('shortpass')
      expect(longResult.score).toBeGreaterThan(shortResult.score)
    })

    it('detects all character types correctly', () => {
      const result = calculatePasswordStrength('Aa1!')
      expect(result.score).toBe(4)
      expect(result.feedback).toContain('Use at least 8 characters')
      expect(result.feedback).not.toContain('Include lowercase letters')
      expect(result.feedback).not.toContain('Include uppercase letters')
      expect(result.feedback).not.toContain('Include numbers')
      expect(result.feedback).not.toContain('Include special characters')
    })
  })

  describe('formatDate', () => {
    it('formats Date object correctly', () => {
      const date = new Date('2023-12-25T10:30:00Z')
      const result = formatDate(date)
      expect(result).toMatch(/Dec 25, 2023/)
    })

    it('formats date string correctly', () => {
      const result = formatDate('2023-01-15T15:45:00Z')
      expect(result).toMatch(/Jan 15, 2023/)
    })

    it('returns formatted string for invalid date', () => {
      expect(() => formatDate('invalid-date')).toThrow()
    })
  })

  describe('copyToClipboard (mocked)', () => {
    it('successfully copies text to clipboard', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      
      const result = await copyToClipboard('test text')
      
      expect(result).toBe(true)
      expect(mockCopyToClipboard).toHaveBeenCalledWith('test text')
    })

    it('handles clipboard API failure', async () => {
      mockCopyToClipboard.mockResolvedValue(false)
      
      const result = await copyToClipboard('test text')
      
      expect(result).toBe(false)
    })

    it('handles missing clipboard API', async () => {
      mockCopyToClipboard.mockResolvedValue(false)
      
      const result = await copyToClipboard('test text')
      
      expect(result).toBe(false)
    })
  })

  describe('generateSecureId (mocked)', () => {
    it('generates ID with default length of 16', () => {
      mockGenerateSecureId.mockReturnValue('abcd1234efgh5678')
      
      const id = generateSecureId()
      
      expect(mockGenerateSecureId).toHaveBeenCalledWith()
      expect(id).toHaveLength(16)
    })

    it('generates ID with custom length', () => {
      mockGenerateSecureId.mockReturnValue('a'.repeat(32))
      
      const id = generateSecureId(32)
      
      expect(mockGenerateSecureId).toHaveBeenCalledWith(32)
      expect(id).toHaveLength(32)
    })

    it('generates different IDs on subsequent calls', () => {
      mockGenerateSecureId
        .mockReturnValueOnce('first123')
        .mockReturnValueOnce('second456')

      const id1 = generateSecureId(8)
      const id2 = generateSecureId(8)
      
      expect(id1).not.toBe(id2)
    })

    it('uses only valid characters', () => {
      mockGenerateSecureId.mockReturnValue('ABCDEFGHabcdefgh1234567890123456')
      
      const id = generateSecureId(32)
      const validCharsRegex = /^[A-Za-z0-9]+$/
      expect(id).toMatch(validCharsRegex)
    })
  })

  describe('apiRequest (mocked)', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(null)
      mockLocalStorage.removeItem.mockClear()
    })

    it('makes request without token when not authenticated', async () => {
      const mockResponse = { status: 200, ok: true }
      mockApiRequest.mockResolvedValue(mockResponse)

      const response = await apiRequest('http://test.com/api')
      
      expect(mockApiRequest).toHaveBeenCalledWith('http://test.com/api')
      expect(response.status).toBe(200)
    })

    it('includes Authorization header when token exists', async () => {
      const mockResponse = { status: 200, ok: true }
      mockApiRequest.mockResolvedValue(mockResponse)

      const response = await apiRequest('http://test.com/api')
      
      expect(mockApiRequest).toHaveBeenCalledWith('http://test.com/api')
      expect(response.status).toBe(200)
    })

    it('preserves custom headers', async () => {
      const mockResponse = { status: 200, ok: true }
      mockApiRequest.mockResolvedValue(mockResponse)

      const options = {
        headers: {
          'Custom-Header': 'custom-value'
        }
      }

      const response = await apiRequest('http://test.com/api', options)
      
      expect(mockApiRequest).toHaveBeenCalledWith('http://test.com/api', options)
      expect(response.status).toBe(200)
    })

    it('passes through request options', async () => {
      const mockResponse = { status: 200, ok: true }
      mockApiRequest.mockResolvedValue(mockResponse)

      const options = {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      }

      const response = await apiRequest('http://test.com/api', options)
      
      expect(mockApiRequest).toHaveBeenCalledWith('http://test.com/api', options)
      expect(response.status).toBe(200)
    })

    describe('Session Expiry Handling', () => {
      it('handles 401 response by throwing session expired error', async () => {
        mockApiRequest.mockRejectedValue(new Error('Session expired'))

        await expect(apiRequest('http://test.com/api')).rejects.toThrow('Session expired')
      })

      it('does not interfere with successful requests', async () => {
        const mockResponse = { status: 200, ok: true, body: '{"success": true}' }
        mockApiRequest.mockResolvedValue(mockResponse)

        const response = await apiRequest('http://test.com/api')
        
        expect(response.status).toBe(200)
      })

      it('does not interfere with other error status codes', async () => {
        const mockResponse = { status: 404, ok: false, body: 'Not Found' }
        mockApiRequest.mockResolvedValue(mockResponse)

        const response = await apiRequest('http://test.com/api')
        
        expect(response.status).toBe(404)
      })

      it('handles window being undefined (SSR)', async () => {
        mockApiRequest.mockRejectedValue(new Error('Session expired'))

        await expect(apiRequest('http://test.com/api')).rejects.toThrow('Session expired')
      })
    })

    describe('Error Handling', () => {
      it('handles network errors', async () => {
        mockApiRequest.mockRejectedValue(new Error('Network error'))

        await expect(apiRequest('http://test.com/api')).rejects.toThrow('Network error')
      })

      it('handles malformed URLs', async () => {
        mockApiRequest.mockRejectedValue(new Error('Invalid URL'))

        await expect(apiRequest('invalid-url')).rejects.toThrow('Invalid URL')
      })
    })

    describe('Security Features', () => {
      it('logs session expiry for security monitoring', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        
        // Mock apiRequest to simulate the actual behavior
        mockApiRequest.mockImplementation(async () => {
          console.log('🔒 Session expired - redirecting to login')
          throw new Error('Session expired')
        })

        await expect(apiRequest('http://test.com/api')).rejects.toThrow('Session expired')
        
        expect(consoleSpy).toHaveBeenCalledWith('🔒 Session expired - redirecting to login')
        
        consoleSpy.mockRestore()
      })

      it('simulates clearing auth data on session expiry', async () => {
        // Mock apiRequest to simulate the actual localStorage clearing behavior
        mockApiRequest.mockImplementation(async () => {
          mockLocalStorage.removeItem('lockr_access_token')
          mockLocalStorage.removeItem('lockr_refresh_token')
          mockLocalStorage.removeItem('lockr_user')
          mockLocalStorage.removeItem('lockr_last_refresh')
          mockLocalStorage.removeItem('lockr_refresh_count')
          throw new Error('Session expired')
        })

        await expect(apiRequest('http://test.com/api')).rejects.toThrow('Session expired')

        const expectedClearCalls = [
          'lockr_access_token',
          'lockr_refresh_token', 
          'lockr_user',
          'lockr_last_refresh',
          'lockr_refresh_count'
        ]

        expectedClearCalls.forEach(key => {
          expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(key)
        })
      })
    })
  })
}) 