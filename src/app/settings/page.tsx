'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import TwoFactorModal from '../../components/TwoFactorModal'
import ResponsiveSettings from '../../components/ResponsiveSettings'
import PhoneManagement from '../../components/PhoneManagement'
import { 
  User,
  Shield,
  Lock,
  Palette,
  Bell,
  Download,
  Upload,
  Smartphone,
  Eye,
  EyeOff,
  Save,
  AlertTriangle,
  CheckCircle,
  Key,
  Timer,
  Moon,
  Sun,
  Monitor,
  Trash2,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react'
import { API_BASE_URL, apiRequest } from '../../lib/utils'
import { useSendTestNotification } from '../../hooks/useNotifications'
import NotificationPreferences from '../../components/notifications/NotificationPreferences'
import { useNotificationStore } from '../../stores/notificationStore'

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

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isClient, setIsClient] = useState(false)
  const [settings, setSettings] = useState<UserSettings>(initialSettings)
  const [activeSection, setActiveSection] = useState(() => {
    const section = searchParams.get('section')
    return ['account', 'security', 'phone', 'vault', 'appearance', 'notifications', 'danger'].includes(section || '') 
      ? section 
      : 'account'
  })
  const [saving, setSaving] = useState(false)
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

  // Delete account state
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeletePassword, setShowDeletePassword] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setIsClient(true)
    loadUserData()
  }, [])

  // Load user data from backend
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

      let userSettings: Partial<UserSettings> = {}
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        userSettings = settingsData.settings || {}
      } else {
        console.warn('Settings loading failed:', settingsResponse.status, settingsResponse.statusText)
      }

      setSettings(prev => ({
        ...prev,
        name: profile.user.name || profile.user.email.split('@')[0],
        email: profile.user.email,
        twoFactorEnabled,
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
    }
  }

  // Handle URL parameter changes
  useEffect(() => {
    const section = searchParams.get('section')
    if (section && ['account', 'security', 'phone', 'vault', 'appearance', 'notifications', 'danger'].includes(section)) {
      setActiveSection(section)
    }
  }, [searchParams])

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

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

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
      // Call the ACCOUNT password change API (auth endpoint)
      const response = await apiRequest(`${API_BASE_URL}/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to change password')
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      
      setToastMessage('Account password changed successfully!')
      setToastType('success')
    } catch (error) {
      console.error('Password change error:', error)
      setToastMessage(error instanceof Error ? error.message : 'Failed to change password')
      setToastType('error')
    } finally {
      setSaving(false)
    }
  }

  const handle2FAStatusChange = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, twoFactorEnabled: enabled }))
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setToastMessage('Please type DELETE to confirm account deletion')
      setToastType('error')
      return
    }

    if (!deletePassword) {
      setToastMessage('Please enter your account password')
      setToastType('error')
      return
    }

    setIsDeleting(true)
    try {
      const response = await apiRequest(`${API_BASE_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmDelete: deleteConfirmation
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }

      // Clear local storage
      localStorage.clear()
      
      // Redirect to home page
      router.push('/')
      
      setToastMessage('Account deleted successfully')
      setToastType('success')
    } catch (error) {
      console.error('Account deletion error:', error)
      setToastMessage(error instanceof Error ? error.message : 'Failed to delete account')
      setToastType('error')
    } finally {
      setIsDeleting(false)
    }
  }

  const renderAccountSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-lockr-cyan" />
          Account Information
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => handleSettingChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => handleSettingChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2 text-warning-600" />
          Change Account Password
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Account Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
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
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
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
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <button
            onClick={handlePasswordChange}
            disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
            className="px-4 py-2 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white rounded-lg hover:from-lockr-blue hover:to-lockr-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Account Password
          </button>
        </div>
      </div>
    </div>
  )

  const renderSecuritySection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-success-600" />
          Two-Factor Authentication
        </h3>
        
        <div className="flex items-center justify-between p-4 bg-accent-50 rounded-lg">
          <div>
            <p className="font-medium text-lockr-navy">Enable 2FA</p>
            <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
          </div>
          <button
            onClick={() => setShowTwoFactorModal(true)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              settings.twoFactorEnabled 
                ? 'bg-success-600 text-white hover:bg-success-700' 
                : 'bg-gradient-to-r from-lockr-navy to-lockr-blue text-white hover:from-lockr-blue hover:to-lockr-navy'
            }`}
          >
            {settings.twoFactorEnabled ? 'Enabled' : 'Setup 2FA'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4 flex items-center">
          <Timer className="w-5 h-5 mr-2 text-accent-600" />
          Session Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Timeout (minutes)
            </label>
            <select
              value={settings.sessionTimeout}
              onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={0}>Never</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="requirePasswordConfirmation"
              checked={settings.requirePasswordConfirmation}
              onChange={(e) => handleSettingChange('requirePasswordConfirmation', e.target.checked)}
              className="w-4 h-4 text-lockr-cyan border-gray-300 rounded focus:ring-lockr-cyan"
            />
            <label htmlFor="requirePasswordConfirmation" className="ml-2 text-sm text-gray-700">
              Require Password Confirmation
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderVaultSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4 flex items-center">
          <Lock className="w-5 h-5 mr-2 text-lockr-navy" />
          Auto-Lock Settings
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auto-lock timeout (minutes)
          </label>
          <select
            value={settings.autoLockTimeout}
            onChange={(e) => handleSettingChange('autoLockTimeout', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan"
          >
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={0}>Never</option>
          </select>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4">Clipboard Settings</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clear clipboard after (seconds)
          </label>
          <select
            value={settings.clipboardTimeout}
            onChange={(e) => handleSettingChange('clipboardTimeout', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lockr-cyan"
          >
            <option value={10}>10 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={0}>Never</option>
          </select>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4">General Settings</h3>
        
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showPasswordStrength"
              checked={settings.showPasswordStrength}
              onChange={(e) => handleSettingChange('showPasswordStrength', e.target.checked)}
              className="w-4 h-4 text-lockr-cyan border-gray-300 rounded focus:ring-lockr-cyan"
            />
            <label htmlFor="showPasswordStrength" className="ml-2 text-sm text-gray-700">
              Show password strength indicators
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoSave"
              checked={settings.autoSave}
              onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
              className="w-4 h-4 text-lockr-cyan border-gray-300 rounded focus:ring-lockr-cyan"
            />
            <label htmlFor="autoSave" className="ml-2 text-sm text-gray-700">
              Auto-save changes
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4 flex items-center">
          <Palette className="w-5 h-5 mr-2 text-accent-600" />
          Theme
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'system', label: 'System', icon: Monitor }
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleSettingChange('theme', value)}
              className={`p-4 border-2 rounded-lg flex flex-col items-center space-y-2 transition-colors ${
                settings.theme === value
                  ? 'border-lockr-cyan bg-accent-50 text-lockr-navy'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4">View Options</h3>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="compactView"
            checked={settings.compactView}
            onChange={(e) => handleSettingChange('compactView', e.target.checked)}
            className="w-4 h-4 text-lockr-cyan border-gray-300 rounded focus:ring-lockr-cyan"
          />
          <label htmlFor="compactView" className="ml-2 text-sm text-gray-700">
            Use compact view
          </label>
        </div>
      </div>
    </div>
  )

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4 flex items-center">
          <Bell className="w-5 h-5 mr-2 text-warning-600" />
          Notification Preferences
        </h3>
        
        <NotificationPreferences
          preferences={{
            securityAlerts: settings.securityAlerts,
            passwordExpiry: settings.passwordExpiry,
            breachAlerts: settings.breachAlerts,
            vaultActivity: settings.vaultActivity,
            accountUpdates: settings.accountUpdates,
            systemMaintenance: settings.systemMaintenance
          }}
          onUpdate={(preferences) => {
            Object.entries(preferences).forEach(([key, value]) => {
              handleSettingChange(key as keyof UserSettings, value)
            })
          }}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-lockr-navy mb-4">Test Notifications</h3>
        
        {/* Only show test buttons in development */}
        {process.env.NODE_ENV === 'development' ? (
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  await sendTestNotificationMutation.mutateAsync({
                    type: 'security',
                    subtype: 'new_device_login',
                    title: 'Test Security Alert',
                    message: 'This is a test security notification from your settings.',
                    priority: 'high'
                  })
                  setToastMessage('Test security notification sent!')
                  setToastType('success')
                } catch (error) {
                  console.error('Failed to send test security notification:', error)
                  setToastMessage('Failed to send test notification')
                  setToastType('error')
                }
              }}
              disabled={sendTestNotificationMutation.isPending}
              className="w-full sm:w-auto px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendTestNotificationMutation.isPending ? 'Sending...' : 'Test Security Alert'}
            </button>
            
            <button
              onClick={async () => {
                try {
                  await sendTestNotificationMutation.mutateAsync({
                    type: 'account',
                    subtype: 'welcome',
                    title: 'Test Account Update',
                    message: 'This is a test account notification from your settings.',
                    priority: 'medium'
                  })
                  setToastMessage('Test account notification sent!')
                  setToastType('success')
                } catch (error) {
                  console.error('Failed to send test account notification:', error)
                  setToastMessage('Failed to send test notification')
                  setToastType('error')
                }
              }}
              disabled={sendTestNotificationMutation.isPending}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white rounded-lg hover:from-lockr-blue hover:to-lockr-navy transition-colors ml-0 sm:ml-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendTestNotificationMutation.isPending ? 'Sending...' : 'Test Account Update'}
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Notification System</h4>
                <p className="text-blue-700 text-sm">
                  You'll receive notifications for real events like security alerts, 
                  account updates, password changes, and system events. Test the notification 
                  system by performing actions that trigger notifications.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderDangerSection = () => (
    <div className="space-y-6">
      <div className="bg-error-50 border border-error-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-error-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-error-900 mb-2">Danger Zone</h3>
            <p className="text-error-700 text-sm mb-4">
              These actions are irreversible and will permanently delete your data. Please proceed with caution.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-error-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Delete Account</h4>
            <p className="text-gray-600 text-sm mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            
            {!showDeleteAccount ? (
              <button
                onClick={() => setShowDeleteAccount(true)}
                className="px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-error-50 border border-error-200 rounded-lg p-4">
                  <h5 className="font-medium text-error-900 mb-2">⚠️ Final Warning</h5>
                  <ul className="text-error-700 text-sm space-y-1">
                    <li>• All your passwords and secure data will be permanently deleted</li>
                    <li>• Your account will be immediately deactivated</li>
                    <li>• This action cannot be reversed or recovered</li>
                    <li>• You will lose access to all your stored information</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type "DELETE" to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-error-500 focus:border-error-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your account password
                  </label>
                  <div className="relative">
                    <input
                      type={showDeletePassword ? 'text' : 'password'}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Account password"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-error-500 focus:border-error-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This is the password you use to log into your Lockr account
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmation !== 'DELETE' || !deletePassword}
                    className="px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isDeleting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>{isDeleting ? 'Deleting...' : 'Permanently Delete Account'}</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowDeleteAccount(false)
                      setDeleteConfirmation('')
                      setDeletePassword('')
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Before You Delete</h4>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Export your data if you want to keep a backup</li>
              <li>• Consider deactivating 2FA if you plan to use the same phone number elsewhere</li>
              <li>• Make sure you have access to all accounts stored in your vault</li>
              <li>• Contact support if you need help with account recovery</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )

  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'account':
        return renderAccountSection()
      case 'security':
        return renderSecuritySection()
      case 'phone':
        return <PhoneManagement />
      case 'vault':
        return renderVaultSection()
      case 'appearance':
        return renderAppearanceSection()
      case 'notifications':
        return renderNotificationsSection()
      case 'danger':
        return renderDangerSection()
      default:
        return renderAccountSection()
    }
  }

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-accent-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-lockr-cyan mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ResponsiveSettings
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        saving={saving}
        onSave={handleSaveSettings}
      >
        {renderCurrentSection()}
      </ResponsiveSettings>

      {/* 2FA Modal */}
      {showTwoFactorModal && (
        <TwoFactorModal
          isOpen={showTwoFactorModal}
          onClose={() => setShowTwoFactorModal(false)}
          token={typeof window !== 'undefined' ? localStorage.getItem('lockr_access_token') || '' : ''}
          currentlyEnabled={settings.twoFactorEnabled}
          onStatusChange={handle2FAStatusChange}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-lg shadow-lockr-lg ${
            toastType === 'success' ? 'bg-success-600 text-white' :
            toastType === 'error' ? 'bg-error-600 text-white' :
            'bg-gradient-to-r from-lockr-navy to-lockr-blue text-white'
          }`}>
            <div className="flex items-center space-x-2">
              {toastType === 'success' && <CheckCircle className="w-5 h-5" />}
              {toastType === 'error' && <AlertTriangle className="w-5 h-5" />}
              <span>{toastMessage}</span>
              <button
                onClick={() => setToastMessage(null)}
                className="ml-2 text-white hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ResponsiveSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-accent-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-lockr-cyan mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  )
} 