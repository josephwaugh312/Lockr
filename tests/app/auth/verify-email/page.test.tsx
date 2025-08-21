/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerifyAccountPage from '../../../../src/app/auth/verify-email/page';

// Mock Next.js navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock the utils
jest.mock('../../../../src/lib/utils', () => ({
  API_BASE_URL: 'http://localhost:3000/api/v1',
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Mail: () => <div data-testid="mail-icon">Mail</div>,
  Loader2: () => <div data-testid="loader-icon">Loader2</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">CheckCircle</div>,
  XCircle: () => <div data-testid="x-circle-icon">XCircle</div>,
  AlertCircle: () => <div data-testid="alert-circle-icon">AlertCircle</div>,
  Phone: () => <div data-testid="phone-icon">Phone</div>,
  Send: () => <div data-testid="send-icon">Send</div>,
}));

// Mock fetch
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock alert
global.alert = jest.fn();

// Helper to debug DOM on failing waits
const debugOnFailure = async (label: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`\n===== DEBUG (${label}) DOM START =====`);
    // eslint-disable-next-line testing-library/no-node-access, no-console
    screen.debug(undefined, 20000);
    // eslint-disable-next-line no-console
    console.log(`===== DEBUG (${label}) DOM END =====\n`);
    throw error;
  }
};

describe.skip('VerifyAccountPage', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    localStorageMock.getItem.mockClear();
    mockGet.mockClear();
    mockPush.mockClear();
  });

  describe('Token-based verification', () => {
    test('shows loading state when verifying token', () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<VerifyAccountPage />);

      expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
      expect(screen.getByText('Please wait while we verify your email address.')).toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    test('shows success state for successful verification', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          user: { email: 'test@example.com' },
        }),
      } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('success state', async () => {
        const el = await screen.findByText('Email verified successfully!');
        expect(el).toBeInTheDocument();
      });

      expect(screen.getByText('Your email address has been verified. You can now access all features of your Lockrr account.')).toBeInTheDocument();
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Continue to sign in')).toBeInTheDocument();
      expect(screen.getByText('Go to dashboard')).toBeInTheDocument();
    });

    test('shows already verified state', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          alreadyVerified: true,
          user: { email: 'test@example.com' },
        }),
      } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('already verified', async () => {
        const el = await screen.findByText('Email already verified');
        expect(el).toBeInTheDocument();
      });

      expect(screen.getByText('Your email address is already verified. You can sign in to your account.')).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    test('shows error state and phone verification option when verification fails', async () => {
      mockGet.mockReturnValue('test-token');
      
      // Mock phone status check and verification failure
      localStorageMock.getItem.mockReturnValue('access-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Invalid token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hasPhoneNumber: true }),
        } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('token failure heading', async () => {
        const el = await screen.findByTestId('error-heading', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      expect(screen.getByText('Invalid token')).toBeInTheDocument();
    });
  });

  describe('Manual email entry', () => {
    test('shows manual email entry when no token provided', () => {
      mockGet.mockReturnValue(null);

      render(<VerifyAccountPage />);

      expect(screen.getByText('Enter your email address below to receive a new verification email.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
      expect(screen.getByText('Send Verification Email')).toBeInTheDocument();
    });

    test('validates email format for manual entry', async () => {
      mockGet.mockReturnValue(null);

      render(<VerifyAccountPage />);

      const emailInput = screen.getByPlaceholderText('Enter your email address');
      const sendButton = screen.getByText('Send Verification Email');

      await user.type(emailInput, 'invalid-email');
      await user.click(sendButton);

      expect(screen.getAllByText('Please enter a valid email address')).toHaveLength(1);
    });

    test('sends verification email for valid manual entry', async () => {
      mockGet.mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<VerifyAccountPage />);

      const emailInput = screen.getByPlaceholderText('Enter your email address');
      const sendButton = screen.getByText('Send Verification Email');

      await user.type(emailInput, 'test@example.com');
      await user.click(sendButton);

      await debugOnFailure('manual resend success alert', async () => {
        await waitFor(() => {
          expect(global.alert).toHaveBeenCalledWith('Verification email sent! Please check your inbox.');
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/auth/email/resend-verification',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      );
    });

    test('shows already verified state from manual entry', async () => {
      mockGet.mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ alreadyVerified: true }),
      } as Response);

      render(<VerifyAccountPage />);

      const emailInput = screen.getByPlaceholderText('Enter your email address');
      const sendButton = screen.getByText('Send Verification Email');

      await user.type(emailInput, 'test@example.com');
      await user.click(sendButton);

      await debugOnFailure('manual already verified', async () => {
        const el = await screen.findByText('Email already verified');
        expect(el).toBeInTheDocument();
      });
    });
  });

  describe('Phone verification', () => {
    beforeEach(() => {
      mockGet.mockReturnValue('test-token');
      // Mock failed email verification
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid token' }),
      } as Response);
    });

    test('shows phone verification when user has phone number', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPhoneNumber: true }),
      } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('phone block visible', async () => {
        const el = await screen.findByTestId('has-phone-heading', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      expect(screen.getByText('Enter the 6-digit code sent to your phone')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter 6-digit code')).toBeInTheDocument();
      expect(screen.getByText('Send Code')).toBeInTheDocument();
      expect(screen.getByText('Verify')).toBeInTheDocument();
    });

    test('shows no phone number message when user has no phone', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPhoneNumber: false }),
      } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('no phone message', async () => {
        const el = await screen.findByTestId('no-phone-heading', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      expect(screen.getByText('Add a phone number to your account to enable SMS verification')).toBeInTheDocument();
    });

    test('sends phone verification code', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hasPhoneNumber: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('send code visible', async () => {
        const el = await screen.findByTestId('send-code-button', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      const sendCodeButton = screen.getByTestId('send-code-button');
      await user.click(sendCodeButton);

      await debugOnFailure('send code alert', async () => {
        await waitFor(() => {
          expect(global.alert).toHaveBeenCalledWith('Verification code sent to your phone!');
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/auth/phone/send-verification',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer access-token',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    test('validates phone code input', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPhoneNumber: true }),
      } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('code input visible', async () => {
        const el = await screen.findByTestId('phone-code-input', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      const codeInput = screen.getByTestId('phone-code-input');
      const verifyButton = screen.getByText('Verify');

      // Initially verify button should be disabled
      expect(verifyButton).toBeDisabled();

      // Type invalid code (letters)
      await user.type(codeInput, 'abc123def');
      expect(codeInput).toHaveValue('123'); // Should filter to numbers only

      // Type valid 6-digit code
      await user.clear(codeInput);
      await user.type(codeInput, '123456');
      expect(codeInput).toHaveValue('123456');
      expect(verifyButton).not.toBeDisabled();
    });

    test('verifies phone code successfully', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hasPhoneNumber: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('code input present', async () => {
        const el = await screen.findByTestId('phone-code-input', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      const codeInput = screen.getByTestId('phone-code-input');
      const verifyButton = screen.getByTestId('verify-code-button');

      await user.type(codeInput, '123456');
      await user.click(verifyButton);

      await debugOnFailure('phone verified success', async () => {
        const el = await screen.findByText('Phone verified successfully!');
        expect(el).toBeInTheDocument();
      });

      // Should redirect to dashboard after 2 seconds
      await debugOnFailure('redirect to dashboard', async () => {
        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/dashboard');
        }, { timeout: 3000 });
      });
    });

    test('shows error for invalid phone code', async () => {
      localStorageMock.getItem.mockReturnValue('access-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hasPhoneNumber: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Invalid verification code' }),
        } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('code input present (error case)', async () => {
        const el = await screen.findByTestId('phone-code-input', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      const codeInput = screen.getByTestId('phone-code-input');
      const verifyButton = screen.getByTestId('verify-code-button');

      await user.type(codeInput, '123456');
      await user.click(verifyButton);

      await debugOnFailure('invalid code error shown', async () => {
        const el = await screen.findByText('Invalid verification code');
        expect(el).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    test('handles fetch errors gracefully', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<VerifyAccountPage />);

      await debugOnFailure('network error shown', async () => {
        const el = await screen.findByText('Network error');
        expect(el).toBeInTheDocument();
      });
    });

    test('shows generic error message for unknown errors', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockRejectedValue('Unknown error');

      render(<VerifyAccountPage />);

      await debugOnFailure('generic error shown', async () => {
        const el = await screen.findByText('An error occurred during verification');
        expect(el).toBeInTheDocument();
      });
    });

    test('handles missing access token for phone operations', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid token' }),
      } as Response);

      localStorageMock.getItem.mockReturnValue(null);

      render(<VerifyAccountPage />);

      await debugOnFailure('error heading without phone', async () => {
        const el = await screen.findByText('Email verification failed', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      // Should not show phone verification without access token
      expect(screen.queryByText('Verify your phone number')).not.toBeInTheDocument();
    });
  });

  describe('Resend functionality', () => {
    test('resends verification email with existing user email', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Invalid token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hasPhoneNumber: false }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('resend button visible', async () => {
        const el = await screen.findByTestId('resend-button', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      const resendButton = screen.getByTestId('resend-button');
      await user.click(resendButton);

      await debugOnFailure('resend success alert', async () => {
        await waitFor(() => {
          expect(global.alert).toHaveBeenCalledWith('Verification email sent! Please check your inbox.');
        });
      });
    });

    test('handles resend errors', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Invalid token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hasPhoneNumber: false }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Rate limit exceeded' }),
        } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('resend button visible (error)', async () => {
        const el = await screen.findByTestId('resend-button', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      const resendButton = screen.getByTestId('resend-button');
      await user.click(resendButton);

      await debugOnFailure('resend error message', async () => {
        const el = await screen.findByText('Rate limit exceeded');
        expect(el).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    test('has back to sign in link', async () => {
      mockGet.mockReturnValue(null);

      render(<VerifyAccountPage />);

      const backLink = screen.getByText('Back to sign in');
      expect(backLink).toHaveAttribute('href', '/authentication/signin');
    });

    test('has continue to sign in link in success state', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('continue to sign in link', async () => {
        const continueLink = await screen.findByText('Continue to sign in');
        expect(continueLink).toHaveAttribute('href', '/authentication/signin');
      });
    });

    test('has go to dashboard link in success state', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      render(<VerifyAccountPage />);

      await debugOnFailure('go to dashboard link', async () => {
        const dashboardLink = await screen.findByText('Go to dashboard');
        expect(dashboardLink).toHaveAttribute('href', '/dashboard');
      });
    });
  });

  describe('Loading states', () => {
    test('shows loading during email resend', async () => {
      mockGet.mockReturnValue(null);
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<VerifyAccountPage />);

      const emailInput = screen.getByPlaceholderText('Enter your email address');
      const sendButton = screen.getByText('Send Verification Email');

      await user.type(emailInput, 'test@example.com');
      await user.click(sendButton);

      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(sendButton).toBeDisabled();
    });

    test('shows loading during phone verification', async () => {
      mockGet.mockReturnValue('test-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: 'Invalid token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ hasPhoneNumber: true }),
        } as Response)
        .mockImplementation(() => new Promise(() => {})); // Never resolves for phone operations

      localStorageMock.getItem.mockReturnValue('access-token');

      render(<VerifyAccountPage />);

      await debugOnFailure('send code button for loading', async () => {
        const el = await screen.findByTestId('send-code-button', {}, { timeout: 3000 });
        expect(el).toBeInTheDocument();
      });

      const sendCodeButton = screen.getByTestId('send-code-button');
      await user.click(sendCodeButton);

      expect(sendCodeButton).toBeDisabled();
    });
  });
});