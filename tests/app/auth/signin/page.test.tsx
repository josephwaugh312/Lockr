/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import SignInRedirect from '../../../../src/app/auth/signin/page';

// Mock Next.js navigation
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

describe('SignInRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('redirects to authentication/signin on mount', () => {
    render(<SignInRedirect />);

    expect(mockReplace).toHaveBeenCalledWith('/authentication/signin');
  });

  test('renders nothing (null)', () => {
    const { container } = render(<SignInRedirect />);

    expect(container.firstChild).toBeNull();
  });

  test('calls router.replace with useEffect dependency', () => {
    render(<SignInRedirect />);

    // Should be called exactly once
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/authentication/signin');
  });
});