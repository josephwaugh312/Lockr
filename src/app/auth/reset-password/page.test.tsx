/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import ResetPasswordPage from './page'

const stableParams = { get: () => null }
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => stableParams,
}))

describe('ResetPasswordPage', () => {
  it('renders form heading', () => {
    render(<ResetPasswordPage />)
    expect(screen.getByText('Set new password')).toBeInTheDocument()
  })
})


