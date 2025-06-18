import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lockr - Your Passwords, Secured & Simple",
  description: "Keep all your passwords safe with military-grade encryption. Access them anywhere, anytime, with complete peace of mind.",
  keywords: ["password manager", "security", "encryption", "passwords", "vault"],
  authors: [{ name: "Lockr Team" }],
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
  openGraph: {
    title: "Lockr - Your Passwords, Secured & Simple",
    description: "Keep all your passwords safe with military-grade encryption.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
