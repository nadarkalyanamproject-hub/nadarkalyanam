import type { Metadata } from 'next';
import { Cinzel, Cormorant_Garamond, Geist_Mono, Inter } from 'next/font/google';
import { AdminAuthProvider } from './providers/admin-auth-provider';
import './globals.css';
import '../components/brand/brand.css';

// The logo wordmark's font, as in apps/web.
const cinzel = Cinzel({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700'],
});

const inter = Inter({
  variable: '--font-inter',
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
      className={`${inter.variable} ${geistMono.variable} ${cormorantGaramond.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
