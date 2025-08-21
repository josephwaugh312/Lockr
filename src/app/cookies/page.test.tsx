/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CookiesPage from './page'

// Mock useSearchParams
let mockParams: any = { get: (k: string) => null }
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockParams,
}))

// Mock Next.js Link component - preserve onClick handlers
jest.mock('next/link', () => {
  return ({ children, href, onClick, ...props }: any) => {
    return <a href={href} onClick={onClick} {...props}>{children}</a>
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('Cookies page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    mockParams = { get: (k: string) => null }
    // @ts-ignore
    global.alert = jest.fn()
  })

  describe('Default View', () => {
    it('renders cookie policy content', () => {
      render(<CookiesPage />)
      expect(screen.getByText('Cookie Policy')).toBeInTheDocument()
      expect(screen.getByText(/Last updated: December 2024/i)).toBeInTheDocument()
    })

    it('renders all cookie types sections', () => {
      render(<CookiesPage />)
      expect(screen.getByText('Essential Cookies')).toBeInTheDocument()
      expect(screen.getByText('Functional Cookies')).toBeInTheDocument()
      expect(screen.getByText('Analytics Cookies')).toBeInTheDocument()
    })

    it('renders cookie policy sections', () => {
      render(<CookiesPage />)
      // Page doesn't have a manage button, just check it renders cookie sections
      expect(screen.getByText('Managing Cookies')).toBeInTheDocument()
      expect(screen.getByText('Cookie Retention')).toBeInTheDocument()
    })

    it('renders back to home link', () => {
      render(<CookiesPage />)
      const backLink = screen.getByText('Back to Home')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    })

    it('toggles mobile menu visibility', async () => {
      const user = userEvent.setup()
      render(<CookiesPage />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      const mobileMenu = document.querySelector('.md\\:hidden.absolute')
      
      // Initially closed
      expect(mobileMenu).toHaveClass('invisible')
      
      // Open menu
      await user.click(toggleButton)
      await waitFor(() => {
        expect(mobileMenu).toHaveClass('visible')
      })
      
      // Close menu
      await user.click(toggleButton)
      await waitFor(() => {
        expect(mobileMenu).toHaveClass('invisible')
      })
    })

    it('closes mobile menu when links are clicked', async () => {
      const user = userEvent.setup()
      
      const mobileLinks = ['Home', 'Features', 'Security', 'Pricing', 'Sign In', 'Get Started']
      
      for (const linkText of mobileLinks) {
        render(<CookiesPage />)
        
        const toggleButton = screen.getByLabelText('Toggle mobile menu')
        await user.click(toggleButton)
        
        const mobileMenu = document.querySelector('.md\\:hidden.absolute')
        expect(mobileMenu).toHaveClass('visible')
        
        const mobileMenuContainer = document.querySelector('.md\\:hidden.absolute')
        const mobileMenuScope = within(mobileMenuContainer as HTMLElement)
        const link = mobileMenuScope.getByText(linkText)
        
        await user.click(link)
        
        await waitFor(() => {
          expect(mobileMenu).toHaveClass('invisible')
        })
        
        // Clean up for next iteration
        require('@testing-library/react').cleanup()
      }
    })
  })

  describe('Manage Section', () => {
    beforeEach(() => {
      mockParams = { get: (k: string) => (k === 'section' ? 'manage' : null) }
    })

    it('renders cookie management interface', async () => {
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      expect(screen.getByText(/Customize your cookie preferences/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Accept All Cookies/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reject Non-Essential/i })).toBeInTheDocument()
    })

    it('loads saved preferences from localStorage', async () => {
      const savedPrefs = {
        essential: true,
        functional: false,
        analytics: true
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPrefs))
      
      render(<CookiesPage />)
      
      await waitFor(() => {
        // Find checkboxes by their parent container
        const allCheckboxes = screen.getAllByRole('checkbox')
        // Essential is first (index 0), Functional is second (index 1), Analytics is third (index 2)
        const functionalCheckbox = allCheckboxes[1] as HTMLInputElement
        const analyticsCheckbox = allCheckboxes[2] as HTMLInputElement
        
        expect(functionalCheckbox.checked).toBe(false)
        expect(analyticsCheckbox.checked).toBe(true)
      })
    })

    it('handles corrupt localStorage data gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error parsing saved cookie preferences:', expect.any(Error))
      })
      
      consoleSpy.mockRestore()
    })

    it('allows toggling functional cookies', async () => {
      const user = userEvent.setup()
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      const allCheckboxes = screen.getAllByRole('checkbox')
      const functionalCheckbox = allCheckboxes[1] as HTMLInputElement
      
      expect(functionalCheckbox.checked).toBe(true)
      
      await user.click(functionalCheckbox)
      expect(functionalCheckbox.checked).toBe(false)
      
      await user.click(functionalCheckbox)
      expect(functionalCheckbox.checked).toBe(true)
    })

    it('allows toggling analytics cookies', async () => {
      const user = userEvent.setup()
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      const allCheckboxes = screen.getAllByRole('checkbox')
      const analyticsCheckbox = allCheckboxes[2] as HTMLInputElement
      
      expect(analyticsCheckbox.checked).toBe(false)
      
      await user.click(analyticsCheckbox)
      expect(analyticsCheckbox.checked).toBe(true)
      
      await user.click(analyticsCheckbox)
      expect(analyticsCheckbox.checked).toBe(false)
    })

    it('saves preferences when Save button is clicked', async () => {
      const user = userEvent.setup()
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      // Toggle analytics to create changes
      const allCheckboxes = screen.getAllByRole('checkbox')
      const analyticsCheckbox = allCheckboxes[2] as HTMLInputElement
      await user.click(analyticsCheckbox)
      
      const saveButton = screen.getByRole('button', { name: /Save Preferences/i })
      await user.click(saveButton)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lockr_cookie_preferences', expect.any(String))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lockr_cookie_consent', 'customized')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lockr_cookie_consent_date', expect.any(String))
      expect(global.alert).toHaveBeenCalledWith('Cookie preferences saved successfully!')
    })

    it('handles Accept All Cookies', async () => {
      const user = userEvent.setup()
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      const acceptAllButton = screen.getByRole('button', { name: /Accept All Cookies/i })
      await user.click(acceptAllButton)
      
      const expectedPrefs = {
        essential: true,
        functional: true,
        analytics: true
      }
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lockr_cookie_preferences', JSON.stringify(expectedPrefs))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lockr_cookie_consent', 'accepted')
      expect(global.alert).toHaveBeenCalledWith('All cookies accepted!')
      
      // Check that checkboxes are updated
      const allCheckboxes = screen.getAllByRole('checkbox')
      const functionalCheckbox = allCheckboxes[1] as HTMLInputElement
      const analyticsCheckbox = allCheckboxes[2] as HTMLInputElement
      
      expect(functionalCheckbox.checked).toBe(true)
      expect(analyticsCheckbox.checked).toBe(true)
    })

    it('handles Reject Non-Essential', async () => {
      const user = userEvent.setup()
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      const rejectButton = screen.getByRole('button', { name: /Reject Non-Essential/i })
      await user.click(rejectButton)
      
      const expectedPrefs = {
        essential: true,
        functional: false,
        analytics: false
      }
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lockr_cookie_preferences', JSON.stringify(expectedPrefs))
      expect(localStorageMock.setItem).toHaveBeenCalledWith('lockr_cookie_consent', 'declined')
      expect(global.alert).toHaveBeenCalledWith('Non-essential cookies rejected!')
      
      // Check that checkboxes are updated
      const allCheckboxes = screen.getAllByRole('checkbox')
      const functionalCheckbox = allCheckboxes[1] as HTMLInputElement
      const analyticsCheckbox = allCheckboxes[2] as HTMLInputElement
      
      expect(functionalCheckbox.checked).toBe(false)
      expect(analyticsCheckbox.checked).toBe(false)
    })

    it('disables save button when no changes made', async () => {
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      const saveButton = screen.getByRole('button', { name: /Preferences Saved/i })
      expect(saveButton).toBeDisabled()
    })

    it('enables save button when changes are made', async () => {
      const user = userEvent.setup()
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      // Initially disabled
      let saveButton = screen.getByRole('button', { name: /Preferences Saved/i })
      expect(saveButton).toBeDisabled()
      
      // Toggle analytics to create changes
      const allCheckboxes = screen.getAllByRole('checkbox')
      const analyticsCheckbox = allCheckboxes[2] as HTMLInputElement
      await user.click(analyticsCheckbox)
      
      // Now should be enabled with different text
      saveButton = screen.getByRole('button', { name: /Save Preferences/i })
      expect(saveButton).not.toBeDisabled()
    })

    it('essential cookies checkbox is always disabled', async () => {
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      const allCheckboxes = screen.getAllByRole('checkbox')
      const essentialCheckbox = allCheckboxes[0] as HTMLInputElement
      
      expect(essentialCheckbox.checked).toBe(true)
      expect(essentialCheckbox.disabled).toBe(true)
    })

    it('renders back to policy link', async () => {
      render(<CookiesPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Cookie Preferences')).toBeInTheDocument()
      })
      
      const backLink = screen.getByText('Back to Cookie Policy')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/cookies')
    })
  })

  describe('Content Rendering', () => {
    it('renders cookie descriptions', () => {
      render(<CookiesPage />)
      
      // Check for actual text in the page
      expect(screen.getByText(/Authentication tokens/)).toBeInTheDocument()
      expect(screen.getByText(/Session management/)).toBeInTheDocument()
      expect(screen.getByText(/Theme preferences/)).toBeInTheDocument()
      expect(screen.getByText(/Page visit statistics/)).toBeInTheDocument()
    })

    it('renders navigation links with correct hrefs', () => {
      render(<CookiesPage />)
      
      const homeLinks = screen.getAllByRole('link', { name: /home/i })
      expect(homeLinks[0]).toHaveAttribute('href', '/')
      
      const featuresLinks = screen.getAllByRole('link', { name: /features/i })
      expect(featuresLinks[0]).toHaveAttribute('href', '/#features')
      
      const signInLinks = screen.getAllByRole('link', { name: /sign in/i })
      expect(signInLinks[0]).toHaveAttribute('href', '/authentication/signin')
    })
  })
})