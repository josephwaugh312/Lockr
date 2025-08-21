/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from './page'

describe('Contact page (expanded)', () => {
  it('renders core sections and contact mailto', () => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: /Contact Us/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Send us a message/i })).toBeInTheDocument()
    expect(screen.getByText(/Get in touch with the Lockrr team/i)).toBeInTheDocument()
    const emailLink = screen.getByRole('link', { name: /contact@lockrr.app/i }) as HTMLAnchorElement
    expect(emailLink).toBeInTheDocument()
    expect(emailLink.href).toMatch(/^mailto:contact@lockrr\.app/i)
  })

  it('shows form labels and inputs', () => {
    render(<Page />)
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Message/i })).toBeInTheDocument()
  })

  it('mobile menu opens and includes expected nav links', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const toggle = screen.getByLabelText(/Toggle mobile menu/i)
    await user.click(toggle)
    expect(screen.getAllByRole('link', { name: /Home/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Features/i })[0]).toBeInTheDocument()
  })

  it('toggles mobile menu and allows clicking nav links', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const toggle = screen.getByLabelText(/Toggle mobile menu/i)
    await user.click(toggle)
    await user.click(screen.getAllByRole('link', { name: /Get Started/i })[0])
    // Open again to exercise the toggle path
    await user.click(toggle)
    await user.click(screen.getAllByRole('link', { name: /Sign In/i })[0])
  })
})


