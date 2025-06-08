import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import SignInPage from '../page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}));

// Mock the API_BASE_URL
jest.mock('../../../../lib/utils', () => ({
  API_BASE_URL: 'http://localhost:3002/api/v1'
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('SignInPage', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (global.fetch as jest.Mock).mockClear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  describe('Form Rendering', () => {
    test('should render login form initially', async () => {
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /unlock vault/i })).toBeInTheDocument();
      });
    });

    test('should show password visibility toggle', async () => {
      render(<SignInPage />);

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/password/i);
        expect(passwordInput).toHaveAttribute('type', 'password');
      });

      // Find the password visibility toggle button more specifically
      const passwordField = screen.getByLabelText(/password/i).parentElement;
      const toggleButton = passwordField!.querySelector('button[type="button"]') as HTMLButtonElement;
      expect(toggleButton).toBeInTheDocument();
      
      await userEvent.setup().click(toggleButton);

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/password/i);
        expect(passwordInput).toHaveAttribute('type', 'text');
      });
    });
  });

  describe('Form Validation', () => {
    test('should show validation errors for empty form', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /unlock vault/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /unlock vault/i }));

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Master password is required')).toBeInTheDocument();
      });
    });

    test('should validate password length', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'short');
      await user.click(screen.getByRole('button', { name: /unlock vault/i }));

      await waitFor(() => {
        expect(screen.getByText('Master password must be at least 8 characters')).toBeInTheDocument();
      });
    });
  });

  describe('Successful Login', () => {
    test('should login successfully without 2FA', async () => {
      const mockLoginResponse = {
        message: 'Login successful',
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLoginResponse)
      });

      const user = userEvent.setup();
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /unlock vault/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3002/api/v1/auth/login',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'password123'
            })
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('should show error for failed login', async () => {
      const mockErrorResponse = {
        error: 'Invalid credentials'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const user = userEvent.setup();
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /unlock vault/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /unlock vault/i }));

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper form labels', async () => {
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/master password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/remember this device/i)).toBeInTheDocument();
      });
    });

    test('should have proper button text', async () => {
      render(<SignInPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /unlock vault/i })).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    test('should have correct navigation links', async () => {
      render(<SignInPage />);

      expect(screen.getByRole('link', { name: /lockr/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /forgot your master password/i })).toHaveAttribute('href', '/forgot-password');
      expect(screen.getByRole('link', { name: /create one here/i })).toHaveAttribute('href', '/authentication/signup');
    });
  });
}); 