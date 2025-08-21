/** @jest-environment jsdom */
import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CookieConsentBanner from '../../src/components/CookieConsentBanner';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('CookieConsentBanner - Comprehensive Tests', () => {
  let mockLocalStorage: { [key: string]: string };

  beforeEach(() => {
    jest.useFakeTimers();
    
    // Mock localStorage
    mockLocalStorage = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: jest.fn(() => {
          mockLocalStorage = {};
        }),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should not render immediately when no consent is stored', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      // Should not be visible immediately
      expect(screen.queryByText('We use cookies to enhance your experience')).not.toBeInTheDocument();
    });

    it('should show banner after delay when no consent is stored', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      // Advance timers to trigger the banner display
      act(() => {
        jest.advanceTimersByTime(1050);
      });

      expect(screen.getByText('We use cookies to enhance your experience')).toBeInTheDocument();
    });

    it('should not show banner when consent is already stored', () => {
      mockLocalStorage['lockr_cookie_consent'] = 'accepted';
      
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      // Advance timers
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('We use cookies to enhance your experience')).not.toBeInTheDocument();
    });
  });

  describe('User Actions', () => {
    it('should handle accept button click', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const acceptButton = screen.getByText('Accept All');
      fireEvent.click(acceptButton);

      // Advance timers for animation to complete
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onAccept).toHaveBeenCalledTimes(1);
      expect(localStorage.setItem).toHaveBeenCalledWith('lockr_cookie_consent', 'accepted');
      expect(localStorage.setItem).toHaveBeenCalledWith('lockr_cookie_consent_date', expect.any(String));
    });

    it('should handle decline button click', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const declineButton = screen.getByText('Decline');
      fireEvent.click(declineButton);

      // Advance timers for animation to complete
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onDecline).toHaveBeenCalledTimes(1);
      expect(localStorage.setItem).toHaveBeenCalledWith('lockr_cookie_consent', 'declined');
      expect(localStorage.setItem).toHaveBeenCalledWith('lockr_cookie_consent_date', expect.any(String));
    });

    it('should handle customize button click', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const customizeButton = screen.getByText('Customize');
      fireEvent.click(customizeButton);

      // Advance timers for animation to complete
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(onCustomize).toHaveBeenCalledTimes(1);
      // Customize should not set localStorage directly
      expect(localStorage.setItem).not.toHaveBeenCalledWith('lockr_cookie_consent', expect.any(String));
    });

    it('should show/hide cookie details when button is clicked', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      // Initially details should not be visible
      expect(screen.queryByText(/Cookie Types We Use:/)).not.toBeInTheDocument();

      // Click to show details - it's "Show details" not "Learn more"
      const detailsButton = screen.getByText('Show details');
      fireEvent.click(detailsButton);

      // Details should now be visible
      expect(screen.getByText(/Cookie Types We Use:/)).toBeInTheDocument();
      expect(screen.getByText(/Essential:/)).toBeInTheDocument();
      expect(screen.getByText(/Functional:/)).toBeInTheDocument();
      expect(screen.getByText(/Analytics:/)).toBeInTheDocument();

      // Button text should change to "Hide details"
      expect(screen.getByText('Hide details')).toBeInTheDocument();
      
      // Click to hide details
      fireEvent.click(screen.getByText('Hide details'));
      
      // Details should be hidden
      expect(screen.queryByText(/Cookie Types We Use:/)).not.toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('should display all required text content', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      expect(screen.getByText('We use cookies to enhance your experience')).toBeInTheDocument();
      expect(screen.getByText(/We use cookies to provide essential functionality/)).toBeInTheDocument();
      expect(screen.getByText(/By continuing to use our site/)).toBeInTheDocument();
    });

    it('should display all action buttons', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      expect(screen.getByText('Accept All')).toBeInTheDocument();
      expect(screen.getByText('Decline')).toBeInTheDocument();
      expect(screen.getByText('Customize')).toBeInTheDocument();
      expect(screen.getByText('Learn more')).toBeInTheDocument();
    });

    it('should display learn more link', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const learnMoreLink = screen.getByText('Learn more');

      expect(learnMoreLink).toBeInTheDocument();
      expect(learnMoreLink.closest('a')).toHaveAttribute('href', '/cookies');
    });
  });

  describe('Animation and Styling', () => {
    it('should apply correct animation classes', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      const { container } = render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const banner = container.querySelector('.fixed.bottom-0');
      expect(banner).toHaveClass('translate-y-0');
      expect(banner).not.toHaveClass('translate-y-full');
    });

    it('should have correct positioning classes', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      const { container } = render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const banner = container.querySelector('.fixed');
      expect(banner).toHaveClass('bottom-0', 'left-0', 'right-0', 'z-50');
    });

    it('should have correct styling classes', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      const { container } = render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const banner = container.querySelector('.fixed');
      expect(banner).toHaveClass('bg-white', 'border-t', 'border-gray-200', 'shadow-lg');
    });
  });

  describe('Icon Display', () => {
    it('should display cookie icon', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      const { container } = render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const iconContainer = container.querySelector('.bg-lockr-cyan\\/10');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('We use cookies to enhance your experience');
    });

    it('should have accessible buttons', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      buttons.forEach(button => {
        expect(button).toBeVisible();
      });
    });
  });

  describe('LocalStorage Interaction', () => {
    it('should store consent timestamp when accepting', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      act(() => {
        jest.advanceTimersByTime(1050);
      });

      fireEvent.click(screen.getByText('Accept All'));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'lockr_cookie_consent_date', 
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      );
    });

    it('should check localStorage on mount', () => {
      const onAccept = jest.fn();
      const onDecline = jest.fn();
      const onCustomize = jest.fn();

      render(
        <CookieConsentBanner 
          onAccept={onAccept} 
          onDecline={onDecline} 
          onCustomize={onCustomize} 
        />
      );

      expect(localStorage.getItem).toHaveBeenCalledWith('lockr_cookie_consent');
    });
  });
});