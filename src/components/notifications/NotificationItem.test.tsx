/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import NotificationItem from './NotificationItem'

const mockMarkAsRead = jest.fn()
const mockDeleteNotification = jest.fn()

jest.mock('@/hooks/useNotifications', () => ({
  useMarkAsRead: () => ({ mutateAsync: mockMarkAsRead, isPending: false }),
  useDeleteNotification: () => ({ mutateAsync: mockDeleteNotification, isPending: false }),
}))

const baseNotification = {
  id: 'n1',
  title: 'Test Notification',
  message: 'Hello world',
  type: 'system',
  priority: 'low',
  read: false,
  created_at: new Date().toISOString(),
}

describe('NotificationItem', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders title and message', () => {
    render(<NotificationItem notification={baseNotification as any} showActions={false} />)
    expect(screen.getByText('Test Notification')).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('handles delete error gracefully', async () => {
    const deleteError = new Error('Delete failed')
    mockDeleteNotification.mockRejectedValueOnce(deleteError)
    
    render(<NotificationItem notification={baseNotification as any} showActions={true} />)
    
    const deleteButton = screen.getByTitle('Delete notification')
    fireEvent.click(deleteButton)
    
    // Wait for the async operation and error to be caught
    await new Promise((resolve) => {
      setTimeout(() => {
        expect(console.error).toHaveBeenCalledWith('Failed to delete notification:', deleteError)
        resolve(undefined)
      }, 100)
    })
  })

  it('renders null for breach data without matching conditions', () => {
    const breachNotification = {
      ...baseNotification,
      type: 'breach_alert',
      subtype: 'data_breach_alert',
      data: {
        // Data that doesn't match any condition (no breachName, no checkType, no totalBreaches)
        someUnknownField: 'value'
      }
    }
    
    const { container } = render(<NotificationItem notification={breachNotification as any} showActions={false} />)
    
    // The renderBreachDetails should return null for data without matching conditions
    // Check that no breach-specific content is rendered
    expect(container.querySelector('.bg-red-50')).toBeNull()
    expect(container.querySelector('.bg-blue-50')).toBeNull()
  })

  it('handles mark as read error gracefully', async () => {
    const readError = new Error('Mark read failed')
    mockMarkAsRead.mockRejectedValueOnce(readError)
    
    const unreadNotification = {
      ...baseNotification,
      read: false
    }
    
    render(<NotificationItem notification={unreadNotification as any} showActions={true} />)
    
    // Click the mark as read button
    const markAsReadButton = screen.getByTitle('Mark as read')
    fireEvent.click(markAsReadButton)
    
    // Wait for the async operation and error to be caught
    await new Promise((resolve) => {
      setTimeout(() => {
        expect(console.error).toHaveBeenCalledWith('Failed to mark as read:', readError)
        resolve(undefined)
      }, 100)
    })
  })
})


