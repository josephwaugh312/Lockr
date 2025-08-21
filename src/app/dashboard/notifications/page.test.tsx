/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationsPage from './page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))

// Dynamic mocks configurable per-test (prefix with mock* to appease Jest)
let mockHooks: any = {
  notificationsData: [],
  unreadCount: 0,
  stats: { total: 0, unread: 0, security_alerts: 0, critical: 0 },
  isLoading: false,
  refetch: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteAll: jest.fn(),
  markOne: jest.fn(),
  deleteOne: jest.fn(),
}
jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({ data: { data: mockHooks.notificationsData }, isLoading: mockHooks.isLoading, refetch: mockHooks.refetch }),
  useUnreadCount: () => ({ data: { data: { unreadCount: mockHooks.unreadCount } }, refetch: jest.fn() }),
  useNotificationStats: () => ({ data: { data: mockHooks.stats }, refetch: jest.fn() }),
  useMarkAllAsRead: () => ({ mutateAsync: mockHooks.markAllAsRead, isPending: false }),
  useDeleteAllNotifications: () => ({ mutateAsync: mockHooks.deleteAll, isPending: false }),
  useMarkAsRead: () => ({ mutateAsync: mockHooks.markOne, isPending: false }),
  useDeleteNotification: () => ({ mutateAsync: mockHooks.deleteOne, isPending: false }),
  NOTIFICATION_QUERY_KEYS: { all: ['notifications'] },
}))

let mockStore: any = {
  notifications: [],
  unreadCount: 0,
  stats: { total: 0, unread: 0, security_alerts: 0, critical: 0 },
}
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => mockStore
}))

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }))

describe('NotificationsPage', () => {
  it('renders header', () => {
    render(<NotificationsPage />)
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('filters and triggers header actions', async () => {
    const user = userEvent.setup()
    // Configure dynamic mocks
    mockStore.notifications = [
      { id: '1', user_id: 'test-user', type: 'account', subtype: 'x', title: 'Alpha', message: 'hello', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '2', user_id: 'test-user', type: 'security', subtype: 'x', title: 'Beta', message: 'world', data: {}, priority: 'high', read: true, read_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
    mockStore.unreadCount = 1
    mockStore.stats = { total: 2, unread: 1, security_alerts: 1, critical: 0 }
    mockHooks.unreadCount = 1
    mockHooks.stats = { total: 2, unread: 1, security_alerts: 1, critical: 0 }
    mockHooks.notificationsData = []

    render(<NotificationsPage />)

    // Filter by type
    await user.selectOptions(screen.getByDisplayValue('All Types'), ['Security'])
    expect(await screen.findByText('Beta')).toBeInTheDocument()

    // Search clears list
    const search = screen.getByPlaceholderText('Search notifications...')
    await user.clear(search)
    await user.type(search, 'Alpha')
    expect(await screen.findByText('No matching notifications')).toBeInTheDocument()

    await user.clear(search)

    // Refresh
    await user.click(screen.getByText(/Refresh/))

    // Mark all read visible and clickable
    await user.click(screen.getByText(/Mark All Read/))

    // Delete all confirmation
    await user.click(screen.getByText(/Delete All/))
    expect(await screen.findByText(/Confirm Deletion/)).toBeInTheDocument()
    await user.click(screen.getByText('Cancel'))
  })
})


