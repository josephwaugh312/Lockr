/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import VerifyRequired from './page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))

describe('Verify Required page', () => {
  it('renders content', () => {
    render(<VerifyRequired />)
    expect(screen.getAllByText(/verify/i).length).toBeGreaterThan(0)
  })
})


