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
  Lock,
  Smartphone,
  AlertCircle
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
  const [isTablet, setIsTablet] = useState(false)

  // Mobile and tablet detection
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      // Tablet vertical: 768 x 953 or similar proportions
      const isTabletVertical = width >= 768 && width <= 1024 && height > width
      
      setIsMobile(width < 768)
      setIsTablet(isTabletVertical)
      
      if (width >= 768) {
        setIsMobileMenuOpen(false)
      }
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const sections = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'phone', name: 'Phone', icon: Smartphone },
    { id: 'vault', name: 'Vault', icon: Lock },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'danger', name: 'Danger Zone', icon: AlertCircle }
  ]

  const currentSection = sections.find(s => s.id === activeSection)

  // Determine if we should show mobile layout (mobile OR tablet vertical)
  const shouldShowMobileLayout = isMobile || isTablet

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-accent-50 to-primary-100">
      {/* Mobile Header */}
      {shouldShowMobileLayout && (
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-4 py-4 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link 
                href="/dashboard"
                className="p-2 text-gray-500 hover:text-lockr-navy hover:bg-accent-50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-lockr-navy">Settings</h1>
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
                  className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white text-sm rounded-lg hover:from-lockr-blue hover:to-lockr-navy transition-colors disabled:opacity-50"
                >
                  <Settings className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              )}
              
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-gray-500 hover:text-lockr-navy hover:bg-accent-50 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tablet Navigation Bar - Only for tablet vertical orientation */}
      {isTablet && (
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <Link 
                href="/dashboard"
                className="p-2 text-gray-500 hover:text-lockr-navy hover:bg-accent-50 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-lockr-navy">Settings</h1>
                <p className="text-sm text-gray-600">Manage your account and preferences</p>
              </div>
            </div>
            
            {onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white text-sm rounded-lg hover:from-lockr-blue hover:to-lockr-navy transition-colors disabled:opacity-50"
              >
                <Settings className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            )}
          </div>
          
          {/* Horizontal Navigation for Tablets */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-2">
            {sections.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  activeSection === id 
                    ? id === 'danger'
                      ? 'bg-gradient-to-r from-error-600 to-error-700 text-white shadow-lockr-lg' 
                      : 'bg-gradient-to-r from-lockr-navy to-lockr-blue text-white shadow-lockr-lg'
                    : id === 'danger'
                    ? 'text-error-700 hover:bg-error-50 hover:text-error-800'
                    : 'text-gray-700 hover:bg-accent-50 hover:text-lockr-navy'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Header */}
      {!shouldShowMobileLayout && (
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link 
                  href="/dashboard"
                  className="p-2 text-gray-500 hover:text-lockr-navy hover:bg-accent-50 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-lockr-navy flex items-center space-x-3">
                    <Settings className="w-7 h-7 text-lockr-cyan" />
                    <span>Settings</span>
                  </h1>
                  <p className="text-gray-600">Manage your account and preferences</p>
                </div>
              </div>
              
              {onSave && (
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-lockr-navy to-lockr-blue text-white rounded-lg hover:from-lockr-blue hover:to-lockr-navy transition-colors disabled:opacity-50"
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
      {isMobileMenuOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation Menu - Only for actual mobile devices */}
      {isMobile && (
        <div className={`
          fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white/95 backdrop-blur-sm shadow-lockr-lg border-l border-gray-200/50 transform transition-transform duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="p-4 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-lockr-navy">Settings Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-500 hover:text-lockr-navy hover:bg-accent-50 rounded-lg transition-colors"
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
                    ? id === 'danger'
                      ? 'bg-gradient-to-r from-error-600 to-error-700 text-white shadow-lockr-lg' 
                      : 'bg-gradient-to-r from-lockr-navy to-lockr-blue text-white shadow-lockr-lg'
                    : id === 'danger'
                    ? 'text-error-700 hover:bg-error-50 hover:text-error-800'
                    : 'text-gray-700 hover:bg-accent-50 hover:text-lockr-navy'
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
        {shouldShowMobileLayout ? (
          // Mobile/Tablet: Full width content
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
                        ? id === 'danger'
                          ? 'bg-gradient-to-r from-error-600 to-error-700 text-white shadow-lockr-lg' 
                          : 'bg-gradient-to-r from-lockr-navy to-lockr-blue text-white shadow-lockr-lg'
                        : id === 'danger'
                        ? 'text-error-700 hover:bg-error-50 hover:text-error-800'
                        : 'text-gray-700 hover:bg-accent-50 hover:text-lockr-navy'
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