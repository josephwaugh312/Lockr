/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResponsiveVaultItems from './ResponsiveVaultItems'

const baseItem = {
  id: '1',
  name: 'Entry',
  username: 'user',
  password: 'pw',
  category: 'login' as const,
  favorite: false,
  lastUsed: new Date(),
  created: new Date(),
  strength: 'good' as const,
}

const noop = () => {}
const handlers = {
  onItemClick: noop,
  onEditItem: noop,
  onDeleteItem: noop,
  onToggleFavorite: noop,
  onDuplicateItem: noop,
  onExportItem: noop,
  onViewDetails: noop,
  onAddItem: noop,
}

describe('ResponsiveVaultItems path coverage', () => {
  it('renders empty search state', () => {
    render(
      <ResponsiveVaultItems
        items={[{ ...baseItem, name: 'Alpha' }]}
        viewMode="list"
        searchQuery="zzzz"
        selectedCategory="all"
        {...handlers}
      />
    )
    expect(screen.getByText(/No items found/i)).toBeInTheDocument()
  })

  it('renders empty vault state (no search)', () => {
    render(
      <ResponsiveVaultItems
        items={[]}
        viewMode="grid"
        searchQuery=""
        selectedCategory="all"
        {...handlers}
      />
    )
    expect(screen.getByText(/Your vault is empty/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add Your First Item/i })).toBeInTheDocument()
  })

  it('shows category-specific title mapping', () => {
    const categories = [
      { key: 'all', title: /All Items/i },
      { key: 'favorites', title: /Favorites/i },
      { key: 'recent', title: /Recently Used/i },
      { key: 'login', title: /Logins/i },
      { key: 'card', title: /Payment Cards/i },
      { key: 'note', title: /Secure Notes/i },
      { key: 'wifi', title: /WiFi Passwords/i },
    ] as const

    for (const { key, title } of categories) {
      render(
        <ResponsiveVaultItems
          items={[baseItem]}
          viewMode="list"
          searchQuery=""
          selectedCategory={key as any}
          {...handlers}
        />
      )
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('list view shows updated time, grid view does not', async () => {
    const user = userEvent.setup()
    const item = { ...baseItem, updatedAt: new Date().toISOString() }

    const { rerender } = render(
      <ResponsiveVaultItems
        items={[item]}
        viewMode="list"
        searchQuery=""
        selectedCategory="all"
        {...handlers}
      />
    )
    expect(screen.getByText(/Updated/i)).toBeInTheDocument()

    rerender(
      <ResponsiveVaultItems
        items={[item]}
        viewMode="grid"
        searchQuery=""
        selectedCategory="all"
        {...handlers}
      />
    )
    expect(screen.queryByText(/Updated/i)).not.toBeInTheDocument()
  })
})


