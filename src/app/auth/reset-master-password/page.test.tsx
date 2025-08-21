/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import ResetMasterPasswordPage from './page'

const stableParams = { get: () => null }
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => stableParams,
}))

describe('ResetMasterPasswordPage', () => {
  it('renders form heading', () => {
    render(<ResetMasterPasswordPage />)
    expect(screen.getByText('Set new master password')).toBeInTheDocument()
  })
})


