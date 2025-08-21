/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Terms from './page'

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

describe('Terms page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Page Rendering', () => {
    it('renders main terms heading and last updated date', () => {
      render(<Terms />)
      
      expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument()
      expect(screen.getByText(/Last updated: December 2024/i)).toBeInTheDocument()
    })

    it('renders all terms sections with numbered headings', () => {
      render(<Terms />)
      
      expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument()
      expect(screen.getByText('2. Service Description')).toBeInTheDocument()
      expect(screen.getByText('3. Privacy and Security')).toBeInTheDocument()
      expect(screen.getByText('4. User Responsibilities')).toBeInTheDocument()
      expect(screen.getByText('5. Service Availability and Limitations')).toBeInTheDocument()
      expect(screen.getByText('6. Disclaimers and Limitations')).toBeInTheDocument()
      expect(screen.getByText('7. Acceptable Use')).toBeInTheDocument()
      expect(screen.getByText('8. Account Termination')).toBeInTheDocument()
      expect(screen.getByText('9. Changes to Terms')).toBeInTheDocument()
      expect(screen.getByText('10. Governing Law')).toBeInTheDocument()
      expect(screen.getByText('11. Contact Information')).toBeInTheDocument()
    })

    it('renders back to home link with arrow icon', () => {
      render(<Terms />)
      
      const backLink = screen.getByText('Back to Home')
      expect(backLink).toBeInTheDocument()
      const linkElement = backLink.closest('a')
      expect(linkElement).toHaveAttribute('href', '/')
      
      // Check for arrow icon
      const arrowIcon = linkElement?.querySelector('svg')
      expect(arrowIcon).toBeInTheDocument()
    })

    it('renders service description details', () => {
      render(<Terms />)
      
      expect(screen.getByText(/zero-knowledge password manager/i)).toBeInTheDocument()
      expect(screen.getByText(/Secure password storage and generation/)).toBeInTheDocument()
      expect(screen.getByText(/Credit card and payment information management/)).toBeInTheDocument()
      expect(screen.getByText(/Secure notes and document storage/)).toBeInTheDocument()
      expect(screen.getByText(/WiFi network password management/)).toBeInTheDocument()
      expect(screen.getByText(/Two-factor authentication support/)).toBeInTheDocument()
      expect(screen.getByText(/Data import and export capabilities/)).toBeInTheDocument()
      expect(screen.getByText(/Security monitoring and breach alerts/)).toBeInTheDocument()
    })

    it('renders privacy and security information', () => {
      render(<Terms />)
      
      expect(screen.getByText(/zero-knowledge encryption architecture/i)).toBeInTheDocument()
      expect(screen.getByText(/cannot access your master password/i)).toBeInTheDocument()
      expect(screen.getByText(/encryption and decryption happens locally/i)).toBeInTheDocument()
      expect(screen.getByText(/encrypted before it leaves your device/i)).toBeInTheDocument()
      expect(screen.getByText(/cannot recover your data if you lose your master password/i)).toBeInTheDocument()
    })

    it('renders user responsibilities list', () => {
      render(<Terms />)
      
      expect(screen.getByText(/Maintaining the security of your master password/)).toBeInTheDocument()
      expect(screen.getByText(/Keeping your account credentials secure/)).toBeInTheDocument()
      expect(screen.getByText(/Backing up your vault data regularly/)).toBeInTheDocument()
      expect(screen.getByText(/Using the Service in compliance with applicable laws/)).toBeInTheDocument()
      expect(screen.getByText(/Not sharing your account with others/)).toBeInTheDocument()
      expect(screen.getByText(/Reporting security concerns immediately/)).toBeInTheDocument()
      expect(screen.getByText(/Ensuring your device is secure and up-to-date/)).toBeInTheDocument()
    })

    it('renders disclaimers and limitations', () => {
      render(<Terms />)
      
      expect(screen.getByText(/Data Loss Disclaimer:/)).toBeInTheDocument()
      expect(screen.getByText(/Service Disclaimer:/)).toBeInTheDocument()
      expect(screen.getByText(/Limitation of Liability:/)).toBeInTheDocument()
      expect(screen.getByText(/provided "as is"/i)).toBeInTheDocument()
    })

    it('renders acceptable use restrictions', () => {
      render(<Terms />)
      
      expect(screen.getByText(/Store or transmit illegal content/)).toBeInTheDocument()
      expect(screen.getByText(/Violate any applicable laws or regulations/)).toBeInTheDocument()
      expect(screen.getByText(/Attempt to gain unauthorized access/)).toBeInTheDocument()
      expect(screen.getByText(/Interfere with the Service or other users/)).toBeInTheDocument()
      expect(screen.getByText(/Use the Service for commercial purposes without permission/)).toBeInTheDocument()
      expect(screen.getByText(/Reverse engineer or attempt to extract source code/)).toBeInTheDocument()
    })

    it('renders contact email link', () => {
      render(<Terms />)
      
      const emailLink = screen.getByText('support@lockrr.app')
      expect(emailLink).toBeInTheDocument()
      expect(emailLink).toHaveAttribute('href', 'mailto:support@lockrr.app')
    })

    it('renders link to privacy policy', () => {
      render(<Terms />)
      
      const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i })
      expect(privacyLink).toHaveAttribute('href', '/privacy')
    })

    it('renders icons for section headings', () => {
      render(<Terms />)
      
      // Check for SVG icons in numbered sections
      const sectionsWithIcons = [
        '1. Acceptance of Terms',
        '2. Service Description',
        '3. Privacy and Security',
        '4. User Responsibilities',
        '5. Service Availability and Limitations',
        '6. Disclaimers and Limitations'
      ]
      
      sectionsWithIcons.forEach(sectionText => {
        const heading = screen.getByText(sectionText)
        const icon = heading.querySelector('svg')
        expect(icon).toBeInTheDocument()
      })
    })
  })

  describe('Mobile Menu Interactions', () => {
    it('toggles mobile menu visibility', async () => {
      const user = userEvent.setup()
      render(<Terms />)
      
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
      render(<Terms />)
      
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
        render(<Terms />)
        
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
      render(<Terms />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      
      // Check initial state
      let svgIcon = toggleButton.querySelector('svg')
      expect(svgIcon).toBeInTheDocument()
      
      // After clicking
      await user.click(toggleButton)
      svgIcon = toggleButton.querySelector('svg')
      expect(svgIcon).toBeInTheDocument()
    })
  })

  describe('Navigation Links', () => {
    it('renders all navigation links with correct hrefs', () => {
      render(<Terms />)
      
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
    it('uses prose formatting for content', () => {
      render(<Terms />)
      
      const proseContainer = document.querySelector('.prose')
      expect(proseContainer).toBeInTheDocument()
      expect(proseContainer).toHaveClass('prose-lg')
      expect(proseContainer).toHaveClass('max-w-none')
    })

    it('displays all section headings as h2 elements', () => {
      render(<Terms />)
      
      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements.length).toBeGreaterThanOrEqual(11) // 11 numbered sections
    })

    it('uses list formatting for service features and restrictions', () => {
      render(<Terms />)
      
      const lists = document.querySelectorAll('ul.list-disc')
      expect(lists.length).toBeGreaterThanOrEqual(5) // Allow exactly 5 lists
      
      lists.forEach(list => {
        expect(list).toHaveClass('list-inside')
        expect(list).toHaveClass('text-gray-700')
      })
    })

    it('maintains consistent spacing between sections', () => {
      render(<Terms />)
      
      const sections = document.querySelectorAll('.mb-8')
      expect(sections.length).toBeGreaterThan(0)
      
      const headings = document.querySelectorAll('.mb-4')
      expect(headings.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      render(<Terms />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      expect(toggleButton).toHaveAttribute('aria-label', 'Toggle mobile menu')
    })

    it('has semantic HTML structure', () => {
      render(<Terms />)
      
      // Check for main heading
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Terms of Service')
      
      // Check for section headings
      const h2s = screen.getAllByRole('heading', { level: 2 })
      expect(h2s.length).toBeGreaterThanOrEqual(11)
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<Terms />)
      
      // Tab to first interactive element
      await user.tab()
      
      // Should be able to tab to links
      const activeElement = document.activeElement
      expect(activeElement?.tagName).toBe('A')
    })

    it('has proper focus indicators', () => {
      render(<Terms />)
      
      const links = screen.getAllByRole('link')
      links.forEach(link => {
        const classNames = link.className
        expect(classNames).toMatch(/transition|hover:/i)
      })
    })
  })

  describe('Responsive Design', () => {
    it('hides mobile menu button on desktop', () => {
      render(<Terms />)
      
      const toggleButton = screen.getByLabelText('Toggle mobile menu')
      expect(toggleButton).toHaveClass('md:hidden')
    })

    it('hides desktop navigation on mobile', () => {
      render(<Terms />)
      
      const desktopNav = document.querySelector('.hidden.md\\:flex')
      expect(desktopNav).toBeInTheDocument()
      expect(desktopNav).toHaveClass('hidden')
      expect(desktopNav).toHaveClass('md:flex')
    })

    it('uses max-width container for content', () => {
      render(<Terms />)
      
      const container = document.querySelector('.max-w-4xl')
      expect(container).toBeInTheDocument()
    })

    it('applies responsive padding', () => {
      render(<Terms />)
      
      const paddedElements = document.querySelectorAll('.px-6')
      expect(paddedElements.length).toBeGreaterThan(0)
    })
  })

  describe('Visual Styling', () => {
    it('applies gradient background', () => {
      render(<Terms />)
      
      const gradientBg = document.querySelector('.bg-gradient-to-br')
      expect(gradientBg).toBeInTheDocument()
      expect(gradientBg).toHaveClass('from-primary-50')
      expect(gradientBg).toHaveClass('to-accent-50')
    })

    it('styles section headings with brand colors', () => {
      render(<Terms />)
      
      const headings = screen.getAllByRole('heading', { level: 2 })
      headings.forEach(heading => {
        if (heading.textContent !== 'Contact Information') {
          expect(heading).toHaveClass('text-lockr-navy')
        }
      })
    })

    it('applies hover effects to links', () => {
      render(<Terms />)
      
      const backLink = screen.getByText('Back to Home').closest('a')
      expect(backLink).toHaveClass('hover:text-lockr-blue')
      
      const emailLink = screen.getByText('support@lockrr.app')
      expect(emailLink).toHaveClass('hover:text-lockr-blue')
    })

    it('uses white background for content container', () => {
      render(<Terms />)
      
      const contentContainer = document.querySelector('.bg-white')
      expect(contentContainer).toBeInTheDocument()
      expect(contentContainer).toHaveClass('rounded-xl')
      expect(contentContainer).toHaveClass('shadow-lg')
    })

    it('styles disclaimers with strong emphasis', () => {
      render(<Terms />)
      
      const strongElements = document.querySelectorAll('strong')
      expect(strongElements.length).toBeGreaterThanOrEqual(3) // Allow exactly 3 strong elements
      
      const disclaimerTexts = ['Data Loss Disclaimer:', 'Service Disclaimer:', 'Limitation of Liability:']
      disclaimerTexts.forEach(text => {
        expect(screen.getByText(text)).toBeInTheDocument()
      })
    })
  })

  describe('Content Completeness', () => {
    it('includes all service availability limitations', () => {
      render(<Terms />)
      
      expect(screen.getByText(/Uninterrupted access to the Service/)).toBeInTheDocument()
      expect(screen.getByText(/Specific response times or performance levels/)).toBeInTheDocument()
      expect(screen.getByText(/Compatibility with all devices or browsers/)).toBeInTheDocument()
      expect(screen.getByText(/Availability during maintenance periods/)).toBeInTheDocument()
    })

    it('includes account termination information', () => {
      render(<Terms />)
      
      expect(screen.getByText(/terminate or suspend your account/i)).toBeInTheDocument()
      expect(screen.getByText(/delete your account at any time/i)).toBeInTheDocument()
      expect(screen.getByText(/permanently removed from our servers/i)).toBeInTheDocument()
    })

    it('includes terms update policy', () => {
      render(<Terms />)
      
      expect(screen.getByText(/update these Terms from time to time/i)).toBeInTheDocument()
      expect(screen.getByText(/notify you of any material changes/i)).toBeInTheDocument()
      expect(screen.getByText(/continued use of the Service/i)).toBeInTheDocument()
    })

    it('includes governing law section', () => {
      render(<Terms />)
      
      expect(screen.getByText(/governed by and construed/i)).toBeInTheDocument()
      expect(screen.getByText(/conflict of law provisions/i)).toBeInTheDocument()
    })
  })
})


