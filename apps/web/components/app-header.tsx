'use client';

import { useState, type ReactElement, type SVGProps } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRegistration } from '../app/providers/registration-provider';
import { claimAuthRedirect } from '../lib/auth-events';
import { useProfile } from '../lib/use-profile';

type IconProps = SVGProps<SVGSVGElement>;

function HomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function HeartIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20s-7.5-4.6-10-9.3C.4 7.1 2.3 4 5.6 4c1.9 0 3.4 1 4.4 2.4C11 5 12.5 4 14.4 4c3.3 0 5.2 3.1 3.6 6.7C19.5 15.4 12 20 12 20Z" />
    </svg>
  );
}

function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
    </svg>
  );
}

function ChatIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4.5 3.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

function BellIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.4 4.3-5.2 7.5-5.2s6.1 1.8 7.5 5.2" />
    </svg>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

const NAV_ITEMS: Array<{
  key: string;
  label: string;
  href?: string;
  icon: (props: IconProps) => ReactElement;
}> = [
  { key: 'home', label: 'Home', href: '/', icon: HomeIcon },
  { key: 'matches', label: 'Matches', href: '/browse', icon: HeartIcon },
  { key: 'interests', label: 'Interests', href: '/interests', icon: StarIcon },
  { key: 'messages', label: 'Messages', href: '/messages', icon: ChatIcon },
  { key: 'search', label: 'Search', icon: SearchIcon },
  { key: 'notifications', label: 'Notifications', icon: BellIcon },
];

function ComingSoonBadge() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
      Soon
    </span>
  );
}

export function AppHeader() {
  const router = useRouter();
  const { data, hydrated, clearAuth } = useRegistration();
  const { profile } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const isAuthenticated = hydrated && Boolean(data.accessToken);
  const avatarUrl = profile?.photos.find((photo) => photo.isPrimary)?.url ?? profile?.photos[0]?.url;

  function handleLogout() {
    setAvatarMenuOpen(false);
    claimAuthRedirect();
    clearAuth();
    router.push('/');
  }

  return (
    <header className="relative border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-bold text-primary">
          Nadar Kalyanam
        </Link>

        {isAuthenticated && (
          <>
            <nav className="hidden flex-1 items-center justify-center gap-1 md:flex lg:gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                if (item.href) {
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary lg:px-3"
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled
                    aria-disabled="true"
                    title={`${item.label} — coming soon`}
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground opacity-70 lg:px-3"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                    <span className="hidden lg:inline">
                      <ComingSoonBadge />
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted md:hidden"
              >
                {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAvatarMenuOpen((open) => !open)}
                  aria-label="Account menu"
                  aria-expanded={avatarMenuOpen}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:border-primary"
                >
                  {avatarUrl ? (
                    // Uploaded photos live in MinIO, an arbitrary external
                    // origin not registered with next/image — a plain <img>
                    // is the simplest correct option here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </button>

                {avatarMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close account menu"
                      className="fixed inset-0 z-10"
                      onClick={() => setAvatarMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-border bg-card p-1 shadow-sm">
                      <Link
                        href="/profile"
                        onClick={() => setAvatarMenuOpen(false)}
                        className="block rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        My Profile
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-muted"
                      >
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {isAuthenticated && menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 bg-foreground/10 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="absolute inset-x-0 top-full z-20 flex flex-col gap-1 border-b border-border bg-card p-3 shadow-sm md:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              if (item.href) {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {item.label}
                  </Link>
                );
              }
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground opacity-70"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <ComingSoonBadge />
                </button>
              );
            })}
          </nav>
        </>
      )}
    </header>
  );
}
