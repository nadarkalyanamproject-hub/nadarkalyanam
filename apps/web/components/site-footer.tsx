'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SupportContactResponse } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../app/providers/registration-provider';
import { getSupportContact } from '../lib/api-client';
import { supportContactLinks } from '../lib/membership';
import { Mail, MessageCircle } from 'lucide-react';
import { Logo } from './brand/logo';

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

// The visitor footer sits on deep maroon: ivory text, gold headings.
const linkClass = 'text-[14px] text-[#F3E6D8]/75 transition-colors hover:text-white';
const headingClass = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E9C77A]';

// The full footer (About Nadar Kalyanam, links, contact) is for visitors who
// aren't signed in. Signed-in members get one slim line on every page.
export function SiteFooter() {
  const pathname = usePathname() ?? '/';
  const { data, hydrated } = useRegistration();
  const signedIn = hydrated && Boolean(data.accessToken);
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
  if (signedIn) return <SlimFooter />;
  const contactLinks = supportContactLinks(contact);

  return (
    <footer className="relative bg-gradient-to-b from-[#5C0C13] to-[#3E070C]" data-testid="site-footer">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"
      />
      <div className="w-full px-4 pb-8 pt-14 sm:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.7fr_1fr_1fr_1.1fr] lg:gap-14">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" aria-label="Nadar Kalyanam home" className="inline-flex">
              <Logo light className="text-[24px]" />
            </Link>
            <p className="mt-5 max-w-sm text-[13px] leading-6 text-[#F3E6D8]/70">
              Nadar Kalyanam is a matrimony service for the Nadar community. It helps members and their families find a life
              partner who shares their values, culture and traditions. Every member signs in with a one-time code sent to their
              mobile number, and photos are reviewed by our team before other members see them.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className={headingClass}>{col.title}</h2>
              <ul className="mt-5 space-y-3">
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
            <ul className="mt-5 space-y-3">
              <li>
                <Link href="/contact" className={linkClass}>
                  Contact us
                </Link>
              </li>
              <li>
                <Link href="/membership" className={linkClass}>
                  VIP Assisted service
                </Link>
              </li>
              {contactLinks.map((l) => {
                const Icon = l.kind === 'email' ? Mail : MessageCircle;
                return (
                  <li key={l.kind}>
                    <a
                      href={l.href}
                      className={`${linkClass} inline-flex items-start gap-2 break-all`}
                      target={l.kind === 'whatsapp' ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      aria-label={`${l.kind === 'email' ? 'Email' : 'WhatsApp'}: ${l.label}`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#E9C77A]" strokeWidth={1.75} aria-hidden="true" />
                      {l.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-[12px] text-[#F3E6D8]/55 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Nadar Kalyanam. All rights reserved.</p>
          <p>Strictly for matrimonial purposes. Not a dating website.</p>
          {SOCIAL.length > 0 && (
            <div className="flex items-center gap-3" data-testid="footer-social">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E9C77A]">Follow us</span>
              {SOCIAL.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-[#F3E6D8] transition-colors hover:border-[#E9C77A] hover:text-[#E9C77A]"
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

function SlimFooter() {
  return (
    <footer className="border-t border-nk-line bg-white" data-testid="site-footer-slim">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 text-[12px] text-nk-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} Nadar Kalyanam · Strictly for matrimonial purposes</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/contact" className="hover:text-nk-maroon">Contact us</Link>
          <Link href="/membership" className="hover:text-nk-maroon">Membership</Link>
        </nav>
      </div>
    </footer>
  );
}
