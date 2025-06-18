'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Loader2, Lock, AlertTriangle, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../../../lib/utils';

export default function ForgotMasterPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (!confirmed) {
      setError('You must confirm that you understand all vault data will be permanently deleted');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-master-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          confirmed: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Forgot master password error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Check your email
              </h2>
              <p className="text-gray-600 mb-4">
                If an account with this email exists, you will receive a master password reset link.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Critical Warning</h3>
                    <p className="mt-1 text-sm text-red-700">
                      Using the reset link will <strong>permanently delete ALL your vault data</strong>. 
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail('');
                    setConfirmed(false);
                    setError('');
                  }}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
                >
                  Send another email
                </button>
                <Link
                  href="/authentication/signin"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm bg-lockr-cyan text-sm font-medium text-white hover:bg-lockr-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
                >
                  Back to sign in
                </Link>
              </div>
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
          <h2 className="text-xl font-semibold text-gray-900">Forgot your master password?</h2>
          <p className="mt-2 text-sm text-gray-600">
            Reset your master password (with vault data wipe)
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
                ⚠️ DATA LOSS WARNING
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Resetting your master password will <strong>permanently delete ALL vault data</strong></li>
                  <li>All saved passwords, notes, and vault entries will be lost forever</li>
                  <li>This action cannot be undone or recovered</li>
                  <li>You will start with a completely empty vault</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  className="pl-10 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-lockr-cyan focus:border-lockr-cyan sm:text-sm"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="confirmed"
                  name="confirmed"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                    if (error) setError('');
                  }}
                  className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded"
                  disabled={isLoading}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="confirmed" className="font-medium text-gray-700">
                  <span className="flex items-center">
                    <Trash2 className="h-4 w-4 text-red-500 mr-2" />
                    I understand that ALL my vault data will be permanently deleted
                  </span>
                </label>
                <p className="text-gray-500 mt-1">
                  This includes all passwords, secure notes, and vault entries. This action cannot be undone.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading || !email.trim() || !confirmed}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-4 w-4" />
                    Sending reset link...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Send master password reset link
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <Link
              href="/authentication/signin"
              className="flex items-center justify-center text-sm text-lockr-cyan hover:text-lockr-blue transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to sign in
            </Link>
          </div>
        </div>

        {/* Additional Warning */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>🔒 Reset links expire after 15 minutes for security</p>
          <p className="mt-1">💡 Try <Link href="/auth/forgot-password" className="text-lockr-cyan hover:underline">account password reset</Link> first if you only forgot your login password</p>
        </div>
      </div>
    </div>
  );
} 