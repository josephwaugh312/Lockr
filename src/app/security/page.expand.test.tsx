/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from './page'

describe('Security page (expanded)', () => {
  it('renders key security sections', () => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: /Security/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Zero-Knowledge Architecture/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Encryption Standards/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Security Practices/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Reporting Security Issues/i })).toBeInTheDocument()
  })

  it('mobile nav toggle works', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const toggle = screen.getByLabelText(/Toggle mobile menu/i)
    await user.click(toggle)
    expect(screen.getAllByRole('link', { name: /Get Started/i })[0]).toBeInTheDocument()
  })

  it('renders encryption and practices bullet points', () => {
    render(<Page />)
    expect(screen.getByText(/AES-256 encryption/i)).toBeInTheDocument()
    expect(screen.getByText(/Argon2id for password hashing/i)).toBeInTheDocument()
    expect(screen.getByText(/End-to-end encryption for all communications/i)).toBeInTheDocument()
    expect(screen.getByText(/Open-source code for transparency/i)).toBeInTheDocument()
    expect(screen.getByText(/No telemetry or tracking/i)).toBeInTheDocument()
  })
})


