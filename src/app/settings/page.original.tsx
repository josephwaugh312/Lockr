'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import TwoFactorModal from '../../components/TwoFactorModal'
import { 
  ArrowLeft,
  User,
  Shield,
  Lock,
  Palette,
  Bell,
  Download,
  Upload,
  Smartphone,
  Clock,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  CheckCircle,
  Settings as SettingsIcon,
  Key,
  Timer,
  Moon,
  Sun,
  Monitor,
  Trash2,
  RefreshCw,
  X
} from 'lucide-react'
import { API_BASE_URL, apiRequest } from '../../lib/utils'
import { useSendTestNotification } from '../../hooks/useNotifications'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService } from '../../services/userService'
import { authService } from '../../services/authService'
import NotificationPreferences from '../../components/notifications/NotificationPreferences'

interface UserSettings {
  // Account
  name: string
  email: string
  
  // Security
  twoFactorEnabled: boolean
  sessionTimeout: number // minutes
  requirePasswordConfirmation: boolean
  
  // Vault
  autoLockTimeout: number // minutes
  clipboardTimeout: number // seconds
  showPasswordStrength: boolean
  autoSave: boolean
  
  // Appearance
  theme: 'light' | 'dark' | 'system'
  compactView: boolean
  
  // Notifications
  securityAlerts: boolean
  passwordExpiry: boolean
  breachAlerts: boolean
  vaultActivity: boolean
  accountUpdates: boolean
  systemMaintenance: boolean
}

const initialSettings: UserSettings = {
  name: '',
  email: '',
  twoFactorEnabled: false,
  sessionTimeout: 30,
  requirePasswordConfirmation: true,
  autoLockTimeout: 15,
  clipboardTimeout: 30,
  showPasswordStrength: true,
  autoSave: true,
  theme: 'system',
  compactView: false,
  securityAlerts: true,
  passwordExpiry: true,
  breachAlerts: true,
  vaultActivity: true,
  accountUpdates: true,
  systemMaintenance: false
}

export default function Settings() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isClient, setIsClient] = useState(false)
  const [settings, setSettings] = useState<UserSettings>(initialSettings)
  const [activeSection, setActiveSection] = useState(() => {
    // Check URL parameter for initial section
    const section = searchParams.get('section')
    return ['account', 'security', 'vault', 'appearance', 'notifications'].includes(section || '') 
      ? section 
      : 'account'
  })
  const [saving, setSaving] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // 2FA Modal state
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false)
  
  // Test notification state
  const [showTestNotificationForm, setShowTestNotificationForm] = useState(false)
  const sendTestNotificationMutation = useSendTestNotification()
  
  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  useEffect(() => {
    setIsClient(true)
    loadUserData()
    
    // Listen for session expiry events
    const handleSessionExpired = () => {
      console.log('Session expired - clearing settings data')
      setSettings(initialSettings)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setToastMessage('Your session has expired. Please log in again.')
      setToastType('error')
    }
    
    window.addEventListener('session-expired', handleSessionExpired)
    
    // Cleanup event listener
    return () => {
      window.removeEventListener('session-expired', handleSessionExpired)
    }
  }, [])

  // Handle URL parameter changes
  useEffect(() => {
    const section = searchParams.get('section')
    if (section && ['account', 'security', 'vault', 'appearance', 'notifications'].includes(section)) {
      setActiveSection(section)
    }
  }, [searchParams])

  // Apply theme when it changes
  useEffect(() => {
    if (!isClient) return
    
    const root = document.documentElement
    
    if (settings.theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else if (settings.theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else { // system
      root.classList.remove('light', 'dark')
      // Use system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.add('light')
      }
    }
    
    // Save theme preference to localStorage for persistence
    localStorage.setItem('lockr_theme', settings.theme)
  }, [settings.theme, isClient])

  // Apply compact view when it changes
  useEffect(() => {
    if (!isClient) return
    
    const root = document.documentElement
    
    if (settings.compactView) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
    
    // Save compact view preference to localStorage
    localStorage.setItem('lockr_compact_view', settings.compactView.toString())
  }, [settings.compactView, isClient])

  // Listen for system theme changes when using system theme
  useEffect(() => {
    if (!isClient || settings.theme !== 'system') return
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement
      if (e.matches) {
        root.classList.add('dark')
        root.classList.remove('light')
      } else {
        root.classList.add('light')
        root.classList.remove('dark')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settings.theme, isClient])

  const loadUserData = async () => {
    try {
      // Load user profile
      const profileResponse = await apiRequest(`${API_BASE_URL}/auth/me`)

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text()
        console.error('Profile loading failed:', {
          status: profileResponse.status,
          statusText: profileResponse.statusText,
          url: `${API_BASE_URL}/auth/me`,
          error: errorText
        })
        throw new Error(`Failed to load profile (${profileResponse.status}): ${errorText || profileResponse.statusText}`)
      }

      const profile = await profileResponse.json()

      // Load 2FA status
      const twoFAResponse = await apiRequest(`${API_BASE_URL}/auth/2fa/status`)

      let twoFactorEnabled = false
      if (twoFAResponse.ok) {
        const twoFAData = await twoFAResponse.json()
        twoFactorEnabled = twoFAData.twoFactorEnabled || false
      } else {
        console.warn('2FA status loading failed:', twoFAResponse.status, twoFAResponse.statusText)
      }

      // Load user settings
      const settingsResponse = await apiRequest(`${API_BASE_URL}/auth/settings`)

      let userSettings = {}
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        userSettings = settingsData.settings || {}
      } else {
        console.warn('Settings loading failed:', settingsResponse.status, settingsResponse.statusText)
      }

      setSettings(prev => ({
        ...prev,
        name: profile.user.name || profile.user.email.split('@')[0], // Use email prefix if no name
        email: profile.user.email,
        twoFactorEnabled,
        // Merge with loaded settings, keeping defaults for any missing values
        sessionTimeout: userSettings.sessionTimeout ?? prev.sessionTimeout,
        requirePasswordConfirmation: userSettings.requirePasswordConfirmation ?? prev.requirePasswordConfirmation,
        autoLockTimeout: userSettings.autoLockTimeout ?? prev.autoLockTimeout,
        clipboardTimeout: userSettings.clipboardTimeout ?? prev.clipboardTimeout,
        showPasswordStrength: userSettings.showPasswordStrength ?? prev.showPasswordStrength,
        autoSave: userSettings.autoSave ?? prev.autoSave,
        theme: userSettings.theme ?? prev.theme,
        compactView: userSettings.compactView ?? prev.compactView,
        securityAlerts: userSettings.securityAlerts ?? prev.securityAlerts,
        passwordExpiry: userSettings.passwordExpiry ?? prev.passwordExpiry,
        breachAlerts: userSettings.breachAlerts ?? prev.breachAlerts,
        vaultActivity: userSettings.vaultActivity ?? prev.vaultActivity,
        accountUpdates: userSettings.accountUpdates ?? prev.accountUpdates,
        systemMaintenance: userSettings.systemMaintenance ?? prev.systemMaintenance
      }))
    } catch (error) {
      console.error('Failed to load user data:', error)
      setToastMessage(`Failed to load user data: ${error.message}`)
      setToastType('error')
    } finally {
      setIsLoadingData(false)
    }
  }

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    
    // Apply theme changes immediately for better UX
    if (key === 'theme') {
      const root = document.documentElement
      
      if (value === 'dark') {
        root.classList.add('dark')
        root.classList.remove('light')
      } else if (value === 'light') {
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
      
      localStorage.setItem('lockr_theme', value)
    }
    
    // Apply compact view changes immediately
    if (key === 'compactView') {
      const root = document.documentElement
      
      if (value) {
        root.classList.add('compact-mode')
      } else {
        root.classList.remove('compact-mode')
      }
      
      localStorage.setItem('lockr_compact_view', value.toString())
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      // Update profile (name and email)
      const profileResponse = await apiRequest(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: settings.name,
          email: settings.email
        })
      })

      if (!profileResponse.ok) {
        const data = await profileResponse.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      // Update user settings (everything except name, email, and 2FA)
      const settingsToSave = {
        sessionTimeout: settings.sessionTimeout,
        requirePasswordConfirmation: settings.requirePasswordConfirmation,
        autoLockTimeout: settings.autoLockTimeout,
        clipboardTimeout: settings.clipboardTimeout,
        showPasswordStrength: settings.showPasswordStrength,
        autoSave: settings.autoSave,
        theme: settings.theme,
        compactView: settings.compactView,
        securityAlerts: settings.securityAlerts,
        passwordExpiry: settings.passwordExpiry,
        breachAlerts: settings.breachAlerts,
        vaultActivity: settings.vaultActivity,
        accountUpdates: settings.accountUpdates,
        systemMaintenance: settings.systemMaintenance
      }

      const settingsResponse = await apiRequest(`${API_BASE_URL}/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsToSave)
      })

      if (!settingsResponse.ok) {
        const data = await settingsResponse.json()
        throw new Error(data.error || 'Failed to update settings')
      }

      console.log('Settings updated successfully')
      setToastMessage('Settings updated successfully!')
      setToastType('success')
    } catch (error) {
      console.error('Settings update error:', error)
      setToastMessage(error instanceof Error ? error.message : 'Failed to save settings')
      setToastType('error')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToastMessage('New passwords do not match')
      setToastType('error')
      return
    }
    
    if (passwordForm.newPassword.length < 8) {
      setToastMessage('New password must be at least 8 characters')
      setToastType('error')
      return
    }

    setSaving(true)
    try {
      // Call the MASTER password change API (vault endpoint)
      const response = await apiRequest(`${API_BASE_URL}/vault/change-master-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentMasterPassword: passwordForm.currentPassword,
          newMasterPassword: passwordForm.newPassword
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to change master password')
      }

      console.log('Master password changed successfully')
      setToastMessage('Master password updated successfully!')
      setToastType('success')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      console.error('Master password change error:', error)
      setToastMessage(error instanceof Error ? error.message : 'Failed to update master password')
      setToastType('error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    // First confirmation
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your vault data.')) {
      return
    }

    // Ask for password confirmation
    const password = prompt('Please enter your account password to confirm deletion:')
    if (!password) {
      return
    }

    // Final confirmation with typed confirmation
    const confirmText = prompt('To confirm deletion, type "DELETE" (all caps):')
    if (confirmText !== 'DELETE') {
      setToastMessage('Account deletion cancelled. You must type "DELETE" exactly.')
      setToastType('error')
      return
    }

    try {
      setSaving(true)
      
      const response = await apiRequest(`${API_BASE_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: password,
          confirmDelete: 'DELETE'
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Account deleted successfully
        setToastMessage('Account deleted successfully. You will be redirected to the home page.')
        setToastType('success')
        
        // Clear all local storage
        localStorage.removeItem('lockr_access_token')
        localStorage.removeItem('lockr_refresh_token')
        localStorage.removeItem('lockr_user')
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push('/')
        }, 2000)
        
      } else {
        // Handle specific error cases
        if (response.status === 400) {
          setToastMessage(data.error || 'Invalid password or confirmation.')
          setToastType('error')
        } else if (response.status === 401) {
          setToastMessage('Session expired. Please log in again.')
          setToastType('error')
          router.push('/authentication/signin')
        } else {
          setToastMessage(data.error || 'Failed to delete account. Please try again.')
          setToastType('error')
        }
      }
    } catch (error) {
      console.error('Account deletion error:', error)
      setToastMessage('Network error. Please check your connection and try again.')
      setToastType('error')
    } finally {
      setSaving(false)
    }
  }

  const handle2FAStatusChange = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, twoFactorEnabled: enabled }))
    setToastMessage(`Two-factor authentication ${enabled ? 'enabled' : 'disabled'} successfully`)
    setToastType('success')
  }

  const handleSendTestNotification = async (type: 'security' | 'account' | 'system') => {
    try {
      const testData = {
        type,
        subtype: type === 'security' ? 'test_security_alert' : type === 'account' ? 'test_account_update' : 'test_system_maintenance',
        title: `Test ${type.charAt(0).toUpperCase() + type.slice(1)} Notification`,
        message: `This is a test ${type} notification sent from your settings page.`,
        priority: 'medium' as const,
        channels: ['inapp']
      }

      await sendTestNotificationMutation.mutateAsync(testData)
      setToastMessage(`Test ${type} notification sent successfully!`)
      setToastType('success')
      setShowTestNotificationForm(false)
    } catch (error) {
      console.error('Failed to send test notification:', error)
      setToastMessage('Failed to send test notification')
      setToastType('error')
    }
  }

  const handleNotificationPreferencesUpdate = (preferences: {
    securityAlerts: boolean
    passwordExpiry: boolean
    breachAlerts: boolean
    vaultActivity: boolean
    accountUpdates: boolean
    systemMaintenance: boolean
  }) => {
    // Just update local state - actual saving happens with main Save Changes button
    setSettings(prev => ({
      ...prev,
      ...preferences
    }))
  }

  const handleTestNotification = async (testEndpoint: string) => {
    try {
      const response = await apiRequest(`${API_BASE_URL}/auth/${testEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send test notification')
      }

      const data = await response.json()
      setToastMessage(data.message || 'Test notification sent successfully!')
      setToastType('success')
    } catch (error) {
      console.error('Failed to send test notification:', error)
      setToastMessage(error instanceof Error ? error.message : 'Failed to send test notification')
      setToastType('error')
    }
  }

  const sections = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'vault', name: 'Vault', icon: Lock },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'notifications', name: 'Notifications', icon: Bell }
  ]

  if (!isClient || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-lockr-cyan to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="w-8 h-8 animate-spin text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading settings...</h3>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                  <p className="text-gray-600">Manage your account and preferences</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-lockr-navy to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="font-medium">{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex gap-8">
            {/* Sidebar Navigation */}
            <div className="w-64 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 p-4 h-fit">
              <nav className="space-y-2">
                {sections.map(({ id, name, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                      activeSection === id 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{name}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Settings Content */}
            <div className="flex-1 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 p-6">
              {/* Account Settings */}
              {activeSection === 'account' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input
                          type="text"
                          value={settings.name}
                          onChange={(e) => handleSettingChange('name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                        <input
                          type="email"
                          value={settings.email}
                          onChange={(e) => handleSettingChange('email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Master Password</h3>
                    
                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                          >
                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handlePasswordChange}
                        disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Key className="w-4 h-4" />
                        <span>Update Password</span>
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-red-900 mb-2">Delete Account</h4>
                          <p className="text-sm text-red-700 mb-4">
                            Permanently delete your account and all vault data. This action cannot be undone.
                          </p>
                          <button
                            onClick={handleDeleteAccount}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete Account</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Security Preferences</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Smartphone className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                            <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`text-sm font-medium ${settings.twoFactorEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                            {settings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <button
                            onClick={() => setShowTwoFactorModal(true)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.twoFactorEnabled ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                settings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3 mb-3">
                          <Timer className="w-5 h-5 text-blue-600" />
                          <h3 className="text-sm font-medium text-gray-900">Session Timeout</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">Automatically log out after period of inactivity</p>
                        <select
                          value={settings.sessionTimeout}
                          onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={240}>4 hours</option>
                          <option value={480}>8 hours</option>
                          <option value={-1}>Never</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Lock className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Require Password Confirmation</h3>
                            <p className="text-sm text-gray-600">Require password to view sensitive actions</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('requirePasswordConfirmation', !settings.requirePasswordConfirmation)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.requirePasswordConfirmation ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.requirePasswordConfirmation ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vault Settings */}
              {activeSection === 'vault' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Vault Preferences</h2>
                    
                    <div className="space-y-6">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3 mb-3">
                          <Clock className="w-5 h-5 text-blue-600" />
                          <h3 className="text-sm font-medium text-gray-900">Auto-Lock Timeout</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">Automatically lock vault after period of inactivity</p>
                        <select
                          value={settings.autoLockTimeout}
                          onChange={(e) => handleSettingChange('autoLockTimeout', parseInt(e.target.value))}
                          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={5}>5 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={-1}>Never</option>
                        </select>
                      </div>

                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3 mb-3">
                          <Timer className="w-5 h-5 text-blue-600" />
                          <h3 className="text-sm font-medium text-gray-900">Clipboard Timeout</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">Clear clipboard after copying passwords</p>
                        <select
                          value={settings.clipboardTimeout}
                          onChange={(e) => handleSettingChange('clipboardTimeout', parseInt(e.target.value))}
                          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={10}>10 seconds</option>
                          <option value={30}>30 seconds</option>
                          <option value={60}>60 seconds</option>
                          <option value={120}>2 minutes</option>
                          <option value={-1}>Never</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Show Password Strength</h3>
                            <p className="text-sm text-gray-600">Display password strength indicators</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('showPasswordStrength', !settings.showPasswordStrength)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.showPasswordStrength ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.showPasswordStrength ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Save className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Auto-Save</h3>
                            <p className="text-sm text-gray-600">Automatically save changes to vault items</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('autoSave', !settings.autoSave)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.autoSave ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.autoSave ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Settings */}
              {activeSection === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Appearance & Display</h2>
                    
                    <div className="space-y-6">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3 mb-4">
                          <Palette className="w-5 h-5 text-blue-600" />
                          <h3 className="text-sm font-medium text-gray-900">Theme</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { value: 'light', label: 'Light', icon: Sun },
                            { value: 'dark', label: 'Dark', icon: Moon },
                            { value: 'system', label: 'System', icon: Monitor }
                          ].map(({ value, label, icon: Icon }) => (
                            <button
                              key={value}
                              onClick={() => handleSettingChange('theme', value)}
                              className={`flex flex-col items-center space-y-2 p-4 border-2 rounded-lg transition-all ${
                                settings.theme === value 
                                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className="w-6 h-6" />
                              <span className="text-sm font-medium">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <SettingsIcon className="w-5 h-5 text-blue-600" />
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">Compact View</h3>
                            <p className="text-sm text-gray-600">Show more items with reduced spacing</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSettingChange('compactView', !settings.compactView)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.compactView ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                              settings.compactView ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeSection === 'notifications' && (
                <div className="space-y-6">
                  <NotificationPreferences
                    preferences={{
                      securityAlerts: settings.securityAlerts,
                      passwordExpiry: settings.passwordExpiry,
                      breachAlerts: settings.breachAlerts,
                      vaultActivity: settings.vaultActivity,
                      accountUpdates: settings.accountUpdates,
                      systemMaintenance: settings.systemMaintenance
                    }}
                    onUpdate={handleNotificationPreferencesUpdate}
                    onTestNotification={handleTestNotification}
                    isLoading={isLoadingData}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center space-x-3 min-w-[280px] ${
            toastType === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : toastType === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              toastType === 'success' 
                ? 'bg-green-500' 
                : toastType === 'error'
                ? 'bg-red-500'
                : 'bg-blue-500'
            }`}>
              {toastType === 'success' ? (
                <CheckCircle className="w-3 h-3 text-white" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-white" />
              )}
            </div>
            <p className="text-sm font-medium flex-1">{toastMessage}</p>
            <button
              onClick={() => setToastMessage(null)}
              className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
                toastType === 'success' 
                  ? 'hover:bg-green-100' 
                  : toastType === 'error'
                  ? 'hover:bg-red-100'
                  : 'hover:bg-blue-100'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Two-Factor Authentication Modal */}
      {showTwoFactorModal && (
        <TwoFactorModal
          isOpen={showTwoFactorModal}
          onClose={() => setShowTwoFactorModal(false)}
          token={localStorage.getItem('lockr_access_token') || ''}
          onStatusChange={handle2FAStatusChange}
          currentlyEnabled={settings.twoFactorEnabled}
        />
      )}
    </>
  )
} 