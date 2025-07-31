'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Settings } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import { useUnreadCount, useNotifications, useMarkAllAsRead } from '@/hooks/useNotifications'
import NotificationItem from './NotificationItem'

interface NotificationBellProps {
  className?: string
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  const { data: unreadCountData } = useUnreadCount()
  const { data: notificationsData } = useNotifications({ limit: 10 })
  const markAllAsReadMutation = useMarkAllAsRead()

  // Use React Query data as source of truth for both unread count and notifications
  const unreadCount = unreadCountData?.data?.unreadCount || 0
  const notifications = notificationsData?.data || []

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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const recentNotifications = notifications.slice(0, 5)
  const hasUnread = unreadCount > 0

  return (
    <div className={`relative ${className}`}>
      {/* Bell Button */}
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
              {unreadCount > 99 ? '99+' : unreadCount}
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
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-96 max-w-sm bg-slate-800/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
                {hasUnread && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {unreadCount}
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
                  
                  {notifications.length > 5 && (
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
                      View All Notifications ({notifications.length})
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
                    // Navigate to notification settings
                    window.location.href = '/dashboard/settings/notifications'
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
      </AnimatePresence>
    </div>
  )
} 