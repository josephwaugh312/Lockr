'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  Filter, 
  Search, 
  CheckCheck, 
  Trash2, 
  Settings,
  ArrowLeft,
  Plus,
  AlertCircle,
  Shield,
  User
} from 'lucide-react'
import Link from 'next/link'
import NotificationItem from '@/components/notifications/NotificationItem'
import { useNotificationStore } from '@/stores/notificationStore'
import { 
  useNotifications, 
  useMarkAllAsRead, 
  useNotificationStats,
  useSendTestNotification 
} from '@/hooks/useNotifications'
import { GetNotificationsParams } from '@/services/notificationService'

export default function NotificationsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'security' | 'account' | 'system'>('all')
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all')
  const [showTestForm, setShowTestForm] = useState(false)

  const { notifications, unreadCount, stats, isLoading, error } = useNotificationStore()
  const markAllAsReadMutation = useMarkAllAsRead()
  const sendTestNotificationMutation = useSendTestNotification()

  // Build filter params
  const filterParams: GetNotificationsParams = {
    ...(filterType !== 'all' && { type: filterType as any }),
    ...(filterRead === 'read' && { read: true }),
    ...(filterRead === 'unread' && { read: false }),
    limit: 50
  }

  // Fetch notifications with filters
  useNotifications(filterParams)
  useNotificationStats()

  // Filter notifications locally by search query
  const filteredNotifications = notifications.filter(notification =>
    notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleSendTestNotification = async (data: any) => {
    try {
      await sendTestNotificationMutation.mutateAsync(data)
      setShowTestForm(false)
    } catch (error) {
      console.error('Failed to send test notification:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-lg border-b border-white/10 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <Bell className="h-6 w-6" />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h1>
                <p className="text-gray-300">
                  Manage your security alerts and account updates
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Test Notification Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTestForm(true)}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Test Notification</span>
              </motion.button>

              {/* Mark All Read */}
              {unreadCount > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Mark All Read</span>
                </motion.button>
              )}

              {/* Settings */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm">Total</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Bell className="h-6 w-6 text-blue-400" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm">Unread</p>
                  <p className="text-2xl font-bold text-orange-400">{stats.unread}</p>
                </div>
                <AlertCircle className="h-6 w-6 text-orange-400" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm">Security</p>
                  <p className="text-2xl font-bold text-red-400">{stats.security_alerts}</p>
                </div>
                <Shield className="h-6 w-6 text-red-400" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm">Critical</p>
                  <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
                </div>
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
            </motion.div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="security">Security</option>
                <option value="account">Account</option>
                <option value="system">System</option>
              </select>
            </div>

            {/* Read Status Filter */}
            <div>
              <select
                value={filterRead}
                onChange={(e) => setFilterRead(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-400 mb-2">Error loading notifications</div>
              <div className="text-gray-400 text-sm">{error}</div>
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="p-6">
              <AnimatePresence>
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center space-y-3">
                <div className="p-4 bg-gray-500/20 rounded-full">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">No notifications found</h3>
                  <p className="text-gray-400 text-sm">
                    {searchQuery || filterType !== 'all' || filterRead !== 'all'
                      ? 'Try adjusting your filters or search query'
                      : 'You\'re all caught up!'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Notification Modal */}
      <AnimatePresence>
        {showTestForm && (
          <TestNotificationModal
            onClose={() => setShowTestForm(false)}
            onSend={handleSendTestNotification}
            isLoading={sendTestNotificationMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Test Notification Modal Component
function TestNotificationModal({ 
  onClose, 
  onSend, 
  isLoading 
}: { 
  onClose: () => void
  onSend: (data: any) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    type: 'security' as 'security' | 'account',
    subtype: 'new_device_login',
    title: 'Test Security Alert',
    message: 'This is a test notification',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  })

  const subtypes = {
    security: ['new_device_login', 'suspicious_login', 'multiple_failed_logins'],
    account: ['welcome', 'password_reset_requested', 'email_verified']
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-white/20"
      >
        <h3 className="text-xl font-semibold text-white mb-4">Send Test Notification</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ 
                ...formData, 
                type: e.target.value as any,
                subtype: subtypes[e.target.value as keyof typeof subtypes][0]
              })}
              className="w-full bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2"
            >
              <option value="security">Security</option>
              <option value="account">Account</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Subtype</label>
            <select
              value={formData.subtype}
              onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2"
            >
              {subtypes[formData.type].map(subtype => (
                <option key={subtype} value={subtype}>{subtype}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              className="w-full bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSend(formData)}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send Test'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
} 