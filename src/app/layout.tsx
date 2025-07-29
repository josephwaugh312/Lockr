import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "../components/ThemeProvider";
import QueryProvider from "../providers/QueryProvider";
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
    default: "Lockrr - Secure Password Manager | Privacy-First Vault",
    template: "%s | Lockrr"
  },
  description: "Secure password manager with client-side encryption. Store passwords, secure notes, and payment cards safely. Zero-knowledge architecture.",
  keywords: [
    "password manager",
    "secure vault", 
    "client-side encryption",
    "zero-knowledge",
    "password security",
    "privacy-first",
    "vault",
    "password generator"
  ],
  authors: [{ name: "Lockrr Team" }],
  creator: "Lockrr",
  publisher: "Lockrr",
  manifest: "/manifest.json",
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
  return (
    <html lang="en" className={inter.variable}>
      <body 
        className={`${inter.className} antialiased bg-white text-gray-900`}
        suppressHydrationWarning={true}
      >
        <QueryProvider>
          <ThemeProvider>
            <div className="min-h-screen w-full">
              {children}
            </div>
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