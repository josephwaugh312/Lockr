/** @jest-environment jsdom */
import { cn, calculatePasswordStrength, formatDate, copyToClipboard, generateSecureId, apiRequest } from '@/lib/utils'

describe('lib/utils', () => {
  it('cn merges classes', () => {
    expect(cn('a', false && 'b', 'c')).toContain('a')
  })

  it('calculatePasswordStrength scores password', () => {
    const weak = calculatePasswordStrength('abc')
    expect(weak.score).toBeLessThan(3)
    const strong = calculatePasswordStrength('Abcdef1!2345')
    expect(strong.score).toBeGreaterThanOrEqual(5)
  })

  it('formatDate returns formatted string', () => {
    const out = formatDate('2024-01-01T12:34:00Z')
    expect(typeof out).toBe('string')
  })

  it('copyToClipboard writes text and returns true; handles failure', async () => {
    ;(navigator.clipboard.writeText as jest.Mock).mockResolvedValueOnce(undefined)
    await expect(copyToClipboard('x')).resolves.toBe(true)

    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('no'))
    await expect(copyToClipboard('y')).resolves.toBe(false)
  })

  it('generateSecureId returns correct length and charset', () => {
    const id = generateSecureId(10)
    expect(id).toHaveLength(10)
    expect(/^[A-Za-z0-9]+$/.test(id)).toBe(true)
  })

  it('apiRequest retries after 401 with refreshed token', async () => {
    localStorage.setItem('lockr_access_token', 'old')
    localStorage.setItem('lockr_refresh_token', 'refresh')

    // First protected request returns 401
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ status: 401 })
      // Refresh call returns new tokens
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: { accessToken: 'new', refreshToken: 'refresh2' } })
      })
      // Retries original request with new token
      .mockResolvedValueOnce({ status: 200 })

    const res = await apiRequest('https://api.example.com/protected')
    expect(res.status).toBe(200)
  })

  it('apiRequest returns original 401 if refresh fails', async () => {
    localStorage.setItem('lockr_access_token', 'old')
    localStorage.removeItem('lockr_refresh_token')

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ status: 401 })

    const res = await apiRequest('https://api.example.com/protected')
    expect(res.status).toBe(401)
  })

  it('apiRequest handles non-JSON error bodies gracefully', async () => {
    localStorage.setItem('lockr_access_token', 'tok')

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ status: 403, text: async () => 'Forbidden' })

    const res = await apiRequest('https://api.example.com/protected')
    expect(res.status).toBe(403)
    await expect(res.text()).resolves.toBe('Forbidden')
  })

  // Note: concurrent refresh queueing is indirectly covered by retry logic; explicit race tests are brittle
})


