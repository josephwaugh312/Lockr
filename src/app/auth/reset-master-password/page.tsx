'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertTriangle, Trash2, Shield, Check } from 'lucide-react';
import { API_BASE_URL, apiRequest } from '../../../lib/utils';
import { validatePasswordStrength } from '@/utils/validation';

// Client-side only component to prevent hydration issues
function ClientOnlyForm({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    
    // Clean up any browser extension modifications after mount
    const cleanupTimer = setTimeout(() => {
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      passwordInputs.forEach(input => {
        // Remove any injected elements from browser extensions
        const parent = input.parentElement;
        if (parent) {
          const injectedElements = parent.querySelectorAll('[data-test], .xv-pwm-icon, [class*="extension"], [class*="password-manager"]');
          injectedElements.forEach(el => {
            if (el !== input) {
              el.remove();
            }
          });
        }
      });
    }, 100);

    return () => clearTimeout(cleanupTimer);
  }, []);

  if (!hasMounted) {
    return (
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function ResetMasterPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    newMasterPassword: false,
    confirmMasterPassword: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [entriesWiped, setEntriesWiped] = useState(0);
  const [errors, setErrors] = useState({
    token: '',
    newMasterPassword: '',
    confirmMasterPassword: '',
    confirmed: '',
    general: ''
  });
  
  const tokenParam = searchParams.get('token');
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
      // Validate token format
      if (!/^[a-f0-9]{64}$/i.test(tokenParam)) {
        setErrors(prev => ({ ...prev, token: 'Invalid reset token format' }));
      }
    } else {
      setErrors(prev => ({ ...prev, token: 'Reset token is required' }));
    }
  }, [tokenParam]);

  // Prevent browser extension interference
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Prevent browser extension interference */
      input[data-form-type="password"] {
        background-image: none !important;
        background-color: transparent !important;
      }
      
      /* Hide browser extension injected elements */
      [data-test*="password"] {
        display: none !important;
      }
      
      .xv-pwm-icon,
      [class*="extension-"],
      [class*="password-manager-"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const validatePassword = (password: string) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('Must be at least 8 characters long');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Must contain at least one uppercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
      errors.push('Must contain at least one special character');
    }
    return errors;
  };

  const handlePasswordChange = (field: 'newMasterPassword' | 'confirmMasterPassword', value: string) => {
    if (field === 'newMasterPassword') {
      setNewMasterPassword(value);
      // Check if confirm password exists and doesn't match the new value
      if (confirmMasterPassword && value !== confirmMasterPassword) {
        setErrors(prev => ({ ...prev, confirmMasterPassword: 'Passwords do not match' }));
      } else if (confirmMasterPassword && value === confirmMasterPassword) {
        setErrors(prev => ({ ...prev, confirmMasterPassword: '' }));
      }
    } else {
      setConfirmMasterPassword(value);
      // Check if new password exists and doesn't match the confirm value
      if (newMasterPassword && value !== newMasterPassword) {
        setErrors(prev => ({ ...prev, confirmMasterPassword: 'Passwords do not match' }));
      } else if (newMasterPassword && value === newMasterPassword) {
        setErrors(prev => ({ ...prev, confirmMasterPassword: '' }));
      }
    }
    
    // Clear other errors when user starts typing
    if (errors[field] && field !== 'confirmMasterPassword') {
      setErrors(prev => ({ ...prev, [field]: '', general: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ token: '', newMasterPassword: '', confirmMasterPassword: '', confirmed: '', general: '' });

    // Validate token
    if (!token) {
      setErrors(prev => ({ ...prev, token: 'Reset token is required' }));
      return;
    }

    // Validate password
    const passwordErrors = validatePassword(newMasterPassword);
    if (passwordErrors.length > 0) {
      setErrors(prev => ({ ...prev, newMasterPassword: passwordErrors.join('; ') }));
      return;
    }

    // Validate password confirmation
    if (newMasterPassword !== confirmMasterPassword) {
      setErrors(prev => ({ ...prev, confirmMasterPassword: 'Passwords do not match' }));
      return;
    }

    // Validate confirmation
    if (!confirmed) {
      setErrors(prev => ({ ...prev, confirmed: 'You must confirm that you understand all vault data will be permanently deleted' }));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-master-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newMasterPassword,
          confirmed: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a token-related error
        const errorMessage = data.error || 'Failed to reset master password';
        const isTokenError = errorMessage.toLowerCase().includes('token') || 
                           errorMessage.toLowerCase().includes('expired') ||
                           errorMessage.toLowerCase().includes('invalid') ||
                           response.status === 401 ||
                           response.status === 403;
        
        if (isTokenError) {
          setErrors(prev => ({ ...prev, token: errorMessage }));
        } else {
          throw new Error(errorMessage);
        }
        return;
      }

      setEntriesWiped(data.entriesWiped || 0);
      setIsSuccess(true);
    } catch (err) {
      console.error('Reset master password error:', err);
      setErrors(prev => ({ 
        ...prev, 
        general: err instanceof Error ? err.message : 'An error occurred' 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Master password reset successful
              </h2>
              <p className="text-gray-600 mb-4">
                Your master password has been updated and all vault data has been permanently deleted.
              </p>
              
              {/* Wipe Summary */}
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-400 mr-2" />
                  <div className="text-sm">
                    <p className="font-medium text-red-800">Vault Data Wiped</p>
                    <p className="text-red-700">{entriesWiped} entries permanently deleted</p>
                  </div>
                </div>
              </div>

              <Link
                href="/authentication/signin"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm bg-lockr-cyan text-sm font-medium text-white hover:bg-lockr-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
              >
                Continue to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-lockr-navy rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-lockr-cyan" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Lockr</h1>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Set new master password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new master password (all vault data will be wiped)
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Critical Warning */}
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                🚨 FINAL WARNING
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  Clicking "Reset Master Password" will <strong>immediately and permanently delete ALL vault data</strong>. 
                  This cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {errors.token && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <XCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {errors.token.toLowerCase().includes('expired') ? 'Reset Link Expired' : 'Invalid Reset Link'}
                  </h3>
                  <p className="mt-1 text-sm text-red-700">{errors.token}</p>
                  
                  {/* Help text and actions */}
                  <div className="mt-3 text-sm text-red-700">
                    {errors.token.toLowerCase().includes('expired') ? (
                      <p>Reset links expire after 15 minutes for security. You'll need to request a new one.</p>
                    ) : (
                      <p>This reset link is invalid or has already been used.</p>
                    )}
                  </div>
                  
                  <div className="mt-4 flex space-x-3">
                    <Link
                      href="/auth/forgot-master-password"
                      className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-md transition-colors"
                    >
                      Request new reset link
                    </Link>
                    <Link
                      href="/authentication/signin"
                      className="text-sm text-red-600 hover:text-red-800 px-3 py-2 transition-colors"
                    >
                      Back to sign in
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ClientOnlyForm>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="newMasterPassword" className="block text-sm font-medium text-gray-700">
                  New master password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    ref={newPasswordRef}
                    id="newMasterPassword"
                    name="newMasterPassword"
                    type={showPasswords.newMasterPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newMasterPassword}
                    onChange={(e) => handlePasswordChange('newMasterPassword', e.target.value)}
                    className="pl-10 pr-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-lockr-cyan focus:border-lockr-cyan sm:text-sm"
                    placeholder="Enter new master password"
                    disabled={isLoading || !!errors.token}
                    data-form-type="password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-dashlane-ignore="true"
                    role="textbox"
                    aria-label="New master password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPasswords(prev => ({ ...prev, newMasterPassword: !prev.newMasterPassword }))}
                  >
                    {showPasswords.newMasterPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.newMasterPassword && (
                  <p className="mt-2 text-sm text-red-600">{errors.newMasterPassword}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmMasterPassword" className="block text-sm font-medium text-gray-700">
                  Confirm new master password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    ref={confirmPasswordRef}
                    id="confirmMasterPassword"
                    name="confirmMasterPassword"
                    type={showPasswords.confirmMasterPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmMasterPassword}
                    onChange={(e) => handlePasswordChange('confirmMasterPassword', e.target.value)}
                    className="pl-10 pr-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-lockr-cyan focus:border-lockr-cyan sm:text-sm"
                    placeholder="Confirm new master password"
                    disabled={isLoading || !!errors.token}
                    data-form-type="password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-dashlane-ignore="true"
                    role="textbox"
                    aria-label="Confirm new master password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirmMasterPassword: !prev.confirmMasterPassword }))}
                  >
                    {showPasswords.confirmMasterPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.confirmMasterPassword && (
                  <p className="mt-2 text-sm text-red-600">{errors.confirmMasterPassword}</p>
                )}
                {!errors.confirmMasterPassword && confirmMasterPassword && newMasterPassword && confirmMasterPassword === newMasterPassword && (
                  <p className="mt-2 text-sm text-green-600 flex items-center">
                    <Check className="h-4 w-4 mr-1" />
                    Passwords match
                  </p>
                )}
              </div>

              {/* Final Confirmation Checkbox */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="confirmed"
                    name="confirmed"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => {
                      setConfirmed(e.target.checked);
                      if (errors.confirmed) setErrors(prev => ({ ...prev, confirmed: '' }));
                    }}
                    className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded"
                    disabled={isLoading || !!errors.token}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="confirmed" className="font-medium text-gray-700">
                    <span className="flex items-center">
                      <Trash2 className="h-4 w-4 text-red-500 mr-2" />
                      I understand that ALL my vault data will be permanently deleted NOW
                    </span>
                  </label>
                  <p className="text-red-600 mt-1 font-medium">
                    This action is irreversible. All passwords and vault entries will be lost forever.
                  </p>
                </div>
              </div>

              {errors.confirmed && (
                <p className="text-sm text-red-600">{errors.confirmed}</p>
              )}

              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.general}</p>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !!errors.token || !newMasterPassword || !confirmMasterPassword || !confirmed}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-3 h-4 w-4" />
                      Resetting master password...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Reset master password & wipe vault
                    </>
                  )}
                </button>
              </div>
            </form>
          </ClientOnlyForm>

          <div className="mt-6">
            <Link
              href="/authentication/signin"
              className="flex items-center justify-center text-sm text-lockr-cyan hover:text-lockr-blue transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>🔒 Reset links expire after 15 minutes for security</p>
          <p className="mt-1">💡 If you only forgot your login password, use <Link href="/auth/forgot-password" className="text-lockr-cyan hover:underline">account password reset</Link> instead</p>
        </div>
      </div>
    </div>
  );
}

export default function ResetMasterPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetMasterPasswordContent />
    </Suspense>
  );
} 