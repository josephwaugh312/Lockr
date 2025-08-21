/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResponsiveVaultItems from './ResponsiveVaultItems'

describe('ResponsiveVaultItems', () => {
  const noop = () => {}
  const props = {
    items: [],
    viewMode: 'list' as const,
    searchQuery: '',
    selectedCategory: 'all',
    onItemClick: noop,
    onEditItem: noop,
    onDeleteItem: noop,
    onToggleFavorite: noop,
    onDuplicateItem: noop,
    onExportItem: noop,
    onViewDetails: noop,
    onAddItem: noop,
  }

  it('renders empty state', () => {
    render(<ResponsiveVaultItems {...props} />)
    expect(screen.getByText('Your vault is empty')).toBeInTheDocument()
  })

  it('shows category title for selected category and item count', () => {
    const items = [
      {
        id: '1',
        name: 'Example Login',
        username: 'user',
        password: 'pw',
        category: 'login' as const,
        favorite: false,
        lastUsed: new Date(),
        created: new Date(),
        strength: 'good' as const,
      },
    ]
    render(
      <ResponsiveVaultItems
        {...props}
        items={items}
        selectedCategory="login"
        searchQuery=""
        viewMode="list"
      />
    )
    expect(screen.getByText('Logins')).toBeInTheDocument()
    expect(screen.getByText(/1 item/)).toBeInTheDocument()
  })

  it('filters by search query', () => {
    const items = [
      { id: '1', name: 'Alpha', username: 'a', password: 'x', category: 'login' as const, favorite: false, lastUsed: new Date(), created: new Date(), strength: 'good' as const },
      { id: '2', name: 'Bravo', username: 'b', password: 'y', category: 'login' as const, favorite: false, lastUsed: new Date(), created: new Date(), strength: 'good' as const },
    ]
    render(
      <ResponsiveVaultItems
        {...props}
        items={items}
        selectedCategory="all"
        searchQuery="brav"
        viewMode="grid"
      />
    )
    expect(screen.getByText('Bravo')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })

  it('opens dropdown menu and triggers actions', async () => {
    const user = userEvent.setup()
    const onViewDetails = jest.fn()
    const onDuplicateItem = jest.fn()
    const onExportItem = jest.fn()
    const onToggleFavorite = jest.fn()
    const item = { id: '1', name: 'Item', username: 'u', password: 'p', category: 'login' as const, favorite: false, lastUsed: new Date(), created: new Date(), strength: 'good' as const }
    render(
      <ResponsiveVaultItems
        {...props}
        items={[item]}
        onViewDetails={onViewDetails}
        onDuplicateItem={onDuplicateItem}
        onExportItem={onExportItem}
        onToggleFavorite={onToggleFavorite}
      />
    )

    // Open dropdown via the kebab button (MoreVertical). It has class 'dropdown-container' wrapper
    const container = document.querySelector('.dropdown-container') as HTMLElement
    const kebab = container.querySelector('button') as HTMLButtonElement
    await user.click(kebab)

    // Click each option
    await user.click(screen.getByText(/view details/i))
    // reopen to click next options (menu closes after each click)
    await user.click(kebab)
    await user.click(screen.getByText(/duplicate/i))
    await user.click(kebab)
    await user.click(screen.getByText(/export/i))
    await user.click(kebab)
    await user.click(screen.getByText(/add to favorites/i))

    expect(onViewDetails).toHaveBeenCalled()
    expect(onDuplicateItem).toHaveBeenCalled()
    expect(onExportItem).toHaveBeenCalled()
    expect(onToggleFavorite).toHaveBeenCalled()
  })
})


