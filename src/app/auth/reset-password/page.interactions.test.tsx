/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPasswordPage from './page'

const stableParams = {
  get: (key: string) => (key === 'token' ? 'a'.repeat(64) : null)
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => stableParams,
}))

describe('ResetPasswordPage interactions', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('validates password, mismatched confirm, then succeeds', async () => {
    const user = userEvent.setup()
    // @ts-ignore
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    render(<ResetPasswordPage />)

    // Too weak password
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'short')
    await user.click(screen.getByRole('button', { name: /reset password/i }))
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()

    // Strong password but mismatch
    const newPwd = screen.getByLabelText('New password') as HTMLInputElement
    await user.clear(newPwd)
    await user.type(newPwd, 'StrongPass123!')
    const confirm = screen.getByLabelText('Confirm new password') as HTMLInputElement
    await user.clear(confirm)
    await user.type(confirm, 'Different123!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()

    // Match and succeed
    await user.clear(confirm)
    await user.type(confirm, 'StrongPass123!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))
    // Success view header appears after successful POST
    expect(await screen.findByRole('heading', { name: /Password reset successful/i })).toBeInTheDocument()
  })
})


