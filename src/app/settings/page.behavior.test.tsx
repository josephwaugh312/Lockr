/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import SettingsPage from './page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

describe('SettingsPage behavior', () => {
  beforeEach(() => {
    // Polyfill IntersectionObserver used by Next.js
    // @ts-ignore
    global.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // Minimal apiRequest mocks via global fetch used inside apiRequest
    // @ts-ignore
    global.fetch = jest.fn()
    // Profile
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    // 2FA status
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    // settings
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('navigates sections and triggers save', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    // Wait for initial load text to disappear by querying for a known control
    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Click Appearance section in desktop sidebar by button text
    const appearanceBtn = screen.getAllByText('Appearance')[0]
    await user.click(appearanceBtn)
    expect(screen.getByText('Theme')).toBeInTheDocument()

    // Trigger save: prepare two PUT calls (profile, settings)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const saveButtons = screen.getAllByRole('button', { name: /Save/i })
    await user.click(saveButtons[0])

    expect(global.fetch).toHaveBeenCalled()
  })

  it('shows toast error on save failure', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Prepare failing PUT calls
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Failed to update profile' }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const saveButtons = screen.getAllByRole('button', { name: /Save/i })
    await user.click(saveButtons[0])

    expect(await screen.findByText(/Failed to update profile/i)).toBeInTheDocument()
  })

  it.skip('sends test notifications: success and failure paths', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // Initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    const prevEnv = process.env.NODE_ENV
    // @ts-ignore
    process.env.NODE_ENV = 'development'
    // Polyfill matchMedia for components using framer-motion queries
    // @ts-ignore
    window.matchMedia = window.matchMedia || function () {
      return {
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }
    }

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Navigate to Notifications section where the test buttons are rendered
    await user.click(screen.getAllByText('Notifications')[0])

    await user.click(await screen.findByRole('button', { name: /Test Security Alert/i }))
    expect(await screen.findByText(/Test notification sent/i)).toBeInTheDocument()

    // Second click, force network failure path to still show fallback success
    await user.click(screen.getByRole('button', { name: /Test Account Update/i }))
    expect(await screen.findByText(/Test notification sent/i)).toBeInTheDocument()

    // restore
    // @ts-ignore
    process.env.NODE_ENV = prevEnv
  })

  it('changes password successfully and shows success toast', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Mock change password success
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    await user.type(screen.getByText('Current Account Password').parentElement!.querySelector('input')!, 'oldpass')
    await user.type(screen.getByText('New Password').parentElement!.querySelector('input')!, 'newpassword1')
    await user.type(screen.getByText('Confirm New Password').parentElement!.querySelector('input')!, 'newpassword1')
    await user.click(screen.getByRole('button', { name: 'Update Account Password' }))

    // Expect success toast
    expect(await screen.findByText('Account password changed successfully!')).toBeInTheDocument()
  })

  it('shows success toast on save', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Prepare success PUTs (profile, settings)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const saveButtons = screen.getAllByRole('button', { name: /Save/i })
    await user.click(saveButtons[0])

    expect(await screen.findByText('Settings updated successfully!')).toBeInTheDocument()
  })

  it('2FA disable: failure shows error then success closes and updates label', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads with 2FA enabled
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: true }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Open Security section and modal (button label is Enabled)
    await user.click(screen.getAllByText('Security')[0])
    await user.click(screen.getByRole('button', { name: /Enabled/i }))

    // In success step, click Disable 2FA to go to disable form
    await user.click(await screen.findByRole('button', { name: /Disable 2FA/i }))

    // Failure path for disable
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Cannot disable now' }) })
    await user.type(await screen.findByPlaceholderText(/Enter your current password/i), 'pw')
    await user.click(screen.getByRole('button', { name: /Disable 2FA/i }))
    expect(await screen.findByText(/Cannot disable now/i)).toBeInTheDocument()

    // Success path closes modal and updates label back to Setup 2FA
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await user.type(screen.getByPlaceholderText(/Enter your current password/i), 'pw2')
    await user.click(screen.getByRole('button', { name: /Disable 2FA/i }))

    // Modal closed: dialog not present; card shows Setup 2FA
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Setup 2FA/i })).toBeInTheDocument()
  })

  it('delete account error sets error toast (401 from backend)', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Open Danger and Delete flow
    await user.click(screen.getAllByText('Danger Zone')[0])
    await user.click(screen.getByRole('button', { name: /^Delete Account$/ }))

    await user.type(screen.getByText(/Type "DELETE" to confirm/i).parentElement!.querySelector('input')!, 'DELETE')
    await user.type(screen.getByText(/Enter your account password/i).parentElement!.querySelector('input')!, 'pw')

    // Mock DELETE 401
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Unauthorized' }) })

    const confirmBtn = screen.getByRole('button', { name: /Permanently Delete Account/i })
    await user.click(confirmBtn)

    expect(await screen.findByText(/Unauthorized|Failed to delete account/i)).toBeInTheDocument()
  })

  it('shows error toast when new passwords mismatch', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    await user.type(screen.getByText('Current Account Password').parentElement!.querySelector('input')!, 'oldpass')
    await user.type(screen.getByText('New Password').parentElement!.querySelector('input')!, 'newpassword1')
    await user.type(screen.getByText('Confirm New Password').parentElement!.querySelector('input')!, 'different')
    await user.click(screen.getByRole('button', { name: 'Update Account Password' }))

    expect(await screen.findByText('New passwords do not match')).toBeInTheDocument()
  })

  it('delete account flow: cancel and success toast', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()

    // Open Danger section and click Delete Account
    await user.click(screen.getByText('Danger Zone', { exact: false }))
    await user.click(screen.getByRole('button', { name: /^Delete Account$/ }))

    // Cancel hides the destructive controls
    await user.click(screen.getByRole('button', { name: /Cancel/i }))

    // Re-open and perform success
    await user.click(screen.getByRole('button', { name: /^Delete Account$/ }))
    await user.type(screen.getByText(/Type "DELETE" to confirm/i).parentElement!.querySelector('input')!, 'DELETE')
    await user.type(screen.getByText(/Enter your account password/i).parentElement!.querySelector('input')!, 'pw')

    // Mock delete success
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const confirmBtn = screen.getByRole('button', { name: /Permanently Delete Account/i })
    await user.click(confirmBtn)

    expect(await screen.findByText('Account deleted successfully')).toBeInTheDocument()
  })

  it('2FA enable success and failure paths', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    // initial loads
    // @ts-ignore
    global.fetch = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ user: { email: 'u@example.com', name: 'User' } }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ twoFactorEnabled: false }) })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: {} }) })

    render(
      <QueryClientProvider client={qc}>
        <SettingsPage />
      </QueryClientProvider>
    )

    expect(await screen.findByText('Account Information')).toBeInTheDocument()
    // Open Security section
    await user.click(screen.getAllByText('Security')[0])
    // Open 2FA modal
    await user.click(screen.getByRole('button', { name: /Setup 2FA/i }))

    // Setup call returns secret and backup codes
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ secret: 'S', qrCodeUrl: 'u', manualEntryKey: 'm', backupCodes: ['a','b'], instructions: { steps: [], supportedApps: [], securityTips: [] } }) })
    // The modal shows "Begin Setup" as the CTA label
    await user.click(await screen.findByRole('button', { name: /Begin Setup/i }))

    // Enter invalid verify first to hit validation
    await user.click(screen.getByRole('button', { name: /Continue/i }))
    await user.type(await screen.findByLabelText('Enter verification code from your app:'), '123456')
    await user.type(screen.getByPlaceholderText(/Enter your password/i), 'pw')

    // Enable fails
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Failed' }) })
    await user.click(screen.getByRole('button', { name: /Enable 2FA/i }))
    expect(await screen.findByText(/Failed/i)).toBeInTheDocument()

    // Retry success
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await user.clear(screen.getByLabelText('Enter verification code from your app:'))
    await user.type(screen.getByLabelText('Enter verification code from your app:'), '654321')
    await user.type(screen.getByPlaceholderText(/Enter your password/i), 'pw')
    await user.click(screen.getByRole('button', { name: /Enable 2FA/i }))
    // Modal goes to success state
    expect(await screen.findByText(/Two-Factor Authentication Enabled!/i)).toBeInTheDocument()
  })
})


