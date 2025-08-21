/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPage from './page'

// Mock Next.js Link to a simple anchor
jest.mock('next/link', () => ({ children, href }: { children: React.ReactNode; href: string }) => (
  <a href={href}>{children}</a>
))

// Mock lucide-react icons to simple spans to avoid SVG complexity
jest.mock('lucide-react', () => ({
  Shield: () => <span data-testid="icon-shield" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eyeoff" />,
  Mail: () => <span data-testid="icon-mail" />,
  Lock: () => <span data-testid="icon-lock" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  Check: () => <span data-testid="icon-check" />,
  X: () => <span data-testid="icon-x" />,
}))

// Silence alert and allow assertions
const originalAlert = global.alert
beforeAll(() => {
  // @ts-expect-error - jsdom alert
  global.alert = jest.fn()
})
afterAll(() => {
  // @ts-expect-error
  global.alert = originalAlert
})

describe('Auth Signup (legacy simple form)', () => {
  beforeEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('renders form fields and submit button', async () => {
    render(<RegisterPage />)
    expect(await screen.findByText(/Create Your Vault/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Master Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Master Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Vault/i })).toBeInTheDocument()
    expect(screen.getByText(/Sign in here/i)).toBeInTheDocument()
  })

  it('validates input and shows errors', async () => {
    render(<RegisterPage />)
    const submit = screen.getByRole('button', { name: /Create Vault/i })
    await userEvent.click(submit)
    expect(await screen.findByText('Email is required')).toBeInTheDocument()

    const email = screen.getByLabelText('Email Address') as HTMLInputElement
    await userEvent.type(email, 'user@example.com')
    await userEvent.click(submit)
    expect(await screen.findByText('Master password is required')).toBeInTheDocument()

    const pwd = screen.getByLabelText('Master Password') as HTMLInputElement
    await userEvent.type(pwd, 'short')
    await userEvent.click(submit)
    expect(await screen.findByText('Master password must be at least 8 characters')).toBeInTheDocument()

    await userEvent.clear(pwd)
    await userEvent.type(pwd, 'password') // weak
    await userEvent.click(submit)
    expect(await screen.findByText('Please create a stronger password')).toBeInTheDocument()

    const confirm = screen.getByLabelText('Confirm Master Password') as HTMLInputElement
    await userEvent.type(confirm, 'different')
    await userEvent.click(submit)
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  })

  it.skip('submits successfully with valid data (uses timers)', async () => {})
})


