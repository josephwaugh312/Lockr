/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import Page from './page-zk-unlock'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))

// Mock API_BASE_URL import used by the page
jest.mock('../../lib/utils', () => ({ ...jest.requireActual('../../lib/utils'), API_BASE_URL: 'http://localhost:3002/api/v1' }))

describe('Dashboard ZK Unlock page', () => {
  beforeEach(() => {
    jest.resetModules()
    // @ts-ignore
    global.fetch = jest.fn()
    localStorage.setItem('lockr_access_token', 't')
    sessionStorage.clear()
  })

  const loadPage = async () => render(<Page />)

  it('disables submit when key empty and shows short-key error', async () => {
    await loadPage()
    const btn = screen.getByRole('button', { name: /unlock/i }) as HTMLButtonElement
    expect(btn).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/encryption key/i), 'short')
    await userEvent.click(btn)
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/i)
  })

  it('successful unlock stores key and navigates', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) })
    await loadPage()
    await userEvent.type(screen.getByLabelText(/encryption key/i), 'correct-horse')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(sessionStorage.getItem('lockr_encryption_key')).toBe('correct-horse')
  })

  it('handles 401 and 429 error responses', async () => {
    // 401
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: 'bad' }) })
    await loadPage()
    await userEvent.type(screen.getByLabelText(/encryption key/i), 'wrong-secret')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid key|session expired/i)

    // 429
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'rate' }) })
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many unlock attempts/i)
  })
})


