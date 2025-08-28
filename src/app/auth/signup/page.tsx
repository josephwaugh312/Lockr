'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, Eye, EyeOff, Mail, Lock, AlertCircle, Check, X } from 'lucide-react'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    masterPassword: '',
    confirmPassword: '',
    acceptTerms: false
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const getPasswordStrength = (password: string) => {
    if (password.length < 8) return { score: 0, text: 'Too short', color: 'text-error-600' }
    
    let score = 0
    if (password.length >= 12) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++

    if (score < 2) return { score: 1, text: 'Weak', color: 'text-error-600' }
    if (score < 4) return { score: 2, text: 'Fair', color: 'text-warning-600' }
    if (score < 5) return { score: 3, text: 'Good', color: 'text-lockr-blue' }
    return { score: 4, text: 'Strong', color: 'text-success-600' }
  }

  const passwordStrength = getPasswordStrength(formData.masterPassword)

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.masterPassword) {
      newErrors.masterPassword = 'Master password is required'
    } else if (formData.masterPassword.length < 8) {
      newErrors.masterPassword = 'Master password must be at least 8 characters'
    } else if (passwordStrength.score < 3) {
      newErrors.masterPassword = 'Please create a stronger password'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your master password'
    } else if (formData.masterPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      // TODO: Implement actual registration logic
      console.log('Registration attempt:', { email: formData.email })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // For now, just show success (replace with actual logic)
      alert('Registration successful! (This is a placeholder)')
      
    } catch (error) {
      setErrors({ 
        general: 'Registration failed. Please try again.' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const passwordRequirements = [
    { test: formData.masterPassword.length >= 8, text: 'At least 8 characters' },
    { test: /[a-z]/.test(formData.masterPassword), text: 'Lowercase letter' },
    { test: /[A-Z]/.test(formData.masterPassword), text: 'Uppercase letter' },
    { test: /[0-9]/.test(formData.masterPassword), text: 'Number' },
    { test: /[^a-zA-Z0-9]/.test(formData.masterPassword), text: 'Special character' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-lockr-navy rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-lockr-cyan" />
            </div>
            <span className="text-2xl font-bold text-lockr-navy">Lockr</span>
          </Link>
          <h1 className="text-3xl font-bold text-lockr-navy mb-2">Create Your Vault</h1>
          <p className="text-gray-600">Set up your master password to secure your digital life</p>
        </div>

        {/* Registration Form */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-lockr-lg border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="bg-error-50 border border-error-500/30 rounded-lg p-4 flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-error-500" />
                <span className="text-error-600 text-sm">{errors.general}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-4 py-3 bg-white border rounded-lg text-lockr-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent ${
                    errors.email ? 'border-error-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-error-600">{errors.email}</p>
              )}
            </div>

            {/* Master Password Field */}
            <div>
              <label htmlFor="masterPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="masterPassword"
                  name="masterPassword"
                  value={formData.masterPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-lockr-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent ${
                    errors.masterPassword ? 'border-error-500' : 'border-gray-300'
                  }`}
                  placeholder="Create a strong master password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.masterPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Password strength:</span>
                    <span className={`text-sm font-medium ${passwordStrength.color}`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordStrength.score === 1 ? 'bg-error-500 w-1/4' :
                        passwordStrength.score === 2 ? 'bg-warning-500 w-2/4' :
                        passwordStrength.score === 3 ? 'bg-lockr-blue w-3/4' :
                        passwordStrength.score === 4 ? 'bg-success-500 w-full' : 'w-0'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Password Requirements */}
              {formData.masterPassword && (
                <div className="mt-3 space-y-1">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center space-x-2 text-xs">
                      {req.test ? (
                        <Check className="h-3 w-3 text-success-500" />
                      ) : (
                        <X className="h-3 w-3 text-gray-400" />
                      )}
                      <span className={req.test ? 'text-success-600' : 'text-gray-500'}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {errors.masterPassword && (
                <p className="mt-2 text-sm text-error-600">{errors.masterPassword}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-lockr-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent ${
                    errors.confirmPassword ? 'border-error-500' : 'border-gray-300'
                  }`}
                  placeholder="Confirm your master password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-error-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms Acceptance */}
            <div>
              <div className="flex items-start">
                <input
                  id="acceptTerms"
                  name="acceptTerms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-lockr-cyan focus:ring-lockr-cyan border-gray-300 rounded mt-0.5"
                />
                <label htmlFor="acceptTerms" className="ml-2 block text-sm text-gray-600">
                  I agree to the{' '}
                  <Link href="/terms" className="text-lockr-cyan hover:text-lockr-blue underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-lockr-cyan hover:text-lockr-blue underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {errors.acceptTerms && (
                <p className="mt-2 text-sm text-error-600">{errors.acceptTerms}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-lockr-navy hover:bg-lockr-blue disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:ring-offset-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg data-testid="loader-icon" className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Your Vault...
                </span>
              ) : (
                'Create Vault'
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center">
            <div className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link
                href="/auth/signin"
                className="text-lockr-cyan hover:text-lockr-blue font-semibold transition-colors"
              >
                Sign in here
              </Link>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-gray-500 space-y-1">
          <p>🔒 Your master password is the key to your vault</p>
          <p>⚠️ We cannot recover it if you forget it</p>
        </div>
      </div>
    </div>
  )
} 