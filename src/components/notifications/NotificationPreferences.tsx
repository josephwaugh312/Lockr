import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Shield, 
  User, 
  Settings, 
  Bell, 
  AlertTriangle,
  Clock,
  TestTube
} from 'lucide-react'

interface NotificationPreferences {
  securityAlerts: boolean
  passwordExpiry: boolean
  breachAlerts: boolean
  vaultActivity: boolean
  accountUpdates: boolean
  systemMaintenance: boolean
}

interface NotificationPreferencesProps {
  preferences: NotificationPreferences
  onUpdate: (preferences: NotificationPreferences) => void
  isLoading?: boolean
  onTestNotification?: (type: string) => Promise<void>
}

export default function NotificationPreferences({ 
  preferences, 
  onUpdate, 
  isLoading = false,
  onTestNotification
}: NotificationPreferencesProps) {
  const [localPreferences, setLocalPreferences] = useState(preferences)
  const [testingType, setTestingType] = useState<string | null>(null)

  const handleToggle = (key: keyof NotificationPreferences) => {
    const newPreferences = {
      ...localPreferences,
      [key]: !localPreferences[key]
    }
    setLocalPreferences(newPreferences)
    // Immediately call onUpdate to sync with parent component
    onUpdate(newPreferences)
  }

  const handleTestNotification = async (type: string) => {
    if (!onTestNotification) return
    
    setTestingType(type)
    try {
      await onTestNotification(type)
    } catch (error) {
      console.error('Failed to send test notification:', error)
    } finally {
      setTestingType(null)
    }
  }

  const notificationSettings = [
    {
      key: 'securityAlerts' as keyof NotificationPreferences,
      icon: Shield,
      title: 'Security Alerts',
      description: 'Failed login attempts, suspicious activity, and security events',
      color: 'red',
      priority: 'High Priority',
      testEndpoint: 'test-security-alert'
    },
    {
      key: 'passwordExpiry' as keyof NotificationPreferences,
      icon: Clock,
      title: 'Password Expiry',
      description: 'Notifications when passwords are old and should be updated',
      color: 'yellow',
      priority: 'Medium Priority',
      testEndpoint: 'test-password-expiry'
    },
    {
      key: 'breachAlerts' as keyof NotificationPreferences,
      icon: AlertTriangle,
      title: 'Data Breach Alerts',
      description: 'Alerts when your accounts may be compromised in data breaches',
      color: 'red',
      priority: 'High Priority',
      testEndpoint: 'test-data-breach'
    },
    {
      key: 'vaultActivity' as keyof NotificationPreferences,
      icon: Settings,
      title: 'Vault Activity',
      description: 'Notifications for vault access, entry changes, and vault events',
      color: 'blue',
      priority: 'Low Priority',
      testEndpoint: null // No specific test endpoint, handled by vault operations
    },
    {
      key: 'accountUpdates' as keyof NotificationPreferences,
      icon: User,
      title: 'Account Updates',
      description: 'Profile changes, subscription updates, and account modifications',
      color: 'green',
      priority: 'Medium Priority',
      testEndpoint: null // Triggered by actual profile updates
    },
    {
      key: 'systemMaintenance' as keyof NotificationPreferences,
      icon: Bell,
      title: 'System Maintenance',
      description: 'Scheduled maintenance, updates, and system announcements',
      color: 'gray',
      priority: 'Low Priority',
      testEndpoint: null // Admin only feature
    }
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      red: 'text-red-600 bg-red-100',
      yellow: 'text-yellow-600 bg-yellow-100',
      blue: 'text-blue-600 bg-blue-100',
      green: 'text-green-600 bg-green-100',
      gray: 'text-gray-600 bg-gray-100'
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      'High Priority': 'text-red-600 bg-red-50 border-red-200',
      'Medium Priority': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'Low Priority': 'text-gray-600 bg-gray-50 border-gray-200'
    }
    return colors[priority as keyof typeof colors] || colors['Low Priority']
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
        <p className="text-gray-600 mt-1">Choose which notifications you want to receive</p>
      </div>

      <div className="space-y-4">
        {notificationSettings.map((setting) => {
          const Icon = setting.icon
          const isEnabled = localPreferences[setting.key]
          
          return (
            <motion.div
              key={setting.key}
              layout
              className={`p-4 border rounded-lg transition-all duration-200 ${
                isEnabled 
                  ? 'border-blue-200 bg-blue-50/50' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${getColorClasses(setting.color)}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-sm font-medium text-gray-900">
                        {setting.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(setting.priority)}`}>
                        {setting.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {setting.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {/* Test Button */}
                  {isEnabled && setting.testEndpoint && onTestNotification && (
                    <button
                      onClick={() => handleTestNotification(setting.testEndpoint!)}
                      disabled={testingType === setting.testEndpoint}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <TestTube className="h-3 w-3" />
                      <span>{testingType === setting.testEndpoint ? 'Testing...' : 'Test'}</span>
                    </button>
                  )}
                  
                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(setting.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          <Bell className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Notification Summary</span>
        </div>
        <p className="text-sm text-gray-600">
          You have <strong>{Object.values(localPreferences).filter(Boolean).length}</strong> out of{' '}
          <strong>{Object.values(localPreferences).length}</strong> notification types enabled.
        </p>
      </div>
    </div>
  )
} 