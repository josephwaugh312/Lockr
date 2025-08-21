/** @jest-environment jsdom */
import React, { useEffect } from 'react'
import { render, screen, act } from '@testing-library/react'
import { useClipboardManager } from '@/hooks/useClipboardManager'

// we'll switch timers inside tests to avoid conflicting with global setup hooks

function HookHarness({
  config,
  onReady,
}: {
  config: Parameters<typeof useClipboardManager>[0]
  onReady: (api: ReturnType<typeof useClipboardManager>) => void
}) {
  const api = useClipboardManager(config)
  useEffect(() => { onReady(api) }, [api])
  return null
}

describe('useClipboardManager', () => {
  beforeEach(() => {
    // defaults from test setup already mock navigator.clipboard
    ;(navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined)
    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValue('')
  })

  it('copies to clipboard and schedules clear', async () => {
    const onNotification = jest.fn()
    const config = { clipboardTimeout: 0.05, showNotifications: true, onNotification }
    let api!: ReturnType<typeof useClipboardManager>
    render(<HookHarness config={config} onReady={(a) => { api = a }} />)

    // Enable fake timers before scheduling the timeout in the hook
    jest.useFakeTimers()
    await act(async () => { await api.copyToClipboard('secret', 'Password') })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('secret')
    expect(onNotification).toHaveBeenCalledWith('Password copied to clipboard!', 'success')

    // Simulate that clipboard still has the value when timeout fires
    ;(navigator.clipboard.readText as jest.Mock).mockResolvedValue('secret')

    await act(async () => { jest.advanceTimersByTime(1000) })
    jest.runOnlyPendingTimers()
    jest.useRealTimers()

    // First call wrote 'secret', second should clear to ''
    const calls = (navigator.clipboard.writeText as jest.Mock).mock.calls
    expect(calls[calls.length - 1][0]).toBe('')
  })

  it('handles copy failure gracefully', async () => {
    // Increase timeout for this test as global DB hooks are present in setup
    jest.setTimeout(20000)
    const onNotification = jest.fn()
    const config = { clipboardTimeout: 0, showNotifications: true, onNotification }
    let api!: ReturnType<typeof useClipboardManager>
    render(<HookHarness config={config} onReady={(a) => { api = a }} />)

    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('denied'))

    await act(async () => { await api.copyToClipboard('x', 'Password') })

    expect(onNotification).toHaveBeenCalledWith('Failed to copy password', 'error')
  })
})


