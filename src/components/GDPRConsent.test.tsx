/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import GDPRConsent from './GDPRConsent'
jest.mock('next/link', () => ({ children, href }: any) => <a href={href}>{children}</a>)

describe('GDPRConsent', () => {
  it('renders consent checkbox and policies', () => {
    const onChange = jest.fn()
    render(<GDPRConsent onConsentChange={onChange} />)
    expect(screen.getByLabelText(/consent/i)).toBeInTheDocument()
    expect(screen.getByText(/privacy policy/i)).toBeInTheDocument()
    expect(screen.getByText(/cookie policy/i)).toBeInTheDocument()
  })
})


