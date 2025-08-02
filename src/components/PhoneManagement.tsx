'use client';

import { useState, useEffect } from 'react';
import { 
  Smartphone, 
  CheckCircle, 
  XCircle, 
  Send, 
  Loader2, 
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
  Shield,
  Bell
} from 'lucide-react';
import { API_BASE_URL } from '../lib/utils';

interface PhoneStatus {
  hasPhoneNumber: boolean;
  phoneNumber: string;
  verified: boolean;
  smsOptOut: boolean;
}

export default function PhoneManagement() {
  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>({
    hasPhoneNumber: false,
    phoneNumber: '',
    verified: false,
    smsOptOut: false
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);

  // Fetch current phone status on component mount
  useEffect(() => {
    fetchPhoneStatus();
  }, []);

  const fetchPhoneStatus = async () => {
    try {
      const token = localStorage.getItem('lockr_access_token');
      const response = await fetch(`${API_BASE_URL}/auth/phone/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPhoneStatus(data);
        if (data.hasPhoneNumber) {
          setPhoneNumber(data.phoneNumber);
        }
      }
    } catch (err) {
      console.error('Error fetching phone status:', err);
    }
  };

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Password is required to encrypt your phone number');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('lockr_access_token');
      const response = await fetch(`${API_BASE_URL}/auth/phone/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber, password })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Phone number added successfully! Please verify with the code sent to your phone.');
        setShowVerification(true);
        setPhoneStatus(prev => ({ ...prev, hasPhoneNumber: true, phoneNumber }));
        // Clear password for security
        setPassword('');
      } else {
        setError(data.error || data.message || 'Failed to add phone number');
        // Clear password on error
        setPassword('');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      // Clear password on error
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setIsSendingCode(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('lockr_access_token');
      const response = await fetch(`${API_BASE_URL}/auth/phone/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Verification code sent! Check your phone for the SMS.');
      } else {
        setError(data.message || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('lockr_access_token');
      const response = await fetch(`${API_BASE_URL}/auth/phone/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phoneNumber, 
          verificationCode 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Phone number verified successfully!');
        setPhoneStatus(prev => ({ ...prev, verified: true }));
        setShowVerification(false);
        setVerificationCode('');
      } else {
        setError(data.message || 'Invalid verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemovePhone = async () => {
    if (!confirm('Are you sure you want to remove your phone number? This will disable SMS notifications and 2FA.')) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('lockr_access_token');
      const response = await fetch(`${API_BASE_URL}/auth/phone`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSuccess('Phone number removed successfully');
        setPhoneStatus({
          hasPhoneNumber: false,
          phoneNumber: '',
          verified: false,
          smsOptOut: false
        });
        setPhoneNumber('');
        setShowVerification(false);
        setVerificationCode('');
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to remove phone number');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Simple formatting for display
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-lockr-cyan/10 rounded-lg flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-lockr-cyan" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Phone Number</h3>
          <p className="text-sm text-gray-600">Manage SMS notifications and two-factor authentication</p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-error-600" />
          <p className="text-error-600 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-lg flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-success-600" />
          <p className="text-success-600 text-sm">{success}</p>
        </div>
      )}

      {/* Current Phone Status */}
      {phoneStatus.hasPhoneNumber && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Smartphone className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {showPhoneNumber ? formatPhoneNumber(phoneStatus.phoneNumber) : '••••••••••'}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  {phoneStatus.verified ? (
                    <span className="inline-flex items-center text-xs text-success-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs text-warning-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Not verified
                    </span>
                  )}
                  <button
                    onClick={() => setShowPhoneNumber(!showPhoneNumber)}
                    className="text-xs text-lockr-cyan hover:text-lockr-blue"
                  >
                    {showPhoneNumber ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={handleRemovePhone}
              disabled={isLoading}
              className="text-error-600 hover:text-error-700 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Phone Number Form */}
      {!phoneStatus.hasPhoneNumber && (
        <form onSubmit={handleAddPhone} className="space-y-4">
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lockr-cyan focus:border-lockr-cyan"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll send a verification code to this number
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Your Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lockr-cyan focus:border-lockr-cyan"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your password is used to encrypt your phone number and is never stored on our servers.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !phoneNumber || !password}
            className="w-full bg-lockr-navy text-white py-2 px-4 rounded-lg hover:bg-lockr-blue disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
            <span>Add Phone Number</span>
          </button>
        </form>
      )}

      {/* Verification Form */}
      {showVerification && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3">Verify Your Phone Number</h4>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lockr-cyan focus:border-lockr-cyan"
                maxLength={6}
                required
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isVerifying || !verificationCode}
                className="flex-1 bg-lockr-cyan text-lockr-navy py-2 px-4 rounded-lg hover:bg-lockr-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>Verify</span>
              </button>
              <button
                type="button"
                onClick={handleSendVerification}
                disabled={isSendingCode}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSendingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Resend</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Benefits Section */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Benefits of Adding Your Phone</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Shield className="w-4 h-4 text-lockr-cyan" />
            <span>Two-factor authentication for enhanced security</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Bell className="w-4 h-4 text-lockr-cyan" />
            <span>Security alerts for suspicious login attempts</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Smartphone className="w-4 h-4 text-lockr-cyan" />
            <span>Account recovery options</span>
          </div>
        </div>
      </div>
    </div>
  );
} 