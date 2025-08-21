/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NotificationItem from '@/components/notifications/NotificationItem'

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const base = {
  id: 'id',
  user_id: 'test-user',
  title: 'Title',
  message: 'Message',
  data: {},
  read: false,
  read_at: null as any,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('NotificationItem matrix', () => {
  beforeEach(() => {
    localStorage.setItem('lockr_access_token', 't')
  })
  afterEach(() => localStorage.clear())

  const typeCases: Array<{ type: 'security'|'account'|'system'; expectedBadge: RegExp }> = [
    { type: 'security', expectedBadge: /security/i },
    { type: 'account', expectedBadge: /account/i },
    { type: 'system', expectedBadge: /system/i },
  ]

  test.each(typeCases)('renders type badge: %s', ({ type, expectedBadge }) => {
    renderWithClient(
      <NotificationItem notification={{ ...base, id: `id-${type}`, type, subtype: 'x', priority: 'low' }} />
    )
    expect(screen.getByText(expectedBadge)).toBeInTheDocument()
  })

  const priorityCases: Array<{ priority: 'low'|'medium'|'high'|'critical'; expectedClass: string }>= [
    { priority: 'low', expectedClass: 'border-l-green-500' },
    { priority: 'medium', expectedClass: 'border-l-yellow-500' },
    { priority: 'high', expectedClass: 'border-l-orange-500' },
    { priority: 'critical', expectedClass: 'border-l-red-500' },
  ]

  test.each(priorityCases)('applies priority color: %s', ({ priority, expectedClass }) => {
    const { container } = renderWithClient(
      <NotificationItem notification={{ ...base, id: `id-${priority}`, type: 'system', subtype: 'x', priority }} />
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain(expectedClass)
  })

  test('renders manual breach details block', () => {
    const data = {
      breachName: 'Acme',
      checkType: 'manual',
      compromisedData: ['emails', 'passwords'],
      breachDate: '2020-01-01',
      affectedAccounts: 123,
      domain: 'acme.com'
    }
    renderWithClient(
      <NotificationItem notification={{ ...base, id: 'b1', type: 'security', subtype: 'data_breach_alert', priority: 'high', data }} />
    )
    expect(screen.getByText(/Service:/i)).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText(/Compromised Data:/i)).toBeInTheDocument()
  })

  test('renders summary breach details for multiple breaches', () => {
    const data = {
      checkType: 'summary',
      totalBreaches: 3,
      mostRecentBreach: '2023-05-01'
    }
    renderWithClient(
      <NotificationItem notification={{ ...base, id: 'b2', type: 'security', subtype: 'data_breach_alert', priority: 'medium', data }} />
    )
    expect(screen.getByText(/Scan Summary:/i)).toBeInTheDocument()
    expect(screen.getByText(/3 breaches found/)).toBeInTheDocument()
  })

  test('renders legacy multi-breach format', () => {
    const data = {
      totalBreaches: 2,
      mostRecentBreach: '2022-01-01',
      allBreaches: [{ name: 'SiteA', dataClasses: ['Emails', 'IPs'] }, { name: 'SiteB', dataClasses: ['Passwords'] }]
    }
    renderWithClient(
      <NotificationItem notification={{ ...base, id: 'b3', type: 'security', subtype: 'data_breach_alert', priority: 'medium', data }} />
    )
    expect(screen.getByText(/2 breaches found/)).toBeInTheDocument()
    expect(screen.getByText(/SiteA/)).toBeInTheDocument()
  })
})


