/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import ForgotMasterPasswordPage from './page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('ForgotMasterPasswordPage', () => {
  it('renders heading', () => {
    render(<ForgotMasterPasswordPage />)
    expect(screen.getByText('Forgot your master password?')).toBeInTheDocument()
  })
})


