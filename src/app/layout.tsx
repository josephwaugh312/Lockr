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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      { url: "/android-icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" }
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" }
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#1E293B"
      }
    ]
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Lockr - Free Password Manager | Secure & Private Vault",
    description: "Free password manager with military-grade encryption. Store passwords, credit cards & notes securely. Zero-knowledge, open-source, and self-hostable.",
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