'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock, Menu, X, ArrowLeft, Shield, FileText, AlertTriangle } from 'lucide-react';

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
              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 mb-8">
                By accessing and using Lockrr, you accept and agree to be bound by the terms and provision of this agreement.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">2. Use License</h2>
              <p className="text-gray-700 mb-4">
                Permission is granted to temporarily use Lockrr for personal, non-commercial use only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose</li>
                <li>Attempt to reverse engineer any software contained in Lockrr</li>
                <li>Remove any copyright or other proprietary notations</li>
                <li>Transfer the materials to another person</li>
              </ul>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">3. Privacy and Security</h2>
              <p className="text-gray-700 mb-8">
                Lockrr implements zero-knowledge encryption. We cannot access your master password or decrypt your vault data.
                Your privacy and security are our top priorities. Please review our Privacy Policy for detailed information about how we handle your data.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">4. Service Availability</h2>
              <p className="text-gray-700 mb-8">
                While we strive to maintain high availability, we do not guarantee uninterrupted access to Lockrr. 
                We may perform maintenance, updates, or modifications that temporarily affect service availability.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">5. Data Loss</h2>
              <p className="text-gray-700 mb-8">
                You are responsible for backing up your data and maintaining the security of your master password. 
                We cannot recover your master password or decrypt your data if you lose access to your account.
              </p>

              <h2 className="text-2xl font-semibold text-lockr-navy mb-4">6. Contact Information</h2>
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