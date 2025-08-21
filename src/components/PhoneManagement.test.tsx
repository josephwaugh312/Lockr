/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import PhoneManagement from './PhoneManagement'

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({ hasPhoneNumber: false }) })) as any

describe('PhoneManagement', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => 'token' },
      configurable: true,
    })
  })

  it('renders heading', () => {
    render(<PhoneManagement />)
    expect(screen.getAllByText('Phone Number').length).toBeGreaterThan(0)
  })
})


