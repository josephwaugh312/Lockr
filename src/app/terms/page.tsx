'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-lockr-cyan hover:text-lockr-blue transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-lockr-navy">Terms of Service</h1>
          <p className="text-gray-600 mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing and using Lockr, you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">2. Use License</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Permission is granted to temporarily use Lockr for personal, non-commercial use only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>modify or copy the materials</li>
              <li>use the materials for any commercial purpose or for any public display</li>
              <li>attempt to reverse engineer any software contained in the service</li>
              <li>remove any copyright or other proprietary notations from the materials</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">3. Privacy and Security</h2>
            <p className="text-gray-700 leading-relaxed">
              Lockr implements zero-knowledge encryption. We cannot access your master password or decrypt your vault data. 
              Your privacy and security are our top priorities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">4. Service Availability</h2>
            <p className="text-gray-700 leading-relaxed">
              While we strive for 99.9% uptime, we cannot guarantee uninterrupted service. We reserve the right to modify 
              or discontinue the service with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">5. Data Loss</h2>
            <p className="text-gray-700 leading-relaxed">
              Due to our zero-knowledge architecture, if you lose your master password, we cannot recover your data. 
              Please ensure you remember your master password or use our secure backup options.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">6. Contact Information</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:support@lockrr.app" className="text-lockr-cyan hover:text-lockr-blue">
                support@lockrr.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
} 