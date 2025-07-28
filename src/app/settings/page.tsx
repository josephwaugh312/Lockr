'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import TwoFactorModal from '../../components/TwoFactorModal'
import ResponsiveSettings from '../../components/ResponsiveSettings'
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
  X
} from 'lucide-react'
import { API_BASE_URL, apiRequest } from '../../lib/utils'
import { useSendTestNotification } from '../../hooks/useNotifications'
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

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isClient, setIsClient] = useState(false)
  const [settings, setSettings] = useState<UserSettings>(initialSettings)
  const [activeSection, setActiveSection] = useState(() => {
    const section = searchParams.get('section')
    return ['account', 'security', 'vault', 'appearance', 'notifications'].includes(section || '') 
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
    if (section && ['account', 'security', 'vault', 'appearance', 'notifications'].includes(section)) {
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
        throw new Error(data.error || 'Failed to change password')
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      
      setToastMessage('Master password changed successfully!')
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
          Change Password
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
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
            className="px-4 py-2 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white rounded-lg hover:from-lockr-blue hover:to-lockr-navy transition-colors"
          >
            Update Password
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
              Require password confirmation for sensitive actions
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
        
        <div className="space-y-3">
          <button
            onClick={() => {
              setToastMessage('Test security notification sent!')
              setToastType('info')
            }}
            className="w-full sm:w-auto px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"
          >
            Test Security Alert
          </button>
          
          <button
            onClick={() => {
              setToastMessage('Test account notification sent!')
              setToastType('info')
            }}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white rounded-lg hover:from-lockr-blue hover:to-lockr-navy transition-colors ml-0 sm:ml-3"
          >
            Test Account Update
          </button>
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
      case 'vault':
        return renderVaultSection()
      case 'appearance':
        return renderAppearanceSection()
      case 'notifications':
        return renderNotificationsSection()
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