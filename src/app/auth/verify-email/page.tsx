'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Loader2, CheckCircle, XCircle, AlertCircle, Phone, Send } from 'lucide-react';
import { API_BASE_URL } from '../../../lib/utils';

function VerifyAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  
  // Phone verification states
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState(false);
  const [hasPhoneNumber, setHasPhoneNumber] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      verifyEmail(tokenParam);
    } else {
      // No email token, show phone verification option
      setIsLoading(false);
      setShowPhoneVerification(true);
      checkPhoneStatus();
    }
  }, [searchParams]);

  const checkPhoneStatus = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) return;

      const response = await fetch(`${API_BASE_URL}/auth/phone/status`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHasPhoneNumber(data.hasPhoneNumber);
      }
    } catch (error) {
      console.error('Failed to check phone status:', error);
    }
  };

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/email/verify?token=${verificationToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify email');
      }

      if (data.alreadyVerified) {
        setIsAlreadyVerified(true);
      } else {
        setIsSuccess(true);
      }

      if (data.user?.email) {
        setUserEmail(data.user.email);
      }

    } catch (err) {
      console.error('Email verification error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during verification');
      // Show phone verification as alternative
      setShowPhoneVerification(true);
      checkPhoneStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!userEmail) {
      setError('Unable to resend - email address not found');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/email/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: userEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend verification email');
      }

      setError('');
      alert('Verification email sent! Please check your inbox.');

    } catch (err) {
      console.error('Resend email error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setIsLoading(false);
    }
  };

  const sendPhoneVerification = async () => {
    setIsPhoneLoading(true);
    setPhoneError('');

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Please sign in to verify your phone number');
      }

      const response = await fetch(`${API_BASE_URL}/auth/phone/send-verification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      alert('Verification code sent to your phone!');
    } catch (err) {
      console.error('Send phone verification error:', err);
      setPhoneError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsPhoneLoading(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!phoneCode || phoneCode.length !== 6) {
      setPhoneError('Please enter a valid 6-digit code');
      return;
    }

    setIsPhoneLoading(true);
    setPhoneError('');

    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Please sign in to verify your phone number');
      }

      const response = await fetch(`${API_BASE_URL}/auth/phone/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: phoneCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setPhoneSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Phone verification error:', err);
      setPhoneError(err instanceof Error ? err.message : 'Failed to verify phone number');
    } finally {
      setIsPhoneLoading(false);
    }
  };

  // Loading state
  if (isLoading && !showPhoneVerification) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Verifying your email...
              </h2>
              <p className="text-gray-600">
                Please wait while we verify your email address.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess || phoneSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {phoneSuccess ? 'Phone verified successfully!' : 'Email verified successfully!'}
              </h2>
              <p className="text-gray-600 mb-6">
                {phoneSuccess 
                  ? 'Your phone number has been verified. You can now receive SMS notifications.'
                  : 'Your email address has been verified. You can now access all features of your Lockrr account.'
                }
              </p>
              <div className="space-y-3">
                <Link
                  href="/authentication/signin"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm bg-lockr-cyan text-sm font-medium text-white hover:bg-lockr-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
                >
                  Continue to sign in
                </Link>
                <Link
                  href="/dashboard"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
                >
                  Go to dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Already verified state
  if (isAlreadyVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Email already verified
              </h2>
              <p className="text-gray-600 mb-6">
                Your email address is already verified. You can sign in to your account.
              </p>
              <div className="space-y-3">
                <Link
                  href="/authentication/signin"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm bg-lockr-cyan text-sm font-medium text-white hover:bg-lockr-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
                >
                  Continue to sign in
                </Link>
                <Link
                  href="/dashboard"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
                >
                  Go to dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main verification page (email failed or no token, show both options)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-lockr-navy rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6 text-lockr-cyan" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Lockrr</h1>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Account Verification</h2>
          <p className="text-gray-600 mt-2">
            Verify your email or phone number to secure your account
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Email Verification Section */}
          {error && (
            <div className="mb-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Email verification failed
                </h3>
                <p className="text-gray-600 mb-4">
                  {error}
                </p>
                
                {userEmail && (
                  <button
                    onClick={handleResendEmail}
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm bg-lockr-cyan text-sm font-medium text-white hover:bg-lockr-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Resend verification email'
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Phone Verification Section */}
          {showPhoneVerification && hasPhoneNumber && (
            <div className="border-t border-gray-200 pt-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Verify your phone number
                </h3>
                <p className="text-gray-600 mb-4">
                  Enter the 6-digit code sent to your phone
                </p>

                {phoneError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{phoneError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <input
                      type="text"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-lockr-cyan focus:border-lockr-cyan text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={sendPhoneVerification}
                      disabled={isPhoneLoading}
                      className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPhoneLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Code
                        </>
                      )}
                    </button>

                    <button
                      onClick={verifyPhoneCode}
                      disabled={isPhoneLoading || phoneCode.length !== 6}
                      className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm bg-lockr-cyan text-sm font-medium text-white hover:bg-lockr-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPhoneLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Verify'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No phone number message */}
          {showPhoneVerification && !hasPhoneNumber && (
            <div className="border-t border-gray-200 pt-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                  <Phone className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No phone number on file
                </h3>
                <p className="text-gray-600 mb-4">
                  Add a phone number to your account to enable SMS verification
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Link
              href="/authentication/signin"
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lockr-cyan"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyAccountPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyAccountContent />
    </Suspense>
  );
} 