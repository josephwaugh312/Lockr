'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Shield, 
  Search, 
  Plus, 
  Filter, 
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
  Lock,
  Eye,
  EyeOff,
  Copy,
  Edit,
  Trash2,
  Star,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Download,
  Upload,
  RefreshCw,
  X,
  ChevronDown,
  ExternalLink,
  Key,
  StickyNote,
  ArrowLeft,
  Palette,
  Bell,
  Smartphone,
  Save,
  Timer,
  Moon,
  Sun,
  Monitor
} from 'lucide-react'
import ItemModal from '../../components/ItemModal'
import NotificationToast from '../../components/NotificationToast'
import NotificationBell from '../../components/notifications/NotificationBell'
import ResponsiveDashboard from '../../components/ResponsiveDashboard'
import { API_BASE_URL, apiRequest } from '../../lib/utils'
import { deriveEncryptionKey } from '../../lib/encryption'
import { useClipboardManager } from '../../hooks/useClipboardManager'
import { useAutoLock } from '../../hooks/useAutoLock'
import { useNotifications, useUnreadCount, useNotificationStats } from '../../hooks/useNotifications'
import { useNotificationStore } from '../../stores/notificationStore'

// Types for our vault items
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
  // Card-specific fields
  cardNumber?: string
  expiryDate?: string
  cvv?: string
  cardholderName?: string
  // WiFi-specific fields
  networkName?: string
  security?: string
}

// Mock data for demonstration
const initialMockData: VaultItem[] = [
  {
    id: '1',
    name: 'GitHub',
    username: 'john.doe',
    email: 'john@example.com',
    password: 'MySecurePassword123!',
    website: 'github.com',
    category: 'login',
    favorite: true,
    lastUsed: new Date('2024-01-15'),
    created: new Date('2024-01-01'),
    strength: 'strong',
    notes: 'Work account for development projects'
  },
  {
    id: '2',
    name: 'Netflix',
    username: 'john.doe@email.com',
    password: 'NetflixPass2024',
    website: 'netflix.com',
    category: 'login',
    favorite: false,
    lastUsed: new Date('2024-01-14'),
    created: new Date('2024-01-02'),
    strength: 'good'
  },
  {
    id: '3',
    name: 'Chase Credit Card',
    username: '4532-1234-5678-9012',
    password: '1234',
    category: 'card',
    favorite: false,
    lastUsed: new Date('2024-01-13'),
    created: new Date('2024-01-03'),
    strength: 'good',
    notes: 'Main credit card',
    cardNumber: '4532-1234-5678-9012',
    cardholderName: 'John Doe',
    expiryDate: '12/26',
    cvv: '123'
  },
  {
    id: '4',
    name: 'Home WiFi',
    username: 'HomeNetwork_5G',
    password: 'MyHomeWiFi2024!',
    category: 'wifi',
    favorite: true,
    lastUsed: new Date('2024-01-12'),
    created: new Date('2024-01-04'),
    strength: 'strong',
    networkName: 'HomeNetwork_5G',
    security: 'WPA2'
  },
  {
    id: '5',
    name: 'Banking Notes',
    username: '',
    password: '',
    category: 'note',
    favorite: false,
    lastUsed: new Date('2024-01-11'),
    created: new Date('2024-01-05'),
    strength: 'good', // Default for non-password items (not displayed)
    notes: 'Important banking information and security questions'
  }
]

export default function Dashboard() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showPasswordIds, setShowPasswordIds] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null)
  
  // Dropdown state for more options
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  // File input ref for import functionality
  const fileInputRef = useRef<HTMLInputElement>(null)

  // New state for user data
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null)

  // Notification state
  const { unreadCount } = useNotificationStore()

  // Settings state
  const [userSettings, setUserSettings] = useState({
    clipboardTimeout: 30,
    autoLockTimeout: 15,
    securityAlerts: true,
    showPasswordStrength: true,
    autoSave: true
  })

  // Vault state management
  const [vaultState, setVaultState] = useState<'loading' | 'locked' | 'unlocked' | 'error'>('loading')
  const [isLoading, setIsLoading] = useState(false)
  const [unlockAttempts, setUnlockAttempts] = useState(0)
  const [masterPassword, setMasterPassword] = useState('')
  const [showMasterPassword, setShowMasterPassword] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    // Mobile and tablet detection
    const checkScreenSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      // Tablet vertical: 768 x 953 or similar proportions
      const isTabletVertical = width >= 768 && width <= 1024 && height > width
      
      setIsMobile(width < 768 || isTabletVertical)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    
    // Load user data from localStorage
    const userData = localStorage.getItem('lockr_user')
    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (error) {
        console.error('Error parsing user data:', error)
        // SECURITY: Clear vault data when redirecting due to corrupted user data
        sessionStorage.removeItem('lockr_encryption_key')
        // If user data is corrupted, redirect to login
        router.push('/authentication/signin')
      }
    } else {
      // SECURITY: Clear vault data when redirecting due to missing user data  
      sessionStorage.removeItem('lockr_encryption_key')
      // No user data found, redirect to login
      router.push('/authentication/signin')
    }
    
    // Check vault status and load data
    checkVaultStatus()
    loadUserSettings()
  }, [router])

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the dropdown
      const target = event.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null)
      }
    }
    
    if (openDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openDropdown])

  const checkVaultStatus = async () => {
    try {
      const token = localStorage.getItem('lockr_access_token')
      if (!token) {
        // SECURITY: Clear vault data when redirecting due to missing access token
        sessionStorage.removeItem('lockr_encryption_key')
        router.push('/authentication/signin')
        return
      }

      // Check if we have an encryption key in session storage
      const encryptionKey = sessionStorage.getItem('lockr_encryption_key')
      if (!encryptionKey) {
        // No encryption key means vault is locked
        setVaultState('locked')
        return
      }

      // Try to load vault items to verify the encryption key is valid
      await loadVaultItems()

    } catch (error) {
      console.error('Error checking vault status:', error)
      setVaultState('error')
    }
  }

  const handleVaultUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!masterPassword) {
      setUnlockError('Master password is required')
      return
    }

    setIsUnlocking(true)
    setUnlockError('')

    try {
      const token = localStorage.getItem('lockr_access_token')
      if (!token) {
        router.push('/authentication/signin')
        return
      }

      // Get user email for key derivation
      const userStr = localStorage.getItem('lockr_user')
      if (!userStr) {
        router.push('/authentication/signin')
        return
      }
      const user = JSON.parse(userStr)
      const email = user.email

      // Derive encryption key from master password (zero-knowledge)
      const encryptionKey = await deriveEncryptionKey(masterPassword, email)

      const response = await apiRequest(`${API_BASE_URL}/vault/unlock`, {
        method: 'POST',
        body: JSON.stringify({
          encryptionKey
        })
      })

        // Store encryption key for vault operations (in memory only)
        sessionStorage.setItem('lockr_encryption_key', encryptionKey)
      if (response.ok) {
        setMasterPassword('')
        setUnlockAttempts(0)
        setToastMessage('Vault unlocked successfully!')
        setToastType('success')
        
        // Load vault data with the new encryption key
        await loadVaultItems()
      } else {
        const data = await response.json()
        console.log("DEBUG: Backend response:", data)
        
        // Handle re-authentication requirement after master password reset
        if (response.status === 401 && data.requiresReauth) {
          setToastMessage('Master password was recently reset. Please sign in again.')
          setToastType('error')
          
          // Clear all storage and redirect to sign in
          localStorage.clear()
          sessionStorage.clear()
          router.push('/authentication/signin')
          return
        }
        
        setUnlockError(data.error || 'Failed to unlock vault')
        setUnlockAttempts(prev => prev + 1)
        
        if (response.status === 429) {
          setToastMessage('Too many unlock attempts. Please wait before trying again.')
          setToastType('error')
        }
      }
    } catch (error) {
      console.error('Vault unlock error:', error)
      setUnlockError('Failed to unlock vault. Please try again.')
      setUnlockAttempts(prev => prev + 1)
    } finally {
      setIsUnlocking(false)
    }
  }

  // Filter and search functionality
  const filteredItems = useMemo(() => {
    return vaultItems.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.website && item.website.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'all' || 
        (selectedCategory === 'favorites' ? item.favorite : 
         selectedCategory === 'recent' ? true : // Would need proper recent logic
         item.category === selectedCategory)

      return matchesSearch && matchesCategory
    })
  }, [vaultItems, searchQuery, selectedCategory])

  // Security stats
  const securityStats = useMemo(() => {
    const total = vaultItems.length
    // Only count password-based items for weak password calculation
    const passwordItems = vaultItems.filter(item => item.category === 'login' || item.category === 'wifi')
    const weak = passwordItems.filter(item => item.strength === 'weak').length
    const reused = 0 // Would calculate actual password reuse
    const breached = 0 // Would check against breach databases
    
    return { total, weak, reused, breached }
  }, [vaultItems])

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const copyToClipboard = async (text: string, type: string) => {
    await clipboardManager.copyToClipboard(text, type)
  }

  const handleAddItem = () => {
    setModalMode('add')
    setEditingItem(null)
    setIsModalOpen(true)
  }

  const handleEditItem = (item: VaultItem) => {
    setModalMode('edit')
    setEditingItem(item)
    setIsModalOpen(true)
    setOpenDropdown(null)
  }

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      try {
        const token = localStorage.getItem('lockr_access_token')
        if (!token) {
          setToastMessage('Session expired. Please log in again.')
          setToastType('error')
          router.push('/authentication/signin')
          return
        }

        // Get encryption key from session storage (for consistency, though delete might not need it)
        const encryptionKey = sessionStorage.getItem('lockr_encryption_key')
        if (!encryptionKey) {
          setToastMessage('Vault is locked. Please unlock your vault first.')
          setToastType('error')
          return
        }

        const response = await apiRequest(`${API_BASE_URL}/vault/entries/${id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          // Remove from local state
          setVaultItems(prev => prev.filter(item => item.id !== id))
          setToastMessage('Item deleted successfully!')
          setToastType('success')
        } else {
          const errorData = await response.json()
          console.error('Delete item error:', errorData)
          
          if (response.status === 401) {
            setToastMessage('Session expired. Please log in again.')
            setToastType('error')
            router.push('/authentication/signin')
          } else if (response.status === 403) {
            setToastMessage('Vault session expired. Please unlock your vault again.')
            setToastType('error')
            setVaultState('locked')
          } else {
            setToastMessage(errorData.error || 'Failed to delete item')
            setToastType('error')
          }
        }
      } catch (error) {
        console.error('Error deleting item:', error)
        setToastMessage('Failed to delete item')
        setToastType('error')
      }
    }
  }

  const handleToggleFavorite = async (id: string) => {
    try {
      const token = localStorage.getItem('lockr_access_token')
      if (!token) {
        setToastMessage('Session expired. Please log in again.')
        setToastType('error')
        router.push('/authentication/signin')
        return
      }

      // Get encryption key from session storage
      const encryptionKey = sessionStorage.getItem('lockr_encryption_key')
      if (!encryptionKey) {
        setToastMessage('Vault is locked. Please unlock your vault first.')
        setToastType('error')
        return
      }

      // Find the current item to get its data
      const currentItem = vaultItems.find(item => item.id === id)
      if (!currentItem) {
        setToastMessage('Item not found')
        setToastType('error')
        return
      }

      const newFavoriteStatus = !currentItem.favorite

      // Update local state optimistically
      setVaultItems(prev => prev.map(item => 
        item.id === id ? { ...item, favorite: newFavoriteStatus } : item
      ))

      // Prepare update data with all required fields
      const updateData = {
        encryptionKey: encryptionKey,
        title: currentItem.name,
        username: currentItem.username || '',
        email: currentItem.email || '',
        password: currentItem.password || '',
        website: currentItem.website || '',
        category: currentItem.category || 'login',
        notes: currentItem.notes || '',
        favorite: newFavoriteStatus
      }

      const response = await apiRequest(`${API_BASE_URL}/vault/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        setToastMessage(newFavoriteStatus ? 'Added to favorites!' : 'Removed from favorites!')
        setToastType('success')
      } else {
        // Revert the optimistic update on error
        setVaultItems(prev => prev.map(item => 
          item.id === id ? { ...item, favorite: currentItem.favorite } : item
        ))

        const errorData = await response.json()
        console.error('Toggle favorite error:', errorData)
        
        if (response.status === 401) {
          setToastMessage('Session expired. Please log in again.')
          setToastType('error')
          router.push('/authentication/signin')
        } else if (response.status === 403) {
          setToastMessage('Vault session expired. Please unlock your vault again.')
          setToastType('error')
          setVaultState('locked')
        } else {
          setToastMessage(errorData.error || 'Failed to update favorite status')
          setToastType('error')
        }
      }
    } catch (error) {
      // Revert the optimistic update on error
      const currentItem = vaultItems.find(item => item.id === id)
      if (currentItem) {
        setVaultItems(prev => prev.map(item => 
          item.id === id ? { ...item, favorite: currentItem.favorite } : item
        ))
      }
      
      console.error('Error toggling favorite:', error)
      setToastMessage('Failed to update favorite status')
      setToastType('error')
    }
  }

  const handleDuplicateItem = (item: VaultItem) => {
    const duplicatedItem: VaultItem = {
      ...item,
      id: Date.now().toString(),
      name: `${item.name} (Copy)`,
      created: new Date(),
      lastUsed: new Date()
    }
    setVaultItems(prev => [...prev, duplicatedItem])
    console.log('Item duplicated:', duplicatedItem)
    setOpenDropdown(null)
  }

  const handleExportItem = (item: VaultItem) => {
    const exportData = {
      name: item.name,
      username: item.username,
      email: item.email,
      website: item.website,
      category: item.category,
      notes: item.notes,
      created: item.created.toISOString(),
      // Don't export sensitive data like passwords in real implementation
    }
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`
    link.click()
    URL.revokeObjectURL(url)
    setOpenDropdown(null)
  }

  const handleViewDetails = (item: VaultItem) => {
    // In a real app, this could open a detailed view modal
    alert(`Item Details:\n\nName: ${item.name}\nCategory: ${item.category}\nCreated: ${item.created.toLocaleDateString()}\nLast Used: ${item.lastUsed.toLocaleDateString()}\nStrength: ${item.strength}`)
    setOpenDropdown(null)
  }

  const handleMoreOptions = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation()
    console.log('More options clicked for item:', itemId, 'Current dropdown:', openDropdown)
    setOpenDropdown(openDropdown === itemId ? null : itemId)
  }

  // Helper function to normalize URLs
  const normalizeUrl = (url: string): string => {
    if (!url || !url.trim()) return url
    const trimmedUrl = url.trim()
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl
    }
    return `https://${trimmedUrl}`
  }

  const handleSaveItem = async (itemData: Partial<VaultItem>) => {
    try {
      const token = localStorage.getItem('lockr_access_token')
      if (!token) {
        setToastMessage('Session expired. Please log in again.')
        setToastType('error')
        router.push('/authentication/signin')
        return
      }

      if (modalMode === 'add') {
        // Creating new item
        
        // Get encryption key from session storage
        const encryptionKey = sessionStorage.getItem('lockr_encryption_key')
        if (!encryptionKey) {
          setToastMessage('Vault is locked. Please unlock your vault first.')
          setToastType('error')
          return
        }

        const createData = {
          encryptionKey: encryptionKey,
          title: itemData.name,
          username: itemData.username || '',
          email: itemData.email || '',
          password: itemData.password || '',
          website: itemData.website || '',
          category: itemData.category || 'login',
          notes: itemData.notes || '',
          favorite: itemData.favorite || false
        } as const

        console.log('Sending create data:', createData)

        const response = await apiRequest(`${API_BASE_URL}/vault/entries`, {
          method: 'POST',
          body: JSON.stringify(createData)
        })

        if (response.ok) {
          const data = await response.json()
          console.log("DEBUG: Backend response:", data)
          
          // Convert backend format to frontend format
          const newItem: VaultItem = {
            id: data.entry.id,
            name: itemData.name || "",
            username: itemData.username || '',
            email: itemData.email || '',
            password: itemData.password || '',
            website: itemData.website || '',
            category: data.entry.category as 'login' | 'card' | 'note' | 'wifi',
            favorite: itemData.favorite || false, // Use actual favorite value from form
            lastUsed: new Date(),
            created: new Date(data.entry.createdAt),
            strength: calculatePasswordStrength(itemData.password || '') as 'weak' | 'fair' | 'good' | 'strong',
            notes: itemData.notes || '',
            // Card-specific fields
            cardNumber: itemData.cardNumber || '',
            expiryDate: itemData.expiryDate || '',
            cvv: itemData.cvv || '',
            cardholderName: itemData.cardholderName || '',
            // WiFi-specific fields
            networkName: itemData.networkName || '',
            security: itemData.security || ''
          }

          setVaultItems(prev => [...prev, newItem])
          console.log("DEBUG: Added item to vault list")
          setToastMessage('Item created successfully!')
          setToastType('success')
        } else {
          const errorData = await response.json()
          console.error('Create item error:', errorData)
          
          if (response.status === 401) {
            setToastMessage('Session expired. Please log in again.')
            setToastType('error')
            // Don't redirect immediately for auto-save, just show error
          } else if (response.status === 403 || (errorData.error && errorData.error.includes('Vault session expired'))) {
            // Vault session expired - redirect to vault unlock
            console.log('Vault session expired, redirecting to unlock')
            setVaultState('locked')
            setVaultItems([])
            setToastMessage('Vault session expired. Please unlock your vault again.')
            setToastType('error')
            throw new Error('Vault session expired') // Throw so auto-save knows it failed
          } else {
            setToastMessage(errorData.error || 'Failed to create item')
            setToastType('error')
          }
          throw new Error(errorData.error || 'Failed to create item')
        }
      } else if (modalMode === 'edit' && editingItem) {
        // Update existing item
        
        // Get encryption key from session storage
        const encryptionKey = sessionStorage.getItem('lockr_encryption_key')
        if (!encryptionKey) {
          setToastMessage('Vault is locked. Please unlock your vault first.')
          setToastType('error')
          return
        }

        const updateData = {
          encryptionKey: encryptionKey,
          title: itemData.name,
          username: itemData.username || '',
          email: itemData.email || '',
          password: itemData.password || '',
          website: itemData.website || '',
          category: itemData.category || 'login',
          notes: itemData.notes || '',
          favorite: itemData.favorite || false
        } as const

        console.log('Sending update data:', updateData)

        const response = await apiRequest(`${API_BASE_URL}/vault/entries/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        })

        if (response.ok) {
          const data = await response.json()
          console.log("DEBUG: Backend response:", data)
          
          // Update local state with the updated item
          setVaultItems(prev => prev.map(item => 
            item.id === editingItem.id 
              ? { 
                  ...item, 
                  name: itemData.name || "",
                  username: itemData.username || '',
                  password: itemData.password || item.password,
                  website: itemData.website || '',
                  category: data.entry.category as 'login' | 'card' | 'note' | 'wifi',
                  notes: itemData.notes || '',
                  lastUsed: new Date(),
                  // Update other fields from itemData
                  email: itemData.email || item.email,
                  favorite: itemData.favorite !== undefined ? itemData.favorite : item.favorite, // Preserve favorite status
                  cardNumber: itemData.cardNumber || item.cardNumber,
                  expiryDate: itemData.expiryDate || item.expiryDate,
                  cvv: itemData.cvv || item.cvv,
                  cardholderName: itemData.cardholderName || item.cardholderName,
                  networkName: itemData.networkName || item.networkName,
                  security: itemData.security || item.security,
                  strength: calculatePasswordStrength(itemData.password || item.password || '') as 'weak' | 'fair' | 'good' | 'strong'
                }
              : item
          ))
          setToastMessage('Item updated successfully!')
          setToastType('success')
        } else {
          const errorData = await response.json()
          console.error('Update item error:', errorData)
          
          if (response.status === 401) {
            setToastMessage('Session expired. Please log in again.')
            setToastType('error')
            // Don't redirect immediately for auto-save, just show error
          } else if (response.status === 403 || (errorData.error && errorData.error.includes('Vault session expired'))) {
            // Vault session expired - redirect to vault unlock
            console.log('Vault session expired, redirecting to unlock')
            setVaultState('locked')
            setVaultItems([])
            setToastMessage('Vault session expired. Please unlock your vault again.')
            setToastType('error')
            throw new Error('Vault session expired') // Throw so auto-save knows it failed
          } else {
            setToastMessage(errorData.error || 'Failed to update item')
            setToastType('error')
          }
          throw new Error(errorData.error || 'Failed to update item')
        }
      }
    } catch (error) {
      console.error('Save item error:', error)
      if (error instanceof Error && error.message.includes('Session expired')) {
        // Session expired error already handled above
        return
      }
      setToastMessage('Failed to save item. Please try again.')
      setToastType('error')
      throw error // Re-throw for auto-save error handling
    }
  }

  const handleExportVault = () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        source: 'Lockr Password Manager',
        itemCount: vaultItems.length,
        items: vaultItems.map(item => ({
          id: item.id,
          name: item.name,
          username: item.username,
          email: item.email,
          website: item.website,
          category: item.category,
          favorite: item.favorite,
          notes: item.notes,
          created: item.created.toISOString(),
          lastUsed: item.lastUsed.toISOString(),
          strength: item.strength,
          // Card fields (excluding sensitive data)
          cardholderName: item.cardholderName,
          // WiFi fields (excluding passwords)
          networkName: item.networkName,
          security: item.security
          // Note: Passwords, card numbers, CVV, and expiry dates are intentionally excluded for security
        }))
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `lockr_vault_export_${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)

      setToastMessage(`Successfully exported ${vaultItems.length} items`)
      setToastType('success')
    } catch (error) {
      console.error('Export failed:', error)
      setToastMessage('Failed to export vault data')
      setToastType('error')
    }
  }

  const handleImportVault = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setToastMessage('Please select a valid JSON file')
      setToastType('error')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)

        // Validate the import data structure
        if (!importData.items || !Array.isArray(importData.items)) {
          throw new Error('Invalid file format')
        }

        const validItems: VaultItem[] = []
        const errors: string[] = []

        importData.items.forEach((item: any, index: number) => {
          try {
            // Validate required fields
            if (!item.name || !item.category) {
              errors.push(`Item ${index + 1}: Missing required fields (name, category)`)
              return
            }

            // Validate category
            if (!['login', 'card', 'note', 'wifi'].includes(item.category)) {
              errors.push(`Item ${index + 1}: Invalid category "${item.category}"`)
              return
            }

            const newItem: VaultItem = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Generate unique ID
              name: item.name,
              username: item.username || '',
              email: item.email || '',
              password: '', // Always empty for security - users need to add passwords manually
              website: item.website || '',
              category: item.category,
              favorite: Boolean(item.favorite),
              notes: item.notes || '',
              created: item.created ? new Date(item.created) : new Date(),
              lastUsed: item.lastUsed ? new Date(item.lastUsed) : new Date(),
              strength: 'weak', // Default strength since no password
              // Card fields
              cardNumber: '', // Always empty for security
              expiryDate: '', // Always empty for security  
              cvv: '', // Always empty for security
              cardholderName: item.cardholderName || '',
              // WiFi fields
              networkName: item.networkName || '',
              security: item.security || 'WPA2'
            }

            validItems.push(newItem)
          } catch (itemError) {
            errors.push(`Item ${index + 1}: ${itemError instanceof Error ? itemError.message : 'Invalid data'}`)
          }
        })

        if (validItems.length === 0) {
          setToastMessage('No valid items found in the import file')
          setToastType('error')
          return
        }

        // Ask for confirmation before importing
        const confirmMessage = validItems.length === importData.items.length 
          ? `Import ${validItems.length} items to your vault?`
          : `Import ${validItems.length} valid items? (${errors.length} items had errors and will be skipped)`

        if (confirm(confirmMessage)) {
          setVaultItems(prev => [...prev, ...validItems])
          
          let message = `Successfully imported ${validItems.length} items`
          if (errors.length > 0) {
            message += ` (${errors.length} items skipped due to errors)`
          }
          message += '\n\nNote: For security, passwords and card details need to be added manually.'
          
          setToastMessage(message)
          setToastType(validItems.length > 0 ? 'success' : 'error')
          
          console.log('Import completed:', { validItems: validItems.length, errors: errors.length })
          if (errors.length > 0) {
            console.warn('Import errors:', errors)
          }
        }

      } catch (error) {
        console.error('Import failed:', error)
        setToastMessage('Failed to parse import file. Please check the file format.')
        setToastType('error')
      }
    }

    reader.onerror = () => {
      setToastMessage('Failed to read the selected file')
      setToastType('error')
    }

    reader.readAsText(file)
    
    // Reset the input so the same file can be selected again
    event.target.value = ''
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'login': return <Globe className="w-4 h-4" />
      case 'card': return <CreditCard className="w-4 h-4" />
      case 'note': return <FileText className="w-4 h-4" />
      case 'wifi': return <Wifi className="w-4 h-4" />
      default: return <Lock className="w-4 h-4" />
    }
  }

  const getCategoryColors = (category: string) => {
    switch (category) {
      case 'login': return { 
        bg: 'bg-blue-50', 
        border: 'border-blue-200', 
        icon: 'text-blue-600',
        accent: 'bg-blue-100'
      }
      case 'card': return { 
        bg: 'bg-emerald-50', 
        border: 'border-emerald-200', 
        icon: 'text-emerald-600',
        accent: 'bg-emerald-100'
      }
      case 'note': return { 
        bg: 'bg-amber-50', 
        border: 'border-amber-200', 
        icon: 'text-amber-600',
        accent: 'bg-amber-100'
      }
      case 'wifi': return { 
        bg: 'bg-purple-50', 
        border: 'border-purple-200', 
        icon: 'text-purple-600',
        accent: 'bg-purple-100'
      }
      default: return { 
        bg: 'bg-gray-50', 
        border: 'border-gray-200', 
        icon: 'text-gray-600',
        accent: 'bg-gray-100'
      }
    }
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return 'text-red-700 bg-red-100 border border-red-200'
      case 'fair': return 'text-orange-700 bg-orange-100 border border-orange-200'
      case 'good': return 'text-blue-700 bg-blue-100 border border-blue-200'
      case 'strong': return 'text-green-700 bg-green-100 border border-green-200'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const calculatePasswordStrength = (password: string): 'weak' | 'fair' | 'good' | 'strong' => {
    if (!password || password.length === 0) return 'weak'
    
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) return 'weak'
    else if (score <= 3) return 'fair'
    else if (score <= 4) return 'good'
    else return 'strong'
  }

  const handleLogout = async () => {
    try {
      // Get the access token from localStorage
      const accessToken = localStorage.getItem('lockr_access_token')
      
      if (accessToken) {
        // Call the backend logout endpoint
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        })
      }
      
      // Clear all stored data regardless of API call success
      localStorage.removeItem('lockr_access_token')
      localStorage.removeItem('lockr_refresh_token')
      localStorage.removeItem('lockr_user')
      
      // SECURITY: Clear vault encryption key and lock vault
      sessionStorage.removeItem('lockr_encryption_key')
      
      // Clear all vault-related state
      setVaultState('locked')
      setVaultItems([])
      setShowPasswordIds(new Set())
      setSelectedItems(new Set())
      setMasterPassword('')
      setUnlockError('')
      setUnlockAttempts(0)
      
      // Clear any sensitive UI state
      setIsModalOpen(false)
      setEditingItem(null)
      setOpenDropdown(null)
      
      // Redirect to home page
      router.push('/')
      
    } catch (error) {
      // Even if the API call fails, still clear all data and redirect
      console.error('Logout error:', error)
      localStorage.removeItem('lockr_access_token')
      localStorage.removeItem('lockr_refresh_token')
      localStorage.removeItem('lockr_user')
      
      // SECURITY: Always clear vault data on logout, even on error
      sessionStorage.removeItem('lockr_encryption_key')
      setVaultState('locked')
      setVaultItems([])
      setShowPasswordIds(new Set())
      setSelectedItems(new Set())
      setMasterPassword('')
      setUnlockError('')
      setUnlockAttempts(0)
      setIsModalOpen(false)
      setEditingItem(null)
      setOpenDropdown(null)
      
      router.push('/')
    }
  }

  const loadUserSettings = async () => {
    try {
      const token = localStorage.getItem('lockr_access_token')
      if (!token) return

      const response = await apiRequest(`${API_BASE_URL}/auth/settings`)

      if (response.ok) {
        const data = await response.json()
          console.log("DEBUG: Backend response:", data)
        setUserSettings({
          clipboardTimeout: data.settings?.clipboardTimeout ?? 30,
          autoLockTimeout: data.settings?.autoLockTimeout ?? 15,
          securityAlerts: data.settings?.securityAlerts ?? true,
          showPasswordStrength: data.settings?.showPasswordStrength ?? true,
          autoSave: data.settings?.autoSave ?? true
        })
      }
    } catch (error) {
      console.error('Failed to load user settings:', error)
    }
  }

  // Initialize hooks with current settings
  const clipboardManager = useClipboardManager({
    clipboardTimeout: userSettings.clipboardTimeout,
    showNotifications: userSettings.securityAlerts,
    onNotification: (message, type) => {
      setToastMessage(message)
      setToastType(type)
    }
  })

  const autoLock = useAutoLock({
    autoLockTimeout: userSettings.autoLockTimeout,
    showNotifications: userSettings.securityAlerts,
    onNotification: (message, type) => {
      setToastMessage(message)
      setToastType(type)
    },
    onLock: () => {
      // Clear any sensitive state when locking
      setVaultState('locked')
      setVaultItems([])
      setShowPasswordIds(new Set())
    }
  })

  // Add session expiry event listener
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('🔒 Session expired - clearing vault data')
      
      // SECURITY: Clear vault encryption key to lock vault
      sessionStorage.removeItem('lockr_encryption_key')
      
      // Clear vault state
      setVaultState('locked')
      setVaultItems([])
      setShowPasswordIds(new Set())
      setSelectedItems(new Set())
      setMasterPassword('')
      setUnlockError('')
      setUnlockAttempts(0)
      
      // Clear sensitive UI state
      setIsModalOpen(false)
      setEditingItem(null)
      setOpenDropdown(null)
      
      setToastMessage('Session expired. Please log in again.')
      setToastType('error')
    }

    window.addEventListener('session-expired', handleSessionExpired)
    
    return () => {
      window.removeEventListener('session-expired', handleSessionExpired)
    }
  }, [])

  // Add debug logging to see current settings
  useEffect(() => {
    console.log('Dashboard userSettings updated:', userSettings)
  }, [userSettings])

  const handleManualLock = async () => {
    if (confirm('Are you sure you want to lock your vault?')) {
      try {
        const token = localStorage.getItem('lockr_access_token')
        if (token) {
          // Call backend to lock vault
          await apiRequest(`${API_BASE_URL}/vault/lock`, {
            method: 'POST'
          })
        }
      } catch (error) {
        console.warn('Failed to lock vault on backend:', error)
      } finally {
        // Always clear local state and update vault state
        autoLock.manualLock()
        setVaultState('locked')
        setVaultItems([])
        setShowPasswordIds(new Set())
        setMasterPassword('')
        setUnlockError('')
        setUnlockAttempts(0)
      }
    }
  }

  const loadVaultItems = async () => {
    try {
      setIsLoading(true)
      
      // Get encryption key from session storage
      const encryptionKey = sessionStorage.getItem('lockr_encryption_key')
      if (!encryptionKey) {
        console.log('No encryption key found, vault may be locked')
        setVaultState('locked')
        return
      }

      // Send POST request with encryption key in body (stateless approach)
      const response = await apiRequest(`${API_BASE_URL}/vault/entries/list`, {
        method: 'POST',
        body: JSON.stringify({
          encryptionKey
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log("DEBUG: Backend response:", data)
        
        // Convert backend format to frontend format
        const formattedItems: VaultItem[] = data.entries
          .filter((entry: any) => entry.category !== 'system') // Hide system entries
          .map((entry: any) => ({
            id: entry.id,
            name: entry.name, // Backend now sends decrypted title as name
            username: entry.username, // Backend sends decrypted username
            email: entry.email || '',
            password: entry.password, // Backend sends decrypted password
            website: entry.website, // Backend sends decrypted website
            notes: entry.notes, // Backend sends decrypted notes
            category: entry.category,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            favorite: entry.favorite || false, // Use favorite status from backend
            lastUsed: new Date(entry.updatedAt || entry.createdAt),
            created: new Date(entry.createdAt),
            strength: calculatePasswordStrength(entry.password || ''), // Calculate actual password strength
            // Card-specific fields (would come from decrypted data if present)
            cardNumber: entry.cardNumber || '',
            expiryDate: entry.expiryDate || '',
            cvv: entry.cvv || '',
            cardholderName: entry.cardholderName || '',
            // WiFi-specific fields
            networkName: entry.networkName || entry.name,
            security: entry.security || 'WPA2'
          }))

        setVaultItems(formattedItems)
        setVaultState('unlocked')
        setIsLoading(false)
        console.log("DEBUG: Data loaded successfully", formattedItems.length, "items")
      } else if (response.status === 403) {
        console.log("DEBUG: Vault locked or invalid encryption key")
        setVaultState('locked')
        setIsLoading(false)
      } else {
        console.error('Failed to load vault items:', response.statusText)
        setVaultState('error')
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error loading vault items:', error)
      setVaultState('error')
      setIsLoading(false)
    }
  }

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-lockr-cyan to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="w-8 h-8 animate-spin text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading your vault...</h3>
          <p className="text-gray-600">Please wait while we fetch your secure data.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <ResponsiveDashboard
        user={user}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        vaultItems={vaultItems}
        notificationCount={unreadCount}
        securityStats={{
          total: vaultItems.length,
          weak: vaultItems.filter(item => item.strength === 'weak').length,
          reused: 0,
          breached: 0
        }}
        onAddItem={handleAddItem}
        onImport={handleImportVault}
        onExport={handleExportVault}
        onLock={handleManualLock}
        onLogout={handleLogout}
      >
        {/* Vault Content */}
        <div className="space-y-6">
          {vaultState === 'loading' ? (
            // Loading state
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-lockr-cyan to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-8 h-8 animate-spin text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading your vault...</h3>
              <p className="text-gray-600">Please wait while we check your vault status.</p>
            </div>
          ) : vaultState === 'locked' ? (
            // Vault locked - show unlock interface
            <div className="flex items-center justify-center min-h-[400px] md:min-h-[600px]">
              <div className="w-full max-w-md px-4">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">Vault Locked</h3>
                  <p className="text-gray-600">Enter your master password to unlock your vault</p>
                </div>

                {/* Master password form */}
                <form onSubmit={handleVaultUnlock} className="space-y-4">
                  <div>
                    <label htmlFor="masterPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Master Password
                    </label>
                    <div className="relative">
                      <input
                        id="masterPassword"
                        type={showMasterPassword ? 'text' : 'password'}
                        value={masterPassword}
                        onChange={(e) => setMasterPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your master password"
                        disabled={isUnlocking}
                      />
                      <button
                        type="button"
                        onClick={() => setShowMasterPassword(!showMasterPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {unlockError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{unlockError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUnlocking || !masterPassword.trim()}
                    className="w-full py-3 px-4 bg-gradient-to-r from-lockr-navy to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isUnlocking ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Unlocking...
                      </>
                    ) : (
                      'Unlock Vault'
                    )}
                  </button>
                </form>

                {unlockAttempts > 0 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-500">
                      Failed attempts: {unlockAttempts}/5
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : vaultState === 'unlocked' ? (
            // Vault unlocked - show items
            <div className="space-y-6">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {['all', 'login', 'card', 'note', 'wifi'].map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      selectedCategory === category
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-300'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                    {category === 'all' && ` (${vaultItems.length})`}
                    {category === 'login' && ` (${vaultItems.filter(item => item.category === 'login').length})`}
                    {category === 'card' && ` (${vaultItems.filter(item => item.category === 'card').length})`}
                    {category === 'note' && ` (${vaultItems.filter(item => item.category === 'note').length})`}
                    {category === 'wifi' && ` (${vaultItems.filter(item => item.category === 'wifi').length})`}
                  </button>
                ))}
              </div>

              {/* Vault Items */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Key className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchQuery ? 'Try adjusting your search terms.' : 'Start building your secure vault by adding your first item.'}
                  </p>
                  <button
                    onClick={handleAddItem}
                    className="px-6 py-3 bg-gradient-to-r from-lockr-navy to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                  >
                    Add Your First Item
                  </button>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 
                  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 
                  'space-y-3'
                }>
                  {filteredItems.map((item) => {
                    const itemStyles = getCategoryColors(item.category)
                    
                    if (viewMode === 'grid') {
                      return (
                        <div
                          key={item.id}
                          className={`${itemStyles.bg} ${itemStyles.border} border rounded-2xl p-4 md:p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer group`}
                          onClick={() => handleViewDetails(item)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className={`p-2 md:p-3 ${itemStyles.accent} rounded-xl`}>
                              {getCategoryIcon(item.category)}
                            </div>
                            <div className="flex items-center space-x-1">
                              {item.favorite && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                              <div className="relative dropdown-container">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenDropdown(openDropdown === item.id ? null : item.id)
                                  }}
                                  className="p-1 hover:bg-white/50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <MoreVertical className="w-4 h-4 text-gray-500" />
                                </button>
                                {openDropdown === item.id && (
                                  <div className="absolute right-0 top-8 z-10 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[140px]">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditItem(item)
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyToClipboard(item.username, 'username')
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                    >
                                      <User className="w-4 h-4 mr-2" />
                                      Copy Username
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyToClipboard(item.password, 'password')
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                    >
                                      <Key className="w-4 h-4 mr-2" />
                                      Copy Password
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteItem(item.id)
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-semibold text-gray-900 truncate text-sm md:text-base">{item.name}</h3>
                            <p className="text-xs md:text-sm text-gray-600 truncate">{item.username || item.email}</p>
                            {item.website && (
                              <p className="text-xs text-gray-500 truncate">{item.website}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-4">
                            {userSettings.showPasswordStrength && (item.category === 'login' || item.category === 'wifi') && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStrengthColor(item.strength)}`}>
                                {item.strength}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {item.lastUsed ? `Used ${new Date(item.lastUsed).toLocaleDateString()}` : 'Never used'}
                            </span>
                          </div>
                        </div>
                      )
                    } else {
                      // List view
                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 hover:shadow-lg transition-all duration-200 hover:border-blue-300 cursor-pointer group"
                          onClick={() => handleViewDetails(item)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
                              <div className={`p-2 ${itemStyles.accent} rounded-lg flex-shrink-0`}>
                                {getCategoryIcon(item.category)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-medium text-gray-900 truncate text-sm md:text-base">{item.name}</h3>
                                  {item.favorite && <Star className="w-3 h-3 md:w-4 md:h-4 text-yellow-500 fill-current flex-shrink-0" />}
                                </div>
                                <p className="text-xs md:text-sm text-gray-600 truncate">{item.username || item.email}</p>
                                {item.website && (
                                  <p className="text-xs text-gray-500 truncate">{item.website}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                              {userSettings.showPasswordStrength && (item.category === 'login' || item.category === 'wifi') && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStrengthColor(item.strength)} hidden sm:inline-block`}>
                                  {item.strength}
                                </span>
                              )}
                              
                              <div className="flex items-center space-x-1 md:space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyToClipboard(item.username, 'username')
                                  }}
                                  className="p-1 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                  title="Copy username"
                                >
                                  <User className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyToClipboard(item.password, 'password')
                                  }}
                                  className="p-1 md:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200"
                                  title="Copy password"
                                >
                                  <Key className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                                
                                <div className="relative dropdown-container">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenDropdown(openDropdown === item.id ? null : item.id)
                                    }}
                                    className="p-1 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all duration-200"
                                  >
                                    <MoreVertical className="w-3 h-3 md:w-4 md:h-4" />
                                  </button>
                                  {openDropdown === item.id && (
                                    <div className="absolute right-0 top-8 z-10 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[140px]">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleEditItem(item)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                      >
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteItem(item.id)
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              )}
            </div>
          ) : (
            // Error state
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-gray-600">Please try refreshing the page or contact support if the problem persists.</p>
            </div>
          )}
        </div>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </ResponsiveDashboard>

      {/* Modals and toasts */}
      {isModalOpen && (
        <ItemModal
          isOpen={isModalOpen}
          mode={modalMode}
          item={editingItem}
          onSave={handleSaveItem}
          onClose={() => {
            setIsModalOpen(false)
            setEditingItem(null)
          }}
          autoSave={userSettings.autoSave}
          showPasswordStrength={userSettings.showPasswordStrength}
        />
      )}
      
      {/* Toast Notification */}
      {toastMessage && (
        <NotificationToast
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </>
  )
} 