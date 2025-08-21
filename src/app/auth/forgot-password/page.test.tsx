/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import ForgotPasswordPage from './page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('ForgotPasswordPage', () => {
  it('renders heading', () => {
    render(<ForgotPasswordPage />)
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument()
  })
})


