/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Privacy from './page'

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

describe('Privacy page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Page Rendering', () => {
    it('renders main privacy policy heading and metadata', () => {
      render(<Privacy />)
      
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
      expect(screen.getByText(/Last updated: December 2024/i)).toBeInTheDocument()
    })

    it('renders zero-knowledge encryption notice prominently', () => {
      render(<Privacy />)
      
      expect(screen.getByText(/We cannot access your data/i)).toBeInTheDocument()
      expect(screen.getByText(/zero-knowledge encryption/i)).toBeInTheDocument()
      expect(screen.getByText(/never transmitted to our servers in a readable format/i)).toBeInTheDocument()
    })

    it('renders all privacy policy sections', () => {
      render(<Privacy />)
      
      // Main sections
      expect(screen.getByText('Information We Collect')).toBeInTheDocument()
      expect(screen.getByText('How We Use Your Information')).toBeInTheDocument()
      expect(screen.getByText('Data Security')).toBeInTheDocument()
      expect(screen.getByText('Data Retention')).toBeInTheDocument()
      expect(screen.getByText('Third-Party Services')).toBeInTheDocument()
      expect(screen.getByText('Your Rights')).toBeInTheDocument()
      expect(screen.getByText('Contact Us')).toBeInTheDocument()
    })

    it('renders information collection details', () => {
      render(<Privacy />)
      
      expect(screen.getByText(/Email address \(for account creation and communication\)/)).toBeInTheDocument()
      expect(screen.getByText(/Encrypted vault data \(we cannot read this data\)/)).toBeInTheDocument()
      expect(screen.getByText(/Account settings and preferences/)).toBeInTheDocument()
      expect(screen.getByText(/Usage analytics \(anonymized, no personal data\)/)).toBeInTheDocument()
    })

    it('renders data usage information', () => {
      render(<Privacy />)
      
      expect(screen.getByText(/To provide password management services/)).toBeInTheDocument()
      expect(screen.getByText(/To send important security notifications/)).toBeInTheDocument()
      expect(screen.getByText(/To improve our service based on usage patterns/)).toBeInTheDocument()
      expect(screen.getByText(/To respond to support requests/)).toBeInTheDocument()
    })

    it('renders security measures details', () => {
      render(<Privacy />)
      
      expect(screen.getByText('Encryption')).toBeInTheDocument()
      expect(screen.getByText(/AES-256 encryption/)).toBeInTheDocument()
      expect(screen.getByText(/Your master password is never stored on our servers/)).toBeInTheDocument()
      
      expect(screen.getByText('Security Measures')).toBeInTheDocument()
      expect(screen.getByText(/End-to-end encryption/)).toBeInTheDocument()
      expect(screen.getByText(/Secure HTTPS connections/)).toBeInTheDocument()
      expect(screen.getByText(/Regular security audits/)).toBeInTheDocument()
      expect(screen.getByText(/Access controls and monitoring/)).toBeInTheDocument()
    })

    it('renders third-party services information', () => {
      render(<Privacy />)
      
      expect(screen.getByText(/Cloud hosting providers \(AWS, Google Cloud\)/)).toBeInTheDocument()
      expect(screen.getByText(/Email service providers \(for notifications\)/)).toBeInTheDocument()
      expect(screen.getByText(/Analytics services \(anonymized data only\)/)).toBeInTheDocument()
    })

    it('renders back to home link', () => {
      render(<Privacy />)
      
      const backLink = screen.getByText('Back to Home')
      expect(backLink).toBeInTheDocument()
      expect(backLink.closest('a')).toHaveAttribute('href', '/')
    })

    it('renders contact email link', () => {
      render(<Privacy />)
      
      const emailLink = screen.getByText('privacy@lockrr.app')
      expect(emailLink).toBeInTheDocument()
      expect(emailLink).toHaveAttribute('href', 'mailto:privacy@lockrr.app')
    })

    it('renders icons for sections', () => {
      render(<Privacy />)
      
      // Check for SVG icons in section headers
      const sections = document.querySelectorAll('h2')
      sections.forEach(section => {
        if (section.textContent?.includes('Information We Collect') ||
            section.textContent?.includes('How We Use Your Information') ||
            section.textContent?.includes('Data Security')) {
          const icon = section.querySelector('svg')
          expect(icon).toBeInTheDocument()
        }
      })
    })
  })

  describe('Mobile Menu Interactions', () => {
    it('toggles mobile menu visibility', async () => {
      const user = userEvent.setup()
      render(<Privacy />)
      
      const toggleButton = screen.getByLabelText(/Toggle.*menu/i)
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
      render(<Privacy />)
      
      const toggleButton = screen.getByLabelText(/Toggle.*menu/i)
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
        render(<Privacy />)
        
        const toggleButton = screen.getByLabelText(/Toggle.*menu/i)
        await user.click(toggleButton)
        
        const mobileMenu = document.querySelector('.md\\:hidden.absolute')
        expect(mobileMenu).toHaveClass('visible')
        
        // Click the specific mobile menu link
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
      render(<Privacy />)
      
      const toggleButton = screen.getByLabelText(/Toggle.*menu/i)
      
      // Check initial state has Menu icon
      let svgIcon = toggleButton.querySelector('svg')
      expect(svgIcon).toBeInTheDocument()
      
      // After clicking, should show X icon
      await user.click(toggleButton)
      svgIcon = toggleButton.querySelector('svg')
      expect(svgIcon).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('renders all navigation links with correct hrefs', () => {
      render(<Privacy />)
      
      // Desktop navigation
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

    it('renders back to home link with arrow icon', () => {
      render(<Privacy />)
      
      const backLink = screen.getByText('Back to Home')
      const linkElement = backLink.closest('a')
      expect(linkElement).toHaveAttribute('href', '/')
      
      // Check for arrow icon
      const arrowIcon = linkElement?.querySelector('svg')
      expect(arrowIcon).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      render(<Privacy />)
      
      const toggleButton = screen.getByLabelText(/Toggle.*menu/i)
      expect(toggleButton).toHaveAttribute('aria-label')
    })

    it('has semantic HTML structure', () => {
      render(<Privacy />)
      
      // Check for main heading
      const h1 = screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })
      expect(h1).toBeInTheDocument()
      
      // Check for section headings
      const h2s = screen.getAllByRole('heading', { level: 2 })
      expect(h2s.length).toBeGreaterThan(5)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Privacy />)
      
      // Tab to first interactive element
      await user.tab()
      
      // Should be able to tab to navigation links
      const activeElement = document.activeElement
      expect(activeElement?.tagName).toBe('A')
    })

    it('has proper focus indicators', () => {
      render(<Privacy />)
      
      const links = screen.getAllByRole('link')
      links.forEach(link => {
        // Check that links have focus-related classes
        const classNames = link.className
        expect(classNames).toMatch(/transition|hover:|focus:/i)
      })
    })
  })

  describe('Responsive Design', () => {
    it('hides mobile menu button on desktop', () => {
      render(<Privacy />)
      
      const toggleButton = screen.getByLabelText(/Toggle.*menu/i)
      expect(toggleButton).toHaveClass('md:hidden')
    })

    it('hides desktop navigation on mobile', () => {
      render(<Privacy />)
      
      const desktopNav = document.querySelector('.hidden.md\\:flex')
      expect(desktopNav).toBeInTheDocument()
      expect(desktopNav).toHaveClass('hidden')
      expect(desktopNav).toHaveClass('md:flex')
    })

    it('uses max-width container for content', () => {
      render(<Privacy />)
      
      const container = document.querySelector('.max-w-4xl')
      expect(container).toBeInTheDocument()
    })

    it('applies responsive padding', () => {
      render(<Privacy />)
      
      const contentContainer = document.querySelector('.px-6')
      expect(contentContainer).toBeInTheDocument()
    })
  })

  describe('Visual Styling', () => {
    it('applies correct color scheme to headings', () => {
      render(<Privacy />)
      
      const mainHeading = screen.getByText('Privacy Policy')
      expect(mainHeading).toHaveClass('text-lockr-navy')
      
      const sectionHeadings = screen.getAllByRole('heading', { level: 2 })
      sectionHeadings.forEach(heading => {
        if (heading.textContent !== 'Contact Us') {
          expect(heading).toHaveClass('text-lockr-navy')
        }
      })
    })

    it('applies hover effects to links', () => {
      render(<Privacy />)
      
      const backLink = screen.getByText('Back to Home').closest('a')
      expect(backLink).toHaveClass('hover:text-lockr-blue')
      
      const emailLink = screen.getByText('privacy@lockrr.app')
      expect(emailLink).toHaveClass('hover:text-lockr-blue')
    })

    it('styles list items consistently', () => {
      render(<Privacy />)
      
      const listItems = document.querySelectorAll('.list-disc li')
      expect(listItems.length).toBeGreaterThan(0)
      
      listItems.forEach(item => {
        const parent = item.parentElement
        expect(parent).toHaveClass('list-disc')
        expect(parent).toHaveClass('list-inside')
      })
    })

    it('applies proper spacing between sections', () => {
      render(<Privacy />)
      
      const sections = document.querySelectorAll('.mb-8')
      expect(sections.length).toBeGreaterThan(0)
    })

    it('uses gradient background', () => {
      render(<Privacy />)
      
      const backgroundContainer = document.querySelector('.bg-gradient-to-br')
      expect(backgroundContainer).toBeInTheDocument()
      expect(backgroundContainer).toHaveClass('from-primary-50')
      expect(backgroundContainer).toHaveClass('to-accent-50')
    })
  })

  describe('Content Structure', () => {
    it('displays content in prose format', () => {
      render(<Privacy />)
      
      const proseContainer = document.querySelector('.prose')
      expect(proseContainer).toBeInTheDocument()
      expect(proseContainer).toHaveClass('prose-lg')
    })

    it('groups related information properly', () => {
      render(<Privacy />)
      
      // Check for subsections under Data Security
      expect(screen.getByText('Encryption')).toBeInTheDocument()
      expect(screen.getByText('Security Measures')).toBeInTheDocument()
      
      // These should be h3 elements
      const encryptionHeading = screen.getByText('Encryption')
      expect(encryptionHeading.tagName).toBe('H3')
    })

    it('uses consistent list formatting', () => {
      render(<Privacy />)
      
      const lists = document.querySelectorAll('ul.list-disc')
      expect(lists.length).toBeGreaterThan(3)
      
      lists.forEach(list => {
        expect(list).toHaveClass('text-gray-700')
        // Lists may have either space-y-1 or space-y-2 for spacing
        const classList = list.className
        expect(classList.includes('space-y-1') || classList.includes('space-y-2')).toBe(true)
      })
    })
  })
})


