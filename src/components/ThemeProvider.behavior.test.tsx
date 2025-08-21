/** @jest-environment jsdom */
import React from 'react'
import { render } from '@testing-library/react'
import ThemeProvider from './ThemeProvider'

describe('ThemeProvider behavior', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    // Reset matchMedia for clean tests
    delete (window as any).matchMedia
  })

  it('applies dark theme and compact mode from localStorage', () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k === 'lockr_theme' ? 'dark' : k === 'lockr_compact_view' ? 'true' : null),
      },
      configurable: true,
    })

    render(
      <ThemeProvider>
        <div>App</div>
      </ThemeProvider>
    )

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('compact-mode')).toBe(true)
  })

  it('applies light theme from localStorage', () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k === 'lockr_theme' ? 'light' : k === 'lockr_compact_view' ? 'false' : null),
      },
      configurable: true,
    })

    render(
      <ThemeProvider>
        <div>App</div>
      </ThemeProvider>
    )

    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('compact-mode')).toBe(false)
  })

  it('applies system theme when matchMedia prefers dark', () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k === 'lockr_theme' ? 'system' : null),
      },
      configurable: true,
    })

    window.matchMedia = jest.fn(() => ({
      matches: true, // prefers dark
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })) as any

    render(
      <ThemeProvider>
        <div>App</div>
      </ThemeProvider>
    )

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('handles system theme change events', () => {
    let changeHandler: (e: MediaQueryListEvent) => void

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k === 'lockr_theme' ? 'system' : null),
      },
      configurable: true,
    })

    window.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn((event, handler) => {
        changeHandler = handler
      }),
      removeEventListener: jest.fn(),
    })) as any

    render(
      <ThemeProvider>
        <div>App</div>
      </ThemeProvider>
    )

    // Simulate system theme change to dark
    changeHandler({ matches: true } as MediaQueryListEvent)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)

    // Simulate system theme change to light
    changeHandler({ matches: false } as MediaQueryListEvent)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})


