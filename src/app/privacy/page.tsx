'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock, Menu, X, ArrowLeft, Shield, Eye, Database } from 'lucide-react';

export default function Privacy() {
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
            <h1 className="text-3xl font-bold text-lockr-navy">Privacy Policy</h1>
            <p className="text-gray-600 mt-4 mb-8">
              Last updated: December 2024
            </p>

            <div className="prose prose-lg max-w-none">
              <p className="text-lg text-gray-700 mb-8">
                <strong>We cannot access your data.</strong> Lockrr uses zero-knowledge encryption, meaning your master password
                and vault contents are never transmitted to our servers in a readable format.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Shield className="w-6 h-6 mr-2" />
                Information We Collect
              </h2>
              <p className="text-gray-700 mb-6">
                We collect minimal information necessary to provide our service:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li>Email address (for account creation and communication)</li>
                <li>Encrypted vault data (we cannot read this data)</li>
                <li>Account settings and preferences</li>
                <li>Usage analytics (anonymized, no personal data)</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Eye className="w-6 h-6 mr-2" />
                How We Use Your Information
              </h2>
              <p className="text-gray-700 mb-6">
                Your information is used solely to provide and improve our service:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li>To provide password management services</li>
                <li>To send important security notifications</li>
                <li>To improve our service based on usage patterns</li>
                <li>To respond to support requests</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4 flex items-center">
                <Database className="w-6 h-6 mr-2" />
                Data Security
              </h2>
              <div className="space-y-4 mb-8">
                <h3 className="font-semibold text-lockr-navy">Encryption</h3>
                <p className="text-gray-700">
                  All sensitive data is encrypted using AES-256 encryption before it leaves your device. 
                  Your master password is never stored on our servers.
                </p>
                
                <h3 className="font-semibold text-lockr-navy">Security Measures</h3>
                <p className="text-gray-700">
                  We implement industry-standard security measures including:
                </p>
                <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
                  <li>End-to-end encryption</li>
                  <li>Secure HTTPS connections</li>
                  <li>Regular security audits</li>
                  <li>Access controls and monitoring</li>
                </ul>
              </div>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Data Retention</h2>
              <p className="text-gray-700 mb-8">
                We retain your account information for as long as you maintain an active account. 
                You can request deletion of your account and all associated data at any time. 
                Encrypted vault data is automatically deleted when you delete your account.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Third-Party Services</h2>
              <p className="text-gray-700 mb-4">
                We use minimal third-party services to operate Lockrr:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li>Cloud hosting providers (AWS, Google Cloud)</li>
                <li>Email service providers (for notifications)</li>
                <li>Analytics services (anonymized data only)</li>
              </ul>
              <p className="text-gray-700 mb-8">
                All third-party services are carefully selected and required to maintain strict privacy standards.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Your Rights</h2>
              <p className="text-gray-700 mb-4">
                You have full control over your data:
              </p>
              <h3 className="font-semibold text-lockr-navy mb-2">You can:</h3>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
                <li>Access all your data through the application</li>
                <li>Export your vault data at any time</li>
                <li>Delete your account and all associated data</li>
                <li>Update your account information</li>
              </ul>
              <h3 className="font-semibold text-lockr-navy mb-2">We cannot:</h3>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-1">
                <li>Access your master password</li>
                <li>Decrypt your vault contents</li>
                <li>See your passwords or sensitive data</li>
                <li>Share your data with third parties</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about this privacy policy, please contact us at:
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