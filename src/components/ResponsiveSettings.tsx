'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft,
  User,
  Shield,
  Database,
  Palette,
  Bell,
  Settings,
  Menu,
  X,
  Lock
} from 'lucide-react'

interface ResponsiveSettingsProps {
  children: ReactNode
  activeSection: string
  setActiveSection: (section: string) => void
  saving?: boolean
  onSave?: () => void
}

export default function ResponsiveSettings({
  children,
  activeSection,
  setActiveSection,
  saving = false,
  onSave
}: ResponsiveSettingsProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const sections = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'vault', name: 'Vault', icon: Lock },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'notifications', name: 'Notifications', icon: Bell }
  ]

  const currentSection = sections.find(s => s.id === activeSection)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Mobile Header */}
      {isMobile && (
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-4 py-4 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link 
                href="/dashboard"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
                {currentSection && (
                  <p className="text-sm text-gray-600">{currentSection.name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {onSave && (
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Settings className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              )}
              
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      {!isMobile && (
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
                    <Settings className="w-7 h-7 text-blue-600" />
                    <span>Settings</span>
                  </h1>
                  <p className="text-gray-600">Manage your account and preferences</p>
                </div>
              </div>
              
              {onSave && (
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Settings className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation Menu */}
      {isMobile && (
        <div className={`
          fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white/95 backdrop-blur-sm shadow-xl border-l border-gray-200/50 transform transition-transform duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="p-4 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Settings Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <nav className="p-4 space-y-2">
            {sections.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveSection(id)
                  setIsMobileMenuOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                  activeSection === id 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{name}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {isMobile ? (
          // Mobile: Full width content
          <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 p-4 md:p-6">
            {children}
          </div>
        ) : (
          // Desktop: Sidebar + Content layout
          <div className="flex gap-8">
            {/* Desktop Sidebar Navigation */}
            <div className="w-64 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 p-4 h-fit">
              <nav className="space-y-2">
                {sections.map(({ id, name, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                      activeSection === id 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{name}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Desktop Settings Content */}
            <div className="flex-1 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 p-6">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 