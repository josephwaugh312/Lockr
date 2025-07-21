'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { API_BASE_URL } from '../../../lib/utils';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isClient, setIsClient] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    twoFactorCode: '',
    remember: false
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    twoFactorCode: '',
    general: ''
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

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
    const newErrors = { email: '', password: '', twoFactorCode: '', general: '' };
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Account password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Account password must be at least 8 characters';
    }

    if (requires2FA && !formData.twoFactorCode) {
      newErrors.twoFactorCode = 'Two-factor authentication code is required';
    } else if (requires2FA && formData.twoFactorCode.length !== 6) {
      newErrors.twoFactorCode = 'Please enter a 6-digit code';
    }

    setErrors(newErrors);

    // If there are errors, don't submit
    if (Object.values(newErrors).some(error => error)) {
      return;
    }

    setIsLoading(true);
    
    try {
      const loginData: any = {
        email: formData.email,
        password: formData.password
      };

      // Include 2FA code if we're in 2FA mode
      if (requires2FA && formData.twoFactorCode) {
        loginData.twoFactorCode = formData.twoFactorCode;
      }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check if 2FA is required
      if (data.requires2FA) {
        setRequires2FA(true);
        setErrors(prev => ({ ...prev, general: '' }));
        return;
      }

      // Successful login
      if (data.tokens) {
        // Store tokens
        localStorage.setItem('lockr_access_token', data.tokens.accessToken);
        localStorage.setItem('lockr_refresh_token', data.tokens.refreshToken);
        
        // Store user data
        localStorage.setItem('lockr_user', JSON.stringify(data.user));

        // Handle redirect parameter
        const redirectTo = searchParams.get('redirect');
        if (redirectTo === 'settings') {
          router.push('/settings');
        } else if (redirectTo) {
          // Sanitize redirect URL to prevent open redirect attacks
          const allowedPaths = ['/dashboard', '/vault', '/settings', '/profile'];
          if (allowedPaths.includes(redirectTo) || redirectTo.startsWith('/vault/')) {
            router.push(redirectTo);
          } else {
            router.push('/dashboard');
          }
        } else {
          // Default redirect to dashboard
          router.push('/dashboard');
        }
      }
      
    } catch (error) {
      console.error('Login failed:', error);
      setErrors(prev => ({ 
        ...prev, 
        general: error instanceof Error ? error.message : 'Login failed. Please try again.' 
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
              <Lock className="w-6 h-6 text-lockr-cyan" />
            </div>
            <span className="text-2xl font-bold text-lockr-navy">Lockr</span>
          </Link>
          <h1 className="text-3xl font-bold text-lockr-navy mb-2">Welcome Back</h1>
          <p className="text-gray-600">Enter your account password to access your vault</p>
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Account Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-12 py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent transition-colors ${
                      errors.password ? 'border-error-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your account password"
                    autoComplete="current-password"
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
                {errors.password && (
                  <p className="mt-1 text-sm text-error-600">{errors.password}</p>
                )}
              </div>

              {/* Two-Factor Authentication Field */}
              {requires2FA && (
                <div>
                  <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Two-Factor Authentication Code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Shield className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="twoFactorCode"
                      name="twoFactorCode"
                      value={formData.twoFactorCode}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:border-transparent transition-colors ${
                        errors.twoFactorCode ? 'border-error-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter your 6-digit code"
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                  </div>
                  {errors.twoFactorCode && (
                    <p className="mt-1 text-sm text-error-600">{errors.twoFactorCode}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
              )}

              {/* General Error Message */}
              {errors.general && (
                <div className="bg-error-50 border border-error-200 rounded-lg p-3">
                  <p className="text-error-600 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  checked={formData.remember}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-lockr-cyan focus:ring-lockr-cyan border-gray-300 rounded"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
                  Remember this device for 30 days
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-lockr-navy hover:bg-lockr-blue text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-lockr-cyan focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* Links - Always visible */}
          <div className="mt-6 text-center space-y-2">
            <Link
              href="/auth/forgot-password"
              className="text-lockr-cyan hover:text-lockr-blue text-sm transition-colors"
            >
              Forgot your account password?
            </Link>
            <div className="text-gray-600 text-sm">
              Don&apos;t have an account?{' '}
              <Link
                href="/authentication/signup"
                className="text-lockr-cyan hover:text-lockr-blue font-semibold transition-colors"
              >
                Create one here
              </Link>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <Link
                href="/auth/forgot-master-password"
                className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
              >
                🔑 Forgot your master password? (⚠️ will delete all vault data)
              </Link>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>🔒 Your master password is never stored on our servers</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
} 