'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  Shield,
  Search,
  Plus,
  Globe,
  CreditCard,
  FileText,
  Wifi,
  Star,
  Edit,
  Trash2,
  MoreVertical,
  Eye,
  Copy,
  Download
} from 'lucide-react'

interface VaultItem {
  id: string
  name: string
  username: string
  email?: string
  password: string
  website?: string
  category: 'login' | 'card' | 'note' | 'wifi'
  favorite: boolean
  lastUsed: Date
  created: Date
  strength: 'weak' | 'fair' | 'good' | 'strong'
  notes?: string
  cardNumber?: string
  expiryDate?: string
  cvv?: string
  cardholderName?: string
  networkName?: string
  security?: string
  updatedAt?: string
  number?: string
  network?: string
}

interface ResponsiveVaultItemsProps {
  items: VaultItem[]
  viewMode: 'grid' | 'list'
  searchQuery: string
  selectedCategory: string
  onItemClick: (item: VaultItem) => void
  onEditItem: (item: VaultItem) => void
  onDeleteItem: (id: string) => void
  onToggleFavorite: (item: VaultItem) => void
  onDuplicateItem: (item: VaultItem) => void
  onExportItem: (item: VaultItem) => void
  onViewDetails: (item: VaultItem) => void
  onAddItem: () => void
}

export default function ResponsiveVaultItems({
  items,
  viewMode,
  searchQuery,
  selectedCategory,
  onItemClick,
  onEditItem,
  onDeleteItem,
  onToggleFavorite,
  onDuplicateItem,
  onExportItem,
  onViewDetails,
  onAddItem
}: ResponsiveVaultItemsProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'login':
        return <Globe className="w-4 h-4" />
      case 'card':
        return <CreditCard className="w-4 h-4" />
      case 'note':
        return <FileText className="w-4 h-4" />
      case 'wifi':
        return <Wifi className="w-4 h-4" />
      default:
        return <Shield className="w-4 h-4" />
    }
  }

  const getCategoryColors = (category: string) => {
    switch (category) {
      case 'login':
        return {
          bg: 'bg-blue-50',
          icon: 'text-blue-600',
          border: 'border-blue-200'
        }
      case 'card':
        return {
          bg: 'bg-emerald-50',
          icon: 'text-emerald-600',
          border: 'border-emerald-200'
        }
      case 'note':
        return {
          bg: 'bg-amber-50',
          icon: 'text-amber-600',
          border: 'border-amber-200'
        }
      case 'wifi':
        return {
          bg: 'bg-purple-50',
          icon: 'text-purple-600',
          border: 'border-purple-200'
        }
      default:
        return {
          bg: 'bg-gray-50',
          icon: 'text-gray-600',
          border: 'border-gray-200'
        }
    }
  }

  // Filter items based on search and category
  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.website?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = selectedCategory === 'all' || 
      selectedCategory === item.category ||
      (selectedCategory === 'favorites' && item.favorite) ||
      (selectedCategory === 'recent')

    return matchesSearch && matchesCategory
  })

  const handleMoreOptions = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation()
    setOpenDropdown(openDropdown === itemId ? null : itemId)
  }

  const getCategoryTitle = () => {
    switch (selectedCategory) {
      case 'all': return 'All Items'
      case 'favorites': return 'Favorites'
      case 'recent': return 'Recently Used'
      case 'login': return 'Logins'
      case 'card': return 'Payment Cards'
      case 'note': return 'Secure Notes'
      case 'wifi': return 'WiFi Passwords'
      default: return selectedCategory
    }
  }

  if (filteredItems.length === 0) {
    return (
      <div>
        {/* Category Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 capitalize mb-2">
                {getCategoryTitle()}
              </h1>
              <p className="text-gray-600">
                0 items{searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {searchQuery ? (
          // No search results
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600">Try adjusting your search or category filter.</p>
          </div>
        ) : (
          // Empty vault
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Your vault is empty</h3>
            <p className="text-gray-600 mb-8">Start securing your digital life by adding your first item.</p>
            <button
              onClick={onAddItem}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Your First Item</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Category Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 capitalize mb-2">
              {getCategoryTitle()}
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        </div>
      </div>

      {/* Vault Items */}
      <div className={
        viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4' 
          : 'space-y-2 md:space-y-3'
      }>
        {filteredItems.map((item) => {
          const categoryColors = getCategoryColors(item.category)
          return (
            <div
              key={item.id}
              className={`bg-white/70 backdrop-blur-sm rounded-xl border ${categoryColors.border} hover:shadow-lg transition-all duration-200 ${
                viewMode === 'list' ? 'p-3 md:p-4' : 'p-3 md:p-4'
              } hover:scale-[1.02] relative cursor-pointer`}
              onClick={() => onItemClick(item)}
            >
              <div className={`flex items-start justify-between ${viewMode === 'grid' ? 'flex-col space-y-3' : ''}`}>
                <div className={`flex items-start space-x-3 ${viewMode === 'grid' ? 'w-full' : 'flex-1'}`}>
                  <div className={`flex-shrink-0 p-2 md:p-2.5 ${categoryColors.bg} ${categoryColors.icon} rounded-xl border ${categoryColors.border}`}>
                    {getCategoryIcon(item.category)}
                  </div>
                  
                  <div className={`min-w-0 ${viewMode === 'grid' ? 'flex-1' : 'flex-1'}`}>
                    <div className="flex items-start justify-between mb-1">
                      <h3 className={`font-semibold text-gray-900 truncate ${viewMode === 'grid' ? 'text-sm' : 'text-sm md:text-base'} pr-2`}>
                        {item.name}
                      </h3>
                      {item.favorite && (
                        <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
                      )}
                    </div>
                    
                    <p className={`text-gray-600 truncate ${viewMode === 'grid' ? 'text-xs' : 'text-xs md:text-sm'}`}>
                      {item.category === 'login' && item.username}
                      {item.category === 'card' && `•••• •••• •••• ${item.number?.slice(-4) || item.cardNumber?.slice(-4) || ''}`}
                      {item.category === 'note' && 'Secure note'}
                      {item.category === 'wifi' && (item.network || item.networkName)}
                    </p>
                    
                    {viewMode === 'list' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Updated {item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : 'recently'}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`flex items-center space-x-1 ${viewMode === 'grid' ? 'w-full justify-end' : 'ml-3'} relative`}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditItem(item) }}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id) }}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="relative dropdown-container">
                    <button 
                      onClick={(e) => handleMoreOptions(e, item.id)}
                      className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openDropdown === item.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewDetails(item)
                            setOpenDropdown(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDuplicateItem(item)
                            setOpenDropdown(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Duplicate</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onExportItem(item)
                            setOpenDropdown(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Export</span>
                        </button>
                        <div className="border-t border-gray-200 my-1"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleFavorite(item)
                            setOpenDropdown(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <Star className={`w-4 h-4 ${item.favorite ? 'text-yellow-500 fill-current' : ''}`} />
                          <span>{item.favorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
} 