'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '../../../lib/utils';

export default function VerifyRequiredPage() {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Get user info to show their email
    const fetchUserInfo = async () => {
      try {
        const token = localStorage.getItem('lockr_access_token');
        if (!token) {
          router.push('/authentication/signin');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUserEmail(data.user.email);
          
          // Check if email is already verified
          if (data.user.emailVerified) {
            router.push('/dashboard');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    };

    fetchUserInfo();
  }, [router]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendVerification = async () => {
    if (countdown > 0) return;
    
    setIsResending(true);
    setMessage('');

    try {
      const token = localStorage.getItem('lockr_access_token');
      if (!token) {
        router.push('/authentication/signin');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/auth/email/send-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Verification email sent successfully! Please check your inbox.');
        setLastSentAt(new Date());
        setCountdown(60); // 60 second cooldown
      } else {
        setMessage(data.message || 'Failed to send verification email. Please try again.');
      }
    } catch (error) {
      setMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Header */}
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Verify Your Email
            </h1>
            <p className="text-gray-600">
              Please verify your email address to access your Lockr dashboard and vault.
            </p>
          </div>

          {/* User Email */}
          {userEmail && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Verification email sent to:</p>
              <p className="font-medium text-gray-900">{userEmail}</p>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.includes('successfully') || message.includes('sent')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <p className="text-sm">{message}</p>
            </div>
          )}

          {/* Resend Button */}
          <div className="mb-6">
            <button
              onClick={handleResendVerification}
              disabled={isResending || countdown > 0}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isResending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resend in {countdown}s
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="text-left mb-6">
            <h3 className="font-medium text-gray-900 mb-2">What to do:</h3>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Check your email inbox for a verification message</li>
              <li>2. Click the "Verify Email Address" button in the email</li>
              <li>3. You'll be automatically redirected to your dashboard</li>
              <li>4. You'll then have full access to your Lockr account</li>
            </ol>
          </div>

          {/* Footer Links */}
          <div className="flex flex-col space-y-2 text-sm">
            <Link 
              href="/authentication/signin" 
              className="text-blue-600 hover:text-blue-800 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Login
            </Link>
            <p className="text-gray-500">
              Didn't receive the email? Check your spam folder or click resend above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 