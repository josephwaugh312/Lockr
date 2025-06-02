import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: "Lockr - Secure Password Manager | Privacy-First Vault",
    template: "%s | Lockr"
  },
  description: "Open-source password manager with AES-256 encryption. Secure, private, and self-hostable. Keep your passwords safe with zero-knowledge architecture.",
  keywords: [
    "password manager",
    "secure vault",
    "encryption",
    "privacy",
    "open source",
    "AES-256",
    "zero knowledge",
    "self-hosted",
    "security"
  ],
  authors: [{ name: "Lockr Team" }],
  creator: "Lockr",
  publisher: "Lockr",
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
    type: "website",
    locale: "en_US",
    url: "https://lockr.app",
    siteName: "Lockr",
    title: "Lockr - Secure Password Manager",
    description: "Open-source password manager with AES-256 encryption. Secure, private, and self-hostable.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Lockr - Secure Password Manager",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lockr - Secure Password Manager",
    description: "Open-source password manager with AES-256 encryption. Secure, private, and self-hostable.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon.ico" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Lockr",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <meta name="theme-color" content="#0F172A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Lockr" />
        <meta name="application-name" content="Lockr" />
        <meta name="msapplication-TileColor" content="#0F172A" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${inter.className} antialiased bg-white dark:bg-lockr-navy text-gray-900 dark:text-gray-100`}>
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
} 