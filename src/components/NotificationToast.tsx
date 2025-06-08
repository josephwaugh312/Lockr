'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

interface NotificationToastProps {
  message: string | null
  type: 'success' | 'error' | 'info'
  onDismiss: () => void
  autoHide?: boolean
  hideDelay?: number
}

export default function NotificationToast({ 
  message, 
  type, 
  onDismiss, 
  autoHide = true, 
  hideDelay = 3000 
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setIsVisible(true)
      
      if (autoHide) {
        const timer = setTimeout(() => {
          setIsVisible(false)
          setTimeout(onDismiss, 200) // Allow fade out animation
        }, hideDelay)
        
        return () => clearTimeout(timer)
      }
    } else {
      setIsVisible(false)
    }
  }, [message, autoHide, hideDelay, onDismiss])

  if (!message) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />
      default:
        return <Info className="w-5 h-5 text-blue-600" />
    }
  }

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  const getButtonStyle = () => {
    switch (type) {
      case 'success':
        return 'hover:bg-green-100 text-green-600'
      case 'error':
        return 'hover:bg-red-100 text-red-600'
      case 'info':
        return 'hover:bg-blue-100 text-blue-600'
      default:
        return 'hover:bg-blue-100 text-blue-600'
    }
  }

  return (
    <div 
      className={`fixed bottom-4 right-4 z-50 transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center space-x-3 min-w-[280px] max-w-md ${getStyles()}`}>
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onDismiss, 200)
          }}
          className={`flex-shrink-0 p-1 rounded-lg transition-colors ${getButtonStyle()}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
} 