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
        return <Shield className="h-5 w-5 text-red-600" />
      case 'account':
        return <User className="h-5 w-5 text-blue-600" />
      case 'system':
        return <Settings className="h-5 w-5 text-gray-600" />
      default:
        return <Bell className="h-5 w-5 text-gray-600" />
    }
  }

  const getPriorityIndicator = () => {
    switch (notification.priority) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      case 'medium':
        return <Info className="h-4 w-4 text-yellow-600" />
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      default:
        return null
    }
  }

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'critical':
        return 'border-l-red-500 bg-red-50'
      case 'high':
        return 'border-l-orange-500 bg-orange-50'
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50'
      case 'low':
        return 'border-l-green-500 bg-green-50'
      default:
        return 'border-l-gray-500 bg-gray-50'
    }
  }

  // Simple breach details rendering
  const renderBreachDetails = () => {
    if (notification.subtype !== 'data_breach_alert' || !notification.data) {
      return null
    }

    const breachData = notification.data

    // Show individual breach details
    if (breachData.breachName && breachData.checkType === 'manual') {
      return (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium text-red-900">Service: </span>
                <span className="text-red-800">{breachData.breachName}</span>
              </div>
              {breachData.breachDate && (
                <div className="text-xs text-red-700">
                  {new Date(breachData.breachDate).getFullYear()}
                </div>
              )}
            </div>
            
            {breachData.compromisedData && breachData.compromisedData.length > 0 && (
              <div className="text-sm">
                <span className="font-medium text-red-900">Compromised Data: </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {breachData.compromisedData.map((dataType: string, index: number) => (
                    <span 
                      key={index}
                      className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full"
                    >
                      {dataType}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {breachData.affectedAccounts && (
              <div className="text-xs text-red-700">
                <span className="font-medium">Affected accounts: </span>
                {breachData.affectedAccounts.toLocaleString()}
              </div>
            )}
            
            {breachData.domain && (
              <div className="text-xs text-red-700">
                <span className="font-medium">Domain: </span>
                {breachData.domain}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Show summary notification for multiple breaches
    if (breachData.checkType === 'summary' && breachData.totalBreaches > 1) {
      return (
        <div className="mt-2 p-2 bg-blue-50 border-l-2 border-blue-300 rounded">
          <div className="text-sm text-blue-800">
            <span className="font-medium">Scan Summary: </span>
            {breachData.totalBreaches} breaches found
            {breachData.mostRecentBreach && (
              <span> - Most recent: {breachData.mostRecentBreach}</span>
            )}
          </div>
          <div className="text-xs text-blue-700 mt-1">
            Check individual breach notifications above for detailed information.
          </div>
        </div>
      )
    }

    // Legacy support for old multiple breach format
    if (breachData.totalBreaches && breachData.totalBreaches > 1 && !breachData.checkType) {
      return (
        <div className="mt-2 p-2 bg-red-50 border-l-2 border-red-300 rounded">
          <div className="text-sm text-red-800">
            <span className="font-medium">{breachData.totalBreaches} breaches found</span>
            {breachData.mostRecentBreach && (
              <span> - Most recent: {breachData.mostRecentBreach}</span>
            )}
          </div>
          {breachData.allBreaches && breachData.allBreaches.length > 0 && (
            <div className="text-xs text-red-700 mt-1">
              {breachData.allBreaches.map((breach: any, index: number) => (
                <div key={index}>
                  {breach.name}: {Array.isArray(breach.dataClasses) ? breach.dataClasses.slice(0, 2).join(', ') : 'Unknown data'}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return null
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
      onClick={handleMarkAsRead}
      className={`
        relative border-l-4 bg-white/80 backdrop-blur-sm rounded-r-lg p-4 mb-3 cursor-pointer border border-gray-200/50
        ${getPriorityColor()}
        ${!notification.read ? 'shadow-md' : 'shadow-sm'}
        hover:shadow-lg hover:bg-white/90 transition-all duration-200
      `}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full"></div>
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
                <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                  {notification.title}
                </h4>
                <div className="flex items-center space-x-1">
                  {getPriorityIndicator()}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    notification.type === 'security' 
                      ? 'bg-red-100 text-red-700' 
                      : notification.type === 'account'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {notification.type}
                  </span>
                </div>
              </div>
              
              <p className={`text-sm ${!notification.read ? 'text-gray-700' : 'text-gray-600'} mb-2`}>
                {notification.message}
              </p>
              
              {/* Enhanced breach details */}
              {renderBreachDetails()}
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {timeAgo}
                </span>
                
                {notification.read_at && (
                  <span className="text-xs text-green-600 flex items-center space-x-1">
                    <CheckCircle className="h-3 w-3" />
                    <span>Read</span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex items-center space-x-1 ml-4" onClick={(e) => e.stopPropagation()}>
                {!notification.read && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleMarkAsRead}
                    disabled={markAsReadMutation.isPending}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
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
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
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