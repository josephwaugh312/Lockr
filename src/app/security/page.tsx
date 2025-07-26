'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

export default function Security() {
  return (
    <div className="bg-gradient-to-br from-primary-50 to-accent-50 min-h-screen">
      {/* Navigation */}
      <nav className="px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-lockr-navy rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-lockr-cyan" />
            </div>
            <span className="text-2xl font-bold text-lockr-navy">Lockr</span>
          </div>
          
          {/* Navigation Links */}
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
        </div>
      </nav>

      {/* Page Content */}
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Security</h1>
            <p className="text-gray-600 mb-8">
              Learn about Lockr's security measures and how we protect your data.
            </p>
            
            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Zero-Knowledge Architecture</h2>
                <p className="text-gray-600">
                  Lockr implements a zero-knowledge architecture, meaning we never have access to your master password or decrypted vault data. All encryption and decryption happens locally on your device.
                </p>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold mb-4">Encryption Standards</h2>
                <ul className="list-disc list-inside text-gray-600 space-y-2">
                  <li>AES-256 encryption for vault data</li>
                  <li>Argon2id for password hashing</li>
                  <li>End-to-end encryption for all communications</li>
                  <li>Secure random password generation</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold mb-4">Security Practices</h2>
                <ul className="list-disc list-inside text-gray-600 space-y-2">
                  <li>Regular security audits and updates</li>
                  <li>Open-source code for transparency</li>
                  <li>No telemetry or tracking</li>
                  <li>Self-hosting options available</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-xl font-semibold mb-4">Reporting Security Issues</h2>
                <p className="text-gray-600">
                  If you discover a security vulnerability, please report it responsibly by contacting our security team at security@lockr.app.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 