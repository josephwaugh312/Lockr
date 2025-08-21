/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import NotificationItem from '@/components/notifications/NotificationItem'
import { useNotificationStore } from '@/stores/notificationStore'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('NotificationItem behavior', () => {
  beforeEach(() => {
    localStorage.setItem('lockr_access_token', 'token')
    useNotificationStore.getState().clearAll()
  })

  afterEach(() => {
    localStorage.clear()
  })

  test('mark as read and delete actions update store for mock', async () => {
    const user = userEvent.setup()
    const onAction = jest.fn()
    const n = {
      id: 'n2', user_id: 'test-user', type: 'account', subtype: 'welcome', title: 'Hi', message: 'm', data: {}, priority: 'low', read: false, read_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
    const qc = new QueryClient()
    // Seed the store so the hook treats this as a mock notification and avoids network
    const { addNotification } = useNotificationStore.getState()
    addNotification(n as any)
    render(
      <QueryClientProvider client={qc}>
        <NotificationItem notification={n as any} onAction={onAction} />
      </QueryClientProvider>
    )

    // Mark as read
    await user.click(screen.getByTitle('Mark as read'))
    expect(onAction).toHaveBeenCalledWith('read', 'n2')

    // Delete
    await user.click(screen.getByTitle('Delete notification'))
    expect(onAction).toHaveBeenCalledWith('delete', 'n2')
  })
})


