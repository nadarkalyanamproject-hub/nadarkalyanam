import type { Metadata } from 'next';
import { Cormorant_Garamond, Geist, Geist_Mono } from 'next/font/google';
import { AdminAuthProvider } from './providers/admin-auth-provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Matches apps/web's login modal heading font (see landing.css's --font-heading).
const cormorantGaramond = Cormorant_Garamond({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: 'Nadar Kalyanam Admin',
  description: 'Nadar Kalyanam admin back-office.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
