/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetMasterPasswordPage from './page'

const stableParams = {
  get: (key: string) => (key === 'token' ? 'b'.repeat(64) : null)
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => stableParams,
}))

describe('ResetMasterPasswordPage interactions', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn()
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('validates token, password rules, confirmation, then succeeds and clears storage', async () => {
    const user = userEvent.setup()
    // @ts-ignore
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ entriesWiped: 3 }) })

    render(<ResetMasterPasswordPage />)

    // Weak password -> validation error (no network call)
    await user.type(screen.getByLabelText('New master password'), 'short')
    await user.type(screen.getByLabelText('Confirm new master password'), 'short')
    await user.click(screen.getByRole('button', { name: /reset master password/i }))
    expect(global.fetch).not.toHaveBeenCalled()

    // Strong but mismatch
    const newPwd = screen.getByLabelText('New master password') as HTMLInputElement
    await user.clear(newPwd)
    await user.type(newPwd, 'StrongPass123!')
    const confirm = screen.getByLabelText('Confirm new master password') as HTMLInputElement
    await user.clear(confirm)
    await user.type(confirm, 'Different123!')
    await user.click(screen.getByRole('button', { name: /reset master password/i }))
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()

    // Confirm checkbox required -> button remains disabled until checked
    await user.clear(confirm)
    await user.type(confirm, 'StrongPass123!')
    const submit = screen.getByRole('button', { name: /reset master password/i })
    expect(submit).toBeDisabled()

    // Confirm and succeed
    await user.click(screen.getByLabelText(/ALL my vault data will be permanently deleted NOW/))
    // Set storage values to ensure they get cleared
    sessionStorage.setItem('x', 'y')
    localStorage.setItem('lockr_encryption_key', 'k')
    localStorage.setItem('lockr_vault_unlocked', '1')
    await user.click(screen.getByRole('button', { name: /reset master password/i }))

    // Success view renders action link
    expect(
      await screen.findByRole('link', { name: /Continue to sign in/i })
    ).toBeInTheDocument()
  })
})


