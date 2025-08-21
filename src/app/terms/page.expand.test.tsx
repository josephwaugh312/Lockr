/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from './page'

describe('Terms page (expanded)', () => {
  it('renders main headings and sections', () => {
    render(<Page />)
    expect(screen.getByRole('heading', { name: /Terms of Service/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Acceptance of Terms/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Service Description/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Privacy and Security/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Governing Law/i })).toBeInTheDocument()
  })

  it('has contact mailto link', () => {
    render(<Page />)
    const link = screen.getByRole('link', { name: /support@lockrr.app/i }) as HTMLAnchorElement
    expect(link).toBeInTheDocument()
    expect(link.href).toMatch(/^mailto:support@lockrr\.app/i)
  })

  it('mobile menu opens', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const toggle = screen.getByLabelText(/Toggle mobile menu/i)
    await user.click(toggle)
    expect(screen.getAllByRole('link', { name: /Home/i })[0]).toBeInTheDocument()
  })

  it('asserts key bullet points are rendered', () => {
    render(<Page />)
    expect(screen.getByText(/Secure password storage/i)).toBeInTheDocument()
    expect(screen.getByText(/WiFi network password management/i)).toBeInTheDocument()
    expect(screen.getByText(/We cannot access your master password/i)).toBeInTheDocument()
    expect(screen.getByText(/Uninterrupted access to the Service/i)).toBeInTheDocument()
  })
})


