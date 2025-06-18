import Image from "next/image";
import Link from "next/link";
import { Shield, Key, Lock, Eye, Database, Smartphone } from "lucide-react";

export default function LockrLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 lg:px-8">
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8 text-purple-400" />
          <span className="text-2xl font-bold text-white">Lockr</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/auth/signin"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center pt-20 pb-16">
          <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6">
            Your Passwords,
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Secured & Simple
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Keep all your passwords safe with military-grade encryption. 
            Access them anywhere, anytime, with complete peace of mind.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/demo"
              className="border border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              Watch Demo
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <section className="py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Why Choose Lockr?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Lock className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Bank-Level Security
              </h3>
              <p className="text-gray-300">
                Your data is encrypted with AES-256 encryption, the same standard used by banks and government agencies.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Key className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Password Generator
              </h3>
              <p className="text-gray-300">
                Generate strong, unique passwords for all your accounts with our built-in password generator.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Eye className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Zero-Knowledge
              </h3>
              <p className="text-gray-300">
                We can't see your passwords, even if we wanted to. Your master password is the only key.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Database className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Secure Sync
              </h3>
              <p className="text-gray-300">
                Access your passwords on all your devices with secure cloud synchronization.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Smartphone className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Cross-Platform
              </h3>
              <p className="text-gray-300">
                Use Lockr on desktop, mobile, and web browsers. Your passwords follow you everywhere.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <Shield className="h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Breach Monitoring
              </h3>
              <p className="text-gray-300">
                Get notified if any of your passwords are compromised in data breaches.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center py-20">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Secure Your Digital Life?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of users who trust Lockr with their passwords.
          </p>
          <Link
            href="/auth/signup"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-10 py-4 rounded-lg text-xl font-semibold transition-all transform hover:scale-105"
          >
            Get Started Free
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Shield className="h-6 w-6 text-purple-400" />
              <span className="text-xl font-bold text-white">Lockr</span>
            </div>
            <div className="flex space-x-6 text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/support" className="hover:text-white transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="text-center text-gray-400 mt-8">
            © 2024 Lockr. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
