/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import AuthRegisterRedirect from './page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }))

describe('AuthRegisterRedirect', () => {
  it('renders redirect message', () => {
    render(<AuthRegisterRedirect />)
    expect(screen.getByText('Redirecting to signup page...')).toBeInTheDocument()
  })
})


