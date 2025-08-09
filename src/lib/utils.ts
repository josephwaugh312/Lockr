import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for merging Tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002/api';

// API endpoints
export const API_ENDPOINTS = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
    changePassword: '/auth/change-password',
    deleteAccount: '/auth/delete-account',
  },
  vault: {
    unlock: '/vault/unlock',
    entries: '/vault/entries',
    search: '/vault/search',
    generatePassword: '/vault/generate-password',
    changeMasterPassword: '/vault/change-master-password',
  },
  health: '/health',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  accessToken: 'lockr_access_token',
  refreshToken: 'lockr_refresh_token',
  theme: 'lockr_theme',
  vaultCache: 'lockr_vault_cache',
} as const;

// Password strength validation
export function calculatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];

  if (password.length >= 12) score += 2;
  else if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Include special characters');

  return { score, feedback };
}

// Format date for display
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// Copy to clipboard utility
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

// Generate secure random string
export function generateSecureId(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  
  return result;
}

// Token refresh state management
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

// Add subscriber for waiting requests during refresh
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

// Notify all waiting requests with new token
function onRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token))
  refreshSubscribers = []
}

// Refresh access token using refresh token
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = localStorage.getItem('lockr_refresh_token')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    // Security: Check if we've refreshed too many times recently
    const lastRefresh = localStorage.getItem('lockr_last_refresh')
    const refreshCount = parseInt(localStorage.getItem('lockr_refresh_count') || '0')
    const now = Date.now()
    
    if (lastRefresh && (now - parseInt(lastRefresh)) < 60000 && refreshCount > 3) {
      console.warn('Too many token refreshes, potential security issue')
      throw new Error('Rate limit exceeded for token refresh')
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    
    // Store new tokens
    localStorage.setItem('lockr_access_token', data.tokens.accessToken)
    localStorage.setItem('lockr_refresh_token', data.tokens.refreshToken)
    
    // Security: Track refresh activity
    localStorage.setItem('lockr_last_refresh', now.toString())
    localStorage.setItem('lockr_refresh_count', (refreshCount + 1).toString())
    
    return data.tokens.accessToken

  } catch (error) {
    console.error('Token refresh error:', error)
    
    // Security: Clear all auth data on refresh failure
    localStorage.removeItem('lockr_access_token')
    localStorage.removeItem('lockr_refresh_token')
    localStorage.removeItem('lockr_user')
    localStorage.removeItem('lockr_last_refresh')
    localStorage.removeItem('lockr_refresh_count')
    
    // SECURITY: Clear vault encryption key to lock vault
    sessionStorage.removeItem('lockr_encryption_key')
    
    // Dispatch session expired event for vault cleanup
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('session-expired'))
    }
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/authentication/signin'
    }
    
    return null
  }
}

// Enhanced fetch with automatic token refresh
export async function apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('lockr_access_token')
  
  // Add authorization header if token exists
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token && { 'Authorization': `Bearer ${token}` })
  }

  // Make the initial request
  let response = await fetch(url, {
    ...options,
    headers
  })

  // If we get a 401 (Unauthorized), try to refresh the token
  if (response.status === 401 && !isRefreshing) {
    isRefreshing = true
    
    try {
      const newToken = await refreshAccessToken()
      
      if (newToken) {
        // Retry the original request with the new token
        const newHeaders = {
          ...headers,
          'Authorization': `Bearer ${newToken}`
        }
        
        response = await fetch(url, {
          ...options,
          headers: newHeaders
        })
        
        // Notify all waiting requests with the new token
        onRefreshed(newToken)
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      // The refreshAccessToken function already handles cleanup and redirect
    } finally {
      isRefreshing = false
    }
  } else if (response.status === 401 && isRefreshing) {
    // If already refreshing, wait for the new token
    return new Promise((resolve) => {
      subscribeTokenRefresh((newToken: string) => {
        // Retry with new token
        const newHeaders = {
          ...headers,
          'Authorization': `Bearer ${newToken}`
        }
        
        fetch(url, {
          ...options,
          headers: newHeaders
        }).then(resolve)
      })
    })
  }

  return response
} 