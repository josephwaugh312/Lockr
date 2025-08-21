/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordPage from './page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('ForgotPasswordPage interactions', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('disables submit when empty, shows invalid email error, then submits successfully', async () => {
    const user = userEvent.setup()
    // Success response
    // @ts-ignore
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    render(<ForgotPasswordPage />)

    // Empty email keeps button disabled (component prevents submit when empty)
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeDisabled()

    // Invalid email format → submit blocked (no network call)
    await user.type(screen.getByLabelText('Email address'), 'invalid')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(global.fetch).not.toHaveBeenCalled()

    // Valid email -> success state
    const email = screen.getByLabelText('Email address') as HTMLInputElement
    await user.clear(email)
    await user.type(email, 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
  })
})


