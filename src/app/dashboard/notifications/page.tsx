'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  Filter, 
  Search, 
  Plus, 
  CheckCircle, 
  AlertCircle,
  Info,
  Shield,
  User,
  Settings,
  Trash2,
  X,
  ArrowLeft,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useNotificationStore } from '@/stores/notificationStore'
import { 
  useNotifications, 
  useUnreadCount, 
  useNotificationStats, 
  useMarkAllAsRead,
  useDeleteAllNotifications
} from '@/hooks/useNotifications'
import { useQueryClient } from '@tanstack/react-query'
import { NOTIFICATION_QUERY_KEYS } from '@/hooks/useNotifications'
import NotificationItem from '@/components/notifications/NotificationItem'
import { toast } from 'sonner'

export default function NotificationsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const { notifications, unreadCount, stats } = useNotificationStore()
  
  // Hooks
  const { data: notificationsData, isLoading, refetch } = useNotifications()
  const { data: unreadCountData, refetch: refetchUnreadCount } = useUnreadCount()
  const { data: statsData, refetch: refetchStats } = useNotificationStats()
  const markAllAsReadMutation = useMarkAllAsRead()
  const deleteAllNotificationsMutation = useDeleteAllNotifications()

  // Fix hydration by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query) ||
          notification.type.toLowerCase().includes(query)
        
        if (!matchesSearch) return false
      }

      // Type filter
      if (selectedType !== 'all' && notification.type !== selectedType) {
        return false
      }

      // Status filter
      if (selectedStatus === 'read' && !notification.read) return false
      if (selectedStatus === 'unread' && notification.read) return false

      return true
    })
  }, [notifications, searchQuery, selectedType, selectedStatus])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Invalidate all notification queries to force fresh data
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
      
      // Refetch all notification data simultaneously
      await Promise.all([
        refetch(),
        refetchUnreadCount(),
        refetchStats()
      ])
      
      toast.success('Notifications refreshed')
    } catch (error) {
      console.error('Failed to refresh notifications:', error)
      toast.error('Failed to refresh notifications')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync()
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleDeleteAllNotifications = async () => {
    try {
      await deleteAllNotificationsMutation.mutateAsync()
      setShowDeleteConfirm(false) // Close the confirmation dialog
    } catch (error) {
      console.error('Failed to delete all notifications:', error)
      // Error handling is already done in the mutation's onError
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
              <Link 
                href="/dashboard"
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              
              <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bell className="h-4 w-4 md:h-6 md:w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg md:text-2xl font-bold text-gray-900 truncate">Notifications</h1>
                  <p className="text-xs md:text-base text-gray-600 truncate">Security alerts and account notifications</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 md:space-x-3">
              <button
                onClick={handleRefresh}
                disabled={!isClient || isLoading || isRefreshing}
                className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`h-4 w-4 ${(isClient && (isLoading || isRefreshing)) ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {isClient && unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                  className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark All Read</span>
                </button>
              )}

              {isClient && notifications.length > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleteAllNotificationsMutation.isPending}
                  className="flex items-center space-x-1 md:space-x-2 px-2 md:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete All</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {isClient && stats && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-gray-600 text-sm">Total Notifications</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.unread}</p>
                  <p className="text-gray-600 text-sm">Unread</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.security_alerts}</p>
                  <p className="text-gray-600 text-sm">Security Alerts</p>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
                  <p className="text-gray-600 text-sm">Critical</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-6 mb-6">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 text-sm">Type:</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-1 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="security">Security</option>
                  <option value="account">Account</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-gray-600 text-sm">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-1 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 overflow-hidden shadow-sm">
          {!isClient ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-gray-600">Loading notifications...</span>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-gray-600">Loading notifications...</span>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-gray-100 rounded-full">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    {notifications.length === 0 ? 'No notifications yet' : 'No matching notifications'}
                  </h3>
                  <p className="text-gray-600">
                    {notifications.length === 0 
                      ? 'You\'ll see notifications here when they arrive.' 
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <AnimatePresence>
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    showActions={true}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isClient && (
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-xl border border-gray-200 w-full max-w-md shadow-xl"
              >
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <Trash2 className="h-5 w-5 text-red-600" />
                    <span>Confirm Deletion</span>
                  </h3>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-gray-700">
                    Are you sure you want to delete all <strong>{notifications.length}</strong> notification{notifications.length !== 1 ? 's' : ''}? This action cannot be undone.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllNotifications}
                    disabled={deleteAllNotificationsMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleteAllNotificationsMutation.isPending ? 'Deleting...' : 'Delete All'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
} 