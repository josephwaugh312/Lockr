'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '../../lib/utils'

export default function ZkUnlockPage() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (key.trim().length < 8) {
      setError('Encryption key must be at least 8 characters')
      return
    }
    const token = localStorage.getItem('lockr_access_token')
    if (!token) {
      setError('Not authenticated')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/vault/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ encryptionKey: key })
      })
      if (res.ok) {
        sessionStorage.setItem('lockr_encryption_key', key)
        setMessage('Unlocked')
        router.push('/dashboard')
      } else {
        let data: any = {}
        try { data = await res.json() } catch { data = { error: await res.text() } }
        if (res.status === 429) {
          setError('Too many unlock attempts. Please try again later.')
        } else if (res.status === 401) {
          setError('Invalid key or session expired')
        } else {
          setError(data.error || 'Failed to unlock')
        }
      }
    } catch (e: any) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Unlock Vault</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label htmlFor="ek" className="block text-sm">Encryption Key</label>
        <input id="ek" value={key} onChange={e => setKey(e.target.value)} type="password" placeholder="Enter key" className="w-full border p-2 rounded" />
        {error && <div role="alert" className="text-red-700 text-sm">{error}</div>}
        {message && <div role="status" className="text-green-700 text-sm">{message}</div>}
        <button type="submit" disabled={loading || key.trim().length === 0} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}

 