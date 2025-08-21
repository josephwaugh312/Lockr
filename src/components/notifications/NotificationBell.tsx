'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Settings, Eye, Trash2 } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import { useUnreadCount, useNotifications, useMarkAllAsRead, useMarkAsRead, useDeleteNotification } from '@/hooks/useNotifications'
import NotificationItem from './NotificationItem'
import { useRouter } from 'next/navigation'

interface NotificationBellProps {
  className?: string
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [buttonPosition, setButtonPosition] = useState({ 
    top: 0, 
    right: 0 as number | 'auto', 
    left: 'auto' as number | 'auto' 
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  
  const { notifications, unreadCount } = useNotificationStore()
  
  // Check authentication status
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('lockr_access_token')

  // Only fetch data when dropdown is open or when we need unread count
  const { data: unreadCountData } = useUnreadCount()
  const { data: notificationsData, isLoading: notificationsLoading, error: notificationsError, refetch: refetchNotifications } = useNotifications({ 
    limit: 10 
  })
  const markAllAsReadMutation = useMarkAllAsRead()
  const markAsReadMutation = useMarkAsRead()
  const deleteNotificationMutation = useDeleteNotification()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleScroll = () => {
      if (isOpen) {
        updateButtonPosition()
      }
    }

    const handleResize = () => {
      if (isOpen) {
        updateButtonPosition()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [isOpen])

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const updateButtonPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const width = window.innerWidth
      const height = window.innerHeight
      
      // Tablet vertical: 768 x 953 or similar proportions
      const isTabletVertical = width >= 768 && width <= 1024 && height > width
      const isMobile = width < 768
      const shouldUseMobileLayout = isMobile || isTabletVertical
      
      const dropdownWidth = 384 // w-96 = 24rem = 384px
      
      if (shouldUseMobileLayout) {
        // On mobile/tablet vertical, center the dropdown horizontally with some padding
        const viewportWidth = window.innerWidth
        const padding = 16 // 1rem padding on each side
        const availableWidth = viewportWidth - (padding * 2)
        const actualDropdownWidth = Math.min(dropdownWidth, availableWidth)
        
        // Center the dropdown
        const left = (viewportWidth - actualDropdownWidth) / 2
        
        setButtonPosition({
          top: rect.bottom + 8,
          left: left,
          right: 'auto' // Don't use right positioning on mobile/tablet
        })
      } else {
        // Desktop positioning (align to right edge of button)
        setButtonPosition({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
          left: 'auto'
        })
      }
    }
  }

  const handleToggleDropdown = () => {
    if (!isOpen) {
      updateButtonPosition()
      // Refetch notifications when opening dropdown
      setTimeout(() => {
        refetchNotifications()
      }, 100)
    }
    setIsOpen(!isOpen)
  }

  // Combine API data with local store data for test notifications
  const apiNotifications = notificationsData?.data || []
  const localNotifications = notifications || []
  
  // Merge notifications, prioritizing API data but including local test notifications
  const allNotifications = [...apiNotifications]
  
  // Add local notifications that aren't already in API data
  localNotifications.forEach(localNotif => {
    const exists = apiNotifications.some(apiNotif => apiNotif.id === localNotif.id)
    if (!exists) {
      allNotifications.unshift(localNotif) // Add to beginning
    }
  })
  
  const recentNotifications = allNotifications.slice(0, 5)
  
  // Calculate unread count from API only
  const apiUnreadCount = unreadCountData?.data?.unreadCount || 0
  
  const hasUnread = apiUnreadCount > 0
  const displayUnreadCount = apiUnreadCount

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className={`relative z-[99999] ${className}`}>
      {/* Bell Button */}
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="h-6 w-6" />
        
        {/* Unread Badge */}
        <AnimatePresence>
          {hasUnread && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
            >
              {displayUnreadCount > 99 ? '99+' : displayUnreadCount}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse animation for new notifications */}
        {hasUnread && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-red-500/20 rounded-lg"
          />
        )}
      </motion.button>

      {/* Dropdown */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed w-96 max-w-[calc(100vw-2rem)] bg-slate-800/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl z-[99999]"
              style={{
                top: buttonPosition.top,
                ...(buttonPosition.left !== 'auto' ? { left: buttonPosition.left } : {}),
                ...(buttonPosition.right !== 'auto' ? { right: buttonPosition.right } : {}),
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Notifications</span>
                  {hasUnread && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {displayUnreadCount}
                    </span>
                  )}
                </h3>
                
                <div className="flex items-center space-x-2">
                  {hasUnread && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleMarkAllAsRead}
                      disabled={markAllAsReadMutation.isPending}
                      className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </motion.button>
                  )}
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {recentNotifications.length > 0 ? (
                  <div className="p-2">
                    {recentNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        showActions={false}
                      />
                    ))}
                    
                    {notificationsData?.data?.length > 5 && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setIsOpen(false)
                          // Navigate to notifications page
                          window.location.href = '/dashboard/notifications'
                        }}
                        className="w-full mt-2 p-3 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 rounded-lg transition-colors text-center font-medium"
                      >
                        View All Notifications ({notificationsData?.data?.length})
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="p-3 bg-gray-500/20 rounded-full">
                        <Bell className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">No notifications</h4>
                        <p className="text-gray-400 text-sm">You're all caught up!</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {recentNotifications.length > 0 && (
                <div className="border-t border-white/10 p-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsOpen(false)
                      // Navigate to notifications page
                      window.location.href = '/dashboard/notifications'
                    }}
                    className="w-full flex items-center justify-center space-x-2 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="text-sm">Notification Settings</span>
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
} 