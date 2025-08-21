/** @jest-environment jsdom */
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import NotificationToast from './NotificationToast'

describe('NotificationToast', () => {
  afterEach(() => {
    jest.useRealTimers()
  })
  it('renders message', () => {
    render(<NotificationToast message="Hello" type="success" onDismiss={() => {}} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('applies success styles and auto-dismisses after delay', () => {
    jest.useFakeTimers()
    const onDismiss = jest.fn()
    render(<NotificationToast message="Saved" type="success" onDismiss={onDismiss} hideDelay={1000} />)
    const msg = screen.getByText('Saved')
    expect(msg).toBeInTheDocument()

    // Container should include success styling
    const closeBtn = screen.getByRole('button')
    expect(closeBtn.className).toMatch(/text-green-600/)

    // Advance main hide timer and fade-out timer
    act(() => {
      jest.advanceTimersByTime(1200)
    })
    expect(onDismiss).toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('applies error styles', () => {
    const onDismiss = jest.fn()
    render(<NotificationToast message="Nope" type="error" onDismiss={onDismiss} autoHide={false} />)
    const msg = screen.getByText('Nope')
    expect(msg).toBeInTheDocument()
    const closeBtn = screen.getByRole('button')
    expect(closeBtn.className).toMatch(/text-red-600/)
  })

  it('applies info styles', () => {
    const onDismiss = jest.fn()
    render(<NotificationToast message="Heads up" type="info" onDismiss={onDismiss} autoHide={false} />)
    const msg = screen.getByText('Heads up')
    expect(msg).toBeInTheDocument()
    const closeBtn = screen.getByRole('button')
    expect(closeBtn.className).toMatch(/text-blue-600/)
  })

  it('does not auto-dismiss when autoHide is false', () => {
    jest.useFakeTimers()
    const onDismiss = jest.fn()
    render(<NotificationToast message="Stay" type="info" onDismiss={onDismiss} autoHide={false} />)
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('dismisses when close button is clicked', () => {
    jest.useFakeTimers()
    const onDismiss = jest.fn()
    render(<NotificationToast message="Bye" type="info" onDismiss={onDismiss} autoHide={false} />)
    const close = screen.getByRole('button')
    fireEvent.click(close)
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('returns null when message is null', () => {
    const { container } = render(<NotificationToast message={null} type="info" onDismiss={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('hides toast when message changes to null', () => {
    const { rerender } = render(<NotificationToast message="Initial" type="info" onDismiss={() => {}} />)
    expect(screen.getByText('Initial')).toBeInTheDocument()
    
    // Change message to null
    rerender(<NotificationToast message={null} type="info" onDismiss={() => {}} />)
    expect(screen.queryByText('Initial')).not.toBeInTheDocument()
  })

  it('handles unknown type with default styles', () => {
    const onDismiss = jest.fn()
    // Use an invalid type to trigger default cases
    render(<NotificationToast message="Unknown" type={'unknown' as any} onDismiss={onDismiss} autoHide={false} />)
    const msg = screen.getByText('Unknown')
    expect(msg).toBeInTheDocument()
    
    // Should use blue (info) styles as default
    const closeBtn = screen.getByRole('button')
    expect(closeBtn.className).toMatch(/text-blue-600/)
  })
})


