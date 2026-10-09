import type { Metadata } from 'next';
import { Cinzel, Cormorant_Garamond, Plus_Jakarta_Sans, Source_Serif_4 } from 'next/font/google';
import { RegistrationProvider } from './providers/registration-provider';
import { NavigationTracker } from '../lib/navigation-history';
import { SiteFooter } from '../components/site-footer';
import './globals.css';

// Headings (--font-heading). --font-playfair is kept as an alias in
// globals.css for the components that still name it.
const sourceSerif = Source_Serif_4({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

// The public landing page keeps its original elegant serif (--font-landing).
const cormorantGaramond = Cormorant_Garamond({
  variable: '--font-landing',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

const cinzel = Cinzel({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Nadar Kalyanam - Relationships Rooted in Values | Matrimony',
  description:
    'Nadar Kalyanam brings together like-minded individuals and families with shared values, culture, and aspirations. Find your trusted life partner.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${cormorantGaramond.variable} ${cinzel.variable} ${plusJakartaSans.variable}`}
    >
      <body>
        <NavigationTracker />
        <RegistrationProvider>
          {children}
          <SiteFooter />
        </RegistrationProvider>
      </body>
    </html>
  );
}
