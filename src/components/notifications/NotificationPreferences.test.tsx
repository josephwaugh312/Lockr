/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationPreferences from './NotificationPreferences'

describe('NotificationPreferences', () => {
  const defaultPrefs = {
    securityAlerts: true,
    passwordExpiry: false,
    breachAlerts: true,
    vaultActivity: false,
    accountUpdates: false,
    systemMaintenance: true,
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders titles for settings', () => {
    render(
      <NotificationPreferences
        preferences={defaultPrefs}
        onUpdate={() => {}}
      />
    )
    expect(screen.getByText('Security Alerts')).toBeInTheDocument()
    expect(screen.getByText('Password Expiry')).toBeInTheDocument()
    expect(screen.getByText('Data Breach Alerts')).toBeInTheDocument()
    expect(screen.getByText('Vault Activity')).toBeInTheDocument()
    expect(screen.getByText('Account Updates')).toBeInTheDocument()
    expect(screen.getByText('System Maintenance')).toBeInTheDocument()
  })

  it('shows loading state when isLoading is true', () => {
    render(
      <NotificationPreferences
        preferences={defaultPrefs}
        onUpdate={() => {}}
        isLoading={true}
      />
    )
    
    // Should show loading skeletons instead of content
    expect(screen.queryByText('Security Alerts')).not.toBeInTheDocument()
    // Should show 6 loading skeleton items
    const loadingElements = document.querySelectorAll('.animate-pulse .h-16')
    expect(loadingElements).toHaveLength(6)
  })

  it('handles test notification when onTestNotification is provided', async () => {
    const mockOnTestNotification = jest.fn().mockResolvedValue(undefined)
    
    render(
      <NotificationPreferences
        preferences={defaultPrefs}
        onUpdate={() => {}}
        onTestNotification={mockOnTestNotification}
      />
    )
    
    // Find and click the first test button
    const testButtons = screen.getAllByText('Test')
    fireEvent.click(testButtons[0])
    
    expect(mockOnTestNotification).toHaveBeenCalled()
    
    // Should show "Testing..." while in progress
    await waitFor(() => {
      expect(screen.getByText('Testing...')).toBeInTheDocument()
    })
  })

  it('handles test notification error gracefully', async () => {
    const mockOnTestNotification = jest.fn().mockRejectedValue(new Error('Test failed'))
    
    render(
      <NotificationPreferences
        preferences={defaultPrefs}
        onUpdate={() => {}}
        onTestNotification={mockOnTestNotification}
      />
    )
    
    const testButtons = screen.getAllByText('Test')
    fireEvent.click(testButtons[0])
    
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to send test notification:', expect.any(Error))
    })
  })

  it('does not call onTestNotification when not provided', async () => {
    render(
      <NotificationPreferences
        preferences={defaultPrefs}
        onUpdate={() => {}}
        // onTestNotification is not provided
      />
    )
    
    // Test buttons should not be visible when onTestNotification is not provided
    expect(screen.queryByText('Test')).not.toBeInTheDocument()
  })
})


