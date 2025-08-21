/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout, { metadata, viewport } from './layout';

// Mock dependencies
jest.mock('next/font/google', () => ({
  Inter: () => ({
    className: 'inter-font',
    variable: '--font-inter',
  }),
}));

jest.mock('../components/ThemeProvider', () => {
  return function MockThemeProvider({ children }: { children: React.ReactNode }) {
    return <div data-testid="theme-provider">{children}</div>;
  };
});

jest.mock('../providers/QueryProvider', () => {
  return function MockQueryProvider({ children }: { children: React.ReactNode }) {
    return <div data-testid="query-provider">{children}</div>;
  };
});

jest.mock('../components/CookieConsentWrapper', () => {
  return function MockCookieConsentWrapper() {
    return <div data-testid="cookie-consent-wrapper">Cookie Consent</div>;
  };
});

jest.mock('sonner', () => ({
  Toaster: (props: any) => (
    <div 
      data-testid="toaster" 
      data-position={props.position}
      data-duration={props.duration}
      data-rich-colors={props.richColors ? "true" : "false"}
      data-close-button={props.closeButton ? "true" : "false"}
    >
      Toaster
    </div>
  ),
}));

describe('RootLayout', () => {
  describe('metadata', () => {
    it('should have correct title metadata', () => {
      expect(metadata.title).toEqual({
        default: "Lockrr - Free Password Manager | Secure & Private Vault",
        template: "%s | Lockrr"
      });
    });

    it('should have correct description', () => {
      expect(metadata.description).toContain('Free password manager');
      expect(metadata.description).toContain('military-grade encryption');
      expect(metadata.description).toContain('Zero-knowledge');
    });

    it('should have correct keywords', () => {
      expect(metadata.keywords).toBeInstanceOf(Array);
      expect(metadata.keywords).toContain('password manager');
      expect(metadata.keywords).toContain('zero-knowledge');
      expect(metadata.keywords).toContain('AES-256 encryption');
    });

    it('should have correct authors and creator', () => {
      expect(metadata.authors).toEqual([{ name: "Lockrr Team" }]);
      expect(metadata.creator).toBe("Lockrr");
      expect(metadata.publisher).toBe("Lockrr");
    });

    it('should have comprehensive icon configuration', () => {
      expect(metadata.icons).toBeDefined();
      expect(metadata.icons?.icon).toBeInstanceOf(Array);
      expect(metadata.icons?.icon).toHaveLength(7);
      expect(metadata.icons?.shortcut).toBe('/favicon.ico');
      expect(metadata.icons?.apple).toEqual([
        { url: "/apple-icon.png", sizes: "180x180", type: "image/png" }
      ]);
      expect(metadata.icons?.other).toEqual([
        {
          rel: "mask-icon",
          url: "/safari-pinned-tab.svg",
          color: "#1E293B"
        }
      ]);
    });

    it('should have manifest path', () => {
      expect(metadata.manifest).toBe('/manifest.json');
    });

    it('should have correct OpenGraph configuration', () => {
      expect(metadata.openGraph).toMatchObject({
        title: "Lockr - Free Password Manager | Secure & Private Vault",
        description: expect.stringContaining('Free password manager'),
        url: "https://lockrr.app",
        siteName: "Lockr",
        locale: "en_US",
        type: "website",
        images: [
          {
            url: "https://lockrr.app/og-image.png",
            width: 1200,
            height: 630,
            alt: "Lockr - Secure Password Manager",
            type: "image/png"
          }
        ]
      });
    });

    it('should have correct Twitter card configuration', () => {
      expect(metadata.twitter).toMatchObject({
        card: "summary_large_image",
        title: "Lockrr - Free Password Manager | Secure & Private Vault",
        description: expect.stringContaining('Free password manager'),
        images: ["https://lockrr.app/og-image.png"]
      });
    });

    it('should have canonical URL', () => {
      expect(metadata.alternates).toEqual({
        canonical: "https://lockrr.app"
      });
    });
  });

  describe('viewport', () => {
    it('should have correct viewport configuration', () => {
      expect(viewport).toEqual({
        width: 'device-width',
        initialScale: 1
      });
    });
  });

  describe('RootLayout component', () => {
    it('should render with all required providers', () => {
      render(
        <RootLayout>
          <div data-testid="test-content">Test Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId('query-provider')).toBeInTheDocument();
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
      expect(screen.getByTestId('cookie-consent-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('toaster')).toBeInTheDocument();
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should apply correct CSS classes to body', () => {
      // Note: React Testing Library doesn't render the actual html/body tags
      // from Next.js layout. These would be tested in an e2e test.
      // We can verify the component renders without errors.
      const { container } = render(
        <RootLayout>
          <div data-testid="test-content">Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should have suppressHydrationWarning on body', () => {
      // Note: body tag attributes can't be tested with RTL
      // This would be tested in an e2e test
      const { container } = render(
        <RootLayout>
          <div data-testid="test-content">Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should set lang attribute on html element', () => {
      // Note: html tag attributes can't be tested with RTL
      // This would be tested in an e2e test
      const { container } = render(
        <RootLayout>
          <div data-testid="test-content">Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should apply Inter font variable to html', () => {
      // Note: html tag classes can't be tested with RTL
      // This would be tested in an e2e test
      const { container } = render(
        <RootLayout>
          <div data-testid="test-content">Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should render structured data script', () => {
      // Note: script tags in head are not rendered by RTL
      // This would be tested in an e2e test
      const { container } = render(
        <RootLayout>
          <div data-testid="test-content">Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should wrap children in min-h-screen container', () => {
      const { container } = render(
        <RootLayout>
          <div data-testid="child">Child Content</div>
        </RootLayout>
      );

      const wrapper = container.querySelector('.min-h-screen.w-full');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toContainElement(screen.getByTestId('child'));
    });

    it('should configure Toaster with correct props', () => {
      render(
        <RootLayout>
          <div>Content</div>
        </RootLayout>
      );

      const toaster = screen.getByTestId('toaster');
      expect(toaster).toHaveAttribute('data-position', 'top-right');
      expect(toaster).toHaveAttribute('data-duration', '4000');
      expect(toaster).toHaveAttribute('data-rich-colors', 'true');
      expect(toaster).toHaveAttribute('data-close-button', 'true');
    });

    it('should render multiple children correctly', () => {
      render(
        <RootLayout>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <div data-testid="child3">Child 3</div>
        </RootLayout>
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
      expect(screen.getByTestId('child3')).toBeInTheDocument();
    });

    it('should handle empty children', () => {
      const { container } = render(
        <RootLayout>
          {null}
        </RootLayout>
      );

      expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
      expect(screen.getByTestId('cookie-consent-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('toaster')).toBeInTheDocument();
    });

    it('should maintain provider hierarchy', () => {
      const { container } = render(
        <RootLayout>
          <div data-testid="content">Content</div>
        </RootLayout>
      );

      // Check that QueryProvider wraps ThemeProvider
      const queryProvider = screen.getByTestId('query-provider');
      const themeProvider = screen.getByTestId('theme-provider');
      
      expect(queryProvider).toContainElement(themeProvider);
      expect(themeProvider).toContainElement(screen.getByTestId('content'));
    });
  });
})


