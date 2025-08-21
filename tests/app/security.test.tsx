import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Security from '../../src/app/security/page';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('Security Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the security page with all sections', () => {
      render(<Security />);
      
      // Check main heading
      expect(screen.getByRole('heading', { level: 1, name: 'Security' })).toBeInTheDocument();
      expect(screen.getByText(/Learn about Lockrr's security measures/)).toBeInTheDocument();
      
      // Check all security sections
      expect(screen.getByText('Zero-Knowledge Architecture')).toBeInTheDocument();
      expect(screen.getByText('Encryption Standards')).toBeInTheDocument();
      expect(screen.getByText('Security Practices')).toBeInTheDocument();
      expect(screen.getByText('Reporting Security Issues')).toBeInTheDocument();
    });

    it('should render navigation with all links', () => {
      render(<Security />);
      
      // Check for navigation links (multiple instances due to mobile/desktop)
      expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Features').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pricing').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Get Started').length).toBeGreaterThan(0);
    });

    it('should render logo correctly', () => {
      render(<Security />);
      expect(screen.getByText('Lockrr')).toBeInTheDocument();
    });
  });

  describe('Security Content', () => {
    it('should display zero-knowledge architecture information', () => {
      render(<Security />);
      
      expect(screen.getByText(/zero-knowledge architecture/)).toBeInTheDocument();
      expect(screen.getByText(/never have access to your master password/)).toBeInTheDocument();
      expect(screen.getByText(/encryption and decryption happens locally/)).toBeInTheDocument();
    });

    it('should display encryption standards', () => {
      render(<Security />);
      
      expect(screen.getByText(/AES-256 encryption for vault data/)).toBeInTheDocument();
      expect(screen.getByText(/Argon2id for password hashing/)).toBeInTheDocument();
      expect(screen.getByText(/End-to-end encryption for all communications/)).toBeInTheDocument();
      expect(screen.getByText(/Secure random password generation/)).toBeInTheDocument();
    });

    it('should display security practices', () => {
      render(<Security />);
      
      expect(screen.getByText(/Regular security audits and updates/)).toBeInTheDocument();
      expect(screen.getByText(/Open-source code for transparency/)).toBeInTheDocument();
      expect(screen.getByText(/No telemetry or tracking/)).toBeInTheDocument();
      expect(screen.getByText(/Self-hosting options available/)).toBeInTheDocument();
    });

    it('should display security contact information', () => {
      render(<Security />);
      
      expect(screen.getByText(/If you discover a security vulnerability/)).toBeInTheDocument();
      expect(screen.getByText(/security@lockr.app/)).toBeInTheDocument();
    });
  });

  describe('Mobile Menu', () => {
    it('should toggle mobile menu when button is clicked', () => {
      render(<Security />);
      
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
      render(<Security />);
      
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

  describe('Layout and Structure', () => {
    it('should have proper container structure', () => {
      render(<Security />);
      
      const mainContainer = document.querySelector('.bg-gradient-to-br.from-primary-50.to-accent-50');
      expect(mainContainer).toBeInTheDocument();
      
      const contentContainer = document.querySelector('.max-w-4xl.mx-auto');
      expect(contentContainer).toBeInTheDocument();
    });

    it('should have security sections in cards', () => {
      render(<Security />);
      
      const cards = document.querySelectorAll('.bg-white\\/80.backdrop-blur-sm.rounded-xl');
      expect(cards.length).toBe(4); // Four security sections
      
      cards.forEach(card => {
        expect(card).toHaveClass('shadow-lockr-lg', 'border', 'border-gray-200');
      });
    });

    it('should have centered heading section', () => {
      render(<Security />);
      
      const headingSection = document.querySelector('.text-center.max-w-3xl.mx-auto');
      expect(headingSection).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should show desktop navigation on large screens', () => {
      render(<Security />);
      
      const desktopNav = document.querySelector('.hidden.md\\:flex');
      expect(desktopNav).toBeInTheDocument();
    });

    it('should show mobile menu button on small screens', () => {
      render(<Security />);
      
      const mobileMenuButton = screen.getByLabelText('Toggle mobile menu');
      expect(mobileMenuButton).toHaveClass('md:hidden');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<Security />);
      
      const h1 = screen.getByRole('heading', { level: 1, name: 'Security' });
      expect(h1).toBeInTheDocument();
      
      const h2Headings = screen.getAllByRole('heading', { level: 2 });
      expect(h2Headings).toHaveLength(4); // Four security sections
      
      // Check h2 heading texts
      expect(screen.getByRole('heading', { level: 2, name: 'Zero-Knowledge Architecture' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Encryption Standards' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Security Practices' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Reporting Security Issues' })).toBeInTheDocument();
    });

    it('should have aria-label for mobile menu button', () => {
      render(<Security />);
      
      const menuButton = screen.getByLabelText('Toggle mobile menu');
      expect(menuButton).toHaveAttribute('aria-label', 'Toggle mobile menu');
    });

    it('should have proper list structure', () => {
      render(<Security />);
      
      const lists = document.querySelectorAll('.list-disc.list-inside');
      expect(lists).toHaveLength(2); // Two sections with lists
      
      lists.forEach(list => {
        expect(list.tagName).toBe('UL');
        const items = list.querySelectorAll('li');
        expect(items.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Styling and Classes', () => {
    it('should have correct background gradient', () => {
      render(<Security />);
      
      const mainContainer = document.querySelector('.bg-gradient-to-br.from-primary-50.to-accent-50');
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer).toHaveClass('min-h-screen');
    });

    it('should have correct section card styling', () => {
      render(<Security />);
      
      // Find cards that are actually the security section cards (not the nav)
      const cards = document.querySelectorAll('.bg-white\\/80.rounded-xl.shadow-lockr-lg');
      cards.forEach(card => {
        expect(card).toHaveClass('backdrop-blur-sm', 'p-8');
      });
    });

    it('should have correct text styling', () => {
      render(<Security />);
      
      // Check h1 styling
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveClass('text-4xl', 'font-bold', 'text-lockr-navy');
      
      // Check h2 styling
      const h2Headings = screen.getAllByRole('heading', { level: 2 });
      h2Headings.forEach(heading => {
        expect(heading).toHaveClass('text-2xl', 'font-bold', 'text-lockr-navy');
      });
      
      // Check paragraph styling
      const paragraphs = document.querySelectorAll('p.text-gray-600');
      expect(paragraphs.length).toBeGreaterThan(0);
    });

    it('should have correct button styling', () => {
      render(<Security />);
      
      const getStartedButtons = screen.getAllByText('Get Started');
      getStartedButtons.forEach(button => {
        const buttonElement = button.closest('a');
        if (buttonElement?.classList.contains('bg-lockr-navy')) {
          expect(buttonElement).toHaveClass('text-white', 'hover:bg-lockr-blue');
        }
      });
    });

    it('should have correct list styling', () => {
      render(<Security />);
      
      const lists = document.querySelectorAll('.list-disc.list-inside');
      lists.forEach(list => {
        expect(list).toHaveClass('text-gray-600', 'space-y-2');
      });
    });
  });
});