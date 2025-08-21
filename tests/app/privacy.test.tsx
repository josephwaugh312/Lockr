import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Privacy from '../../src/app/privacy/page';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('Privacy Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the privacy page with all sections', () => {
      render(<Privacy />);
      
      // Check main heading and date
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      expect(screen.getByText(/Last updated: December 2024/)).toBeInTheDocument();
      
      // Check zero-knowledge statement
      expect(screen.getByText(/We cannot access your data/)).toBeInTheDocument();
      expect(screen.getByText(/zero-knowledge encryption/)).toBeInTheDocument();
      
      // Check all section headings
      expect(screen.getByText('Information We Collect')).toBeInTheDocument();
      expect(screen.getByText('How We Use Your Information')).toBeInTheDocument();
      expect(screen.getByText('Data Security')).toBeInTheDocument();
      expect(screen.getByText('Data Retention')).toBeInTheDocument();
      expect(screen.getByText('Third-Party Services')).toBeInTheDocument();
      expect(screen.getByText('Your Rights')).toBeInTheDocument();
      expect(screen.getByText('Contact Us')).toBeInTheDocument();
    });

    it('should render back to home link', () => {
      render(<Privacy />);
      
      const backLink = screen.getByText('Back to Home');
      expect(backLink).toBeInTheDocument();
      expect(backLink.closest('a')).toHaveAttribute('href', '/');
    });

    it('should render navigation with all links', () => {
      render(<Privacy />);
      
      // Check for navigation links (multiple instances due to mobile/desktop)
      expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Features').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pricing').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0);
    });

    it('should render logo correctly', () => {
      render(<Privacy />);
      expect(screen.getByText('Lockrr')).toBeInTheDocument();
    });
  });

  describe('Privacy Content', () => {
    it('should display information collection details', () => {
      render(<Privacy />);
      
      expect(screen.getByText(/Email address \(for account creation and communication\)/)).toBeInTheDocument();
      expect(screen.getByText(/Encrypted vault data \(we cannot read this data\)/)).toBeInTheDocument();
      expect(screen.getByText(/Account settings and preferences/)).toBeInTheDocument();
      expect(screen.getByText(/Usage analytics \(anonymized, no personal data\)/)).toBeInTheDocument();
    });

    it('should display data usage information', () => {
      render(<Privacy />);
      
      expect(screen.getByText(/To provide password management services/)).toBeInTheDocument();
      expect(screen.getByText(/To send important security notifications/)).toBeInTheDocument();
      expect(screen.getByText(/To improve our service based on usage patterns/)).toBeInTheDocument();
      expect(screen.getByText(/To respond to support requests/)).toBeInTheDocument();
    });

    it('should display security measures', () => {
      render(<Privacy />);
      
      expect(screen.getByText('Encryption')).toBeInTheDocument();
      expect(screen.getByText(/AES-256 encryption/)).toBeInTheDocument();
      expect(screen.getByText('Security Measures')).toBeInTheDocument();
      expect(screen.getByText(/End-to-end encryption/)).toBeInTheDocument();
      expect(screen.getByText(/Secure HTTPS connections/)).toBeInTheDocument();
      expect(screen.getByText(/Regular security audits/)).toBeInTheDocument();
      expect(screen.getByText(/Access controls and monitoring/)).toBeInTheDocument();
    });

    it('should display user rights', () => {
      render(<Privacy />);
      
      expect(screen.getByText('You can:')).toBeInTheDocument();
      expect(screen.getByText(/Access all your data through the application/)).toBeInTheDocument();
      expect(screen.getByText(/Export your vault data at any time/)).toBeInTheDocument();
      expect(screen.getByText(/Delete your account and all associated data/)).toBeInTheDocument();
      expect(screen.getByText(/Update your account information/)).toBeInTheDocument();
      
      expect(screen.getByText('We cannot:')).toBeInTheDocument();
      expect(screen.getByText(/Access your master password/)).toBeInTheDocument();
      expect(screen.getByText(/Decrypt your vault contents/)).toBeInTheDocument();
      expect(screen.getByText(/See your passwords or sensitive data/)).toBeInTheDocument();
      expect(screen.getByText(/Share your data with third parties/)).toBeInTheDocument();
    });

    it('should display third-party services', () => {
      render(<Privacy />);
      
      expect(screen.getByText(/Cloud hosting providers \(AWS, Google Cloud\)/)).toBeInTheDocument();
      expect(screen.getByText(/Email service providers \(for notifications\)/)).toBeInTheDocument();
      expect(screen.getByText(/Analytics services \(anonymized data only\)/)).toBeInTheDocument();
    });

    it('should display contact email', () => {
      render(<Privacy />);
      
      const emailLink = screen.getByText('privacy@lockrr.app');
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute('href', 'mailto:privacy@lockrr.app');
    });
  });

  describe('Mobile Menu', () => {
    it('should toggle mobile menu when button is clicked', () => {
      render(<Privacy />);
      
      const menuButton = screen.getByLabelText('Toggle mobile menu');
      
      // Find the mobile menu by its unique classes
      const mobileMenus = document.querySelectorAll('.md\\:hidden.absolute.top-full');
      const mobileMenu = mobileMenus[0];
      
      // Initially mobile menu should be hidden
      expect(mobileMenu).toHaveClass('opacity-0', 'invisible');
      
      // Click to open
      fireEvent.click(menuButton);
      expect(mobileMenu).toHaveClass('opacity-100', 'visible');
      
      // Click to close
      fireEvent.click(menuButton);
      expect(mobileMenu).toHaveClass('opacity-0', 'invisible');
    });

    it('should close mobile menu when a link is clicked', () => {
      render(<Privacy />);
      
      const menuButton = screen.getByLabelText('Toggle mobile menu');
      fireEvent.click(menuButton);
      
      // Find a mobile menu link and click it
      const mobileHomeLinks = screen.getAllByText('Home');
      const mobileLink = mobileHomeLinks.find(link => 
        link.classList.contains('block') && link.getAttribute('href') === '/'
      );
      
      if (mobileLink) {
        fireEvent.click(mobileLink);
        
        const mobileMenus = document.querySelectorAll('.md\\:hidden.absolute.top-full');
        const mobileMenu = mobileMenus[0];
        expect(mobileMenu).toHaveClass('opacity-0', 'invisible');
      }
    });
  });

  describe('Icons', () => {
    it('should render section icons', () => {
      render(<Privacy />);
      
      // Check for icon containers next to headings
      const shieldIcon = screen.getByText('Information We Collect').closest('h2');
      expect(shieldIcon).toBeInTheDocument();
      expect(shieldIcon).toHaveClass('flex', 'items-center');
      
      const eyeIcon = screen.getByText('How We Use Your Information').closest('h2');
      expect(eyeIcon).toBeInTheDocument();
      expect(eyeIcon).toHaveClass('flex', 'items-center');
      
      const databaseIcon = screen.getByText('Data Security').closest('h2');
      expect(databaseIcon).toBeInTheDocument();
      expect(databaseIcon).toHaveClass('flex', 'items-center');
    });

    it('should render back arrow icon', () => {
      render(<Privacy />);
      
      const backLink = screen.getByText('Back to Home').closest('a');
      expect(backLink).toHaveClass('inline-flex', 'items-center');
    });
  });

  describe('Responsive Design', () => {
    it('should show desktop navigation on large screens', () => {
      render(<Privacy />);
      
      const desktopNav = document.querySelector('.hidden.md\\:flex');
      expect(desktopNav).toBeInTheDocument();
    });

    it('should show mobile menu button on small screens', () => {
      render(<Privacy />);
      
      const mobileMenuButton = screen.getByLabelText('Toggle mobile menu');
      expect(mobileMenuButton).toHaveClass('md:hidden');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<Privacy />);
      
      const h1 = screen.getByRole('heading', { level: 1, name: 'Privacy Policy' });
      expect(h1).toBeInTheDocument();
      
      const h2Headings = screen.getAllByRole('heading', { level: 2 });
      expect(h2Headings.length).toBeGreaterThan(5); // Multiple h2 sections
      
      const h3Headings = screen.getAllByRole('heading', { level: 3 });
      expect(h3Headings.length).toBeGreaterThan(0); // Sub-sections
    });

    it('should have aria-label for mobile menu button', () => {
      render(<Privacy />);
      
      const menuButton = screen.getByLabelText('Toggle mobile menu');
      expect(menuButton).toHaveAttribute('aria-label', 'Toggle mobile menu');
    });

    it('should have proper link accessibility', () => {
      render(<Privacy />);
      
      const emailLink = screen.getByText('privacy@lockrr.app');
      expect(emailLink).toHaveAttribute('href', 'mailto:privacy@lockrr.app');
      
      const backLink = screen.getByText('Back to Home');
      expect(backLink.closest('a')).toHaveAttribute('href', '/');
    });
  });

  describe('Styling and Classes', () => {
    it('should have correct background gradient', () => {
      render(<Privacy />);
      
      const mainContainer = document.querySelector('.bg-gradient-to-br.from-primary-50.to-accent-50');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should have prose styling for content', () => {
      render(<Privacy />);
      
      const proseContainer = document.querySelector('.prose.prose-lg');
      expect(proseContainer).toBeInTheDocument();
    });

    it('should have correct link styling', () => {
      render(<Privacy />);
      
      const emailLink = screen.getByText('privacy@lockrr.app');
      expect(emailLink).toHaveClass('text-lockr-cyan', 'hover:text-lockr-blue');
      
      const backLink = screen.getByText('Back to Home').closest('a');
      expect(backLink).toHaveClass('text-lockr-cyan', 'hover:text-lockr-blue');
    });

    it('should have correct list styling', () => {
      render(<Privacy />);
      
      const lists = document.querySelectorAll('.list-disc.list-inside');
      expect(lists.length).toBeGreaterThan(0);
      
      lists.forEach(list => {
        expect(list).toHaveClass('text-gray-700');
      });
    });
  });
});