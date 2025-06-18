'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { 
  Shield, 
  Search, 
  Plus, 
  Grid3X3, 
  List, 
  User, 
  Settings, 
  LogOut,
  Home,
  CreditCard,
  FileText,
  Wifi,
  Globe,
  Star,
  Clock,
  Bell,
  Menu,
  X,
  MoreVertical,
  Download,
  Upload,
  Lock
} from 'lucide-react'

interface ResponsiveDashboardProps {
  user: { id: string; email: string; role: string } | null
  children: ReactNode
  searchQuery: string
  setSearchQuery: (query: string) => void
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  vaultItems: any[]
  notificationCount: number
  securityStats: {
    total: number
    weak: number
    reused: number
    breached: number
  }
  onAddItem: () => void
  onImport: () => void
  onExport: () => void
  onLock: () => void
  onLogout: () => void
}

export default function ResponsiveDashboard({
  user,
  children,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  selectedCategory,
  setSelectedCategory,
  vaultItems,
  notificationCount,
  securityStats,
  onAddItem,
  onImport,
  onExport,
  onLock,
  onLogout
}: ResponsiveDashboardProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showActionMenu, setShowActionMenu] = useState(false)

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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && !event.target?.closest('.mobile-sidebar')) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobileMenuOpen])

  const navigationItems = [
    { key: 'all', label: 'All Items', icon: Home, count: vaultItems.length },
    { key: 'favorites', label: 'Favorites', icon: Star, count: vaultItems.filter(item => item.favorite).length },
    { key: 'recent', label: 'Recently Used', icon: Clock, count: 0 },
    { key: 'notifications', label: 'Notifications', icon: Bell, count: notificationCount, isLink: true, href: '/dashboard/notifications' }
  ]

  const categoryItems = [
    { key: 'login', label: 'Logins', icon: Globe, gradient: 'from-blue-500 to-cyan-500', hover: 'hover:bg-blue-50 hover:text-blue-700', count: 'bg-blue-100 text-blue-700' },
    { key: 'card', label: 'Payment Cards', icon: CreditCard, gradient: 'from-emerald-500 to-teal-500', hover: 'hover:bg-emerald-50 hover:text-emerald-700', count: 'bg-emerald-100 text-emerald-700' },
    { key: 'note', label: 'Secure Notes', icon: FileText, gradient: 'from-amber-500 to-orange-500', hover: 'hover:bg-amber-50 hover:text-amber-700', count: 'bg-amber-100 text-amber-700' },
    { key: 'wifi', label: 'WiFi Passwords', icon: Wifi, gradient: 'from-purple-500 to-indigo-500', hover: 'hover:bg-purple-50 hover:text-purple-700', count: 'bg-purple-100 text-purple-700' }
  ]

  const handleNavClick = (key: string) => {
    setSelectedCategory(key)
    if (isMobile) setIsMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 mobile-sidebar' : 'w-64'}
        ${isMobile && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
        bg-white/80 backdrop-blur-sm shadow-lg border-r border-gray-200/50 flex flex-col
      `}>
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-200/50 bg-gradient-to-r from-blue-900 to-blue-800">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <span className="text-lg md:text-xl font-bold text-white">Lockr</span>
            </Link>
            
            {/* Mobile Close Button */}
            {isMobile && (
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 md:p-4 space-y-1 md:space-y-2 overflow-y-auto">
          {navigationItems.map(({ key, label, icon: Icon, count, isLink, href }) => {
            if (isLink && href) {
              return (
                <Link
                  key={key}
                  href={href}
                  onClick={() => {
                    if (isMobile) setIsMobileMenuOpen(false)
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-sm md:text-base">{label}</span>
                  {count > 0 && (
                    <span className="ml-auto text-xs md:text-sm px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {count}
                    </span>
                  )}
                </Link>
              )
            }

            return (
              <button
                key={key}
                onClick={() => handleNavClick(key)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                  selectedCategory === key 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' 
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm md:text-base">{label}</span>
                {count > 0 && (
                  <span className={`ml-auto text-xs md:text-sm px-2 py-0.5 rounded-full ${
                    selectedCategory === key ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          <div className="border-t border-gray-200 my-3 md:my-4"></div>

          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 md:mb-3">Categories</p>
            
            {categoryItems.map(({ key, label, icon: Icon, gradient, hover, count }) => (
              <button
                key={key}
                onClick={() => handleNavClick(key)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                  selectedCategory === key ? `bg-gradient-to-r ${gradient} text-white shadow-lg` : `text-gray-700 ${hover}`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm md:text-base">{label}</span>
                <span className={`ml-auto text-xs md:text-sm px-2 py-0.5 rounded-full ${
                  selectedCategory === key ? 'bg-white/20 text-white' : count
                }`}>
                  {vaultItems.filter(item => item.category === key).length}
                </span>
              </button>
            ))}
          </div>
        </nav>

        {/* Security Overview */}
        <div className="p-3 md:p-4 border-t border-gray-200/50">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 md:p-4 border border-gray-200">
            <h3 className="text-xs md:text-sm font-semibold text-gray-900 mb-2 md:mb-3 flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Security Health
            </h3>
            <div className="space-y-2 md:space-y-3 text-xs md:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Items</span>
                <span className="font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">{securityStats.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Weak Passwords</span>
                <span className={`font-bold px-2 py-1 rounded-lg ${securityStats.weak > 0 ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100'}`}>
                  {securityStats.weak}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Reused</span>
                <span className="font-bold text-green-600 bg-green-100 px-2 py-1 rounded-lg">{securityStats.reused}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Breached</span>
                <span className="font-bold text-green-600 bg-green-100 px-2 py-1 rounded-lg">{securityStats.breached}</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Menu */}
        <div className="p-3 md:p-4 border-t border-gray-200/50 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
              <p className="text-xs text-gray-600 truncate">{user?.email}</p>
            </div>
            <div className="flex space-x-1">
              <Link 
                href="/settings"
                onClick={() => {
                  if (isMobile) setIsMobileMenuOpen(false)
                }}
                className="p-1.5 md:p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all duration-200"
              >
                <Settings className="w-3 h-3 md:w-4 md:h-4" />
              </Link>
              <button 
                className="p-1.5 md:p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200" 
                onClick={onLogout}
              >
                <LogOut className="w-3 h-3 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-3 md:px-6 py-3 md:py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4 flex-1">
              {/* Mobile Menu Button */}
              {isMobile && (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}

              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search vault..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 md:py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm text-sm md:text-base"
                />
              </div>

              {/* View Toggle - Hidden on small mobile */}
              <div className="hidden sm:flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-1 md:space-x-3 ml-2 md:ml-4">
              {/* Mobile Actions Dropdown */}
              <div className="md:hidden relative">
                <button
                  onClick={() => setShowActionMenu(!showActionMenu)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                
                {showActionMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    <button
                      onClick={() => {
                        onImport()
                        setShowActionMenu(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import</span>
                    </button>
                    <button
                      onClick={() => {
                        onExport()
                        setShowActionMenu(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </button>
                    <button
                      onClick={() => {
                        onLock()
                        setShowActionMenu(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Lock</span>
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <div className="px-4 py-2">
                      <p className="text-xs text-gray-500 mb-2">View Mode</p>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setViewMode('list')
                            setShowActionMenu(false)
                          }}
                          className={`flex-1 p-2 rounded text-xs transition-colors ${
                            viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          List
                        </button>
                        <button
                          onClick={() => {
                            setViewMode('grid')
                            setShowActionMenu(false)
                          }}
                          className={`flex-1 p-2 rounded text-xs transition-colors ${
                            viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Grid
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Actions */}
              <div className="hidden md:flex items-center space-x-3">
                <button
                  onClick={onImport}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Import</span>
                </button>

                <button
                  onClick={onExport}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm font-medium">Export</span>
                </button>

                <button
                  onClick={onLock}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200"
                >
                  <Lock className="w-4 h-4" />
                  <span className="text-sm font-medium">Lock</span>
                </button>
              </div>

              {/* Add Item Button */}
              <button
                onClick={onAddItem}
                className="flex items-center space-x-1 md:space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 md:px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md text-sm md:text-base flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Add Item</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto px-3 md:px-6 py-4 md:py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
} 