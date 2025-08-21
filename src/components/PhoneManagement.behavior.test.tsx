/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhoneManagement from './PhoneManagement'

// Helper to mock fetch with sequence or default
function mockFetch(map: Record<string, any> = {}) {
  // @ts-expect-error override
  global.fetch = jest.fn(async (url: string, opts?: RequestInit) => {
    const key = Object.keys(map).find(k => url.includes(k))
    if (key) return map[key]()
    return { ok: true, status: 200, json: async () => ({}) }
  }) as any
}

describe('PhoneManagement behaviors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k === 'lockr_access_token' ? 'token' : null),
      },
      configurable: true,
    })
  })

  it('loads status on mount and shows add form by default', async () => {
    mockFetch({ '/auth/phone/status': () => ({ ok: true, json: async () => ({ hasPhoneNumber: false }) }) })
    render(<PhoneManagement />)
    expect((await screen.findAllByText('Phone Number')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument()
    expect(screen.getByLabelText('Your Password')).toBeInTheDocument()
  })

  it('adds phone successfully and reveals verification UI', async () => {
    mockFetch({
      '/auth/phone/status': () => ({ ok: true, json: async () => ({ hasPhoneNumber: false }) }),
      '/auth/phone/add': () => ({ ok: true, json: async () => ({}) }),
    })
    render(<PhoneManagement />)
    await userEvent.type(await screen.findByLabelText('Phone Number'), '+15551234567')
    const pwd1 = document.getElementById('password') as HTMLInputElement
    expect(pwd1).toBeTruthy()
    await userEvent.type(pwd1!, 'pass')
    await userEvent.click(screen.getByRole('button', { name: /Add Phone Number/i }))
    expect(await screen.findByText(/Please verify with the code/i)).toBeInTheDocument()
    // password cleared
    const pwdValue1 = document.getElementById('password') as HTMLInputElement | null
    if (pwdValue1) {
      expect(pwdValue1.value).toBe('')
    }
  })

  it('shows backend error when add fails and clears password', async () => {
    mockFetch({
      '/auth/phone/status': () => ({ ok: true, json: async () => ({ hasPhoneNumber: false }) }),
      '/auth/phone/add': () => ({ ok: false, json: async () => ({ error: 'Bad phone' }) }),
    })
    render(<PhoneManagement />)
    await userEvent.type(await screen.findByLabelText('Phone Number'), '+15551234567')
    const pwd2 = document.getElementById('password') as HTMLInputElement
    expect(pwd2).toBeTruthy()
    await userEvent.type(pwd2!, 'pass')
    await userEvent.click(screen.getByRole('button', { name: /Add Phone Number/i }))
    expect(await screen.findByText(/Bad phone|Failed to add phone number/i)).toBeInTheDocument()
    const pwdValue2 = document.getElementById('password') as HTMLInputElement
    expect(pwdValue2?.value).toBe('')
  })

  it('handles network error on add and shows message', async () => {
    mockFetch({
      '/auth/phone/status': () => ({ ok: true, json: async () => ({ hasPhoneNumber: false }) }),
      '/auth/phone/add': () => { throw new Error('Network error') },
    })
    render(<PhoneManagement />)
    await userEvent.type(await screen.findByLabelText('Phone Number'), '+15551234567')
    const pwd3 = document.getElementById('password') as HTMLInputElement
    expect(pwd3).toBeTruthy()
    await userEvent.type(pwd3!, 'pass')
    await userEvent.click(screen.getByRole('button', { name: /Add Phone Number/i }))
    expect(await screen.findByText(/Network error/i)).toBeInTheDocument()
  })

  it('sends verification code and shows success/failure', async () => {
    // First add to reveal verification UI
    mockFetch({
      '/auth/phone/status': () => ({ ok: true, json: async () => ({ hasPhoneNumber: false }) }),
      '/auth/phone/add': () => ({ ok: true, json: async () => ({}) }),
      '/auth/phone/send-verification': () => ({ ok: true, json: async () => ({}) }),
    })
    render(<PhoneManagement />)
    await userEvent.type(await screen.findByLabelText('Phone Number'), '+15551234567')
    const pwd4 = document.getElementById('password') as HTMLInputElement
    expect(pwd4).toBeTruthy()
    await userEvent.type(pwd4!, 'pass')
    await userEvent.click(screen.getByRole('button', { name: /Add Phone Number/i }))
    // Now verification UI visible
    const resend = await screen.findByRole('button', { name: /Resend/i })
    await userEvent.click(resend)
    expect(await screen.findByText(/Verification code sent/i)).toBeInTheDocument()

    // Failure path
    mockFetch({ '/auth/phone/send-verification': () => ({ ok: false, json: async () => ({ message: 'nope' }) }) })
    await userEvent.click(screen.getByRole('button', { name: /Resend/i }))
    expect(await screen.findByText(/nope|Failed to send verification code/i)).toBeInTheDocument()
  })

  it('verifies phone code success and hides verification form', async () => {
    // Add to reveal verification
    mockFetch({
      '/auth/phone/status': () => ({ ok: true, json: async () => ({ hasPhoneNumber: false }) }),
      '/auth/phone/add': () => ({ ok: true, json: async () => ({}) }),
      '/auth/phone/verify': () => ({ ok: true, json: async () => ({}) }),
    })
    render(<PhoneManagement />)
    await userEvent.type(await screen.findByLabelText('Phone Number'), '+15551234567')
    await userEvent.type(await screen.findByPlaceholderText('Enter your password'), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /Add Phone Number/i }))
    const input = await screen.findByLabelText('Verification Code') as HTMLInputElement
    await userEvent.type(input, '123456')
    const verify = screen.getByRole('button', { name: /^Verify$/i })
    await userEvent.click(verify)
    expect(await screen.findByText(/Phone number verified successfully/i)).toBeInTheDocument()
  })

  it('remove phone handles cancel and success', async () => {
    mockFetch({ '/auth/phone/status': () => ({ ok: true, json: async () => ({ hasPhoneNumber: true, phoneNumber: '+15551230000', verified: true }) }) })
    render(<PhoneManagement />)
    const originalConfirm = window.confirm
    // Cancel
    window.confirm = jest.fn(() => false)
    // Wait for status block
    await screen.findByText(/Verified|Not verified/i)
    const trashBtn = document.querySelector('button.text-error-600') as HTMLButtonElement
    await userEvent.click(trashBtn)
    expect(window.confirm).toHaveBeenCalled()

    // Success
    window.confirm = jest.fn(() => true)
    mockFetch({ '/auth/phone': () => ({ ok: true, json: async () => ({}) }) })
    await userEvent.click(trashBtn)
    await waitFor(() => {
      expect(screen.getByText(/Phone number removed successfully/i)).toBeInTheDocument()
    })
    window.confirm = originalConfirm
  })
})


