'use client'

import { useEffect } from 'react'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme immediately from localStorage to prevent flash
    const savedTheme = localStorage.getItem('lockr_theme') || 'system'
    const savedCompactView = localStorage.getItem('lockr_compact_view') === 'true'
    
    const root = document.documentElement
    
    // Apply theme
    if (savedTheme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else if (savedTheme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else { // system
      root.classList.remove('light', 'dark')
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.add('light')
      }
    }
    
    // Apply compact view
    if (savedCompactView) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (savedTheme === 'system') {
        const root = document.documentElement
        if (e.matches) {
          root.classList.add('dark')
          root.classList.remove('light')
        } else {
          root.classList.add('light')
          root.classList.remove('dark')
        }
      }
    }
    
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  return <>{children}</>
} 