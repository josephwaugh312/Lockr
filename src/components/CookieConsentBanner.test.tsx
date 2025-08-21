/** @jest-environment jsdom */
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import CookieConsentBanner from './CookieConsentBanner'

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // Ensure no prior consent stored
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {},
      },
      configurable: true,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows and accepts', () => {
    const onAccept = jest.fn()
    const onDecline = jest.fn()
    const onCustomize = jest.fn()

    render(<CookieConsentBanner onAccept={onAccept} onDecline={onDecline} onCustomize={onCustomize} />)

    act(() => {
      jest.advanceTimersByTime(1050)
    })

    expect(screen.getByText('We use cookies to enhance your experience')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Accept All'))

    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(onAccept).toHaveBeenCalled()
  })
})


