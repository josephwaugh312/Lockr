'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock, Menu, X } from 'lucide-react';

export default function Contact() {
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
            <span className="text-2xl font-bold text-lockr-navy">Lockr</span>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Contact Us</h1>
            <p className="text-gray-600 mb-8">
              Get in touch with the Lockr team for support, questions, or feedback.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">Support</h2>
                <p className="text-gray-600 mb-4">
                  For technical support and bug reports, please visit our GitHub repository.
                </p>
                <a 
                  href="#" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  GitHub Issues →
                </a>
              </div>
              
              <div>
                <h2 className="text-xl font-semibold mb-4">General Inquiries</h2>
                <p className="text-gray-600 mb-4">
                  For general questions about Lockr, partnerships, or other inquiries.
                </p>
                <a 
                  href="mailto:contact@lockr.app" 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  contact@lockr.app →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 