'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, 
  Smartphone, 
  Key, 
  AlertTriangle, 
  CheckCircle,
  Copy,
  Download,
  Eye,
  EyeOff
} from 'lucide-react'
import { API_BASE_URL } from '../lib/utils'

interface TwoFactorModalProps {
  isOpen: boolean
  onClose: () => void
  token: string
  onStatusChange: (enabled: boolean) => void
  currentlyEnabled: boolean
}

interface TwoFactorSetupData {
  secret: string
  qrCodeUrl: string
  manualEntryKey: string
  backupCodes: string[]
  instructions: {
    steps: string[]
    supportedApps: string[]
    securityTips: string[]
  }
}

export default function TwoFactorModal({ isOpen, onClose, token, onStatusChange, currentlyEnabled }: TwoFactorModalProps) {
  const [step, setStep] = useState<'setup' | 'qr' | 'verify' | 'disable' | 'success'>('setup')
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedCodes, setCopiedCodes] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep(currentlyEnabled ? 'disable' : 'setup')
      setError('')
      setVerificationCode('')
      setPassword('')
      setSetupData(null)
    }
  }, [isOpen, currentlyEnabled])

  const handleSetup2FA = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to set up two-factor authentication')
      }

      const data = await response.json()
      setSetupData(data)
      setStep('qr')
    } catch (err) {
      if (err instanceof Error) {
        // If it's a network error, provide a more specific message
        if (err.message === 'Network error' || err.name === 'TypeError') {
          setError('Failed to set up two-factor authentication. Please check your connection and try again.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to set up two-factor authentication')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnable2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          token: verificationCode
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to enable 2FA')
      }

      const data = await response.json()
      setStep('success')
      onStatusChange(true)
      // Clear the code for security
      setVerificationCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable 2FA')
      // Clear the code on error
      setVerificationCode('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disable 2FA')
      }

      onStatusChange(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA')
    } finally {
      setIsLoading(false)
    }
  }

  const copyBackupCodes = () => {
    if (setupData?.backupCodes) {
      const codesText = setupData.backupCodes.join('\n')
      navigator.clipboard.writeText(codesText)
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
    }
  }

  const downloadBackupCodes = () => {
    if (setupData?.backupCodes) {
      const codesText = setupData.backupCodes.join('\n')
      const blob = new Blob([codesText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lockr-backup-codes.txt'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (!isOpen) return null

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  // Use useEffect to handle global keydown events
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            {currentlyEnabled ? 'Two-Factor Authentication' : 'Set Up Two-Factor Authentication'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Setup Step */}
          {step === 'setup' && (
            <div className="space-y-4">
              <div className="text-center">
                <Smartphone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Secure Your Account
                </h3>
                <p className="text-gray-600">
                  Two-factor authentication adds an extra layer of security to your account by requiring a code from your phone in addition to your password.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What you'll need:</h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• A smartphone or tablet</li>
                  <li>• An authenticator app (Google Authenticator, Authy, etc.)</li>
                  <li>• A few minutes to complete setup</li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetup2FA}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Setting up...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Begin Setup</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* QR Code Step */}
          {step === 'qr' && setupData && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Scan QR Code
                </h3>
                
                <div className="bg-white border-2 border-gray-200 rounded-lg p-4 inline-block">
                  <img 
                    src={setupData.qrCodeUrl} 
                    alt="2FA QR Code"
                    className="w-48 h-48"
                  />
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Can't scan? Enter this code manually:</p>
                  <div className="bg-gray-100 border rounded-lg p-3 font-mono text-sm break-all">
                    {setupData.secret}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 mb-2">Backup Codes</h4>
                <p className="text-sm text-amber-800 mb-3">
                  Save these codes in a secure location. You can use them to access your account if you lose your phone.
                </p>
                <div className="bg-white border rounded-lg p-3 font-mono text-sm">
                  {setupData.backupCodes?.map((code, index) => (
                    <div key={index} className="text-center">{code}</div>
                  )) || <div className="text-center text-gray-500">No backup codes available</div>}
                </div>
                {setupData.backupCodes && (
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={copyBackupCodes}
                      className="flex items-center space-x-1 px-3 py-1 bg-amber-100 text-amber-800 rounded text-sm hover:bg-amber-200"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCodes ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={downloadBackupCodes}
                      className="flex items-center space-x-1 px-3 py-1 bg-amber-100 text-amber-800 rounded text-sm hover:bg-amber-200"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('setup')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('verify')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Verify Step */}
          {step === 'verify' && setupData && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Verify Setup
                </h3>
                <p className="text-gray-600">
                  Enter the 6-digit code from your authenticator app to complete setup.
                </p>
              </div>

              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter verification code from your app:
                </label>
                <input
                  id="verification-code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-lg"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('qr')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleEnable2FA}
                  disabled={isLoading || verificationCode.length !== 6}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Enabling...' : 'Enable 2FA'}
                </button>
              </div>
            </div>
          )}

          {/* Disable Step */}
          {step === 'disable' && (
            <div className="space-y-4">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Disable Two-Factor Authentication
                </h3>
                <p className="text-gray-600">
                  Are you sure you want to disable two-factor authentication?
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisable2FA}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="space-y-4 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900">
                Two-Factor Authentication Enabled!
              </h3>
              <p className="text-gray-600">
                Your account is now protected with an additional layer of security.
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Important Reminders:</h4>
                <ul className="space-y-1 text-sm text-green-800 text-left">
                  <li>• Keep your backup codes safe and accessible</li>
                  <li>• You'll need your authenticator app to sign in</li>
                  <li>• Contact support if you lose access to your device</li>
                </ul>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 