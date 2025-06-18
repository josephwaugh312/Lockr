'use client'

import { motion } from 'framer-motion'
import { 
  Bell, 
  Shield, 
  User, 
  Settings, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  X,
  Eye,
  Trash2
} from 'lucide-react'
import { Notification } from '@/stores/notificationStore'
import { useMarkAsRead, useDeleteNotification } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

interface NotificationItemProps {
  notification: Notification
  onAction?: (action: 'read' | 'delete', id: string) => void
  showActions?: boolean
}

export default function NotificationItem({ 
  notification, 
  onAction, 
  showActions = true 
}: NotificationItemProps) {
  const markAsReadMutation = useMarkAsRead()
  const deleteNotificationMutation = useDeleteNotification()

  const getIcon = () => {
    switch (notification.type) {
      case 'security':
        return <Shield className="h-5 w-5 text-red-400" />
      case 'account':
        return <User className="h-5 w-5 text-blue-400" />
      case 'system':
        return <Settings className="h-5 w-5 text-gray-400" />
      default:
        return <Bell className="h-5 w-5 text-gray-400" />
    }
  }

  const getPriorityIndicator = () => {
    switch (notification.priority) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-500" />
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return null
    }
  }

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'critical':
        return 'border-l-red-500 bg-red-500/5'
      case 'high':
        return 'border-l-orange-500 bg-orange-500/5'
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-500/5'
      case 'low':
        return 'border-l-green-500 bg-green-500/5'
      default:
        return 'border-l-gray-500 bg-gray-500/5'
    }
  }

  const handleMarkAsRead = async () => {
    if (notification.read) return
    
    try {
      await markAsReadMutation.mutateAsync(notification.id)
      onAction?.('read', notification.id)
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteNotificationMutation.mutateAsync(notification.id)
      onAction?.('delete', notification.id)
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`
        relative border-l-4 bg-white/5 backdrop-blur-sm rounded-r-lg p-4 mb-3
        ${getPriorityColor()}
        ${!notification.read ? 'bg-white/10' : 'bg-white/5'}
        hover:bg-white/10 transition-colors duration-200
      `}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-4 right-4 w-2 h-2 bg-purple-500 rounded-full"></div>
      )}

      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className={`text-sm font-medium ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                  {notification.title}
                </h4>
                <div className="flex items-center space-x-1">
                  {getPriorityIndicator()}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    notification.type === 'security' 
                      ? 'bg-red-500/20 text-red-300' 
                      : notification.type === 'account'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-gray-500/20 text-gray-300'
                  }`}>
                    {notification.type}
                  </span>
                </div>
              </div>
              
              <p className={`text-sm ${!notification.read ? 'text-gray-200' : 'text-gray-400'} mb-2`}>
                {notification.message}
              </p>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {timeAgo}
                </span>
                
                {notification.read_at && (
                  <span className="text-xs text-green-400 flex items-center space-x-1">
                    <CheckCircle className="h-3 w-3" />
                    <span>Read</span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex items-center space-x-1 ml-4">
                {!notification.read && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleMarkAsRead}
                    disabled={markAsReadMutation.isPending}
                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                    title="Mark as read"
                  >
                    <Eye className="h-4 w-4" />
                  </motion.button>
                )}
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDelete}
                  disabled={deleteNotificationMutation.isPending}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete notification"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
} 