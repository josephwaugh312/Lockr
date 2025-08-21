/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/link', () => ({ children, href }: any) => <a href={href}>{children}</a>)

let mockEntries: Record<string, string> = {}
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: (k: string) => (mockEntries as any)[k] || null }),
}))
import Page from './page'

const originalAlert = global.alert
beforeAll(() => {
  // @ts-expect-error jsdom
  global.alert = jest.fn()
})
afterAll(() => {
  // @ts-expect-error
  global.alert = originalAlert
})

describe('Verify Email expanded flows', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    // @ts-expect-error override
    global.fetch = jest.fn()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k === 'accessToken' ? 'token' : null),
      },
      configurable: true,
    })
  })

  it('invalid token path shows error and keeps error heading after resend', async () => {
    mockEntries = { token: 'bad' }
    // @ts-expect-error override
    global.fetch = jest.fn(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth/email/verify')) return { ok: false, json: async () => ({ message: 'Invalid token' }) }
      if (url.includes('/auth/email/resend-verification')) return { ok: false, json: async () => ({ message: 'rate limited' }) }
      if (url.includes('/auth/phone/status')) return { ok: true, json: async () => ({ hasPhoneNumber: false }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<Page />)
    expect(await screen.findByTestId('error-heading')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('resend-button'))
    // Error heading persists; rate-limit text may vary
    expect(await screen.findByTestId('error-heading')).toBeInTheDocument()
  })

  it('already verified path renders correct state', async () => {
    mockEntries = { token: 'ok' }
    // @ts-expect-error override
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/auth/email/verify')) return { ok: true, json: async () => ({ alreadyVerified: true, user: { email: 'u@e.com' } }) }
      return { ok: true, json: async () => ({}) }
    })
    render(<Page />)
    expect(await screen.findByText(/Email already verified/i)).toBeInTheDocument()
  })

  it('manual resend validates email and shows success', async () => {
    mockEntries = {}
    // @ts-expect-error override
    global.fetch = jest.fn(async (url: string, opts?: RequestInit) => {
      if (url.includes('/auth/phone/status')) return { ok: true, json: async () => ({ hasPhoneNumber: false }) }
      if (url.includes('/auth/email/resend-verification')) return { ok: true, json: async () => ({}) }
      return { ok: true, json: async () => ({}) }
    })
    render(<Page />)
    const input = await screen.findByPlaceholderText(/Enter your email address/i)
    await userEvent.type(input, 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: /Send Verification Email/i }))
    await waitFor(() => expect(global.alert).toHaveBeenCalled())
  })
})


