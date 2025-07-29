'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock, Menu, X, ArrowLeft, Shield, FileText, AlertTriangle, Users, Globe, Server } from 'lucide-react';

export default function Terms() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="bg-gradient-to-br from-primary-50 to-accent-50 min-h-screen">
      {/* Navigation */}
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
            <h1 className="text-3xl font-bold text-lockr-navy">Terms of Service</h1>
            <p className="text-gray-600 mt-4 mb-8">
              Last updated: December 2024
            </p>

            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-2" />
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-700 mb-8">
                By accessing and using Lockrr ("the Service"), you accept and agree to be bound by these Terms of Service ("Terms"). 
                If you do not agree to these Terms, you must not use the Service. These Terms apply to all users of the Service.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Users className="w-6 h-6 mr-2" />
                2. Service Description
              </h2>
              <p className="text-gray-700 mb-4">
                Lockrr is a zero-knowledge password manager that provides secure storage and management of passwords, 
                credit card information, secure notes, and other sensitive data. The Service includes:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li>Secure password storage and generation</li>
                <li>Credit card and payment information management</li>
                <li>Secure notes and document storage</li>
                <li>WiFi network password management</li>
                <li>Two-factor authentication support</li>
                <li>Data import and export capabilities</li>
                <li>Security monitoring and breach alerts</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Shield className="w-6 h-6 mr-2" />
                3. Privacy and Security
              </h2>
              <p className="text-gray-700 mb-4">
                Lockrr implements zero-knowledge encryption architecture. This means:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>We cannot access your master password or decrypt your vault data</li>
                <li>All encryption and decryption happens locally on your device</li>
                <li>Your data is encrypted before it leaves your device</li>
                <li>We cannot recover your data if you lose your master password</li>
              </ul>
              <p className="text-gray-700 mb-8">
                Please review our <Link href="/privacy" className="text-lockr-cyan hover:text-lockr-blue">Privacy Policy</Link> for detailed information about how we handle your data.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Globe className="w-6 h-6 mr-2" />
                4. User Responsibilities
              </h2>
              <p className="text-gray-700 mb-4">
                You are responsible for:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li>Maintaining the security of your master password</li>
                <li>Keeping your account credentials secure</li>
                <li>Backing up your vault data regularly</li>
                <li>Using the Service in compliance with applicable laws</li>
                <li>Not sharing your account with others</li>
                <li>Reporting security concerns immediately</li>
                <li>Ensuring your device is secure and up-to-date</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Server className="w-6 h-6 mr-2" />
                5. Service Availability and Limitations
              </h2>
              <p className="text-gray-700 mb-4">
                While we strive to maintain high availability, we do not guarantee:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                <li>Uninterrupted access to the Service</li>
                <li>Specific response times or performance levels</li>
                <li>Compatibility with all devices or browsers</li>
                <li>Availability during maintenance periods</li>
              </ul>
              <p className="text-gray-700 mb-8">
                We may perform maintenance, updates, or modifications that temporarily affect service availability. 
                We will provide reasonable notice for scheduled maintenance when possible.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2" />
                6. Disclaimers and Limitations
              </h2>
              <p className="text-gray-700 mb-4">
                <strong>Data Loss Disclaimer:</strong> You are responsible for backing up your data and maintaining the security of your master password. 
                We cannot recover your master password or decrypt your data if you lose access to your account.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>Service Disclaimer:</strong> The Service is provided "as is" without warranties of any kind. 
                We disclaim all warranties, express or implied, including but not limited to warranties of merchantability, 
                fitness for a particular purpose, and non-infringement.
              </p>
              <p className="text-gray-700 mb-8">
                <strong>Limitation of Liability:</strong> In no event shall Lockrr be liable for any indirect, incidental, 
                special, consequential, or punitive damages, including but not limited to loss of profits, data, or use.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">7. Acceptable Use</h2>
              <p className="text-gray-700 mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li>Store or transmit illegal content</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with the Service or other users</li>
                <li>Use the Service for commercial purposes without permission</li>
                <li>Reverse engineer or attempt to extract source code</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">8. Account Termination</h2>
              <p className="text-gray-700 mb-8">
                We may terminate or suspend your account at any time for violation of these Terms. 
                You may delete your account at any time through the Service. Upon account deletion, 
                all your data will be permanently removed from our servers.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">9. Changes to Terms</h2>
              <p className="text-gray-700 mb-8">
                We may update these Terms from time to time. We will notify you of any material changes 
                by posting the new Terms on this page and updating the "Last updated" date. 
                Your continued use of the Service after such changes constitutes acceptance of the new Terms.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">10. Governing Law</h2>
              <p className="text-gray-700 mb-8">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
                where Lockrr operates, without regard to its conflict of law provisions.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">11. Contact Information</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <a href="mailto:support@lockrr.app" className="text-lockr-cyan hover:text-lockr-blue">
                support@lockrr.app
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 