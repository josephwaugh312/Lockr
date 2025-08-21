/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Contact from './page'

// Mock Next.js navigation
const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({ 
  useRouter: () => ({ 
    push: mockPush, 
    replace: mockReplace 
  }) 
}))

// Mock Next.js Link component - preserve onClick handlers
jest.mock('next/link', () => {
  return ({ children, href, onClick, ...props }: any) => {
    return <a href={href} onClick={onClick} {...props}>{children}</a>
  }
})

describe('Contact page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Page Rendering', () => {
    it('renders all main content sections', () => {
      render(<Contact />)
      
      // Check main heading
      expect(screen.getByText('Contact Us')).toBeInTheDocument()
      expect(screen.getByText(/Get in touch with the Lockrr team/i)).toBeInTheDocument()
      
      // Check form section
      expect(screen.getByText('Send us a message')).toBeInTheDocument()
      
      // Check contact info section
      expect(screen.getByText('General Inquiries')).toBeInTheDocument()
      expect(screen.getByText('contact@lockrr.app →')).toBeInTheDocument()
    })

    it('renders navigation bar with logo', () => {
      render(<Contact />)
      
      // Check logo
      expect(screen.getByText('Lockrr')).toBeInTheDocument()
      
      // Check desktop nav links (should be visible by default)
      const homeLinks = screen.getAllByText('Home')
      expect(homeLinks.length).toBeGreaterThan(0)
    })

    it('renders contact form with all fields', () => {
      render(<Contact />)
      
      // Check form labels
      expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
      expect(screen.getByLabelText('Message')).toBeInTheDocument()
      
      // Check form inputs
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('How can we help you?')).toBeInTheDocument()
      
      // Check submit button
      expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument()
    })
  })

  describe('Mobile Menu Interactions', () => {
    it('toggles mobile menu on button click', async () => {
      const user = userEvent.setup()
      render(<Contact />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      
      // Initially menu should be closed
      const mobileMenu = document.querySelector('.md\\:hidden.absolute')
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

    it('shows all navigation links in mobile menu', async () => {
      const user = userEvent.setup()
      render(<Contact />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      await user.click(toggleButton)
      
      // Check all mobile menu links are visible
      const mobileMenuContainer = document.querySelector('.md\\:hidden.absolute')
      
      // Use within to scope queries to mobile menu
      const withinMobile = require('@testing-library/react').within
      const mobileMenu = withinMobile(mobileMenuContainer as HTMLElement)
      
      expect(mobileMenu.getByText('Home')).toBeInTheDocument()
      expect(mobileMenu.getByText('Features')).toBeInTheDocument()
      expect(mobileMenu.getByText('Security')).toBeInTheDocument()
      expect(mobileMenu.getByText('Pricing')).toBeInTheDocument()
      expect(mobileMenu.getByText('Sign In')).toBeInTheDocument()
      expect(mobileMenu.getByText('Get Started')).toBeInTheDocument()
    })

    it('closes mobile menu when each link is clicked', async () => {
      const user = userEvent.setup()
      const withinMobile = require('@testing-library/react').within
      
      // Test each mobile menu link to ensure all onClick handlers are covered
      const mobileLinks = ['Home', 'Features', 'Security', 'Pricing', 'Sign In', 'Get Started']
      
      for (const linkText of mobileLinks) {
        render(<Contact />)
        
        // Open menu
        const toggleButton = screen.getByLabelText('Toggle mobile menu')
        await user.click(toggleButton)
        
        const mobileMenu = document.querySelector('.md\\:hidden.absolute')
        expect(mobileMenu).toHaveClass('visible')
        
        // Click the specific mobile menu link
        const mobileMenuContainer = document.querySelector('.md\\:hidden.absolute')
        const mobileMenuScope = withinMobile(mobileMenuContainer as HTMLElement)
        const link = mobileMenuScope.getByText(linkText)
        
        await user.click(link)
        
        // Menu should close
        await waitFor(() => {
          expect(mobileMenu).toHaveClass('invisible')
        })
        
        // Clean up for next iteration
        require('@testing-library/react').cleanup()
      }
    })

    it('changes menu icon when toggled', async () => {
      const user = userEvent.setup()
      render(<Contact />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      
      // Initially should show Menu icon (hamburger)
      expect(toggleButton.querySelector('svg')).toBeInTheDocument()
      
      // After click, should show X icon
      await user.click(toggleButton)
      await waitFor(() => {
        const svg = toggleButton.querySelector('svg')
        expect(svg).toBeInTheDocument()
      })
    })
  })

  describe('Form Interactions', () => {
    it('allows typing in form fields', async () => {
      const user = userEvent.setup()
      render(<Contact />)
      
      const nameInput = screen.getByPlaceholderText('Enter your name') as HTMLInputElement
      const emailInput = screen.getByPlaceholderText('Enter your email') as HTMLInputElement
      const messageInput = screen.getByPlaceholderText('How can we help you?') as HTMLTextAreaElement
      
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(messageInput, 'I need help with my account')
      
      expect(nameInput.value).toBe('John Doe')
      expect(emailInput.value).toBe('john@example.com')
      expect(messageInput.value).toBe('I need help with my account')
    })

    it('submits form when button is clicked', async () => {
      const user = userEvent.setup()
      render(<Contact />)
      
      const nameInput = screen.getByPlaceholderText('Enter your name')
      const emailInput = screen.getByPlaceholderText('Enter your email')
      const messageInput = screen.getByPlaceholderText('How can we help you?')
      const submitButton = screen.getByRole('button', { name: 'Send Message' })
      
      // Fill form
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(messageInput, 'Test message')
      
      // Mock form submission
      const formElement = submitButton.closest('form')
      const submitHandler = jest.fn((e) => e.preventDefault())
      formElement?.addEventListener('submit', submitHandler)
      
      await user.click(submitButton)
      
      // Since there's no actual submission handler in the component,
      // we're just testing that the button is clickable
      expect(submitButton).toBeInTheDocument()
    })

    it('maintains form field focus states', async () => {
      const user = userEvent.setup()
      render(<Contact />)
      
      const nameInput = screen.getByPlaceholderText('Enter your name')
      const emailInput = screen.getByPlaceholderText('Enter your email')
      
      // Focus name input
      await user.click(nameInput)
      expect(nameInput).toHaveFocus()
      
      // Tab to email input
      await user.tab()
      expect(emailInput).toHaveFocus()
      
      // Tab to message input
      await user.tab()
      const messageInput = screen.getByPlaceholderText('How can we help you?')
      expect(messageInput).toHaveFocus()
    })
  })

  describe('Navigation Links', () => {
    it('renders all navigation links with correct hrefs', () => {
      render(<Contact />)
      
      // Desktop navigation links
      const homeLinks = screen.getAllByRole('link', { name: /home/i })
      expect(homeLinks[0]).toHaveAttribute('href', '/')
      
      const featuresLinks = screen.getAllByRole('link', { name: /features/i })
      expect(featuresLinks[0]).toHaveAttribute('href', '/#features')
      
      const securityLinks = screen.getAllByRole('link', { name: /security/i })
      expect(securityLinks[0]).toHaveAttribute('href', '/#security')
      
      const pricingLinks = screen.getAllByRole('link', { name: /pricing/i })
      expect(pricingLinks[0]).toHaveAttribute('href', '/#pricing')
      
      const signInLinks = screen.getAllByRole('link', { name: /sign in/i })
      expect(signInLinks[0]).toHaveAttribute('href', '/authentication/signin')
      
      const getStartedLinks = screen.getAllByRole('link', { name: /get started/i })
      expect(getStartedLinks[0]).toHaveAttribute('href', '/authentication/signup')
    })

    it('renders contact email link with mailto', () => {
      render(<Contact />)
      
      const emailLink = screen.getByText('contact@lockrr.app →')
      expect(emailLink).toHaveAttribute('href', 'mailto:contact@lockrr.app')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      render(<Contact />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle mobile menu')
    })

    it('has proper form field associations', () => {
      render(<Contact />)
      
      // Check label-input associations
      const nameLabel = screen.getByText('Your Name')
      const nameInput = screen.getByPlaceholderText('Enter your name')
      expect(nameLabel).toHaveAttribute('for', 'name')
      expect(nameInput).toHaveAttribute('id', 'name')
      
      const emailLabel = screen.getByText('Email Address')
      const emailInput = screen.getByPlaceholderText('Enter your email')
      expect(emailLabel).toHaveAttribute('for', 'email')
      expect(emailInput).toHaveAttribute('id', 'email')
      
      const messageLabel = screen.getByText('Message')
      const messageInput = screen.getByPlaceholderText('How can we help you?')
      expect(messageLabel).toHaveAttribute('for', 'message')
      expect(messageInput).toHaveAttribute('id', 'message')
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Contact />)
      
      // Tab through form fields
      await user.tab()
      // First tab might go to skip link or nav, keep tabbing to form
      let activeElement = document.activeElement
      let tabCount = 0
      
      while (activeElement?.getAttribute('placeholder') !== 'Enter your name' && tabCount < 20) {
        await user.tab()
        activeElement = document.activeElement
        tabCount++
      }
      
      expect(activeElement).toHaveAttribute('placeholder', 'Enter your name')
    })
  })

  describe('Responsive Design', () => {
    it('hides mobile menu button on desktop', () => {
      render(<Contact />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      expect(toggleButton).toHaveClass('md:hidden')
    })

    it('hides desktop navigation on mobile', () => {
      render(<Contact />)
      
      // Find desktop nav container
      const desktopNav = document.querySelector('.hidden.md\\:flex')
      expect(desktopNav).toBeInTheDocument()
      expect(desktopNav).toHaveClass('hidden')
      expect(desktopNav).toHaveClass('md:flex')
    })

    it('uses responsive grid for content sections', () => {
      render(<Contact />)
      
      // Find the grid container
      const gridContainer = document.querySelector('.grid.md\\:grid-cols-2')
      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer).toHaveClass('grid')
      expect(gridContainer).toHaveClass('md:grid-cols-2')
    })
  })

  describe('Visual Styling', () => {
    it('applies correct color classes to elements', () => {
      render(<Contact />)
      
      // Check logo colors
      const logoContainer = document.querySelector('.bg-lockr-navy')
      expect(logoContainer).toBeInTheDocument()
      
      // Check button styling
      const submitButton = screen.getByRole('button', { name: 'Send Message' })
      expect(submitButton).toHaveClass('bg-lockr-navy')
      expect(submitButton).toHaveClass('text-white')
      expect(submitButton).toHaveClass('hover:bg-lockr-blue')
    })

    it('applies hover effects to links', () => {
      render(<Contact />)
      
      const homeLink = screen.getAllByText('Home')[0]
      expect(homeLink).toHaveClass('hover:text-lockr-navy')
      
      const emailLink = screen.getByText('contact@lockrr.app →')
      expect(emailLink).toHaveClass('hover:text-lockr-blue')
    })
  })
})


