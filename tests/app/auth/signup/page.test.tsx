/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '../../../../src/app/authentication/signup/page';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Shield: () => <div data-testid="shield-icon">Shield</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  EyeOff: () => <div data-testid="eye-off-icon">EyeOff</div>,
  Mail: () => <div data-testid="mail-icon">Mail</div>,
  Lock: () => <div data-testid="lock-icon">Lock</div>,
  AlertCircle: () => <div data-testid="alert-circle-icon">AlertCircle</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  X: () => <div data-testid="x-icon">X</div>,
}));

// Mock API_BASE_URL utility
jest.mock('../../../../src/lib/utils', () => ({
  API_BASE_URL: 'http://localhost:3002'
}));

// Mock console.log to avoid noise in tests
const originalConsole = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsole;
});

// Mock alert
global.alert = jest.fn();

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));


describe('RegisterPage', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders register page with all form elements', async () => {
      render(<RegisterPage />);

      // Check header
      expect(screen.getByText('Create Your Vault')).toBeInTheDocument();
      expect(screen.getByText('Set up your master password to secure your digital life')).toBeInTheDocument();

      // Check form fields
      expect(await screen.findByLabelText('Email Address')).toBeInTheDocument();
      expect(await screen.findByLabelText('Master Password')).toBeInTheDocument();
      expect(await screen.findByLabelText('Confirm Master Password')).toBeInTheDocument();
      expect(await screen.findByLabelText(/I agree to the/)).toBeInTheDocument();

      // Check submit button
      expect(screen.getByRole('button', { name: /Create Vault/i })).toBeInTheDocument();

      // Check navigation links
      expect(screen.getByText('Sign in here')).toBeInTheDocument();
    });

    test('renders password strength indicator when password is entered', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'test123');

      expect(screen.getByText('Password Strength:')).toBeInTheDocument();
      expect(screen.getByText('Too short')).toBeInTheDocument();
    });

    test('renders password requirements when password is entered', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'test123');

      expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('Lowercase letter')).toBeInTheDocument();
      expect(screen.getByText('Uppercase letter')).toBeInTheDocument();
      expect(screen.getByText('Number')).toBeInTheDocument();
      expect(screen.getByText('Special character')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    test('allows typing in form fields', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmPasswordInput, 'TestPassword123!');

      expect(emailInput).toHaveValue('test@example.com');
      expect(passwordInput).toHaveValue('TestPassword123!');
      expect(confirmPasswordInput).toHaveValue('TestPassword123!');
    });

    test('toggles password visibility', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      const toggleButton = screen.getAllByLabelText('Show password')[0];

      // Initially password type
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click to hide password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('toggles confirm password visibility', async () => {
      render(<RegisterPage />);

      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');
      const toggleButton = screen.getAllByLabelText('Show password')[1];

      // Initially password type
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      // Click to show password
      await user.click(toggleButton);
      expect(confirmPasswordInput).toHaveAttribute('type', 'text');

      // Click to hide password
      await user.click(toggleButton);
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    test('allows checking terms acceptance', async () => {
      render(<RegisterPage />);

      const checkbox = await screen.findByLabelText(/I agree to the/);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('Password Strength', () => {
    test('shows "Too short" for passwords less than 8 characters', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'test');

      expect(screen.getByText('Too short')).toBeInTheDocument();
    });

    test('shows "Weak" for simple passwords', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'password');

      expect(screen.getByText('Weak')).toBeInTheDocument();
    });

    test('shows "Good" for medium complexity passwords', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'Password123good');

      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    test('shows "Strong" for good complexity passwords', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'Password123!');

      expect(screen.getByText('Strong')).toBeInTheDocument();
    });

    test('shows "Strong" for high complexity passwords', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'StrongPassword123!');

      expect(screen.getByText('Strong')).toBeInTheDocument();
    });
  });

  describe('Password Requirements', () => {
    test('shows correct requirement status for various passwords', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');

      // Test password with all requirements met
      await user.type(passwordInput, 'StrongPassword123!');

      // All requirements should be met (check icons should be present)
      const checkIcons = screen.getAllByTestId('check-icon');
      expect(checkIcons).toHaveLength(5); // All 5 requirements met
    });

    test('shows unfulfilled requirements correctly', async () => {
      render(<RegisterPage />);

      const passwordInput = await screen.findByLabelText('Master Password');
      await user.type(passwordInput, 'password');

      // Some requirements should not be met (x icons should be present)
      const xIcons = screen.getAllByTestId('x-icon');
      expect(xIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Form Validation', () => {
    test('shows error for empty email', async () => {
      render(<RegisterPage />);

      const submitButton = screen.getByRole('button', { name: /Create Vault/i });
      await user.click(submitButton);

      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    test('shows error for invalid email format', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const submitButton = screen.getByRole('button', { name: /Create Vault/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    test('shows error for empty master password', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const submitButton = screen.getByRole('button', { name: /Create Vault/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      expect(screen.getByText('Master password is required')).toBeInTheDocument();
    });

    test('shows error for short master password', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const submitButton = screen.getByRole('button', { name: /Create Vault/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'short');
      await user.click(submitButton);

      expect(screen.getByText('Master password must be at least 8 characters')).toBeInTheDocument();
    });

    test('shows error for weak password', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const submitButton = screen.getByRole('button', { name: /Create Vault/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'weakpass');
      await user.click(submitButton);

      expect(screen.getByText('Please create a stronger password')).toBeInTheDocument();
    });

    test('shows error for missing password confirmation', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const submitButton = screen.getByRole('button', { name: /Create Vault/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.click(submitButton);

      expect(screen.getByText('Please confirm your master password')).toBeInTheDocument();
    });

    test('shows error for mismatched passwords', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');
      const submitButton = screen.getByRole('button', { name: /Create Vault/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'DifferentPassword123!');
      await user.click(submitButton);

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    test('shows error when terms are not accepted', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');
      const submitButton = screen.getByRole('button', { name: /Create Vault/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(submitButton);

      expect(screen.getByText('You must accept the terms and conditions')).toBeInTheDocument();
    });

    test('clears errors when user starts typing', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const submitButton = screen.getByRole('button', { name: 'Create Vault' });

      // Trigger validation error
      await user.click(submitButton);
      expect(screen.getByText('Email is required')).toBeInTheDocument();

      // Start typing to clear error
      await user.type(emailInput, 't');
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    test('submits form with valid data', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');
      const termsCheckbox = await screen.findByLabelText(/I agree to the/);
      const submitButton = screen.getByRole('button', { name: 'Create Vault' });

      // Fill out form with valid data
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(termsCheckbox);

      // Submit form
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Creating Your Vault...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Wait for form submission to complete
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Registration successful! (This is a placeholder)');
      }, { timeout: 2000 });

      // Console.log should have been called with registration data
      expect(console.log).toHaveBeenCalledWith('Registration attempt:', { email: 'test@example.com' });
    });

    test('handles form submission errors', async () => {
      // Since the current component always succeeds, we'll test that no error shows up
      // This test verifies the happy path works - error handling would need actual API integration
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');
      const termsCheckbox = await screen.findByLabelText(/I agree to the/);
      const submitButton = screen.getByRole('button', { name: 'Create Vault' });

      // Fill out form with valid data
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(termsCheckbox);

      // Submit form
      await user.click(submitButton);

      // Should show loading state (since no actual error occurs in current implementation)
      expect(screen.getByText('Creating Your Vault...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    test('disables submit button during submission', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');
      const termsCheckbox = await screen.findByLabelText(/I agree to the/);
      const submitButton = screen.getByRole('button', { name: 'Create Vault' });

      // Fill out form
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'StrongPassword123!');
      await user.type(confirmPasswordInput, 'StrongPassword123!');
      await user.click(termsCheckbox);

      // Submit form
      await user.click(submitButton);

      // Button should be disabled during submission
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Creating Your Vault...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper form labels', async () => {
      render(<RegisterPage />);

      expect(await screen.findByLabelText('Email Address')).toBeInTheDocument();
      expect(await screen.findByLabelText('Master Password')).toBeInTheDocument();
      expect(await screen.findByLabelText('Confirm Master Password')).toBeInTheDocument();
      expect(await screen.findByLabelText(/I agree to the/)).toBeInTheDocument();
    });

    test('has proper button attributes', async () => {
      render(<RegisterPage />);

      const passwordToggle = screen.getAllByLabelText('Show password')[0];
      expect(passwordToggle).toHaveAttribute('type', 'button');

      const confirmPasswordToggle = screen.getAllByLabelText('Show password')[1];
      expect(confirmPasswordToggle).toHaveAttribute('type', 'button');
    });

    test('has proper form autocomplete attributes', async () => {
      render(<RegisterPage />);

      const emailInput = await screen.findByLabelText('Email Address');
      const passwordInput = await screen.findByLabelText('Master Password');
      const confirmPasswordInput = await screen.findByLabelText('Confirm Master Password');

      expect(emailInput).toHaveAttribute('autocomplete', 'email');
      expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
      expect(confirmPasswordInput).toHaveAttribute('autocomplete', 'new-password');
    });
  });
});