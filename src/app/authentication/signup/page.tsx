'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shield, Eye, EyeOff, Mail, Lock, AlertCircle, Check, X, Loader2 } from 'lucide-react'
import { API_BASE_URL } from '../../../lib/utils'

export default function RegisterPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    accountPassword: '',
    confirmAccountPassword: '',
    masterPassword: '',
    confirmMasterPassword: '',
    agreedToTerms: false
  });
  const [errors, setErrors] = useState({
    email: '',
    accountPassword: '',
    confirmAccountPassword: '',
    masterPassword: '',
    confirmMasterPassword: '',
    terms: '',
    general: ''
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    const checks = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    Object.values(checks).forEach(check => check && score++);

    if (score <= 2) return { level: 'Weak', color: 'bg-error-500', width: '33%' };
    if (score <= 4) return { level: 'Good', color: 'bg-warning-500', width: '66%' };
    return { level: 'Strong', color: 'bg-success-500', width: '100%' };
  };

  const accountPasswordStrength = calculatePasswordStrength(formData.accountPassword);
  const masterPasswordStrength = calculatePasswordStrength(formData.masterPassword);
  
  const accountPasswordChecks = {
    length: formData.accountPassword.length >= 12,
    uppercase: /[A-Z]/.test(formData.accountPassword),
    lowercase: /[a-z]/.test(formData.accountPassword),
    numbers: /\d/.test(formData.accountPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.accountPassword)
  };

  const masterPasswordChecks = {
    length: formData.masterPassword.length >= 12,
    uppercase: /[A-Z]/.test(formData.masterPassword),
    lowercase: /[a-z]/.test(formData.masterPassword),
    numbers: /\d/.test(formData.masterPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.masterPassword)
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear errors when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '', general: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors = { email: '', accountPassword: '', confirmAccountPassword: '', masterPassword: '', confirmMasterPassword: '', terms: '', general: '' };
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.accountPassword) {
      newErrors.accountPassword = 'Account password is required';
    } else if (accountPasswordStrength.level === 'Weak') {
      newErrors.accountPassword = 'Password is too weak. Please create a stronger password.';
    }
    
    if (!formData.confirmAccountPassword) {
      newErrors.confirmAccountPassword = 'Please confirm your account password';
    } else if (formData.accountPassword !== formData.confirmAccountPassword) {
      newErrors.confirmAccountPassword = 'Passwords do not match';
    }

    if (!formData.masterPassword) {
      newErrors.masterPassword = 'Master password is required';
    } else if (masterPasswordStrength.level === 'Weak') {
      newErrors.masterPassword = 'Password is too weak. Please create a stronger password.';
    }
    
    if (!formData.confirmMasterPassword) {
      newErrors.confirmMasterPassword = 'Please confirm your master password';
    } else if (formData.masterPassword !== formData.confirmMasterPassword) {
      newErrors.confirmMasterPassword = 'Passwords do not match';
    }

    if (!formData.agreedToTerms) {
      newErrors.terms = 'You must agree to the Terms and Conditions';
    }

    setErrors(newErrors);

    // If there are errors, don't submit
    if (Object.values(newErrors).some(error => error)) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.accountPassword,
          masterPassword: formData.masterPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Successful registration
      if (data.tokens) {
        // Store tokens
        localStorage.setItem('lockr_access_token', data.tokens.accessToken);
        localStorage.setItem('lockr_refresh_token', data.tokens.refreshToken);
        
        // Store user data
        localStorage.setItem('lockr_user', JSON.stringify(data.user));

        // Redirect to dashboard
        router.push('/dashboard');
      }
      
    } catch (error) {
      console.error('Registration failed:', error);
      setErrors(prev => ({ 
        ...prev, 
        general: error instanceof Error ? error.message : 'Registration failed. Please try again.' 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-lockr-navy rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-lockr-cyan" />
            </div>
            <span className="text-2xl font-bold text-lockr-navy">Lockr</span>
          </Link>
          <h1 className="text-3xl font-bold text-lockr-navy mb-2">Create Your Vault</h1>
          <p className="text-gray-600">Set up your secure password manager account</p>
          
          {/* Password Explanation */}
          <div className="mt-6 p-4 bg-lockr-cyan/10 rounded-lg border border-lockr-cyan/20">
            <h3 className="text-sm font-semibold text-lockr-navy mb-2">Why Two Passwords?</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Account Password:</strong> Log into your Lockr account</p>
              <p><strong>Master Password:</strong> Unlock and decrypt your vault data</p>
              <p className="text-lockr-navy">💡 This ensures maximum security - even we can't access your vault!</p>
            </div>
          </div>
        </div>

        {/* Form - Only render after client hydration */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-lockr-lg border border-gray-200">
          {!isClient ? (
            // Loading placeholder during SSR
            <div className="space-y-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          ) : (
            // Actual form - only rendered on client
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    className={`w-full pl-10 pr-4 py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent transition-colors ${
                      errors.email ? 'border-error-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-error-600">{errors.email}</p>
                )}
              </div>

              {/* Account Password Field */}
              <div>
                <label htmlFor="accountPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Account Password
                  <span className="text-xs text-gray-500 font-normal ml-2">(for logging into Lockr)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="accountPassword"
                    name="accountPassword"
                    value={formData.accountPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent transition-colors ${
                      errors.accountPassword ? 'border-error-500' : 'border-gray-300'
                    }`}
                    placeholder="Password for your Lockr account"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-lockr-cyan transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.accountPassword && (
                  <p className="mt-1 text-sm text-error-600">{errors.accountPassword}</p>
                )}

                {/* Password Strength Indicator */}
                {formData.accountPassword && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Password Strength:</span>
                      <span className={`text-sm font-medium ${
                        accountPasswordStrength.level === 'Weak' ? 'text-error-600' :
                        accountPasswordStrength.level === 'Good' ? 'text-warning-600' :
                        'text-success-600'
                      }`}>
                        {accountPasswordStrength.level}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${accountPasswordStrength.color}`}
                        style={{ width: accountPasswordStrength.width }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Password Requirements */}
                {formData.accountPassword && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-600 mb-2">Password must include:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries({
                        'At least 12 characters': accountPasswordChecks.length,
                        'Uppercase letter': accountPasswordChecks.uppercase,
                        'Lowercase letter': accountPasswordChecks.lowercase,
                        'Number': accountPasswordChecks.numbers,
                        'Special character': accountPasswordChecks.special
                      }).map(([requirement, met]) => (
                        <div key={requirement} className="flex items-center space-x-1">
                          {met ? (
                            <Check className="w-3 h-3 text-success-500" />
                          ) : (
                            <X className="w-3 h-3 text-error-500" />
                          )}
                          <span className={met ? 'text-success-600' : 'text-gray-500'}>
                            {requirement}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Account Password Field */}
              <div>
                <label htmlFor="confirmAccountPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Account Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmAccountPassword"
                    name="confirmAccountPassword"
                    value={formData.confirmAccountPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent transition-colors ${
                      errors.confirmAccountPassword ? 'border-error-500' : 
                      formData.confirmAccountPassword && formData.accountPassword !== formData.confirmAccountPassword ? 'border-error-500' :
                      'border-gray-300'
                    }`}
                    placeholder="Confirm your account password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-lockr-cyan transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.confirmAccountPassword && (
                  <p className="mt-1 text-sm text-error-600">{errors.confirmAccountPassword}</p>
                )}
                {formData.confirmAccountPassword && formData.accountPassword !== formData.confirmAccountPassword && (
                  <p className="mt-1 text-sm text-error-600">Passwords do not match</p>
                )}
              </div>

              {/* Master Password Field */}
              <div>
                <label htmlFor="masterPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Master Password
                  <span className="text-xs text-gray-500 font-normal ml-2">(for unlocking your vault)</span>
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
                    className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent transition-colors ${
                      errors.masterPassword ? 'border-error-500' : 'border-gray-300'
                    }`}
                    placeholder="Password that encrypts your vault data"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-lockr-cyan transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.masterPassword && (
                  <p className="mt-1 text-sm text-error-600">{errors.masterPassword}</p>
                )}

                {/* Password Strength Indicator */}
                {formData.masterPassword && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Password Strength:</span>
                      <span className={`text-sm font-medium ${
                        masterPasswordStrength.level === 'Weak' ? 'text-error-600' :
                        masterPasswordStrength.level === 'Good' ? 'text-warning-600' :
                        'text-success-600'
                      }`}>
                        {masterPasswordStrength.level}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${masterPasswordStrength.color}`}
                        style={{ width: masterPasswordStrength.width }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Password Requirements */}
                {formData.masterPassword && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-600 mb-2">Password must include:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries({
                        'At least 12 characters': masterPasswordChecks.length,
                        'Uppercase letter': masterPasswordChecks.uppercase,
                        'Lowercase letter': masterPasswordChecks.lowercase,
                        'Number': masterPasswordChecks.numbers,
                        'Special character': masterPasswordChecks.special
                      }).map(([requirement, met]) => (
                        <div key={requirement} className="flex items-center space-x-1">
                          {met ? (
                            <Check className="w-3 h-3 text-success-500" />
                          ) : (
                            <X className="w-3 h-3 text-error-500" />
                          )}
                          <span className={met ? 'text-success-600' : 'text-gray-500'}>
                            {requirement}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Master Password Field */}
              <div>
                <label htmlFor="confirmMasterPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Master Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmMasterPassword"
                    name="confirmMasterPassword"
                    value={formData.confirmMasterPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent transition-colors ${
                      errors.confirmMasterPassword ? 'border-error-500' : 
                      formData.confirmMasterPassword && formData.masterPassword !== formData.confirmMasterPassword ? 'border-error-500' :
                      'border-gray-300'
                    }`}
                    placeholder="Confirm your master password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-lockr-cyan transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.confirmMasterPassword && (
                  <p className="mt-1 text-sm text-error-600">{errors.confirmMasterPassword}</p>
                )}
                {formData.confirmMasterPassword && formData.masterPassword !== formData.confirmMasterPassword && (
                  <p className="mt-1 text-sm text-error-600">Passwords do not match</p>
                )}
              </div>

              {/* Terms and Conditions */}
              <div>
                <div className="flex items-start">
                  <input
                    id="agreedToTerms"
                    name="agreedToTerms"
                    type="checkbox"
                    checked={formData.agreedToTerms}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-lockr-cyan focus:ring-lockr-cyan border-gray-300 rounded mt-1"
                  />
                  <label htmlFor="agreedToTerms" className="ml-2 block text-sm text-gray-700">
                    I agree to the{' '}
                    <Link href="/terms" className="text-lockr-cyan hover:text-lockr-blue font-medium">
                      Terms and Conditions
                    </Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-lockr-cyan hover:text-lockr-blue font-medium">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                {errors.terms && (
                  <p className="mt-1 text-sm text-error-600">{errors.terms}</p>
                )}
              </div>

              {/* General Error Message */}
              {errors.general && (
                <div className="bg-error-50 border border-error-200 rounded-lg p-3">
                  <p className="text-error-600 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-lockr-navy hover:bg-lockr-blue text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating Your Vault...</span>
                  </>
                ) : (
                  <span>Create Secure Vault</span>
                )}
              </button>
            </form>
          )}

          {/* Links - Always visible */}
          <div className="mt-6 text-center">
            <div className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link
                href="/authentication/signin"
                className="text-lockr-cyan hover:text-lockr-blue font-semibold transition-colors"
              >
                Sign in here
              </Link>
            </div>
          </div>
        </div>

        {/* Security Warnings - Always visible */}
        <div className="mt-6 space-y-2">
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning-800 mb-1">Important Security Notice</p>
                <p className="text-warning-700">
                  Your master password cannot be recovered if forgotten. Make sure to store it safely.
                </p>
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-500">
            <p>🔒 Your password is encrypted locally and never stored on our servers</p>
          </div>
        </div>
      </div>
    </div>
  );
} 