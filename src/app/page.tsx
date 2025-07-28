'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Lock, 
  Key, 
  Eye, 
  EyeOff, 
  Smartphone, 
  Globe, 
  Server,
  CheckCircle2,
  ArrowRight,
  Github,
  Star,
  Menu,
  X
} from 'lucide-react';

export default function LandingPage() {
  const [showPassword, setShowPassword] = useState(false);
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
            <Link href="#features" className="text-gray-600 hover:text-lockr-navy transition-colors">
              Features
            </Link>
            <Link href="#security" className="text-gray-600 hover:text-lockr-navy transition-colors">
              Security
            </Link>
            <Link href="#pricing" className="text-gray-600 hover:text-lockr-navy transition-colors">
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
              href="#features" 
              className="block text-gray-600 hover:text-lockr-navy transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link 
              href="#security" 
              className="block text-gray-600 hover:text-lockr-navy transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Security
            </Link>
            <Link 
              href="#pricing" 
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

      {/* Hero Section */}
      <section className="px-6 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center space-x-2 bg-lockr-cyan/10 text-lockr-navy px-4 py-2 rounded-full">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Enterprise-Grade Security</span>
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold text-lockr-navy leading-tight">
                  Your Passwords,
                  <br />
                  <span className="text-lockr-cyan">Completely Secure</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Open-source password manager with AES-256 encryption. 
                  Keep your digital life secure with zero-knowledge architecture.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  href="/authentication/signup"
                  className="bg-lockr-navy text-white px-8 py-4 rounded-lg font-semibold hover:bg-lockr-blue transition-colors flex items-center justify-center space-x-2"
                >
                  <span>Start Securing Now</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link 
                  href="#demo"
                  className="border-2 border-lockr-navy text-lockr-navy px-8 py-4 rounded-lg font-semibold hover:bg-lockr-navy hover:text-white transition-colors flex items-center justify-center space-x-2"
                >
                  <span>See Demo</span>
                  <Eye className="w-5 h-5" />
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-2">
                  <Github className="w-4 h-4" />
                  <span>Open Source</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Zero Knowledge</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4" />
                  <span>Self-Hostable</span>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-lockr-lg p-8 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-lockr-navy">Your Vault</h3>
                    <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse"></div>
                  </div>
                  
                  {/* Mock Password Entry */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Globe className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">gmail.com</p>
                          <p className="text-sm text-gray-500">work@example.com</p>
                        </div>
                      </div>
                      <button className="text-lockr-cyan hover:text-lockr-blue">
                        <Key className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <Server className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">AWS Console</p>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">
                              {showPassword ? 'MySecureP@ssw0rd!' : '••••••••••••'}
                            </span>
                            <button 
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-lockr-cyan hover:text-lockr-blue"
                            >
                              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <Lock className="w-4 h-4" />
                    <span>AES-256 Encrypted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-lockr-navy">
              Everything you need to stay secure
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Powerful features designed with privacy and security as the foundation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            {[
              {
                icon: Shield,
                title: "AES-256 Encryption",
                description: "Military-grade encryption ensures your data is protected with the strongest security standards."
              },
              {
                icon: Key,
                title: "Password Generator",
                description: "Create strong, unique passwords with customizable length and character sets."
              },
              {
                icon: Smartphone,
                title: "Cross-Platform",
                description: "Access your vault on any device with seamless synchronization and offline support."
              },
              {
                icon: Eye,
                title: "Zero Knowledge",
                description: "We can't see your data even if we wanted to. Your master password never leaves your device."
              },
              {
                icon: Server,
                title: "Self-Hostable",
                description: "Deploy on your own infrastructure for complete control over your sensitive data."
              },
              {
                icon: Github,
                title: "Open Source",
                description: "Fully transparent code that you can audit, contribute to, and trust completely."
              }
            ].map((feature, index) => (
              <div key={index} className="p-6 rounded-xl border border-gray-200 hover:border-lockr-cyan hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 bg-lockr-cyan/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-lockr-cyan" />
                </div>
                <h3 className="text-xl font-semibold text-lockr-navy mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="px-6 py-20 bg-lockr-navy text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold">
                  Security that never compromises
                </h2>
                <p className="text-xl text-gray-300">
                  Built with enterprise-grade security from the ground up. 
                  Your data is protected by multiple layers of encryption and security measures.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  "AES-256-GCM encryption with authenticated encryption",
                  "Argon2id password hashing for maximum resistance",
                  "Zero-knowledge architecture - we never see your data",
                  "End-to-end encryption for all communications",
                  "Open-source for complete transparency and trust"
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-lockr-cyan flex-shrink-0" />
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-lockr-blue to-lockr-cyan p-8 rounded-2xl">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Enterprise Ready</h3>
                  <p className="text-white/80">
                    The same security standards trusted by Fortune 500 companies, 
                    now available for your personal use.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Ready to secure your digital life?
          </h2>
          <p className="text-xl text-gray-300">
            Join thousands of users who trust Lockr to keep their passwords safe.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/authentication/signup"
              className="bg-lockr-cyan text-lockr-navy px-8 py-4 rounded-lg font-semibold hover:bg-lockr-cyan/90 transition-colors inline-flex items-center justify-center space-x-2"
            >
              <span>Start Free Today</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="#"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-lockr-navy transition-colors inline-flex items-center justify-center space-x-2"
            >
              <Github className="w-5 h-5" />
              <span>View on GitHub</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-lockr-cyan rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-lockr-navy" />
              </div>
              <span className="text-xl font-bold">Lockr</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/security" className="hover:text-white transition-colors">Security</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>&copy; 2024 Lockr. Open source password manager built with ❤️ for privacy.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 