/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CookieConsentWrapper from './CookieConsentWrapper'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ 
  useRouter: () => ({ push: mockPush }) 
}))

jest.mock('./CookieConsentBanner', () => ({ onAccept, onDecline, onCustomize }: any) => (
  <div>
    <button onClick={onAccept}>Accept</button>
    <button onClick={onDecline}>Decline</button>
    <button onClick={onCustomize}>Customize</button>
    <div>Cookie Banner</div>
  </div>
))

describe('CookieConsentWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders banner proxy', () => {
    render(<CookieConsentWrapper />)
    expect(screen.getByText('Cookie Banner')).toBeInTheDocument()
  })

  it('handles accept button click', () => {
    render(<CookieConsentWrapper />)
    fireEvent.click(screen.getByText('Accept'))
    expect(console.log).toHaveBeenCalledWith('Cookies accepted')
  })

  it('handles decline button click', () => {
    render(<CookieConsentWrapper />)
    fireEvent.click(screen.getByText('Decline'))
    expect(console.log).toHaveBeenCalledWith('Cookies declined')
  })

  it('handles customize button click', () => {
    render(<CookieConsentWrapper />)
    fireEvent.click(screen.getByText('Customize'))
    expect(console.log).toHaveBeenCalledWith('Cookie customization requested')
    expect(mockPush).toHaveBeenCalledWith('/cookies?section=manage')
  })
})


