/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VerifyRequiredPage from './page'

describe('VerifyRequiredPage interactions', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn()
    localStorage.clear()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('shows manual entry when unauthenticated and sends verification', async () => {
    const user = userEvent.setup()
    // No token in storage
    const getItem = jest.fn(() => null)
    Object.defineProperty(window, 'localStorage', { value: { getItem }, configurable: true })

    // Successful resend
    // @ts-ignore
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })

    render(<VerifyRequiredPage />)

    // Enter email and click send
    const email = await screen.findByLabelText('Email Address')
    await user.type(email, 'verify@example.com')
    const sendBtn = screen.getByRole('button', { name: /Send Verification Email/i })
    await user.click(sendBtn)
    expect(global.fetch).toHaveBeenCalled()
  })
})


