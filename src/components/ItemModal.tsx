'use client'

import { useState, useEffect } from 'react'
import { 
  X, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Copy, 
  Check,
  Globe,
  CreditCard,
  FileText,
  Wifi,
  Lock,
  User,
  Mail,
  Calendar,
  Shield,
  Zap
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
  // Card-specific fields
  cardNumber?: string
  expiryDate?: string
  cvv?: string
  cardholderName?: string
  // WiFi-specific fields
  networkName?: string
  security?: string
}

interface ItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (item: Partial<VaultItem>) => void
  item?: VaultItem | null
  mode: 'add' | 'edit'
  autoSave?: boolean
  showPasswordStrength?: boolean
}

export default function ItemModal({ isOpen, onClose, onSave, item, mode, autoSave = false, showPasswordStrength = true }: ItemModalProps) {
  const [formData, setFormData] = useState<Partial<VaultItem>>({
    name: '',
    username: '',
    email: '',
    password: '',
    website: '',
    category: 'login',
    favorite: false,
    notes: '',
    // Card fields
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    // WiFi fields
    networkName: '',
    security: 'WPA2'
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showCvv, setShowCvv] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'good' | 'strong'>('weak')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Password generation options
  const [genOptions, setGenOptions] = useState({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: true
  })

  // Auto-save state
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const [autoSaveError, setAutoSaveError] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && item) {
        setFormData({
          ...item,
          expiryDate: item.expiryDate || '',
          cvv: item.cvv || '',
          cardNumber: item.cardNumber || '',
          cardholderName: item.cardholderName || '',
          networkName: item.networkName || '',
          security: item.security || 'WPA2'
        })
        setPasswordStrength(item.strength)
      } else {
        setFormData({
          name: '',
          username: '',
          email: '',
          password: '',
          website: '',
          category: 'login',
          favorite: false,
          notes: '',
          cardNumber: '',
          expiryDate: '',
          cvv: '',
          cardholderName: '',
          networkName: '',
          security: 'WPA2'
        })
        setPasswordStrength('weak')
      }
      setErrors({})
      setShowPassword(false)
      setShowCvv(false)
    }
  }, [isOpen, mode, item])

  useEffect(() => {
    if (formData.password) {
      calculatePasswordStrength(formData.password)
    }
  }, [formData.password])

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !item) {
      return
    }

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }

    const timer = setTimeout(() => {
      handleAutoSave()
    }, 2000)

    setAutoSaveTimer(timer)

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [formData, autoSave, item])

  const calculatePasswordStrength = (password: string) => {
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) setPasswordStrength('weak')
    else if (score <= 3) setPasswordStrength('fair')
    else if (score <= 4) setPasswordStrength('good')
    else setPasswordStrength('strong')
  }

  const generatePassword = () => {
    setIsGenerating(true)
    
    setTimeout(() => {
      const { length, uppercase, lowercase, numbers, symbols, excludeSimilar } = genOptions
      
      let charset = ''
      if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz'
      if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      if (numbers) charset += '0123456789'
      if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'
      
      if (excludeSimilar) {
        charset = charset.replace(/[il1Lo0O]/g, '')
      }
      
      let password = ''
      for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length))
      }
      
      setFormData(prev => ({ ...prev, password }))
      setIsGenerating(false)
    }, 500)
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (formData.category === 'login') {
      if (!formData.username?.trim()) {
        newErrors.username = 'Username is required for login items'
      }
      if (!formData.password?.trim()) {
        newErrors.password = 'Password is required for login items'
      }
    }
    
    if (formData.category === 'card') {
      if (!formData.cardNumber?.trim()) {
        newErrors.cardNumber = 'Card number is required'
      }
      if (!formData.cardholderName?.trim()) {
        newErrors.cardholderName = 'Cardholder name is required'
      }
      if (!formData.expiryDate?.trim()) {
        newErrors.expiryDate = 'Expiry date is required'
      }
      if (!formData.cvv?.trim()) {
        newErrors.cvv = 'CVV is required'
      }
    }
    
    if (formData.category === 'wifi') {
      if (!formData.networkName?.trim()) {
        newErrors.networkName = 'Network name is required'
      }
      if (!formData.password?.trim()) {
        newErrors.password = 'Password is required for WiFi items'
      }
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    const itemData: Partial<VaultItem> = {
      ...formData,
      strength: passwordStrength,
      lastUsed: new Date(),
      created: mode === 'add' ? new Date() : item?.created || new Date()
    }
    
    onSave(itemData)
    onClose()
  }

  const handleAutoSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsAutoSaving(true)

    const itemData: Partial<VaultItem> = {
      ...formData,
      strength: passwordStrength,
      lastUsed: new Date(),
      created: item?.created || new Date()
    }

    try {
      await onSave(itemData)
      setLastAutoSave(new Date())
      setAutoSaveError(false)
    } catch (error) {
      console.error('Auto-save failed:', error)
      
      if (error instanceof Error && error.message.includes('Vault session expired')) {
        setAutoSaveError(true)
      } else {
        setAutoSaveError(true)
      }
    } finally {
      setIsAutoSaving(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'login': return <Globe className="w-5 h-5" />
      case 'card': return <CreditCard className="w-5 h-5" />
      case 'note': return <FileText className="w-5 h-5" />
      case 'wifi': return <Wifi className="w-5 h-5" />
      default: return <Lock className="w-5 h-5" />
    }
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' }
      case 'fair': return { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' }
      case 'good': return { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' }
      case 'strong': return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' }
      default: return { bg: 'bg-gray-100', text: 'text-gray-700', bar: 'bg-gray-500' }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-lockr-navy to-blue-700 text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              {getCategoryIcon(formData.category || 'login')}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {mode === 'add' ? 'Add New Item' : 'Edit Item'}
              </h2>
              <p className="text-blue-100 text-sm">
                {mode === 'add' ? 'Create a new vault item' : 'Update vault item details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'login', label: 'Login', icon: Globe, color: 'blue' },
                  { key: 'card', label: 'Card', icon: CreditCard, color: 'emerald' },
                  { key: 'note', label: 'Note', icon: FileText, color: 'amber' },
                  { key: 'wifi', label: 'WiFi', icon: Wifi, color: 'purple' }
                ].map(({ key, label, icon: Icon, color }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: key as any }))}
                    className={`p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center space-y-1 ${
                      formData.category === key
                        ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="e.g., GitHub, Netflix, Work Email"
                  />
                  {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, favorite: !prev.favorite }))}
                      className="flex items-center space-x-2 hover:text-yellow-600 transition-colors"
                    >
                      <span>Add to Favorites</span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        formData.favorite 
                          ? 'bg-yellow-500 border-yellow-500 text-white' 
                          : 'border-gray-300 hover:border-yellow-400'
                      }`}>
                        {formData.favorite && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  </label>
                </div>
              </div>
            </div>

            {/* Category-specific fields */}
            {formData.category === 'login' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Login Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        value={formData.username || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.username ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Enter username"
                      />
                    </div>
                    {errors.username && <p className="text-sm text-red-600">{errors.username}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Enter email address"
                      />
                    </div>
                    {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={formData.website || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., github.com, netflix.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.category === 'card' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Card Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Cardholder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cardholderName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, cardholderName: e.target.value }))}
                      className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.cardholderName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="John Doe"
                    />
                    {errors.cardholderName && <p className="text-sm text-red-600">{errors.cardholderName}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Card Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.cardNumber || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value }))}
                      className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.cardNumber ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="1234 5678 9012 3456"
                    />
                    {errors.cardNumber && <p className="text-sm text-red-600">{errors.cardNumber}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Expiry Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.expiryDate || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.expiryDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="MM/YY"
                    />
                    {errors.expiryDate && <p className="text-sm text-red-600">{errors.expiryDate}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      CVV <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showCvv ? 'text' : 'password'}
                        value={formData.cvv || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, cvv: e.target.value }))}
                        className={`w-full pr-10 px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.cvv ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="123"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCvv(!showCvv)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.cvv && <p className="text-sm text-red-600">{errors.cvv}</p>}
                  </div>
                </div>
              </div>
            )}

            {formData.category === 'wifi' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  WiFi Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Network Name (SSID) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.networkName || formData.username || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, networkName: e.target.value, username: e.target.value }))}
                      className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.networkName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="MyHomeNetwork"
                    />
                    {errors.networkName && <p className="text-sm text-red-600">{errors.networkName}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Security Type</label>
                    <select
                      value={formData.security || 'WPA2'}
                      onChange={(e) => setFormData(prev => ({ ...prev, security: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="WPA2">WPA2</option>
                      <option value="WPA3">WPA3</option>
                      <option value="WEP">WEP</option>
                      <option value="Open">Open</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Password Section (for login and wifi) */}
            {(formData.category === 'login' || formData.category === 'wifi') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Password <span className="text-red-500">*</span>
                  </h3>
                  <button
                    type="button"
                    onClick={generatePassword}
                    disabled={isGenerating}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>Generate</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={`w-full pl-10 pr-20 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Enter or generate a password"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex space-x-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {formData.password && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formData.password!, 'password')}
                          className="text-gray-400 hover:text-green-600 p-1 transition-colors"
                        >
                          {copied === 'password' ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}

                  {/* Password Strength Indicator */}
                  {showPasswordStrength && formData.password && (formData.category === 'login' || formData.category === 'wifi') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Password Strength</span>
                        <span className={`font-medium ${getStrengthColor(passwordStrength).text}`}>
                          {passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(passwordStrength).bar}`}
                          style={{
                            width: passwordStrength === 'weak' ? '25%' : 
                                   passwordStrength === 'fair' ? '50%' : 
                                   passwordStrength === 'good' ? '75%' : '100%'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Password Generator Options */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Password Generator Options</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-600">Length: {genOptions.length}</label>
                      <input
                        type="range"
                        min="8"
                        max="50"
                        value={genOptions.length}
                        onChange={(e) => setGenOptions(prev => ({ ...prev, length: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'uppercase', label: 'A-Z' },
                        { key: 'lowercase', label: 'a-z' },
                        { key: 'numbers', label: '0-9' },
                        { key: 'symbols', label: '!@#$' }
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center space-x-2 text-xs">
                          <input
                            type="checkbox"
                            checked={genOptions[key as keyof typeof genOptions] as boolean}
                            onChange={(e) => setGenOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="rounded border-gray-300"
                          />
                          <span className="text-gray-600">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Add any additional notes or information..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              {/* Auto-save indicator */}
              <div className="flex items-center space-x-2">
                {autoSave && (
                  <div className="flex items-center space-x-2 text-sm bg-gray-50 px-3 py-2 rounded-lg border">
                    {isAutoSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-blue-600 font-medium">Auto-saving...</span>
                      </>
                    ) : autoSaveError ? (
                      <>
                        <X className="w-4 h-4 text-red-600" />
                        <span className="text-red-600 font-medium">Auto-save failed</span>
                      </>
                    ) : lastAutoSave ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-green-600 font-medium">
                          Auto-saved {lastAutoSave.toLocaleTimeString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">Auto-save enabled</span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {autoSave ? 'Close' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-lockr-navy to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium"
                >
                  {mode === 'add' ? 'Add Item' : 
                   autoSave ? 'Save Now' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 