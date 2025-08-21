/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import NotificationBell from '@/components/notifications/NotificationBell'
import { useNotificationStore } from '@/stores/notificationStore'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('NotificationBell behavior', () => {
  beforeEach(() => {
    localStorage.setItem('lockr_access_token', 'token')
    useNotificationStore.getState().clearAll()
  })

  afterEach(() => {
    localStorage.clear()
  })

  test('renders bell and toggles dropdown', async () => {
    const user = userEvent.setup()
    const { addNotification, setUnreadCount } = useNotificationStore.getState()
    addNotification({
      id: 'n1', user_id: 'test-user', type: 'account', subtype: 'welcome', title: 'Hello', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    })
    setUnreadCount(1)

    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <NotificationBell />
      </QueryClientProvider>
    )

    const bell = screen.getByRole('button')
    await user.click(bell)

    // Dropdown content should appear
    expect(await screen.findByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})


