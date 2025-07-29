'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, X, Settings, CheckCircle, AlertTriangle } from 'lucide-react';

interface CookieConsentBannerProps {
  onAccept: () => void;
  onDecline: () => void;
  onCustomize: () => void;
}

export default function CookieConsentBanner({ onAccept, onDecline, onCustomize }: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('lockr_cookie_consent');
    if (!cookieConsent) {
      // Show banner after a short delay to ensure page is loaded
      const timer = setTimeout(() => {
        setIsAnimating(true);
        // Small delay to trigger the animation
        setTimeout(() => {
          setIsVisible(true);
        }, 50);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setIsVisible(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      localStorage.setItem('lockr_cookie_consent', 'accepted');
      localStorage.setItem('lockr_cookie_consent_date', new Date().toISOString());
      onAccept();
    }, 300);
  };

  const handleDecline = () => {
    setIsVisible(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      localStorage.setItem('lockr_cookie_consent', 'declined');
      localStorage.setItem('lockr_cookie_consent_date', new Date().toISOString());
      onDecline();
    }, 300);
  };

  const handleCustomize = () => {
    setIsVisible(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      onCustomize();
    }, 300);
  };

  // Don't render if not animating and not visible
  if (!isAnimating && !isVisible) {
    return null;
  }

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-4 lg:space-y-0">
          {/* Content */}
          <div className="flex-1">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-lockr-cyan/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <Cookie className="w-5 h-5 text-lockr-cyan" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  We use cookies to enhance your experience
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  We use cookies to provide essential functionality, improve performance, and analyze site usage. 
                  By continuing to use our site, you consent to our use of cookies.
                </p>
                
                {showDetails && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3 animate-in slide-in-from-top-2 duration-200">
                    <h4 className="font-medium text-gray-900 mb-2">Cookie Types We Use:</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span><strong>Essential:</strong> Required for basic site functionality</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Settings className="w-4 h-4 text-blue-600" />
                        <span><strong>Functional:</strong> Remember your preferences and settings</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <span><strong>Analytics:</strong> Help us understand how you use our service (anonymized)</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center space-x-4 text-xs">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-lockr-cyan hover:text-lockr-blue font-medium transition-colors"
                  >
                    {showDetails ? 'Hide details' : 'Show details'}
                  </button>
                  <Link href="/cookies" className="text-lockr-cyan hover:text-lockr-blue font-medium transition-colors">
                    Learn more
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={handleCustomize}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              Customize
            </button>
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-6 py-2 text-sm text-white bg-lockr-navy hover:bg-lockr-blue rounded-lg transition-colors duration-200"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 