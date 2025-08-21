/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import GDPRConsent from '../../src/components/GDPRConsent';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('GDPRConsent - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the consent checkbox and label', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const checkbox = screen.getByRole('checkbox', { name: /I consent to the processing/i });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toBeRequired();
    });

    it('should render Privacy Policy and Cookie Policy links', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
      const cookieLink = screen.getByRole('link', { name: 'Cookie Policy' });
      
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).toHaveAttribute('href', '/privacy');
      
      expect(cookieLink).toBeInTheDocument();
      expect(cookieLink).toHaveAttribute('href', '/cookies');
    });

    it('should render Show details button', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const detailsButton = screen.getByRole('button', { name: 'Show details' });
      expect(detailsButton).toBeInTheDocument();
    });

    it('should not render details initially', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      expect(screen.queryByText('Your GDPR Rights')).not.toBeInTheDocument();
      expect(screen.queryByText('Zero-Knowledge Architecture')).not.toBeInTheDocument();
    });
  });

  describe('Checkbox Interaction', () => {
    it('should call onConsentChange when checkbox is checked', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const checkbox = screen.getByRole('checkbox', { name: /I consent to the processing/i });
      fireEvent.click(checkbox);
      
      expect(onConsentChange).toHaveBeenCalledTimes(1);
      expect(onConsentChange).toHaveBeenCalledWith(true);
      expect(checkbox).toBeChecked();
    });

    it('should call onConsentChange when checkbox is unchecked', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const checkbox = screen.getByRole('checkbox', { name: /I consent to the processing/i });
      
      // Check then uncheck
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      
      expect(onConsentChange).toHaveBeenCalledTimes(2);
      expect(onConsentChange).toHaveBeenNthCalledWith(1, true);
      expect(onConsentChange).toHaveBeenNthCalledWith(2, false);
      expect(checkbox).not.toBeChecked();
    });

    it('should be required by default', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const checkbox = screen.getByRole('checkbox', { name: /I consent to the processing/i });
      expect(checkbox).toBeRequired();
    });

    it('should not be required when required prop is false', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} required={false} />);
      
      const checkbox = screen.getByRole('checkbox', { name: /I consent to the processing/i });
      expect(checkbox).not.toBeRequired();
    });
  });

  describe('Details Toggle', () => {
    it('should show details when Show details button is clicked', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const detailsButton = screen.getByRole('button', { name: 'Show details' });
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('Your GDPR Rights')).toBeInTheDocument();
      expect(screen.getByText('Zero-Knowledge Architecture')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hide details' })).toBeInTheDocument();
    });

    it('should hide details when Hide details button is clicked', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      // Show details first
      const showButton = screen.getByRole('button', { name: 'Show details' });
      fireEvent.click(showButton);
      
      // Then hide them
      const hideButton = screen.getByRole('button', { name: 'Hide details' });
      fireEvent.click(hideButton);
      
      expect(screen.queryByText('Your GDPR Rights')).not.toBeInTheDocument();
      expect(screen.queryByText('Zero-Knowledge Architecture')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show details' })).toBeInTheDocument();
    });

    it('should toggle details multiple times', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const button = screen.getByRole('button', { name: 'Show details' });
      
      // Show
      fireEvent.click(button);
      expect(screen.getByText('Your GDPR Rights')).toBeInTheDocument();
      
      // Hide
      fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));
      expect(screen.queryByText('Your GDPR Rights')).not.toBeInTheDocument();
      
      // Show again
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      expect(screen.getByText('Your GDPR Rights')).toBeInTheDocument();
    });
  });

  describe('GDPR Rights Content', () => {
    it('should display all GDPR rights when details are shown', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      const rights = [
        'Access your personal data',
        'Correct inaccurate data',
        'Request deletion of your data',
        'Export your data',
        'Withdraw consent at any time',
        'Lodge a complaint with supervisory authorities'
      ];
      
      rights.forEach(right => {
        expect(screen.getByText(right)).toBeInTheDocument();
      });
    });

    it('should display GDPR heading and introduction', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      expect(screen.getByText('Your GDPR Rights')).toBeInTheDocument();
      expect(screen.getByText('Under GDPR, you have the right to:')).toBeInTheDocument();
    });

    it('should display zero-knowledge architecture information', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      expect(screen.getByText('Zero-Knowledge Architecture')).toBeInTheDocument();
      expect(screen.getByText(/Lockrr uses zero-knowledge encryption/)).toBeInTheDocument();
      expect(screen.getByText(/All encryption happens locally on your device/)).toBeInTheDocument();
    });
  });

  describe('Styling and Classes', () => {
    it('should have correct checkbox styling', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const checkbox = screen.getByRole('checkbox', { name: /I consent to the processing/i });
      expect(checkbox).toHaveClass('text-lockr-cyan', 'focus:ring-lockr-cyan', 'border-gray-300', 'rounded');
    });

    it('should have correct link styling', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
      const cookieLink = screen.getByRole('link', { name: 'Cookie Policy' });
      
      expect(privacyLink).toHaveClass('text-lockr-cyan', 'hover:text-lockr-blue', 'font-medium');
      expect(cookieLink).toHaveClass('text-lockr-cyan', 'hover:text-lockr-blue', 'font-medium');
    });

    it('should have correct details button styling', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const detailsButton = screen.getByRole('button', { name: 'Show details' });
      expect(detailsButton).toHaveClass('text-xs', 'text-lockr-cyan', 'hover:text-lockr-blue');
    });

    it('should have correct details container styling', () => {
      const onConsentChange = jest.fn();
      const { container } = render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      const detailsContainer = container.querySelector('.bg-blue-50');
      expect(detailsContainer).toBeInTheDocument();
      expect(detailsContainer).toHaveClass('border', 'border-blue-200', 'rounded-lg', 'p-4');
    });
  });

  describe('Icons', () => {
    it('should display Shield icon in GDPR rights section', () => {
      const onConsentChange = jest.fn();
      const { container } = render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      // Check for Shield icon container
      const shieldContainer = container.querySelector('.text-blue-600');
      expect(shieldContainer).toBeInTheDocument();
    });

    it('should display CheckCircle icon in zero-knowledge section', () => {
      const onConsentChange = jest.fn();
      const { container } = render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      // Check for CheckCircle icon container
      const checkCircleContainer = container.querySelector('.text-green-600');
      expect(checkCircleContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper label association', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'gdpr-consent');
      
      const label = screen.getByLabelText(/I consent to the processing/i);
      expect(label).toBe(checkbox);
    });

    it('should have accessible button', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const button = screen.getByRole('button', { name: 'Show details' });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have proper heading hierarchy in details', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      // h4 headings in details section
      const headings = screen.getAllByRole('heading', { level: 4 });
      expect(headings).toHaveLength(2);
      expect(headings[0]).toHaveTextContent('Your GDPR Rights');
      expect(headings[1]).toHaveTextContent('Zero-Knowledge Architecture');
    });

    it('should maintain focus after toggling details', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const button = screen.getByRole('button', { name: 'Show details' });
      button.focus();
      
      fireEvent.click(button);
      
      // Button text changes but element should still be focused
      const hideButton = screen.getByRole('button', { name: 'Hide details' });
      expect(hideButton).toHaveFocus();
    });
  });

  describe('Layout', () => {
    it('should have proper spacing classes', () => {
      const onConsentChange = jest.fn();
      const { container } = render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      const mainContainer = container.querySelector('.space-y-4');
      expect(mainContainer).toBeInTheDocument();
      
      const flexContainer = container.querySelector('.flex.items-start.space-x-3');
      expect(flexContainer).toBeInTheDocument();
    });

    it('should render list items as unordered list', () => {
      const onConsentChange = jest.fn();
      render(<GDPRConsent onConsentChange={onConsentChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
      
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass('list-disc', 'list-inside');
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(6);
    });
  });
});