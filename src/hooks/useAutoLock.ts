import { useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '../lib/utils'

interface AutoLockConfig {
  autoLockTimeout: number // minutes
  showNotifications: boolean
  onNotification?: (message: string, type: 'success' | 'error' | 'info') => void
  onLock?: () => void
}

export function useAutoLock(config: AutoLockConfig) {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  // Store current config in ref to avoid dependency issues
  const configRef = useRef(config)
  configRef.current = config

  const lockVault = useCallback(async () => {
    try {
      const token = localStorage.getItem('lockr_access_token')
      if (token) {
        // Call backend to clear vault session
        await fetch(`${API_BASE_URL}/vault/lock`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.warn('Failed to lock vault on backend:', error)
    } finally {
      // Always clear local session and redirect
      configRef.current.onLock?.()
      if (configRef.current.showNotifications) {
        configRef.current.onNotification?.('Vault locked due to inactivity', 'info')
      }
      
      // Clear any stored vault session data
      localStorage.removeItem('lockr_vault_session')
      
      // Redirect to dashboard which will show unlock screen
      router.push('/dashboard')
    }
  }, [router])

  const showLockWarning = useCallback(() => {
    if (configRef.current.showNotifications) {
      configRef.current.onNotification?.('Vault will lock in 30 seconds due to inactivity', 'info')
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
  }, [])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    
    // Clear existing timers
    clearTimers()

    // Only set timers if auto-lock is enabled
    if (configRef.current.autoLockTimeout > 0) {
      // Convert minutes to milliseconds
      const lockTimeMs = configRef.current.autoLockTimeout * 60 * 1000
      const warningTimeMs = Math.max(lockTimeMs - 30000, lockTimeMs * 0.8) // 30 seconds before or 80% of timeout

      // Set warning timer
      if (lockTimeMs > 30000) { // Only show warning if timeout is longer than 30 seconds
        warningTimeoutRef.current = setTimeout(showLockWarning, warningTimeMs)
      }

      // Set lock timer
      timeoutRef.current = setTimeout(lockVault, lockTimeMs)
    }
  }, [lockVault, showLockWarning, clearTimers])

  const manualLock = useCallback(() => {
    clearTimers()
    lockVault()
  }, [clearTimers, lockVault])

  // Track user activity
  useEffect(() => {
    
    if (config.autoLockTimeout <= 0) {
      return // Auto-lock disabled
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      resetTimer()
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Start timer
    resetTimer()

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      clearTimers()
    }
  }, [config.autoLockTimeout, resetTimer, clearTimers])

  return {
    manualLock,
    resetTimer,
    clearTimers
  }
} 