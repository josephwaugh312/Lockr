/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ItemModal from '../../src/components/ItemModal';

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

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('ItemModal - Minimal Tests', () => {
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

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    test('renders modal when isOpen is true', () => {
      render(<ItemModal {...defaultProps} />);
      expect(screen.getByText('Add New Item')).toBeInTheDocument();
    });

    test('does not render modal when isOpen is false', () => {
      render(<ItemModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add New Item')).not.toBeInTheDocument();
    });

    test('renders edit mode with correct title', () => {
      render(<ItemModal {...defaultProps} mode="edit" />);
      expect(screen.getByText('Edit Item')).toBeInTheDocument();
    });

    test('renders all category tabs', () => {
      render(<ItemModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Card/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Note/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /WiFi/i })).toBeInTheDocument();
    });
  });

  describe('Basic Interactions', () => {
    test('calls onClose when cancel button is clicked', () => {
      render(<ItemModal {...defaultProps} />);
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('calls onClose when X button is clicked', () => {
      render(<ItemModal {...defaultProps} />);
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('switches between categories', () => {
      render(<ItemModal {...defaultProps} />);
      
      // Default is login - check for login tab being active
      const loginTab = screen.getByRole('button', { name: /Login/i });
      // Implementation varies by color; assert aria-current state by behavior instead
      expect(loginTab).toBeInTheDocument();
      
      // Switch to card
      const cardTab = screen.getByRole('button', { name: /Card/i });
      fireEvent.click(cardTab);
      // Should expose card-specific fields
      expect(screen.getByLabelText(/Card Number/i)).toBeInTheDocument();
    });

    test('updates input values', () => {
      render(<ItemModal {...defaultProps} />);
      
      const nameInput = screen.getByPlaceholderText(/GitHub, Netflix, Work Email/i) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Test Item' } });
      expect(nameInput.value).toBe('Test Item');
    });
  });

  describe('Form Validation', () => {
    test('shows validation error for empty name', () => {
      render(<ItemModal {...defaultProps} />);
      
      const saveButton = screen.getByRole('button', { name: /Add Item/i });
      fireEvent.click(saveButton);
      
      // Check for validation message
      expect(screen.getAllByText(/Name is required/i).length).toBeGreaterThan(0);
    });

    test('validates email format', () => {
      render(<ItemModal {...defaultProps} />);
      
      // Ensure we are in login category
      const loginTab = screen.getByRole('button', { name: /Login/i });
      fireEvent.click(loginTab);

      const nameInput = screen.getByPlaceholderText(/GitHub, Netflix, Work Email/i);
      fireEvent.change(nameInput, { target: { value: 'Test Login' } });

      // Fill required fields for login category
      const usernameInput = screen.getByPlaceholderText(/Enter username/i);
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });

      const passwordInput = screen.getByPlaceholderText(/Enter or generate a password/i);
      fireEvent.change(passwordInput, { target: { value: 'TestPassword123!' } });

      const emailInput = screen.getByPlaceholderText(/Enter email address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      
      const saveButton = screen.getByRole('button', { name: /Add Item/i });
      fireEvent.click(saveButton);
      
      // The modal should still be open with validation errors
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Debug: Check all text content in the modal
      const allText = screen.getByRole('dialog').textContent || '';
      console.log('Modal text content after validation:', allText.substring(0, 500));
      
      // Check for any error messages
      const errorMessages = screen.queryAllByText(/.*invalid.*|.*required.*|.*format.*/i);
      console.log('Found error messages:', errorMessages.map(el => el.textContent));
      
      expect(screen.getByText(/Invalid email format/i)).toBeInTheDocument();
    });
  });

  describe('Password Features', () => {
    test('toggles password visibility', () => {
      render(<ItemModal {...defaultProps} />);
      
      const passwordInput = screen.getByPlaceholderText(/Enter or generate a password/i) as HTMLInputElement;
      expect(passwordInput.type).toBe('password');
      
      // Find the Eye icon button
      const toggleButton = screen.getByTestId('eye-icon').parentElement as HTMLElement;
      fireEvent.click(toggleButton);
      
      expect(passwordInput.type).toBe('text');
    });

    test('generates password', async () => {
      jest.useFakeTimers();
      render(<ItemModal {...defaultProps} />);
      
      const generateButton = screen.getByRole('button', { name: /Generate/i });
      fireEvent.click(generateButton);
      
      // advance the internal timeout used by generator
      act(() => {
        jest.advanceTimersByTime(600);
      })
      
      const passwordInput = screen.getByPlaceholderText(/Enter or generate a password/i) as HTMLInputElement;
      expect(passwordInput.value).toBeTruthy();
      expect(passwordInput.value.length).toBeGreaterThanOrEqual(12);
      jest.useRealTimers();
    });
  });

  describe('Form Submission', () => {
    test('submits login item with valid data', () => {
      render(<ItemModal {...defaultProps} />);
      
      const nameInput = screen.getByPlaceholderText(/GitHub, Netflix, Work Email/i);
      const usernameInput = screen.getByPlaceholderText(/Enter username/i);
      const passwordInput = screen.getByPlaceholderText(/Enter or generate a password/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Login' } });
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      
      const saveButton = screen.getByRole('button', { name: /Add Item/i });
      fireEvent.click(saveButton);
      
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Login',
          username: 'testuser',
          password: 'TestPass123!',
          category: 'login',
        })
      );
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    const existingItem = {
      id: '123',
      name: 'Existing Login',
      username: 'existinguser',
      email: 'existing@example.com',
      password: 'ExistingPass123!',
      website: 'https://existing.com',
      category: 'login' as const,
      favorite: false,
      lastUsed: new Date(),
      created: new Date(),
      strength: 'strong' as const,
      notes: 'Test notes',
    };

    test('loads existing item data', () => {
      render(<ItemModal {...defaultProps} mode="edit" item={existingItem} />);
      
      expect(screen.getByDisplayValue('Existing Login')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existinguser')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existing@example.com')).toBeInTheDocument();
    });
  });
});