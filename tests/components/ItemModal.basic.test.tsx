/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ItemModal from '../../src/components/ItemModal';

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  X: () => <div>X</div>,
  Eye: () => <div>Eye</div>,
  EyeOff: () => <div>EyeOff</div>,
  RefreshCw: () => <div>RefreshCw</div>,
  Copy: () => <div>Copy</div>,
  Check: () => <div>Check</div>,
  Globe: () => <div>Globe</div>,
  CreditCard: () => <div>CreditCard</div>,
  FileText: () => <div>FileText</div>,
  Wifi: () => <div>Wifi</div>,
  Lock: () => <div>Lock</div>,
  User: () => <div>User</div>,
  Mail: () => <div>Mail</div>,
  Calendar: () => <div>Calendar</div>,
  Shield: () => <div>Shield</div>,
  Zap: () => <div>Zap</div>,
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe('ItemModal - Basic Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    item: null,
    mode: 'add' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders when isOpen is true', () => {
    render(<ItemModal {...defaultProps} />);
    expect(screen.getByText('Add New Item')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    render(<ItemModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Add New Item')).not.toBeInTheDocument();
  });

  test('renders edit mode', () => {
    render(<ItemModal {...defaultProps} mode="edit" />);
    expect(screen.getByText('Edit Item')).toBeInTheDocument();
  });

  test('renders category tabs', () => {
    render(<ItemModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Card/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WiFi/i })).toBeInTheDocument();
  });

  test('renders form buttons', () => {
    render(<ItemModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Item/i })).toBeInTheDocument();
  });

  test('renders input fields', () => {
    render(<ItemModal {...defaultProps} />);
    // Check for placeholders
    expect(screen.getByPlaceholderText(/GitHub, Netflix, Work Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter or generate a password/i)).toBeInTheDocument();
  });
});