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
  const [unlockAttempts, setUnlockAttempts] = useState(0)
  const [masterPassword, setMasterPassword] = useState('')
  const [showMasterPassword, setShowMasterPassword] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [isUnlocking, setIsUnlocking] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    // Mobile detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    // Load user data from localStorage
    const userData = localStorage.getItem('lockr_user')
    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (error) {
        console.error('Error parsing user data:', error)
        // If user data is corrupted, redirect to login
        router.push('/authentication/signin')
      }
    } else {
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
        router.push('/authentication/signin')
        return
      }

      // Try to fetch vault entries to check if vault is unlocked
      const response = await apiRequest(`${API_BASE_URL}/vault/entries`)

      if (response.status === 403) {
        // Vault is locked
        setVaultState('locked')
      } else if (response.ok) {
        // Vault is unlocked, load data
        const data = await response.json()
        
        // Convert backend data to frontend format with proper date objects
        const convertedEntries = (data.entries || []).map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          username: entry.username || '',
          email: '', // Backend doesn't store email separately
          password: '', // Will be decrypted when needed
          website: entry.url || '',
          category: entry.category as 'login' | 'card' | 'note' | 'wifi',
          favorite: false, // Backend doesn't store favorites yet
          lastUsed: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
          created: entry.createdAt ? new Date(entry.createdAt) : new Date(),
          strength: 'good' as 'weak' | 'fair' | 'good' | 'strong', // Default
          notes: '', // Will be decrypted when needed
          // Card-specific fields (not from backend yet)
          cardNumber: '',
          expiryDate: '',
          cvv: '',
          cardholderName: '',
          // WiFi-specific fields (not from backend yet)
          networkName: entry.name, // Use name as network name for wifi items
          security: 'WPA2'
        }))
        
        setVaultItems(convertedEntries)
        setVaultState('unlocked')
      } else if (response.status === 401) {
        // Token expired or invalid
        router.push('/authentication/signin')
      } else {
        console.error('Failed to check vault status:', response.statusText)
        setVaultState('error')
      }
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
        
        // Reload vault data
        await checkVaultStatus()
      } else {
        const data = await response.json()
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

        const response = await apiRequest(`${API_BASE_URL}/vault/entries/${id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          setVaultItems(prev => prev.filter(item => item.id !== id))
          setToastMessage('Item deleted successfully!')
          setToastType('success')
        } else {
          const errorData = await response.json()
          setToastMessage(errorData.error || 'Failed to delete item')
          setToastType('error')
        }
      } catch (error) {
        console.error('Delete item error:', error)
        setToastMessage('Failed to delete item. Please try again.')
        setToastType('error')
      }
    }
    setOpenDropdown(null)
  }

  const handleToggleFavorite = (id: string) => {
    setVaultItems(prev => prev.map(item => 
      item.id === id ? { ...item, favorite: !item.favorite } : item
    ))
    // Would send update request to API
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
        // Create new item
        const createData: any = {
          title: itemData.name,
          category: itemData.category || 'login'
        }

        // Only add non-empty values
        if (itemData.username && itemData.username.trim()) {
          createData.username = itemData.username.trim()
        }
        if (itemData.password && itemData.password.trim()) {
          createData.password = itemData.password.trim()
        }
        if (itemData.website && itemData.website.trim()) {
          createData.website = normalizeUrl(itemData.website.trim())
        }
        if (itemData.notes && itemData.notes.trim()) {
          createData.notes = itemData.notes.trim()
        }

        console.log('Sending create data:', createData)

        const response = await apiRequest(`${API_BASE_URL}/vault/entries`, {
          method: 'POST',
          body: JSON.stringify(createData)
        })

        if (response.ok) {
          const data = await response.json()
          
          // Convert backend format to frontend format
          const newItem: VaultItem = {
            id: data.entry.id,
            name: data.entry.name,
            username: data.entry.username || '',
            email: itemData.email || '',
            password: itemData.password || '',
            website: data.entry.url || '',
            category: data.entry.category as 'login' | 'card' | 'note' | 'wifi',
            favorite: false, // Default to false for new items
            lastUsed: new Date(),
            created: new Date(data.entry.createdAt),
            strength: (itemData.category === 'login' || itemData.category === 'wifi') 
              ? (itemData as VaultItem).strength 
              : 'good',
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
        const updateData: any = {
          title: itemData.name,
          category: itemData.category || 'login'
        }

        // Only add non-empty values
        if (itemData.username !== undefined) {
          updateData.username = itemData.username?.trim() || null
        }
        if (itemData.password !== undefined) {
          updateData.password = itemData.password?.trim() || null
        }
        if (itemData.website !== undefined) {
          updateData.url = normalizeUrl(itemData.website?.trim() || '')
        }
        if (itemData.notes !== undefined) {
          updateData.notes = itemData.notes?.trim() || null
        }

        console.log('Sending update data:', updateData)

        const response = await apiRequest(`${API_BASE_URL}/vault/entries/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        })

        if (response.ok) {
          const data = await response.json()
          
          // Update local state with the updated item
          setVaultItems(prev => prev.map(item => 
            item.id === editingItem.id 
              ? { 
                  ...item, 
                  name: data.entry.name,
                  username: data.entry.username || '',
                  password: itemData.password || item.password,
                  website: data.entry.url || '',
                  category: data.entry.category as 'login' | 'card' | 'note' | 'wifi',
                  notes: itemData.notes || '',
                  lastUsed: new Date(),
                  // Update other fields from itemData
                  email: itemData.email || item.email,
                  cardNumber: itemData.cardNumber || item.cardNumber,
                  expiryDate: itemData.expiryDate || item.expiryDate,
                  cvv: itemData.cvv || item.cvv,
                  cardholderName: itemData.cardholderName || item.cardholderName,
                  networkName: itemData.networkName || item.networkName,
                  security: itemData.security || item.security,
                  strength: (itemData.category === 'login' || itemData.category === 'wifi') 
                    ? (itemData as VaultItem).strength 
                    : item.strength
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
      
      // Redirect to home page
      router.push('/')
      
    } catch (error) {
      // Even if the API call fails, still clear local storage and redirect
      console.error('Logout error:', error)
      localStorage.removeItem('lockr_access_token')
      localStorage.removeItem('lockr_refresh_token')
      localStorage.removeItem('lockr_user')
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
      setVaultState('locked')
      setVaultItems([])
      setShowPasswordIds(new Set())
      setMasterPassword('')
      setUnlockError('')
      setUnlockAttempts(0)
      setSelectedItems(new Set())
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
        {/* Sidebar */}
        <div className="w-64 bg-white/80 backdrop-blur-sm shadow-lg border-r border-gray-200/50 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-lockr-navy to-blue-800">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Lockr</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                selectedCategory === 'all' ? 'bg-gradient-to-r from-lockr-cyan to-blue-500 text-white shadow-lg' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="font-medium">All Items</span>
              <span className={`ml-auto text-sm px-2 py-0.5 rounded-full ${
                selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
              }`}>{vaultItems.length}</span>
            </button>

            <button
              onClick={() => setSelectedCategory('favorites')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                selectedCategory === 'favorites' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg' : 'text-gray-700 hover:bg-yellow-50 hover:text-yellow-700'
              }`}
            >
              <Star className="w-4 h-4" />
              <span className="font-medium">Favorites</span>
              <span className={`ml-auto text-sm px-2 py-0.5 rounded-full ${
                selectedCategory === 'favorites' ? 'bg-white/20 text-white' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {vaultItems.filter(item => item.favorite).length}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategory('recent')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                selectedCategory === 'recent' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-medium">Recently Used</span>
            </button>

            {/* Notifications navigation item */}
            <Link
              href="/dashboard/notifications"
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-gray-700 hover:bg-orange-50 hover:text-orange-700"
            >
              <Bell className="w-4 h-4" />
              <span className="font-medium">Notifications</span>
              {unreadCount > 0 && (<span className="ml-auto text-sm px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{unreadCount}</span>)}
            </Link>

            <div className="border-t border-gray-200 my-4"></div>

            <div className="space-y-1">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Categories</p>
              
              {[
                { key: 'login', label: 'Logins', icon: Globe, gradient: 'from-blue-500 to-cyan-500', hover: 'hover:bg-blue-50 hover:text-blue-700', count: 'bg-blue-100 text-blue-700' },
                { key: 'card', label: 'Payment Cards', icon: CreditCard, gradient: 'from-emerald-500 to-teal-500', hover: 'hover:bg-emerald-50 hover:text-emerald-700', count: 'bg-emerald-100 text-emerald-700' },
                { key: 'note', label: 'Secure Notes', icon: FileText, gradient: 'from-amber-500 to-orange-500', hover: 'hover:bg-amber-50 hover:text-amber-700', count: 'bg-amber-100 text-amber-700' },
                { key: 'wifi', label: 'WiFi Passwords', icon: Wifi, gradient: 'from-purple-500 to-indigo-500', hover: 'hover:bg-purple-50 hover:text-purple-700', count: 'bg-purple-100 text-purple-700' }
              ].map(({ key, label, icon: Icon, gradient, hover, count }) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                    selectedCategory === key ? `bg-gradient-to-r ${gradient} text-white shadow-lg` : `text-gray-700 ${hover}`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{label}</span>
                  <span className={`ml-auto text-sm px-2 py-0.5 rounded-full ${
                    selectedCategory === key ? 'bg-white/20 text-white' : count
                  }`}>
                    {vaultItems.filter(item => item.category === key).length}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          {/* Security Overview */}
          <div className="p-4 border-t border-gray-200/50">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Security Health
              </h3>
              <div className="space-y-3 text-sm">
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
          <div className="p-4 border-t border-gray-200/50 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
                <p className="text-xs text-gray-600 truncate">{user?.email}</p>
              </div>
              <div className="flex space-x-1">
                <Link 
                  href="/settings"
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all duration-200"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <button className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search vault..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 backdrop-blur-sm"
                  />
                </div>

                {/* View Toggle */}
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
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
                <div className="mr-8"><NotificationBell /></div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={handleImportVault}
                  className="flex items-center space-x-2 px-4 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all duration-200"
                >
                  <Upload className="w-4 h-4" />
                  <span className="font-medium">Import</span>
                </button>
                <button 
                  onClick={handleExportVault}
                  className="flex items-center space-x-2 px-4 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all duration-200"
                >
                  <Download className="w-4 h-4" />
                  <span className="font-medium">Export</span>
                </button>
                <button 
                  onClick={handleManualLock}
                  className="flex items-center space-x-2 px-4 py-2.5 text-gray-700 border border-gray-300 rounded-xl hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300 transition-all duration-200"
                  title="Lock vault manually"
                >
                  <Lock className="w-4 h-4" />
                  <span className="font-medium">Lock</span>
                </button>
                <button 
                  onClick={handleAddItem}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-lockr-navy to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">Add Item</span>
                </button>
                
                {/* Hidden file input for import */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6">
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
              <div className="flex items-center justify-center min-h-[600px]">
                <div className="w-full max-w-md">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Vault Locked</h3>
                    <p className="text-gray-600">Enter your master password to unlock your vault</p>
                    {unlockAttempts > 0 && (
                      <p className="text-sm text-orange-600 mt-2">
                        {unlockAttempts} failed attempt{unlockAttempts > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleVaultUnlock} className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200/50 p-6 shadow-lg">
                    {unlockError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span className="text-red-700 text-sm">{unlockError}</span>
                      </div>
                    )}

                    <div className="mb-6">
                      <label htmlFor="masterPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Master Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type={showMasterPassword ? 'text' : 'password'}
                          id="masterPassword"
                          value={masterPassword}
                          onChange={(e) => setMasterPassword(e.target.value)}
                          className="w-full pl-10 pr-12 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="Enter your master password"
                          autoComplete="current-password"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowMasterPassword(!showMasterPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {showMasterPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isUnlocking || !masterPassword}
                      className="w-full bg-gradient-to-r from-lockr-navy to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      {isUnlocking ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Unlocking...</span>
                        </>
                      ) : (
                        <span>Unlock Vault</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : vaultState === 'error' ? (
              // Error state
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to load vault</h3>
                <p className="text-gray-600 mb-4">There was an error checking your vault status.</p>
                <button
                  onClick={checkVaultStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : vaultItems.length === 0 ? (
              // Empty vault state
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Your vault is empty</h3>
                <p className="text-gray-600 mb-6">Start securing your digital life by adding your first item.</p>
                <button
                  onClick={handleAddItem}
                  className="px-6 py-3 bg-gradient-to-r from-lockr-navy to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold"
                >
                  Add Your First Item
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              // No search results
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No items found</h3>
                <p className="text-gray-600">Try adjusting your search or category filter.</p>
              </div>
            ) : (
              // Vault items
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
                {filteredItems.map((item) => {
                  const categoryColors = getCategoryColors(item.category)
                  return (
                    <div
                      key={item.id}
                      className={`bg-white/70 backdrop-blur-sm rounded-xl border ${categoryColors.border} hover:shadow-lg transition-all duration-200 ${
                        viewMode === 'list' ? 'p-4' : 'p-4'
                      } hover:scale-[1.02] relative`}
                    >
                      <div className={`flex items-start justify-between ${viewMode === 'grid' ? 'flex-col space-y-3' : ''}`}>
                        <div className={`flex items-start space-x-3 ${viewMode === 'grid' ? 'w-full' : 'flex-1'}`}>
                          <div className={`flex-shrink-0 p-2.5 ${categoryColors.bg} ${categoryColors.icon} rounded-xl border ${categoryColors.border}`}>
                            {getCategoryIcon(item.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id) }}
                                className="flex-shrink-0"
                              >
                                <Star className={`w-4 h-4 transition-colors ${
                                  item.favorite 
                                    ? 'text-yellow-500 fill-current hover:text-yellow-600' 
                                    : 'text-gray-300 hover:text-yellow-400'
                                }`} />
                              </button>
                            </div>
                            
                            {/* Only show password strength for login and wifi items */}
                            {(item.category === 'login' || item.category === 'wifi') && userSettings.showPasswordStrength && (
                              <div className="mb-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${getStrengthColor(item.strength)}`}>
                                  {item.strength}
                                </span>
                              </div>
                            )}
                            
                            <div className="mt-2 space-y-2 text-sm text-gray-600">
                              {/* Login and WiFi fields */}
                              {(item.category === 'login' || item.category === 'wifi') && item.username && (
                                <div className="flex items-center space-x-2 bg-gray-50 rounded-lg px-2 py-1">
                                  <span className="truncate flex-1">{item.username}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(item.username, 'Username') }}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-all duration-200"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* Card-specific fields */}
                              {item.category === 'card' && (
                                <>
                                  {item.cardholderName && (
                                    <div className="flex items-center space-x-2 bg-emerald-50 rounded-lg px-2 py-1">
                                      <span className="text-xs text-emerald-600 font-medium">Cardholder:</span>
                                      <span className="truncate flex-1">{item.cardholderName}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); copyToClipboard(item.cardholderName!, 'Cardholder name') }}
                                        className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-all duration-200"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                  
                                  {item.cardNumber && (
                                    <div className="flex items-center space-x-2 bg-emerald-50 rounded-lg px-2 py-1">
                                      <span className="text-xs text-emerald-600 font-medium">Card Number:</span>
                                      <span className="truncate flex-1">
                                        {showPasswordIds.has(item.id) ? item.cardNumber : '•••• •••• •••• ' + item.cardNumber.slice(-4)}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(item.id) }}
                                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all duration-200"
                                      >
                                        {showPasswordIds.has(item.id) ? 
                                          <EyeOff className="w-3 h-3" /> : 
                                          <Eye className="w-3 h-3" />
                                        }
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); copyToClipboard(item.cardNumber!, 'Card number') }}
                                        className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-all duration-200"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-2">
                                    {item.expiryDate && (
                                      <div className="flex items-center space-x-2 bg-emerald-50 rounded-lg px-2 py-1">
                                        <span className="text-xs text-emerald-600 font-medium">Expires:</span>
                                        <span className="truncate flex-1">{item.expiryDate}</span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); copyToClipboard(item.expiryDate!, 'Expiry date') }}
                                          className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-all duration-200"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}

                                    {item.cvv && (
                                      <div className="flex items-center space-x-2 bg-emerald-50 rounded-lg px-2 py-1">
                                        <span className="text-xs text-emerald-600 font-medium">CVV:</span>
                                        <span className="truncate flex-1">
                                          {showPasswordIds.has(item.id + '_cvv') ? item.cvv : '•••'}
                                        </span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(item.id + '_cvv') }}
                                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all duration-200"
                                        >
                                          {showPasswordIds.has(item.id + '_cvv') ? 
                                            <EyeOff className="w-3 h-3" /> : 
                                            <Eye className="w-3 h-3" />
                                          }
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); copyToClipboard(item.cvv!, 'CVV') }}
                                          className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-100 rounded transition-all duration-200"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Note-specific fields */}
                              {item.category === 'note' && item.notes && (
                                <div className="flex items-center space-x-2 bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
                                  <span className="text-xs text-amber-600 font-medium">Notes:</span>
                                  <div className="flex-1 min-w-0">
                                    {showPasswordIds.has(item.id) ? (
                                      <p className="text-sm text-amber-800 whitespace-pre-wrap break-words">{item.notes}</p>
                                    ) : (
                                      <span className="text-sm text-amber-700">••••••••••••••••••••</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(item.id) }}
                                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all duration-200"
                                  >
                                    {showPasswordIds.has(item.id) ? 
                                      <EyeOff className="w-3 h-3" /> : 
                                      <Eye className="w-3 h-3" />
                                    }
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(item.notes!, 'Notes') }}
                                    className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-100 rounded transition-all duration-200"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* WiFi-specific fields */}
                              {item.category === 'wifi' && item.networkName && (
                                <div className="flex items-center space-x-2 bg-purple-50 rounded-lg px-2 py-1">
                                  <span className="text-xs text-purple-600 font-medium">Network:</span>
                                  <span className="truncate flex-1">{item.networkName}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(item.networkName!, 'Network name') }}
                                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-all duration-200"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {item.category === 'wifi' && item.security && (
                                <div className="flex items-center space-x-2 bg-purple-50 rounded-lg px-2 py-1">
                                  <span className="text-xs text-purple-600 font-medium">Security:</span>
                                  <span className="truncate flex-1">{item.security}</span>
                                </div>
                              )}
                              
                              {/* Password field for login and wifi items */}
                              {(item.category === 'login' || item.category === 'wifi') && item.password && (
                                <div className="flex items-center space-x-2 bg-gray-50 rounded-lg px-2 py-1">
                                  <span className="truncate flex-1">
                                    {showPasswordIds.has(item.id) ? item.password : '••••••••••••'}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(item.id) }}
                                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded transition-all duration-200"
                                  >
                                    {showPasswordIds.has(item.id) ? 
                                      <EyeOff className="w-3 h-3" /> : 
                                      <Eye className="w-3 h-3" />
                                    }
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(item.password, 'Password') }}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-100 rounded transition-all duration-200"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              
                              {/* Website field for login items */}
                              {item.category === 'login' && item.website && (
                                <div className="flex items-center space-x-2 bg-blue-50 rounded-lg px-2 py-1">
                                  <span className="truncate text-blue-600 flex-1">{item.website}</span>
                                  <button
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const url = item.website.startsWith('http://') || item.website.startsWith('https://') 
                                        ? item.website 
                                        : `https://${item.website}`
                                      window.open(url, '_blank') 
                                    }}
                                    className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-all duration-200"
                                  >
                                    <Globe className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1">
                              Last used {item.lastUsed.toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className={`flex items-center space-x-1 ${viewMode === 'grid' ? 'w-full justify-end' : 'ml-3'} relative`}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditItem(item) }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id) }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-all duration-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="relative dropdown-container">
                            <button 
                              onClick={(e) => handleMoreOptions(e, item.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openDropdown === item.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                                <button
                                  onClick={() => handleViewDetails(item)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>View Details</span>
                                </button>
                                <button
                                  onClick={() => handleDuplicateItem(item)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <Copy className="w-4 h-4" />
                                  <span>Duplicate</span>
                                </button>
                                <button
                                  onClick={() => handleExportItem(item)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <Download className="w-4 h-4" />
                                  <span>Export Item</span>
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => handleToggleFavorite(item.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                >
                                  <Star className={`w-4 h-4 ${item.favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
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
            )}
          </div>
        </div>
      </div>

      {/* Item Modal */}
      <ItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveItem}
        item={editingItem}
        mode={modalMode}
        autoSave={userSettings.autoSave}
      />

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