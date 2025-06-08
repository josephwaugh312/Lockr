import { useCallback, useRef, useState, useEffect } from 'react'

interface ClipboardManagerConfig {
  clipboardTimeout: number // seconds
  showNotifications: boolean
  onNotification?: (message: string, type: 'success' | 'error' | 'info') => void
}

export function useClipboardManager(config: ClipboardManagerConfig) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [lastCopiedValue, setLastCopiedValue] = useState<string | null>(null)

  const copyToClipboard = useCallback(async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setLastCopiedValue(text)
      
      // Show success notification
      config.onNotification?.(`${type} copied to clipboard!`, 'success')
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Set timeout to clear clipboard if enabled
      if (config.clipboardTimeout > 0) {
        timeoutRef.current = setTimeout(async () => {
          try {
            // Only clear if the clipboard still contains our value
            const currentClipboard = await navigator.clipboard.readText()
            if (currentClipboard === text) {
              await navigator.clipboard.writeText('')
              if (config.showNotifications) {
                config.onNotification?.('Clipboard cleared for security', 'info')
              }
            }
          } catch (error) {
            console.warn('Could not clear clipboard:', error)
          }
          setLastCopiedValue(null)
          timeoutRef.current = null
        }, config.clipboardTimeout * 1000)
      }
      
      console.log(`${type} copied to clipboard`)
    } catch (err) {
      console.error('Failed to copy:', err)
      config.onNotification?.(`Failed to copy ${type.toLowerCase()}`, 'error')
    }
  }, [config])

  const clearClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('')
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setLastCopiedValue(null)
      if (config.showNotifications) {
        config.onNotification?.('Clipboard cleared', 'info')
      }
    } catch (error) {
      console.warn('Could not clear clipboard:', error)
    }
  }, [config])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    copyToClipboard,
    clearClipboard,
    lastCopiedValue,
    isClipboardActive: !!timeoutRef.current
  }
} 