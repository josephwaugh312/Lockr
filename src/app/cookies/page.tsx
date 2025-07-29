'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Menu, X, ArrowLeft, Cookie, Settings, Shield, CheckCircle, AlertTriangle, Save } from 'lucide-react';

export default function Cookies() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchParams = useSearchParams();
  const showManageSection = searchParams.get('section') === 'manage';

  // Cookie preferences state
  const [cookiePreferences, setCookiePreferences] = useState({
    essential: true, // Always true, cannot be disabled
    functional: true,
    analytics: false
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedPreferences = localStorage.getItem('lockr_cookie_preferences');
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences);
        setCookiePreferences(parsed);
      } catch (error) {
        console.error('Error parsing saved cookie preferences:', error);
      }
    }
  }, []);

  const handlePreferenceChange = (type: string, value: boolean) => {
    setCookiePreferences(prev => ({
      ...prev,
      [type]: value
    }));
    setHasChanges(true);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('lockr_cookie_preferences', JSON.stringify(cookiePreferences));
    localStorage.setItem('lockr_cookie_consent', 'customized');
    localStorage.setItem('lockr_cookie_consent_date', new Date().toISOString());
    setHasChanges(false);
    
    // Show success message
    alert('Cookie preferences saved successfully!');
  };

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      functional: true,
      analytics: true
    };
    setCookiePreferences(allAccepted);
    localStorage.setItem('lockr_cookie_preferences', JSON.stringify(allAccepted));
    localStorage.setItem('lockr_cookie_consent', 'accepted');
    localStorage.setItem('lockr_cookie_consent_date', new Date().toISOString());
    setHasChanges(false);
    
    alert('All cookies accepted!');
  };

  const handleRejectAll = () => {
    const allRejected = {
      essential: true, // Essential cookies cannot be disabled
      functional: false,
      analytics: false
    };
    setCookiePreferences(allRejected);
    localStorage.setItem('lockr_cookie_preferences', JSON.stringify(allRejected));
    localStorage.setItem('lockr_cookie_consent', 'declined');
    localStorage.setItem('lockr_cookie_consent_date', new Date().toISOString());
    setHasChanges(false);
    
    alert('Non-essential cookies rejected!');
  };

  // If showing manage section, render the cookie management interface
  if (showManageSection) {
    return (
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 min-h-screen">
        {/* Navigation */}
        <nav className="px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-200 relative">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-lockr-navy rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-lockr-cyan" />
              </div>
              <span className="text-2xl font-bold text-lockr-navy">Lockrr</span>
            </div>
          </div>
        </nav>

        {/* Cookie Management Content */}
        <div className="py-12">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <Link href="/cookies" className="inline-flex items-center text-lockr-cyan hover:text-lockr-blue transition-colors mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Cookie Policy
              </Link>
              
              <h1 className="text-3xl font-bold text-lockr-navy mb-2">Cookie Preferences</h1>
              <p className="text-gray-600 mb-8">
                Customize your cookie preferences to control how we use cookies on our website.
              </p>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 bg-lockr-navy text-white rounded-lg hover:bg-lockr-blue transition-colors"
                >
                  Accept All Cookies
                </button>
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Reject Non-Essential
                </button>
              </div>

              {/* Cookie Categories */}
              <div className="space-y-6">
                {/* Essential Cookies */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Essential Cookies</h3>
                        <p className="text-sm text-gray-600">Required for basic site functionality</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.essential}
                        disabled
                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm text-gray-500">Always enabled</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies are necessary for the website to function properly. They cannot be disabled and include authentication tokens, session management, and security features.
                  </p>
                </div>

                {/* Functional Cookies */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Settings className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Functional Cookies</h3>
                        <p className="text-sm text-gray-600">Remember your preferences and settings</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.functional}
                        onChange={(e) => handlePreferenceChange('functional', e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies enhance your experience by remembering your theme preferences, language settings, and display options.
                  </p>
                </div>

                {/* Analytics Cookies */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Analytics Cookies</h3>
                        <p className="text-sm text-gray-600">Help us understand how you use our service</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={cookiePreferences.analytics}
                        onChange={(e) => handlePreferenceChange('analytics', e.target.checked)}
                        className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    These cookies help us understand how our service is used to improve it. All data is anonymized and does not identify individual users.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleSavePreferences}
                  disabled={!hasChanges}
                  className="px-6 py-3 bg-lockr-navy text-white rounded-lg hover:bg-lockr-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{hasChanges ? 'Save Preferences' : 'Preferences Saved'}</span>
                </button>
                {hasChanges && (
                  <p className="text-sm text-gray-600 mt-2">
                    You have unsaved changes. Click "Save Preferences" to apply your settings.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original cookie policy content
  return (
    <div className="bg-gradient-to-br from-primary-50 to-accent-50 min-h-screen">
      {/* Navigation - Same as privacy page */}
      <nav className="px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-200 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-lockr-navy rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-lockr-cyan" />
            </div>
            <span className="text-2xl font-bold text-lockr-navy">Lockrr</span>
          </div>
          
          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-gray-600 hover:text-lockr-navy transition-colors">
              Home
            </Link>
            <Link href="/#features" className="text-gray-600 hover:text-lockr-navy transition-colors">
              Features
            </Link>
            <Link href="/#security" className="text-gray-600 hover:text-lockr-navy transition-colors">
              Security
            </Link>
            <Link href="/#pricing" className="text-gray-600 hover:text-lockr-navy transition-colors">
              Pricing
            </Link>
            <Link href="/authentication/signin" className="text-lockr-navy hover:text-lockr-blue transition-colors">
              Sign In
            </Link>
            <Link 
              href="/authentication/signup"
              className="bg-lockr-navy text-white px-6 py-2 rounded-lg hover:bg-lockr-blue transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-lockr-navy hover:bg-gray-100 transition-colors"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 transition-all duration-300 ease-in-out ${
          isMobileMenuOpen 
            ? 'opacity-100 visible transform translate-y-0' 
            : 'opacity-0 invisible transform -translate-y-2'
        }`}>
          <div className="px-6 py-4 space-y-4">
            <Link 
              href="/" 
              className="block text-gray-600 hover:text-lockr-navy transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="/#features" 
              className="block text-gray-600 hover:text-lockr-navy transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link 
              href="/#security" 
              className="block text-gray-600 hover:text-lockr-navy transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Security
            </Link>
            <Link 
              href="/#pricing" 
              className="block text-gray-600 hover:text-lockr-navy transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link 
              href="/authentication/signin" 
              className="block text-lockr-navy hover:text-lockr-blue transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Sign In
            </Link>
            <Link 
              href="/authentication/signup" 
              className="block bg-lockr-navy text-white px-6 py-3 rounded-lg hover:bg-lockr-blue transition-colors text-center"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <Link href="/" className="inline-flex items-center text-lockr-cyan hover:text-lockr-blue transition-colors mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-3xl font-bold text-lockr-navy">Cookie Policy</h1>
            <p className="text-gray-600 mt-4 mb-8">
              Last updated: December 2024
            </p>

            <div className="prose prose-lg max-w-none">
              <p className="text-lg text-gray-700 mb-8">
                This Cookie Policy explains how Lockrr uses cookies and similar technologies when you visit our website and use our service.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Cookie className="w-6 h-6 mr-2" />
                What Are Cookies?
              </h2>
              <p className="text-gray-700 mb-8">
                Cookies are small text files that are stored on your device when you visit a website. 
                They help websites remember information about your visit and provide a better user experience.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Shield className="w-6 h-6 mr-2" />
                How We Use Cookies
              </h2>
              <p className="text-gray-700 mb-4">
                Lockrr uses cookies for the following purposes:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li><strong>Authentication:</strong> To keep you signed in and maintain your session</li>
                <li><strong>Security:</strong> To protect against unauthorized access and detect suspicious activity</li>
                <li><strong>Preferences:</strong> To remember your settings and preferences</li>
                <li><strong>Performance:</strong> To improve website performance and user experience</li>
                <li><strong>Analytics:</strong> To understand how our service is used (anonymized data only)</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Settings className="w-6 h-6 mr-2" />
                Types of Cookies We Use
              </h2>
              
              <h3 className="text-xl font-semibold text-lockr-navy mb-3">Essential Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies are necessary for the website to function properly. They cannot be disabled.
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
                <li>Authentication tokens (JWT)</li>
                <li>Session management</li>
                <li>Security tokens</li>
                <li>CSRF protection</li>
              </ul>

              <h3 className="text-xl font-semibold text-lockr-navy mb-3">Functional Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies enhance your experience by remembering your preferences.
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-6 space-y-1">
                <li>Theme preferences (light/dark mode)</li>
                <li>Language settings</li>
                <li>Display preferences</li>
                <li>Notification settings</li>
              </ul>

              <h3 className="text-xl font-semibold text-lockr-navy mb-3">Analytics Cookies</h3>
              <p className="text-gray-700 mb-4">
                These cookies help us understand how our service is used to improve it.
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-1">
                <li>Page visit statistics (anonymized)</li>
                <li>Feature usage patterns</li>
                <li>Performance metrics</li>
                <li>Error tracking</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Third-Party Cookies</h2>
              <p className="text-gray-700 mb-4">
                We use minimal third-party services that may set their own cookies:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li><strong>Email Services:</strong> For sending notifications and security alerts</li>
                <li><strong>SMS Services:</strong> For two-factor authentication and security notifications</li>
                <li><strong>Analytics:</strong> For understanding service usage (anonymized data only)</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Managing Cookies</h2>
              <p className="text-gray-700 mb-4">
                You can control and manage cookies in several ways:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li><strong>Browser Settings:</strong> Most browsers allow you to control cookies through settings</li>
                <li><strong>Cookie Consent:</strong> We provide cookie consent options when you first visit</li>
                <li><strong>Account Settings:</strong> You can manage some preferences through your account settings</li>
              </ul>
              <p className="text-gray-700 mb-8">
                <strong>Note:</strong> Disabling essential cookies may prevent the service from functioning properly.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Cookie Retention</h2>
              <p className="text-gray-700 mb-8">
                Cookies are retained for different periods:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                <li><strong>Authentication Cookies:</strong> 7 days (refresh tokens)</li>
                <li><strong>Preference Cookies:</strong> 1 year</li>
                <li><strong>Analytics Cookies:</strong> 2 years</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Updates to This Policy</h2>
              <p className="text-gray-700 mb-8">
                We may update this Cookie Policy from time to time. We will notify you of any material changes 
                by posting the updated policy on this page and updating the "Last updated" date.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about our use of cookies, please contact us at:
              </p>
              <a href="mailto:privacy@lockrr.app" className="text-lockr-cyan hover:text-lockr-blue">
                privacy@lockrr.app
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 