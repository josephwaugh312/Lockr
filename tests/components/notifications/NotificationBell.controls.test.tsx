/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NotificationBell from '@/components/notifications/NotificationBell'

// Mock hooks to control behavior
jest.mock('@/hooks/useNotifications', () => {
  const actual = jest.requireActual('@/hooks/useNotifications')
  return {
    ...actual,
    useUnreadCount: () => ({ data: { data: { unreadCount: 2 } } }),
    useNotifications: () => ({ data: { data: [
      { id: 'a', user_id: 'test-user', type: 'account', subtype: 'welcome', title: 'A', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'b', user_id: 'test-user', type: 'system', subtype: 'info', title: 'B', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'c', user_id: 'test-user', type: 'account', subtype: 'x', title: 'C', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'd', user_id: 'test-user', type: 'account', subtype: 'x', title: 'D', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'e', user_id: 'test-user', type: 'account', subtype: 'x', title: 'E', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'f', user_id: 'test-user', type: 'account', subtype: 'x', title: 'F', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ] }, isLoading: false, error: null, refetch: jest.fn() }),
    useMarkAllAsRead: () => ({ mutateAsync: jest.fn().mockResolvedValue({ data: { updatedCount: 2 } }), isPending: false }),
  }
})

describe('NotificationBell controls', () => {
  beforeEach(() => localStorage.setItem('lockr_access_token', 't'))
  afterEach(() => localStorage.clear())

  test('mark all as read and view all buttons', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NotificationBell />
      </QueryClientProvider>
    )

    // Open dropdown
    await user.click(screen.getByRole('button'))

    // Mark all as read visible because unread > 0
    const markAll = await screen.findByTitle('Mark all as read')
    await user.click(markAll)

    // View all button appears because > 5 notifications
    expect(await screen.findByText(/View All Notifications/)).toBeInTheDocument()
  })
})


