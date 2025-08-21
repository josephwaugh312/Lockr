/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotMasterPasswordPage from './page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('ForgotMasterPasswordPage interactions', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('requires confirmation checkbox and submits successfully', async () => {
    const user = userEvent.setup()
    // @ts-ignore
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    render(<ForgotMasterPasswordPage />)

    // Enter email but do not confirm: button remains disabled
    await user.type(screen.getByLabelText('Email address'), 'user@example.com')
    expect(screen.getByRole('button', { name: /send master password reset link/i })).toBeDisabled()

    // Confirm and submit
    await user.click(screen.getByLabelText(/I understand that ALL my vault data/))
    await user.click(screen.getByRole('button', { name: /send master password reset link/i }))
    expect(await screen.findByText('Check your email')).toBeInTheDocument()
  })
})


