import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TwoFactorModal from '../TwoFactorModal';

// Mock the API_BASE_URL
jest.mock('../../lib/utils', () => ({
  API_BASE_URL: 'http://localhost:3002/api/v1'
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('TwoFactorModal', () => {
  const mockOnClose = jest.fn();
  const mockOnStatusChange = jest.fn();
  const mockToken = 'test-token';

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    token: mockToken,
    onStatusChange: mockOnStatusChange,
    currentlyEnabled: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Setup Flow (when not enabled)', () => {
    test('should render setup modal when 2FA is not enabled', () => {
      render(<TwoFactorModal {...defaultProps} />);
      
      expect(screen.getByText('Set Up Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText('Begin Setup')).toBeInTheDocument();
    });

    test('should initiate setup when Begin Setup is clicked', async () => {
      const mockSetupResponse = {
        secret: 'TEST_SECRET',
        qrCodeUrl: 'otpauth://totp/test',
        backupCodes: ['CODE1', 'CODE2', 'CODE3']
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSetupResponse)
      });

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      await user.click(screen.getByText('Begin Setup'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3002/api/v1/auth/2fa/setup',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mockToken}`,
              'Content-Type': 'application/json'
            }
          })
        );
      });
    });

    test('should display QR code and backup codes after successful setup', async () => {
      const mockSetupResponse = {
        secret: 'TEST_SECRET',
        qrCodeUrl: 'otpauth://totp/test@example.com?secret=TEST_SECRET&issuer=Lockr',
        backupCodes: ['BACKUP1', 'BACKUP2', 'BACKUP3']
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSetupResponse)
      });

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      await user.click(screen.getByText('Begin Setup'));

      await waitFor(() => {
        expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
        expect(screen.getByText('Backup Codes')).toBeInTheDocument();
        expect(screen.getByText('BACKUP1')).toBeInTheDocument();
        expect(screen.getByText('BACKUP2')).toBeInTheDocument();
      });
    });

    test('should show verification step after scanning QR code', async () => {
      const mockSetupResponse = {
        secret: 'TEST_SECRET',
        qrCodeUrl: 'otpauth://totp/test',
        backupCodes: ['CODE1', 'CODE2']
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSetupResponse)
      });

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      await user.click(screen.getByText('Begin Setup'));

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue'));

      expect(screen.getByText('Verify Setup')).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    test('should enable 2FA with valid verification code', async () => {
      const mockSetupResponse = {
        secret: 'TEST_SECRET',
        qrCodeUrl: 'otpauth://totp/test',
        backupCodes: ['CODE1']
      };

      const mockEnableResponse = {
        message: 'Two-factor authentication enabled successfully',
        backupCodes: ['NEW_CODE1', 'NEW_CODE2']
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSetupResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEnableResponse)
        });

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      // Start setup
      await user.click(screen.getByText('Begin Setup'));
      await waitFor(() => screen.getByText('Continue'));
      
      // Move to verification
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByLabelText(/verification code/i));

      // Enter code and enable
      await user.type(screen.getByLabelText(/verification code/i), '123456');
      await user.click(screen.getByText('Enable 2FA'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3002/api/v1/auth/2fa/enable',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mockToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: '123456' })
          })
        );
      });

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(true);
      });
    });

    test('should show error for invalid verification code', async () => {
      const mockSetupResponse = {
        secret: 'TEST_SECRET',
        qrCodeUrl: 'otpauth://totp/test',
        backupCodes: ['CODE1']
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSetupResponse)
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid two-factor authentication code' })
        });

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      // Complete setup flow to verification
      await user.click(screen.getByText('Begin Setup'));
      await waitFor(() => screen.getByText('Continue'));
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByLabelText(/verification code/i));

      // Try to enable with invalid code
      await user.type(screen.getByLabelText(/verification code/i), '000000');
      await user.click(screen.getByText('Enable 2FA'));

      await waitFor(() => {
        expect(screen.getByText('Invalid two-factor authentication code')).toBeInTheDocument();
      });
    });
  });

  describe('Disable Flow (when enabled)', () => {
    const enabledProps = {
      ...defaultProps,
      currentlyEnabled: true
    };

    test('should render disable modal when 2FA is enabled', () => {
      render(<TwoFactorModal {...enabledProps} />);
      
      expect(screen.getByText('Disable Two-Factor Authentication')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to disable two-factor authentication?')).toBeInTheDocument();
      expect(screen.getByText('Disable 2FA')).toBeInTheDocument();
    });

    test('should disable 2FA when confirmed', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Two-factor authentication disabled successfully' })
      });

      const user = userEvent.setup();
      render(<TwoFactorModal {...enabledProps} />);

      await user.click(screen.getByText('Disable 2FA'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3002/api/v1/auth/2fa/disable',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mockToken}`,
              'Content-Type': 'application/json'
            }
          })
        );
      });

      await waitFor(() => {
        expect(mockOnStatusChange).toHaveBeenCalledWith(false);
      });
    });

    test('should show error if disable fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Two-factor authentication is not enabled' })
      });

      const user = userEvent.setup();
      render(<TwoFactorModal {...enabledProps} />);

      await user.click(screen.getByText('Disable 2FA'));

      await waitFor(() => {
        expect(screen.getByText('Two-factor authentication is not enabled')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Controls', () => {
    test('should close modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('should close modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      await user.click(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('should not render when isOpen is false', () => {
      render(<TwoFactorModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Set Up Two-Factor Authentication')).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    test('should show loading state during setup', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(promise);

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      await user.click(screen.getByText('Begin Setup'));

      // Check for loading state
      expect(screen.getByText('Setting up...')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({
          secret: 'TEST',
          qrCodeUrl: 'test',
          backupCodes: []
        })
      });
    });

    test('should show loading state during enable', async () => {
      const mockSetupResponse = {
        secret: 'TEST_SECRET',
        qrCodeUrl: 'otpauth://totp/test',
        backupCodes: ['CODE1']
      };

      let resolveEnablePromise: (value: any) => void;
      const enablePromise = new Promise((resolve) => {
        resolveEnablePromise = resolve;
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSetupResponse)
        })
        .mockReturnValueOnce(enablePromise);

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      // Complete setup flow to verification
      await user.click(screen.getByText('Begin Setup'));
      await waitFor(() => screen.getByText('Continue'));
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByLabelText(/verification code/i));

      // Try to enable
      await user.type(screen.getByLabelText(/verification code/i), '123456');
      await user.click(screen.getByText('Enable 2FA'));

      // Check for loading state
      expect(screen.getByText('Enabling...')).toBeInTheDocument();

      // Resolve the promise
      resolveEnablePromise!({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' })
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors during setup', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      await user.click(screen.getByText('Begin Setup'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to set up two-factor authentication/)).toBeInTheDocument();
      });
    });

    test('should handle API errors during setup', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' })
      });

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      await user.click(screen.getByText('Begin Setup'));

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    test('should validate verification code format', async () => {
      const mockSetupResponse = {
        secret: 'TEST_SECRET',
        qrCodeUrl: 'otpauth://totp/test',
        backupCodes: ['CODE1']
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSetupResponse)
      });

      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      // Complete setup flow to verification
      await user.click(screen.getByText('Begin Setup'));
      await waitFor(() => screen.getByText('Continue'));
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByLabelText(/verification code/i));

      // Try to enable with short code
      await user.type(screen.getByLabelText(/verification code/i), '123');
      
      const enableButton = screen.getByText('Enable 2FA');
      expect(enableButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<TwoFactorModal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/close modal/i)).toBeInTheDocument();
    });

    test('should trap focus within modal', () => {
      render(<TwoFactorModal {...defaultProps} />);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    test('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<TwoFactorModal {...defaultProps} />);

      // Test ESC key closes modal
      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
}); 