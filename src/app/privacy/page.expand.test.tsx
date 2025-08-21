/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from './page'

describe('Privacy page (expanded)', () => {
  it('renders headings and key sections', () => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: /Privacy Policy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Information We Collect/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /How We Use Your Information/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Data Security/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Your Rights/i })).toBeInTheDocument()
  })

  it('has a working mailto link for privacy contact', () => {
    render(<Page />)
    const link = screen.getByRole('link', { name: /privacy@lockrr.app/i }) as HTMLAnchorElement
    expect(link).toBeInTheDocument()
    expect(link.href).toMatch(/^mailto:privacy@lockrr\.app/i)
  })

  it('mobile menu opens and nav links are present', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const toggle = screen.getByLabelText(/Toggle mobile menu/i)
    await user.click(toggle)
    expect(screen.getAllByRole('link', { name: /Home/i })[0]).toBeInTheDocument()
  })

  it('renders lists with expected items', () => {
    render(<Page />)
    // Information We Collect list
    expect(screen.getByText(/Email address/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Encrypted vault data/i).length).toBeGreaterThan(0)
    // How We Use Your Information list
    expect(screen.getByText(/To provide password management services/i)).toBeInTheDocument()
    expect(screen.getByText(/To send important security notifications/i)).toBeInTheDocument()
    // Data Security sub-lists
    expect(screen.getByText(/End-to-end encryption/i)).toBeInTheDocument()
    expect(screen.getByText(/Regular security audits/i)).toBeInTheDocument()
  })
})


