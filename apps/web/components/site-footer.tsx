'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SupportContactResponse } from '@nadar-kalyanam/schemas';
import { getSupportContact } from '../lib/api-client';
import { supportContactLinks } from '../lib/membership';
import { MandalaEmblem } from './app-header';

// Pages that fill the screen on their own (the step-by-step sign-up, an
// open chat) have no footer.
const HIDDEN_ON = [/^\/onboarding(\/|$)/, /^\/messages\/[^/]+/];

type FooterLink = { label: string; href: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Find Your Match',
    links: [
      { label: 'Matches', href: '/matches' },
      { label: 'Search', href: '/search' },
      { label: 'Interests', href: '/interests' },
      { label: 'Messages', href: '/messages' },
    ],
  },
  {
    title: 'Your Account',
    links: [
      { label: 'My profile', href: '/profile' },
      { label: 'Notifications', href: '/notifications' },
      { label: 'Membership plans', href: '/membership' },
      { label: 'Unlocked contacts', href: '/membership/contacts' },
    ],
  },
];

// Social profiles, only those configured (NEXT_PUBLIC_*_URL). None set →
// no "Follow us" block, rather than icons that go nowhere.
const SOCIAL = [
  { name: 'Facebook', href: process.env.NEXT_PUBLIC_FACEBOOK_URL, path: 'M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z' },
  { name: 'Instagram', href: process.env.NEXT_PUBLIC_INSTAGRAM_URL, path: 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm0 6.2a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Zm4-7.4a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8ZM12 3c-2.4 0-2.7 0-3.7.1-3.3.1-5.1 2-5.2 5.2C3 9.3 3 9.6 3 12s0 2.7.1 3.7c.1 3.2 2 5.1 5.2 5.2 1 .1 1.3.1 3.7.1s2.7 0 3.7-.1c3.2-.1 5.1-2 5.2-5.2.1-1 .1-1.3.1-3.7s0-2.7-.1-3.7c-.1-3.2-2-5.1-5.2-5.2C14.7 3 14.4 3 12 3Zm0 1.6c2.4 0 2.7 0 3.6.1 2.4.1 3.6 1.3 3.7 3.7.1.9.1 1.2.1 3.6s0 2.7-.1 3.6c-.1 2.4-1.3 3.6-3.7 3.7-.9.1-1.2.1-3.6.1s-2.7 0-3.6-.1c-2.4-.1-3.6-1.3-3.7-3.7-.1-.9-.1-1.2-.1-3.6s0-2.7.1-3.6C4.8 6 6 4.8 8.4 4.7c.9-.1 1.2-.1 3.6-.1Z' },
  { name: 'YouTube', href: process.env.NEXT_PUBLIC_YOUTUBE_URL, path: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z' },
].filter((s): s is typeof s & { href: string } => typeof s.href === 'string' && s.href.startsWith('https://'));

const linkClass = 'text-[13px] text-nk-muted transition-colors hover:text-nk-maroon';
const headingClass = 'text-[15px] font-bold tracking-wide text-nk-ink';

export function SiteFooter() {
  const pathname = usePathname() ?? '/';
  const [contact, setContact] = useState<SupportContactResponse | null>(null);
  const hidden = HIDDEN_ON.some((re) => re.test(pathname));

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    getSupportContact()
      .then((c) => {
        if (!cancelled) setContact(c);
      })
      .catch(() => {
        // The footer still shows; only the email / WhatsApp lines are missing.
      });
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  if (hidden) return null;
  const contactLinks = supportContactLinks(contact);

  return (
    <footer className="border-t-2 border-nk-turmeric bg-nk-cream" data-testid="site-footer">
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-12">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <MandalaEmblem />
              <span className="text-lg font-bold tracking-tight text-nk-maroon">About Nadar Kalyanam</span>
            </Link>
            <p className="mt-4 text-[13px] leading-6 text-nk-muted">
              Nadar Kalyanam is a matrimony service for the Nadar community. It helps members and their families find a life
              partner who shares their values, culture and traditions. Every member signs in with a one-time code sent to their
              mobile number, and photos are reviewed by our team before other members see them.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className={headingClass}>{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <nav aria-label="Help and support">
            <h2 className={headingClass}>Help &amp; Support</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/contact" className={linkClass}>
                  Contact us
                </Link>
              </li>
              {contactLinks.map((l) => (
                <li key={l.kind}>
                  <a href={l.href} className={`${linkClass} break-all`} target={l.kind === 'whatsapp' ? '_blank' : undefined} rel="noopener noreferrer">
                    {l.kind === 'email' ? 'Email: ' : 'WhatsApp: '}
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/membership" className={linkClass}>
                  VIP Assisted service
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-[#EADBC4] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 text-[12px] text-nk-subtle">
            <p>This website is strictly for matrimonial purposes only and is not a dating website.</p>
            <p>&copy; {new Date().getFullYear()} Nadar Kalyanam. All rights reserved.</p>
          </div>
          {SOCIAL.length > 0 && (
            <div className="flex items-center gap-3" data-testid="footer-social">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-nk-ink-soft">Follow us</span>
              {SOCIAL.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#EADBC4] text-nk-maroon transition-colors hover:bg-nk-butter"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
