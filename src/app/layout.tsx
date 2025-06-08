import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "../components/ThemeProvider";

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased bg-white text-gray-900`}>
        <ThemeProvider>
          <div className="min-h-screen">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
} 