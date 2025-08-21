/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VerifyEmailPage from './page'

const makeSearchParams = (map: Record<string, string | null>) => ({
  get: (k: string) => map[k] ?? null,
})

// Stable mocks for next/navigation
const mockUseSearchParams = jest.fn(() => makeSearchParams({ token: null }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => mockUseSearchParams(),
}))

describe('VerifyEmailPage interactions', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn()
    // Mock alert where used
    // @ts-ignore
    global.alert = jest.fn()
    localStorage.clear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('verifies with token and shows success actions', async () => {
    const user = userEvent.setup()
    // token success
    // @ts-ignore
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ alreadyVerified: false, user: { email: 't@example.com' } }),
    })

    mockUseSearchParams.mockReturnValueOnce(makeSearchParams({ token: 'a'.repeat(64) }))
    render(<VerifyEmailPage />)
    expect(await screen.findByText('Email verified successfully!')).toBeInTheDocument()
    // Action links appear
    expect(screen.getByRole('link', { name: /Continue to sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Go to dashboard/i })).toBeInTheDocument()
  })

  it('shows manual resend when no token and sends email', async () => {
    const user = userEvent.setup()
    // No token path
    // @ts-ignore
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    mockUseSearchParams.mockReturnValue(makeSearchParams({ token: null }))

    // Polyfill IntersectionObserver used by Next internal use-intersection
    // @ts-ignore
    window.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    render(<VerifyEmailPage />)
    // Await manual entry input by role
    const input = await screen.findByRole('textbox')
    await user.type(input, 'user@example.com')
    const sendBtn = screen.getByRole('button', { name: /Send Verification Email/i })
    await user.click(sendBtn)

    expect(global.fetch).toHaveBeenCalled()
  })
})


