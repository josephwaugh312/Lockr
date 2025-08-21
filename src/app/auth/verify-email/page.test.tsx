/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import VerifyEmailPage from './page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }))
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => null },
      configurable: true,
    })
  })

  it('renders default heading', () => {
    render(<VerifyEmailPage />)
    expect(screen.getByText('Verify Your Email')).toBeInTheDocument()
  })
})


