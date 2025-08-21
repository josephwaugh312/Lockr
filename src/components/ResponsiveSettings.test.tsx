/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResponsiveSettings from './ResponsiveSettings'

// Mock next/link to a simple anchor for testing
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('ResponsiveSettings', () => {
  function setup(overrides: Partial<{
    activeSection: string
    onSave: () => void
  }> = {}) {
    const setActiveSection = jest.fn()
    const usedOnSave = overrides.onSave ?? jest.fn()
    const utils = render(
      <ResponsiveSettings
        activeSection={overrides.activeSection ?? 'account'}
        setActiveSection={setActiveSection}
        saving={false}
        onSave={usedOnSave}
      >
        <div>Content</div>
      </ResponsiveSettings>
    )
    return { setActiveSection, onSave: usedOnSave, ...utils }
  }

  it('renders the Settings header and children', () => {
    setup()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('invokes setActiveSection when a sidebar section is clicked', async () => {
    const user = userEvent.setup()
    const { setActiveSection } = setup()

    // Sidebar is visible on desktop layout by default in jsdom
    await user.click(screen.getByText('Security'))
    expect(setActiveSection).toHaveBeenCalledWith('security')
  })

  it('calls onSave when clicking Save Changes', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn()
    setup({ onSave })
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)
    expect(onSave).toHaveBeenCalled()
  })

  it('shows disabled save state with "Saving..." label', async () => {
    const user = userEvent.setup()
    const onSave = jest.fn()

    const setActiveSection = jest.fn()
    render(
      <ResponsiveSettings
        activeSection={'account'}
        setActiveSection={setActiveSection}
        saving={true}
        onSave={onSave}
      >
        <div>Content</div>
      </ResponsiveSettings>
    )

    const saveButton = screen.getByRole('button', { name: /saving/i })
    expect(saveButton).toBeDisabled()
    await user.click(saveButton)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('renders tablet navigation bar in tablet-vertical and mobile drawer toggles open/close', async () => {
    const user = userEvent.setup()
    // Simulate tablet vertical
    ;(window as any).innerWidth = 800
    ;(window as any).innerHeight = 1000
    window.dispatchEvent(new Event('resize'))

    const setActiveSection = jest.fn()
    render(
      <ResponsiveSettings
        activeSection={'account'}
        setActiveSection={setActiveSection}
        saving={false}
        onSave={jest.fn()}
      >
        <div>Content</div>
      </ResponsiveSettings>
    )

    // Tablet header tagline appears
    expect(screen.getByText('Manage your account and preferences')).toBeInTheDocument()

    // Switch to mobile and open/close drawer
    ;(window as any).innerWidth = 375
    ;(window as any).innerHeight = 800
    window.dispatchEvent(new Event('resize'))

    // Click the menu toggle in the mobile header (last button in md:hidden header bar)
    const header = document.querySelector('div[class*="md:hidden"]') as HTMLElement
    const headerButtons = Array.from(header.querySelectorAll('button')) as HTMLButtonElement[]
    const menuToggle = headerButtons[headerButtons.length - 1]
    await user.click(menuToggle)

    // Drawer panel should be visible (translate-x-0)
    const drawer = document.querySelector('div.fixed.inset-y-0.right-0.z-50.w-full.max-w-sm') as HTMLElement
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(drawer?.className).not.toContain('translate-x-full')

    // Close via X button
    const closeBtn = screen.getAllByRole('button').find(b => b !== menuToggle) as HTMLElement
    await user.click(closeBtn)
  })

  it('applies danger styling when selecting Danger Zone and closes mobile menu on selection', async () => {
    const user = userEvent.setup()
    // Force mobile
    ;(window as any).innerWidth = 360
    ;(window as any).innerHeight = 780
    window.dispatchEvent(new Event('resize'))

    const setActiveSection = jest.fn()
    render(
      <ResponsiveSettings
        activeSection={'account'}
        setActiveSection={setActiveSection}
        saving={false}
        onSave={jest.fn()}
      >
        <div>Content</div>
      </ResponsiveSettings>
    )

    // Open mobile menu
    const openBtn = screen.getAllByRole('button').find(b => b.querySelector('svg')) as HTMLElement
    await user.click(openBtn)

    const dangerBtn = screen.getByText('Danger Zone').closest('button') as HTMLButtonElement
    expect(dangerBtn).toBeInTheDocument()
    await user.click(dangerBtn)
    expect(setActiveSection).toHaveBeenCalledWith('danger')
  })
})


