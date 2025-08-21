import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Contact from '../../src/app/contact/page';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('Contact Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the contact page with all sections', () => {
      render(<Contact />);
      
      // Check main heading
      expect(screen.getByText('Contact Us')).toBeInTheDocument();
      expect(screen.getByText(/Get in touch with the Lockrr team/)).toBeInTheDocument();
      
      // Check form section
      expect(screen.getByText('Send us a message')).toBeInTheDocument();
      expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument();
      
      // Check contact info section
      expect(screen.getByText('General Inquiries')).toBeInTheDocument();
      expect(screen.getByText('contact@lockrr.app →')).toBeInTheDocument();
    });

    it('should render navigation with all links', () => {
      render(<Contact />);
      
      // Desktop navigation links
      const homeLinks = screen.getAllByText('Home');
      expect(homeLinks.length).toBeGreaterThan(0);
      
      const featureLinks = screen.getAllByText('Features');
      expect(featureLinks.length).toBeGreaterThan(0);
      
      const securityLinks = screen.getAllByText('Security');
      expect(securityLinks.length).toBeGreaterThan(0);
      
      const pricingLinks = screen.getAllByText('Pricing');
      expect(pricingLinks.length).toBeGreaterThan(0);
      
      const signInLinks = screen.getAllByText('Sign In');
      expect(signInLinks.length).toBeGreaterThan(0);
      
      const getStartedLinks = screen.getAllByText('Get Started');
      expect(getStartedLinks.length).toBeGreaterThan(0);
    });

    it('should render logo correctly', () => {
      render(<Contact />);
      expect(screen.getByText('Lockrr')).toBeInTheDocument();
    });
  });

  describe('Mobile Menu', () => {
    it('should toggle mobile menu when button is clicked', () => {
      render(<Contact />);
      
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
      render(<Contact />);
      
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

  describe('Contact Form', () => {
    it('should render all form fields', () => {
      render(<Contact />);
      
      const nameInput = screen.getByLabelText('Your Name') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;
      const messageInput = screen.getByLabelText('Message') as HTMLTextAreaElement;
      
      expect(nameInput).toBeInTheDocument();
      expect(nameInput.type).toBe('text');
      expect(nameInput.placeholder).toBe('Enter your name');
      
      expect(emailInput).toBeInTheDocument();
      expect(emailInput.type).toBe('email');
      expect(emailInput.placeholder).toBe('Enter your email');
      
      expect(messageInput).toBeInTheDocument();
      expect(messageInput.placeholder).toBe('How can we help you?');
      expect(messageInput.rows).toBe(6);
    });

    it('should handle form input changes', () => {
      render(<Contact />);
      
      const nameInput = screen.getByLabelText('Your Name') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;
      const messageInput = screen.getByLabelText('Message') as HTMLTextAreaElement;
      
      fireEvent.change(nameInput, { target: { value: 'John Doe' } });
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
      fireEvent.change(messageInput, { target: { value: 'Test message' } });
      
      expect(nameInput.value).toBe('John Doe');
      expect(emailInput.value).toBe('john@example.com');
      expect(messageInput.value).toBe('Test message');
    });

    it('should handle form submission', () => {
      render(<Contact />);
      
      const form = screen.getByRole('button', { name: 'Send Message' }).closest('form');
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      
      // Create a mock event handler
      const handleSubmit = jest.fn((e) => e.preventDefault());
      form?.addEventListener('submit', handleSubmit);
      
      fireEvent.click(submitButton);
      
      // The form should attempt to submit
      expect(handleSubmit).toHaveBeenCalled();
    });
  });

  describe('Contact Information', () => {
    it('should render contact email with correct href', () => {
      render(<Contact />);
      
      const emailLink = screen.getByText('contact@lockrr.app →');
      expect(emailLink).toHaveAttribute('href', 'mailto:contact@lockrr.app');
    });

    it('should have correct styling on email link hover', () => {
      render(<Contact />);
      
      const emailLink = screen.getByText('contact@lockrr.app →');
      expect(emailLink).toHaveClass('text-lockr-cyan', 'hover:text-lockr-blue');
    });
  });

  describe('Responsive Design', () => {
    it('should show desktop navigation on large screens', () => {
      render(<Contact />);
      
      const desktopNav = document.querySelector('.hidden.md\\:flex');
      expect(desktopNav).toBeInTheDocument();
    });

    it('should show mobile menu button on small screens', () => {
      render(<Contact />);
      
      const mobileMenuButton = screen.getByLabelText('Toggle mobile menu');
      expect(mobileMenuButton).toHaveClass('md:hidden');
    });

    it('should have responsive grid for contact sections', () => {
      render(<Contact />);
      
      const gridContainer = document.querySelector('.grid.md\\:grid-cols-2');
      expect(gridContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<Contact />);
      
      expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
    });

    it('should have aria-label for mobile menu button', () => {
      render(<Contact />);
      
      const menuButton = screen.getByLabelText('Toggle mobile menu');
      expect(menuButton).toHaveAttribute('aria-label', 'Toggle mobile menu');
    });

    it('should have proper heading hierarchy', () => {
      render(<Contact />);
      
      const h1 = screen.getByRole('heading', { level: 1, name: 'Contact Us' });
      const h2 = screen.getByRole('heading', { level: 2, name: 'Send us a message' });
      const h3 = screen.getByRole('heading', { level: 3, name: 'General Inquiries' });
      
      expect(h1).toBeInTheDocument();
      expect(h2).toBeInTheDocument();
      expect(h3).toBeInTheDocument();
    });
  });

  describe('Styling and Classes', () => {
    it('should have correct background gradient', () => {
      render(<Contact />);
      
      const mainContainer = document.querySelector('.bg-gradient-to-br.from-primary-50.to-accent-50');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should have correct button styling', () => {
      render(<Contact />);
      
      const submitButton = screen.getByRole('button', { name: 'Send Message' });
      expect(submitButton).toHaveClass('bg-lockr-navy', 'text-white', 'hover:bg-lockr-blue');
    });

    it('should have correct form field styling', () => {
      render(<Contact />);
      
      const nameInput = screen.getByLabelText('Your Name');
      expect(nameInput).toHaveClass('focus:ring-lockr-cyan');
    });
  });
});