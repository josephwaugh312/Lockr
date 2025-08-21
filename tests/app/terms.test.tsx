import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Terms from '../../src/app/terms/page';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('Terms Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the terms page with all sections', () => {
      render(<Terms />);
      
      // Check main heading and date
      expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
      expect(screen.getByText(/Last updated: December 2024/)).toBeInTheDocument();
      
      // Check section headings
      expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument();
      expect(screen.getByText('2. Service Description')).toBeInTheDocument();
      
      // Check content
      expect(screen.getByText(/By accessing and using Lockrr/)).toBeInTheDocument();
      expect(screen.getByText(/zero-knowledge password manager/)).toBeInTheDocument();
    });

    it('should render back to home link', () => {
      render(<Terms />);
      
      const backLink = screen.getByText('Back to Home');
      expect(backLink).toBeInTheDocument();
      expect(backLink.closest('a')).toHaveAttribute('href', '/');
    });

    it('should render navigation with all links', () => {
      render(<Terms />);
      
      // Check for navigation links (multiple instances due to mobile/desktop)
      expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Features').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pricing').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0);
    });

    it('should render logo correctly', () => {
      render(<Terms />);
      expect(screen.getByText('Lockrr')).toBeInTheDocument();
    });
  });

  describe('Terms Content', () => {
    it('should display acceptance of terms section', () => {
      render(<Terms />);
      
      expect(screen.getByText(/If you do not agree to these Terms/)).toBeInTheDocument();
      expect(screen.getByText(/you must not use the Service/)).toBeInTheDocument();
      expect(screen.getByText(/These Terms apply to all users/)).toBeInTheDocument();
    });

    it('should display service description', () => {
      render(<Terms />);
      
      expect(screen.getByText(/The Service includes:/)).toBeInTheDocument();
      expect(screen.getByText(/Secure password storage and generation/)).toBeInTheDocument();
      expect(screen.getByText(/Credit card and payment information management/)).toBeInTheDocument();
      expect(screen.getByText(/Secure notes and document storage/)).toBeInTheDocument();
      expect(screen.getByText(/WiFi network password management/)).toBeInTheDocument();
    });

    it('should display service features list', () => {
      render(<Terms />);
      
      const serviceFeatures = [
        'Secure password storage and generation',
        'Credit card and payment information management',
        'Secure notes and document storage',
        'WiFi network password management'
      ];
      
      serviceFeatures.forEach(feature => {
        expect(screen.getByText(new RegExp(feature))).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Menu', () => {
    it('should toggle mobile menu when button is clicked', () => {
      render(<Terms />);
      
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
      render(<Terms />);
      
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
      render(<Terms />);
      
      // Check for icon containers next to headings
      const acceptanceHeading = screen.getByText('1. Acceptance of Terms').closest('h2');
      expect(acceptanceHeading).toBeInTheDocument();
      expect(acceptanceHeading).toHaveClass('flex', 'items-center');
      
      const serviceHeading = screen.getByText('2. Service Description').closest('h2');
      expect(serviceHeading).toBeInTheDocument();
      expect(serviceHeading).toHaveClass('flex', 'items-center');
    });

    it('should render back arrow icon', () => {
      render(<Terms />);
      
      const backLink = screen.getByText('Back to Home').closest('a');
      expect(backLink).toHaveClass('inline-flex', 'items-center');
    });
  });

  describe('Layout and Structure', () => {
    it('should have proper container structure', () => {
      render(<Terms />);
      
      const mainContainer = document.querySelector('.bg-gradient-to-br.from-primary-50.to-accent-50');
      expect(mainContainer).toBeInTheDocument();
      
      const contentContainer = document.querySelector('.max-w-4xl.mx-auto');
      expect(contentContainer).toBeInTheDocument();
    });

    it('should have white background for content', () => {
      render(<Terms />);
      
      const contentCard = document.querySelector('.bg-white.rounded-xl.shadow-lg');
      expect(contentCard).toBeInTheDocument();
      expect(contentCard).toHaveClass('p-8');
    });

    it('should have prose styling for content', () => {
      render(<Terms />);
      
      const proseContainer = document.querySelector('.prose.prose-lg');
      expect(proseContainer).toBeInTheDocument();
      expect(proseContainer).toHaveClass('max-w-none');
    });
  });

  describe('Responsive Design', () => {
    it('should show desktop navigation on large screens', () => {
      render(<Terms />);
      
      const desktopNav = document.querySelector('.hidden.md\\:flex');
      expect(desktopNav).toBeInTheDocument();
    });

    it('should show mobile menu button on small screens', () => {
      render(<Terms />);
      
      const mobileMenuButton = screen.getByLabelText('Toggle mobile menu');
      expect(mobileMenuButton).toHaveClass('md:hidden');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<Terms />);
      
      const h1 = screen.getByRole('heading', { level: 1, name: 'Terms of Service' });
      expect(h1).toBeInTheDocument();
      
      const h2Headings = screen.getAllByRole('heading', { level: 2 });
      expect(h2Headings.length).toBeGreaterThan(0);
      
      // Check specific h2 headings
      expect(screen.getByRole('heading', { level: 2, name: /1\. Acceptance of Terms/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /2\. Service Description/ })).toBeInTheDocument();
    });

    it('should have aria-label for mobile menu button', () => {
      render(<Terms />);
      
      const menuButton = screen.getByLabelText('Toggle mobile menu');
      expect(menuButton).toHaveAttribute('aria-label', 'Toggle mobile menu');
    });

    it('should have proper link accessibility', () => {
      render(<Terms />);
      
      const backLink = screen.getByText('Back to Home').closest('a');
      expect(backLink).toHaveAttribute('href', '/');
      
      // Check navigation links
      const homeLinks = screen.getAllByText('Home');
      homeLinks.forEach(link => {
        if (link.tagName === 'A' || link.closest('a')) {
          const anchor = link.tagName === 'A' ? link : link.closest('a');
          expect(anchor).toHaveAttribute('href');
        }
      });
    });

    it('should have proper list structure', () => {
      render(<Terms />);
      
      const lists = document.querySelectorAll('.list-disc.list-inside');
      expect(lists.length).toBeGreaterThan(0);
      
      lists.forEach(list => {
        expect(list.tagName).toBe('UL');
        const items = list.querySelectorAll('li');
        expect(items.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Styling and Classes', () => {
    it('should have correct background gradient', () => {
      render(<Terms />);
      
      const mainContainer = document.querySelector('.bg-gradient-to-br.from-primary-50.to-accent-50');
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer).toHaveClass('min-h-screen');
    });

    it('should have correct text styling', () => {
      render(<Terms />);
      
      // Check h1 styling
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveClass('text-3xl', 'font-bold', 'text-lockr-navy');
      
      // Check h2 styling
      const h2Headings = screen.getAllByRole('heading', { level: 2 });
      h2Headings.forEach(heading => {
        expect(heading).toHaveClass('text-2xl', 'font-semibold', 'text-lockr-navy');
      });
      
      // Check paragraph styling
      const paragraphs = document.querySelectorAll('p.text-gray-700');
      expect(paragraphs.length).toBeGreaterThan(0);
    });

    it('should have correct link styling', () => {
      render(<Terms />);
      
      const backLink = screen.getByText('Back to Home').closest('a');
      expect(backLink).toHaveClass('text-lockr-cyan', 'hover:text-lockr-blue', 'transition-colors');
    });

    it('should have correct button styling', () => {
      render(<Terms />);
      
      const getStartedButtons = screen.getAllByText('Get Started');
      getStartedButtons.forEach(button => {
        const buttonElement = button.closest('a');
        if (buttonElement?.classList.contains('bg-lockr-navy')) {
          expect(buttonElement).toHaveClass('text-white', 'hover:bg-lockr-blue');
        }
      });
    });

    it('should have correct list styling', () => {
      render(<Terms />);
      
      const lists = document.querySelectorAll('.list-disc.list-inside');
      lists.forEach(list => {
        expect(list).toHaveClass('text-gray-700', 'space-y-2');
      });
    });
  });
});