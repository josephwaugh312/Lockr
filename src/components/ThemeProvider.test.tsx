/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import ThemeProvider from './ThemeProvider'

describe('ThemeProvider', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <div>Child Content</div>
      </ThemeProvider>
    )
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })
})


