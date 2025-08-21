/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ItemModal from '../../src/components/ItemModal';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon">X</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  EyeOff: () => <div data-testid="eye-off-icon">EyeOff</div>,
  RefreshCw: () => <div data-testid="refresh-icon">RefreshCw</div>,
  Copy: () => <div data-testid="copy-icon">Copy</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  Globe: () => <div data-testid="globe-icon">Globe</div>,
  CreditCard: () => <div data-testid="credit-card-icon">CreditCard</div>,
  FileText: () => <div data-testid="file-text-icon">FileText</div>,
  Wifi: () => <div data-testid="wifi-icon">Wifi</div>,
  Lock: () => <div data-testid="lock-icon">Lock</div>,
  User: () => <div data-testid="user-icon">User</div>,
  Mail: () => <div data-testid="mail-icon">Mail</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  Shield: () => <div data-testid="shield-icon">Shield</div>,
  Zap: () => <div data-testid="zap-icon">Zap</div>,
}));

describe('ItemModal Quick Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    item: null,
    mode: 'add' as const,
    autoSave: false,
    showPasswordStrength: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal when isOpen is true', () => {
    render(<ItemModal {...defaultProps} />);
    expect(screen.getByText('Add New Item')).toBeInTheDocument();
  });

  test('validates required fields on save', async () => {
    const user = userEvent.setup();
    render(<ItemModal {...defaultProps} />);
    
    const saveButton = screen.getByRole('button', { name: /Add Item/i });
    await user.click(saveButton);
    
    // Should show validation errors - multiple required fields
    const errors = screen.getAllByText(/required/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('switches between categories', async () => {
    const user = userEvent.setup();
    render(<ItemModal {...defaultProps} />);
    
    // Default is login - look for Username field
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    
    // Switch to card
    await user.click(screen.getByRole('button', { name: /Card/i }));
    expect(screen.getByLabelText(/Card Number/i)).toBeInTheDocument();
  });

  test('fills and submits login item', async () => {
    const user = userEvent.setup();
    render(<ItemModal {...defaultProps} />);
    
    // Fill in required fields
    const nameInput = screen.getByLabelText(/Item Name/i);
    await user.type(nameInput, 'Test Login');
    
    const usernameInput = screen.getByLabelText(/Username/i);
    await user.type(usernameInput, 'testuser');
    
    const passwordInput = screen.getByLabelText('Password');
    await user.type(passwordInput, 'TestPass123!');
    
    // Submit
    const saveButton = screen.getByRole('button', { name: /Add Item/i });
    await user.click(saveButton);
    
    // Verify save was called
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Login',
        username: 'testuser',
        password: 'TestPass123!',
      })
    );
  });
});