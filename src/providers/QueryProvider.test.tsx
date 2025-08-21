/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import QueryProvider from './QueryProvider'

describe('QueryProvider', () => {
  it('renders children', () => {
    render(
      <QueryProvider>
        <div>Inside</div>
      </QueryProvider>
    )
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })
})


