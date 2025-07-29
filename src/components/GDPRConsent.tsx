'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';

interface GDPRConsentProps {
  onConsentChange: (consent: boolean) => void;
  required?: boolean;
}

export default function GDPRConsent({ onConsentChange, required = true }: GDPRConsentProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          id="gdpr-consent"
          onChange={(e) => onConsentChange(e.target.checked)}
          required={required}
          className="mt-1 h-4 w-4 text-lockr-cyan focus:ring-lockr-cyan border-gray-300 rounded"
        />
        <div className="flex-1">
          <label htmlFor="gdpr-consent" className="text-sm text-gray-700">
            I consent to the processing of my personal data in accordance with the{' '}
            <Link href="/privacy" className="text-lockr-cyan hover:text-lockr-blue font-medium">
              Privacy Policy
            </Link>
            {' '}and{' '}
            <Link href="/cookies" className="text-lockr-cyan hover:text-lockr-blue font-medium">
              Cookie Policy
            </Link>
            .
          </label>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-lockr-cyan hover:text-lockr-blue mt-1"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <div className="flex items-start space-x-2 mb-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900 mb-2">Your GDPR Rights</h4>
              <p className="text-blue-800 mb-3">
                Under GDPR, you have the right to:
              </p>
              <ul className="list-disc list-inside text-blue-800 space-y-1 ml-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Withdraw consent at any time</li>
                <li>Lodge a complaint with supervisory authorities</li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-start space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-900 mb-1">Zero-Knowledge Architecture</h4>
              <p className="text-green-800 text-xs">
                Lockrr uses zero-knowledge encryption, meaning we cannot access your master password or decrypt your vault data. 
                All encryption happens locally on your device.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 