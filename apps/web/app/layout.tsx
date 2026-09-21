import type { Metadata } from 'next';
import { Cinzel, Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google';
import { RegistrationProvider } from './providers/registration-provider';
import './globals.css';

const cormorantGaramond = Cormorant_Garamond({
  variable: '--font-heading',
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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${cinzel.variable} ${plusJakartaSans.variable}`}
    >
      <body>
        <RegistrationProvider>{children}</RegistrationProvider>
      </body>
    </html>
  );
}
