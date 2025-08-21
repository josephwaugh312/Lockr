/** @jest-environment jsdom */
import React, { useEffect } from 'react'
import { render, act } from '@testing-library/react'
import { useAutoLock } from '@/hooks/useAutoLock'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush })
}))

function HookHarness({
  config,
  onReady,
}: {
  config: Parameters<typeof useAutoLock>[0]
  onReady: (api: ReturnType<typeof useAutoLock>) => void
}) {
  const api = useAutoLock(config)
  useEffect(() => { onReady(api) }, [api])
  return null
}

describe('useAutoLock', () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch.mockReset()
    localStorage.clear()
    mockPush.mockClear()
  })

  it('sets timers and triggers lock after timeout', async () => {
    const onNotification = jest.fn()
    const onLock = jest.fn()
    const config = { autoLockTimeout: 0.001, showNotifications: true, onNotification, onLock }

    localStorage.setItem('lockr_access_token', 'token')
    // First POST to /vault/lock
    // @ts-ignore
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    let api: ReturnType<typeof useAutoLock> | undefined
    // Use fake timers BEFORE rendering so the hook's timers are controlled
    jest.useFakeTimers()
    render(<HookHarness config={config} onReady={(a) => { api = a }} />)

    // Advance beyond ~60ms
    await act(async () => { jest.advanceTimersByTime(100) })
    jest.useRealTimers()

    expect(onLock).toHaveBeenCalled()
    expect(onNotification).toHaveBeenCalledWith('Vault locked due to inactivity', 'info')
    expect(localStorage.getItem('lockr_vault_session')).toBeNull()
    expect(mockPush).toHaveBeenCalledWith('/dashboard')

    // Ensure API object exists and clearTimers is callable
    expect(api).toBeDefined()
  })

  it('manualLock clears timers and locks immediately', async () => {
    const onLock = jest.fn()
    const config = { autoLockTimeout: 5, showNotifications: false, onLock }
    // @ts-ignore
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    let api!: ReturnType<typeof useAutoLock>
    render(<HookHarness config={config} onReady={(a) => { api = a }} />)

    await act(async () => { api.manualLock() })

    expect(onLock).toHaveBeenCalled()
  })
})


