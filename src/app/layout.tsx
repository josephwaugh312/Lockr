import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "../components/ThemeProvider";
import QueryProvider from "../providers/QueryProvider";
import CookieConsentWrapper from "../components/CookieConsentWrapper";
import { Toaster } from "sonner";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: "Lockrr - Free Password Manager | Secure & Private Vault",
    template: "%s | Lockrr"
  },
  description: "Free password manager with military-grade encryption. Store passwords, credit cards & notes securely. Zero-knowledge, open-source, and self-hostable. Start protecting your digital life today.",
  keywords: [
    "password manager",
    "free password manager",
    "secure vault", 
    "client-side encryption",
    "zero-knowledge",
    "password security",
    "privacy-first",
    "vault",
    "password generator",
    "open source password manager",
    "self-hosted password manager",
    "AES-256 encryption",
    "password storage",
    "secure notes",
    "credit card manager"
  ],
  authors: [{ name: "Lockrr Team" }],
  creator: "Lockrr",
  publisher: "Lockrr",
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: "Lockrr - Free Password Manager | Secure & Private Vault",
    description: "Free password manager with military-grade encryption. Store passwords, credit cards & notes securely. Zero-knowledge, open-source, and self-hostable.",
    url: "https://lockrr.app",
    siteName: "Lockrr",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://lockrr.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lockrr - Secure Password Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lockrr - Free Password Manager | Secure & Private Vault",
    description: "Free password manager with military-grade encryption. Store passwords, credit cards & notes securely. Zero-knowledge, open-source, and self-hostable.",
    images: ["https://lockrr.app/og-image.png"],
  },
  alternates: {
    canonical: "https://lockrr.app",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.svg", sizes: "32x32", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Lockrr",
    "description": "Free password manager with military-grade encryption. Store passwords, credit cards & notes securely. Zero-knowledge, open-source, and self-hostable.",
    "url": "https://lockrr.app",
    "applicationCategory": "SecurityApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "Lockrr Team"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Lockrr"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "150"
    }
  };

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body 
        className={`${inter.className} antialiased bg-white text-gray-900`}
        suppressHydrationWarning={true}
      >
        <QueryProvider>
          <ThemeProvider>
            <div className="min-h-screen w-full">
              {children}
            </div>
            <CookieConsentWrapper />
            <Toaster 
              position="top-right"
              richColors
              closeButton
              duration={4000}
            />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
} 