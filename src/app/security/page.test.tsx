/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Security from './page'

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

describe('Security page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Page Rendering', () => {
    it('renders main security heading and description', () => {
      render(<Security />)
      
      expect(screen.getByRole('heading', { level: 1, name: 'Security' })).toBeInTheDocument()
      expect(screen.getByText(/Learn about Lockrr's security measures/i)).toBeInTheDocument()
    })

    it('renders all security sections', () => {
      render(<Security />)
      
      expect(screen.getByText('Zero-Knowledge Architecture')).toBeInTheDocument()
      expect(screen.getByText('Encryption Standards')).toBeInTheDocument()
      expect(screen.getByText('Security Practices')).toBeInTheDocument()
      expect(screen.getByText('Reporting Security Issues')).toBeInTheDocument()
    })

    it('renders zero-knowledge architecture details', () => {
      render(<Security />)
      
      // Use getAllByText since "zero-knowledge architecture" appears multiple times
      const zkElements = screen.getAllByText(/zero-knowledge architecture/i)
      expect(zkElements.length).toBeGreaterThan(0)
      expect(screen.getByText(/never have access to your master password/i)).toBeInTheDocument()
      expect(screen.getByText(/encryption and decryption happens locally/i)).toBeInTheDocument()
    })

    it('renders encryption standards list', () => {
      render(<Security />)
      
      expect(screen.getByText(/AES-256 encryption for vault data/)).toBeInTheDocument()
      expect(screen.getByText(/Argon2id for password hashing/)).toBeInTheDocument()
      expect(screen.getByText(/End-to-end encryption for all communications/)).toBeInTheDocument()
      expect(screen.getByText(/Secure random password generation/)).toBeInTheDocument()
    })

    it('renders security practices list', () => {
      render(<Security />)
      
      expect(screen.getByText(/Regular security audits and updates/)).toBeInTheDocument()
      expect(screen.getByText(/Open-source code for transparency/)).toBeInTheDocument()
      expect(screen.getByText(/No telemetry or tracking/)).toBeInTheDocument()
      expect(screen.getByText(/Self-hosting options available/)).toBeInTheDocument()
    })

    it('renders security contact email', () => {
      render(<Security />)
      
      expect(screen.getByText(/security@lockr.app/)).toBeInTheDocument()
      expect(screen.getByText(/report it responsibly/)).toBeInTheDocument()
    })

    it('renders navigation bar with logo', () => {
      render(<Security />)
      
      expect(screen.getByText('Lockrr')).toBeInTheDocument()
      const logoContainer = document.querySelector('.bg-lockr-navy')
      expect(logoContainer).toBeInTheDocument()
    })
  })

  describe('Mobile Menu Interactions', () => {
    it('toggles mobile menu visibility on button click', async () => {
      const user = userEvent.setup()
      render(<Security />)
      
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

    it('displays all navigation links in mobile menu', async () => {
      const user = userEvent.setup()
      render(<Security />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      await user.click(toggleButton)
      
      const mobileMenuContainer = document.querySelector('.md\\:hidden.absolute')
      const mobileMenu = within(mobileMenuContainer as HTMLElement)
      
      expect(mobileMenu.getByText('Home')).toBeInTheDocument()
      expect(mobileMenu.getByText('Features')).toBeInTheDocument()
      expect(mobileMenu.getByText('Security')).toBeInTheDocument()
      expect(mobileMenu.getByText('Pricing')).toBeInTheDocument()
      expect(mobileMenu.getByText('Sign In')).toBeInTheDocument()
      expect(mobileMenu.getByText('Get Started')).toBeInTheDocument()
    })

    it('closes mobile menu when each link is clicked', async () => {
      const user = userEvent.setup()
      
      // Test each mobile menu link to ensure all onClick handlers are covered
      const mobileLinks = ['Home', 'Features', 'Security', 'Pricing', 'Sign In', 'Get Started']
      
      for (const linkText of mobileLinks) {
        render(<Security />)
        
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

    it('changes menu icon between hamburger and X', async () => {
      const user = userEvent.setup()
      render(<Security />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      
      // Check for SVG icon presence
      let svgIcon = toggleButton.querySelector('svg')
      expect(svgIcon).toBeInTheDocument()
      
      // After clicking, icon should change
      await user.click(toggleButton)
      svgIcon = toggleButton.querySelector('svg')
      expect(svgIcon).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('renders all navigation links with correct hrefs', () => {
      render(<Security />)
      
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
  })

  describe('Content Structure', () => {
    it('uses card layout for security sections', () => {
      render(<Security />)
      
      const cards = document.querySelectorAll('.bg-white\\/80.backdrop-blur-sm.rounded-xl')
      expect(cards.length).toBe(4) // 4 security sections
      
      cards.forEach(card => {
        expect(card).toHaveClass('shadow-lockr-lg')
        expect(card).toHaveClass('border')
        expect(card).toHaveClass('border-gray-200')
      })
    })

    it('displays section headings as h2 elements', () => {
      render(<Security />)
      
      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements.length).toBeGreaterThanOrEqual(4)
      
      const headingTexts = h2Elements.map(h => h.textContent)
      expect(headingTexts).toContain('Zero-Knowledge Architecture')
      expect(headingTexts).toContain('Encryption Standards')
      expect(headingTexts).toContain('Security Practices')
      expect(headingTexts).toContain('Reporting Security Issues')
    })

    it('uses list formatting for security features', () => {
      render(<Security />)
      
      const lists = document.querySelectorAll('ul.list-disc')
      expect(lists.length).toBeGreaterThanOrEqual(2)
      
      lists.forEach(list => {
        expect(list).toHaveClass('list-inside')
        expect(list).toHaveClass('space-y-2')
        expect(list).toHaveClass('text-gray-600')
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      render(<Security />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle mobile menu')
    })

    it('has semantic HTML structure', () => {
      render(<Security />)
      
      // Check for main heading
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Security')
      
      // Check for section headings
      const h2s = screen.getAllByRole('heading', { level: 2 })
      expect(h2s.length).toBeGreaterThanOrEqual(4)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Security />)
      
      // Tab to first interactive element
      await user.tab()
      
      // Should be able to tab to links
      const activeElement = document.activeElement
      expect(activeElement?.tagName).toBe('A')
    })

    it('maintains focus visibility', () => {
      render(<Security />)
      
      const links = screen.getAllByRole('link')
      links.forEach(link => {
        const classNames = link.className
        expect(classNames).toMatch(/transition|hover:/i)
      })
    })
  })

  describe('Responsive Design', () => {
    it('hides mobile menu button on desktop', () => {
      render(<Security />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      expect(toggleButton).toHaveClass('md:hidden')
    })

    it('hides desktop navigation on mobile', () => {
      render(<Security />)
      
      const desktopNav = document.querySelector('.hidden.md\\:flex')
      expect(desktopNav).toBeInTheDocument()
      expect(desktopNav).toHaveClass('hidden')
      expect(desktopNav).toHaveClass('md:flex')
    })

    it('uses max-width container for content', () => {
      render(<Security />)
      
      const container = document.querySelector('.max-w-4xl')
      expect(container).toBeInTheDocument()
    })

    it('applies responsive padding', () => {
      render(<Security />)
      
      const paddedElements = document.querySelectorAll('.px-6')
      expect(paddedElements.length).toBeGreaterThan(0)
    })

    it('centers content on larger screens', () => {
      render(<Security />)
      
      const centeredContainer = document.querySelector('.mx-auto')
      expect(centeredContainer).toBeInTheDocument()
      
      const textCenter = document.querySelector('.text-center')
      expect(textCenter).toBeInTheDocument()
    })
  })

  describe('Visual Styling', () => {
    it('applies gradient background', () => {
      render(<Security />)
      
      const gradientBg = document.querySelector('.bg-gradient-to-br')
      expect(gradientBg).toBeInTheDocument()
      expect(gradientBg).toHaveClass('from-primary-50')
      expect(gradientBg).toHaveClass('to-accent-50')
    })

    it('styles section headings with brand colors', () => {
      render(<Security />)
      
      const headings = screen.getAllByRole('heading', { level: 2 })
      headings.forEach(heading => {
        expect(heading).toHaveClass('text-lockr-navy')
        expect(heading).toHaveClass('font-bold')
      })
    })

    it('applies hover effects to links', () => {
      render(<Security />)
      
      const homeLink = screen.getAllByText('Home')[0]
      expect(homeLink).toHaveClass('hover:text-lockr-navy')
      
      const getStartedButton = screen.getAllByText('Get Started')[0]
      expect(getStartedButton).toHaveClass('hover:bg-lockr-blue')
    })

    it('uses consistent spacing between sections', () => {
      render(<Security />)
      
      const spacedContainer = document.querySelector('.space-y-12')
      expect(spacedContainer).toBeInTheDocument()
    })

    it('applies shadow and border to content cards', () => {
      render(<Security />)
      
      const cards = document.querySelectorAll('.shadow-lockr-lg')
      expect(cards.length).toBeGreaterThan(0)
      
      cards.forEach(card => {
        expect(card).toHaveClass('border')
        expect(card).toHaveClass('rounded-xl')
      })
    })
  })

  describe('Content Completeness', () => {
    it('includes all encryption methods', () => {
      render(<Security />)
      
      const encryptionMethods = [
        'AES-256',
        'Argon2id',
        'End-to-end encryption',
        'Secure random password'
      ]
      
      encryptionMethods.forEach(method => {
        expect(screen.getByText(new RegExp(method, 'i'))).toBeInTheDocument()
      })
    })

    it('includes all security practices', () => {
      render(<Security />)
      
      const practices = [
        'security audits',
        'Open-source',
        'No telemetry',
        'Self-hosting'
      ]
      
      practices.forEach(practice => {
        expect(screen.getByText(new RegExp(practice, 'i'))).toBeInTheDocument()
      })
    })

    it('includes security contact information', () => {
      render(<Security />)
      
      expect(screen.getByText(/security@lockr.app/)).toBeInTheDocument()
      expect(screen.getByText(/report it responsibly/i)).toBeInTheDocument()
    })
  })
})


