'use client';

import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, Server } from 'lucide-react';

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-lockr-navy">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          
          {/* Zero-Knowledge Architecture */}
          <section className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <Shield className="w-6 h-6 text-green-600 mt-1" />
              <div>
                <h2 className="text-xl font-semibold text-green-800 mb-2">Zero-Knowledge Architecture</h2>
                <p className="text-green-700 leading-relaxed">
                  <strong>We cannot access your data.</strong> Lockr uses zero-knowledge encryption, meaning your master password 
                  and vault data are encrypted on your device before being sent to our servers. Even our developers cannot 
                  decrypt or view your passwords.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
              <Lock className="w-6 h-6 mr-2" />
              What We Don't Store
            </h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Master passwords</strong> - Never stored on our servers</li>
              <li><strong>Decrypted vault data</strong> - All data is encrypted client-side</li>
              <li><strong>Plain text passwords</strong> - Everything is encrypted before transmission</li>
              <li><strong>Personal browsing habits</strong> - We don't track your web activity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
              <Eye className="w-6 h-6 mr-2" />
              What We Do Collect
            </h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Account email</strong> - For authentication and account recovery</li>
              <li><strong>Encrypted vault data</strong> - Your passwords encrypted with your master password</li>
              <li><strong>Usage analytics</strong> - Anonymous data to improve our service</li>
              <li><strong>Security logs</strong> - Login attempts and security events for protection</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
              <Server className="w-6 h-6 mr-2" />
              How We Protect Your Data
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lockr-navy">Encryption</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                  <li>AES-256-GCM encryption</li>
                  <li>PBKDF2 key derivation</li>
                  <li>TLS 1.3 for data transmission</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-lockr-navy">Security Measures</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                  <li>Rate limiting and DDoS protection</li>
                  <li>Regular security audits</li>
                  <li>Secure infrastructure on Railway</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Data Retention</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We retain your encrypted data until you delete your account. Upon account deletion:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>All vault data is permanently deleted within 30 days</li>
              <li>Account information is anonymized</li>
              <li>Backup copies are securely destroyed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use minimal third-party services to operate Lockr:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Railway</strong> - Cloud hosting infrastructure</li>
              <li><strong>Resend</strong> - Email delivery service</li>
              <li><strong>PostgreSQL</strong> - Encrypted database storage</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              All third parties are bound by strict data protection agreements and cannot access your encrypted data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Your Rights</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lockr-navy mb-2">You can:</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                  <li>Export your data at any time</li>
                  <li>Delete your account permanently</li>
                  <li>Request information about your data</li>
                  <li>Update your account information</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lockr-navy mb-2">We cannot:</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                  <li>Recover your master password</li>
                  <li>Access your encrypted vault data</li>
                  <li>Share your personal information</li>
                  <li>Decrypt your passwords</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
              <a href="mailto:privacy@lockrr.app" className="text-lockr-cyan hover:text-lockr-blue">
                privacy@lockrr.app
              </a>
            </p>
          </section>

          <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-800 mb-2">Security First Promise</h2>
            <p className="text-blue-700 leading-relaxed">
              Your security and privacy are not just our priority—they're built into our architecture. 
              With zero-knowledge encryption, even we cannot access your data. Your trust is earned through 
              transparency and proven security practices.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
} 