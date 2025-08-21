/** @jest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResponsiveDashboard from './ResponsiveDashboard'

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a> }))
jest.mock('./notifications/NotificationBell', () => ({ __esModule: true, default: () => <div data-testid="bell" /> }))

describe('ResponsiveDashboard', () => {
  const noop = () => {}
  const props = {
    user: { id: '1', email: 'test@example.com', role: 'user' },
    children: <div>Child Content</div>,
    searchQuery: '',
    setSearchQuery: noop,
    viewMode: 'list' as const,
    setViewMode: noop,
    selectedCategory: 'all',
    setSelectedCategory: noop,
    vaultItems: [],
    notificationCount: 0,
    securityStats: { total: 0, weak: 0, reused: 0, breached: 0 },
    onAddItem: noop,
    onImport: noop,
    onExport: noop,
    onLock: noop,
    onLogout: noop,
  }

  it('renders brand and actions', () => {
    render(<ResponsiveDashboard {...props} />)
    expect(screen.getByText('Lockrr')).toBeInTheDocument()
    expect(screen.getByText('Add Item')).toBeInTheDocument()
  })

  it('handles category click and view toggles', async () => {
    const user = userEvent.setup()
    const setSelectedCategory = jest.fn()
    const setViewMode = jest.fn()

    render(
      <ResponsiveDashboard
        {...props}
        setSelectedCategory={setSelectedCategory}
        setViewMode={setViewMode}
        viewMode="grid"
      />
    )

    // Click a category (Logins)
    await user.click(screen.getByText('Logins'))
    expect(setSelectedCategory).toHaveBeenCalled()

    // View toggle buttons exist; click both
    const buttons = screen.getAllByRole('button')
    // Click first two buttons after search input area (heuristic)
    if (buttons.length > 3) {
      await user.click(buttons[3])
      await user.click(buttons[4])
    }
  })

  it('shows empty state content area and calls actions from mobile menu', async () => {
    const user = userEvent.setup()
    const onImport = jest.fn()
    const onExport = jest.fn()
    const onLock = jest.fn()

    // Simulate mobile by exposing only mobile action menu; search area remains
    // Render with empty children and 0 counts
    render(
      <ResponsiveDashboard
        {...props}
        onImport={onImport}
        onExport={onExport}
        onLock={onLock}
        children={<div>Empty</div>}
        vaultItems={[]}
        notificationCount={0}
      />
    )

    // Open the mobile action menu (three-dot MoreVertical button)
    const buttons = screen.getAllByRole('button')
    const menuButton = buttons.find(b => b.innerHTML.includes('svg')) || buttons[buttons.length - 1]
    await user.click(menuButton)

    // Click Import, Export, Lock entries in the dropdown
    const importBtn = await screen.findByText('Import')
    await user.click(importBtn)
    const exportBtn = await screen.findByText('Export')
    await user.click(exportBtn)
    const lockBtn = await screen.findByText('Lock')
    await user.click(lockBtn)

    expect(onImport).toHaveBeenCalled()
    expect(onExport).toHaveBeenCalled()
    expect(onLock).toHaveBeenCalled()
  })

  it('updates search input and shows category/favorite counts', async () => {
    const user = userEvent.setup()
    const setSearchQuery = jest.fn()
    const setSelectedCategory = jest.fn()
    const sampleItems = [
      { id: 'a', category: 'login', favorite: true },
      { id: 'b', category: 'login', favorite: false },
      { id: 'c', category: 'card', favorite: true },
    ]

    render(
      <ResponsiveDashboard
        {...props}
        setSearchQuery={setSearchQuery}
        setSelectedCategory={setSelectedCategory}
        vaultItems={sampleItems}
        securityStats={{ total: 0, weak: 0, reused: 0, breached: 0 }}
      />
    )

    const input = screen.getByPlaceholderText('Search vault...')
    await user.type(input, 'test')
    expect(setSearchQuery).toHaveBeenCalled()
    // Ensure we passed string values during typing
    for (const call of (setSearchQuery as jest.Mock).mock.calls) {
      expect(typeof call[0]).toBe('string')
    }

    // Category chips exist
    expect(screen.getByText('Logins')).toBeInTheDocument()
    expect(screen.getByText('Payment Cards')).toBeInTheDocument()

    // Counts for categories and favorites should render (>0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0) // two logins
    expect(screen.getAllByText('1').length).toBeGreaterThan(0) // one card or favorites
  })

  it('renders provided content (empty state placeholder)', () => {
    render(
      <ResponsiveDashboard
        {...props}
        children={<div>No items found</div>}
        vaultItems={[]}
      />
    )
    expect(screen.getByText('No items found')).toBeInTheDocument()
  })

  it('desktop view toggle buttons call setViewMode', async () => {
    const user = userEvent.setup()
    const setViewMode = jest.fn()
    render(
      <ResponsiveDashboard
        {...props}
        viewMode="grid"
        setViewMode={setViewMode}
      />
    )

    // Click a bunch of buttons; ensure both modes requested at least once
    const buttons = screen.getAllByRole('button')
    for (const b of buttons) {
      await user.click(b)
    }
    expect(setViewMode).toHaveBeenCalled()
    expect(setViewMode.mock.calls.flat()).toContain('list')
    expect(setViewMode.mock.calls.flat()).toContain('grid')
  })

  it('shows favorites and notifications counts when non-zero', () => {
    const items = [
      { id: '1', category: 'login', favorite: true },
      { id: '2', category: 'card', favorite: true },
      { id: '3', category: 'note', favorite: false },
    ]
    render(
      <ResponsiveDashboard
        {...props}
        vaultItems={items}
        notificationCount={3}
      />
    )
    // Favorites count badge (2) and notifications badge (3) should be visible
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    // Notifications link present
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('clicking Favorites selects the favorites category and shows its count', async () => {
    const user = userEvent.setup()
    const setSelectedCategory = jest.fn()
    const items = [
      { id: '1', category: 'login', favorite: true },
      { id: '2', category: 'card', favorite: true },
      { id: '3', category: 'note', favorite: false },
    ]

    render(
      <ResponsiveDashboard
        {...props}
        setSelectedCategory={setSelectedCategory}
        vaultItems={items}
      />
    )

    const favButton = screen.getByText('Favorites').closest('button') as HTMLButtonElement
    expect(favButton).toBeInTheDocument()
    // Count badge inside favorites should be 2
    expect(within(favButton).getAllByText('2').length).toBeGreaterThan(0)

    await user.click(favButton)
    expect(setSelectedCategory).toHaveBeenCalledWith('favorites')
  })

  it('notifications item is a link to /dashboard/notifications', () => {
    render(
      <ResponsiveDashboard
        {...props}
        notificationCount={1}
      />
    )
    const notifLink = screen.getByRole('link', { name: /Notifications/i }) as HTMLAnchorElement
    expect(notifLink).toBeInTheDocument()
    expect(notifLink.getAttribute('href')).toBe('/dashboard/notifications')
  })

  // View mode toggling is covered in the earlier test via desktop toggle buttons
})


