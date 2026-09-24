'use client';

import { useState, type ReactElement, type SVGProps } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

function MandalaEmblem() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="h-7 w-7 text-[#7A0710]">
      <circle cx="20" cy="20" r="18" stroke="#D6A33A" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="20" cy="20" r="12" stroke="#7A0710" strokeWidth="1.2" />
      <path d="M20 4L22 14H18L20 4Z" fill="#7A0710" />
      <path d="M20 36L18 26H22L20 36Z" fill="#7A0710" />
      <path d="M4 20L14 18V22L4 20Z" fill="#7A0710" />
      <path d="M36 20L26 22V18L36 20Z" fill="#7A0710" />
      <circle cx="20" cy="20" r="4" fill="#D6A33A" />
    </svg>
  );
}

interface NavItem {
  key: string;
  label: string;
  href?: string;
  icon: (props: IconProps) => ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', href: '/', icon: HomeIcon },
  { key: 'matches', label: 'Matches', href: '/matches', icon: HeartIcon },
  { key: 'search', label: 'Search', href: '/search', icon: SearchIcon },
  { key: 'interests', label: 'Interests', href: '/interests', icon: StarIcon },
  { key: 'messages', label: 'Messages', href: '/messages', icon: ChatIcon },
  { key: 'notifications', label: 'Notifications', href: '/notifications', icon: BellIcon },
  { key: 'profile', label: 'Profile', href: '/profile', icon: UserIcon },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, hydrated, clearAuth } = useRegistration();
  const { profile } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const isAuthenticated = hydrated && Boolean(data.accessToken);
  const avatarUrl = profile?.photos?.find((photo) => photo.isPrimary)?.url ?? profile?.photos?.[0]?.url;

  function handleLogout() {
    setAvatarMenuOpen(false);
    claimAuthRedirect();
    clearAuth();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#E8DCC8] bg-[#FFFDF9]/95 backdrop-blur-md transition-shadow">
      {/* Radiant Festive Yellow Top Announcement Bar */}
      <div className="border-b border-[#F59E0B]/30 bg-[#FFD54F] px-4 py-1 text-[11px] font-semibold tracking-wider text-[#680A0E]">
        <div className="mx-auto flex w-full items-center justify-between px-2 sm:px-4 lg:px-8 xl:px-12 2xl:px-16">
          <div className="flex items-center gap-2">
            <span>Tradition</span>
            <span className="opacity-40">|</span>
            <span>Trust</span>
            <span className="opacity-40">|</span>
            <span>Together in Values</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-[#7A0710]/90 font-medium">
            <span>⭐ Trusted Nadar Matrimonial Platform</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* Brand Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-transform hover:scale-[1.01]">
          <MandalaEmblem />
          <div className="flex flex-col">
            <span className="font-[family-name:var(--font-body)] text-xl font-bold tracking-tight text-[#7A0710] sm:text-2xl">
              Nadar Kalyanam
            </span>
            <span className="hidden text-[10px] font-medium tracking-wider text-[#776B62] uppercase sm:inline-block">
              Matrimonial Portal
            </span>
          </div>
        </Link>

        {isAuthenticated && (
          <>
            {/* Desktop Navigation */}
            <nav className="hidden flex-1 items-center justify-center gap-1 md:flex lg:gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.href ? pathname === item.href : false;

                if (item.href) {
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'text-[#7A0710] font-semibold'
                          : 'text-[#2B211C] hover:bg-[#F9F3E7] hover:text-[#7A0710]'
                      }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          isActive ? 'text-[#7A0710]' : 'text-[#776B62] group-hover:text-[#7A0710]'
                        }`}
                      />
                      <span>{item.label}</span>
                      {/* Active gold/maroon indicator */}
                      {isActive && (
                        <span className="absolute bottom-0 left-2.5 right-2.5 h-[2.5px] rounded-full bg-[#D6A33A]" />
                      )}
                    </Link>
                  );
                }

                // Unavailable features: subtle muted link with gentle tooltip instead of jarring SOON badges
                return (
                  <div
                    key={item.key}
                    title={`${item.label} — Coming soon`}
                    className="group relative flex cursor-default items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#776B62]/75 transition-colors hover:text-[#2B211C]"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 text-[#968A82]" />
                    <span>{item.label}</span>
                    <span className="hidden text-[9px] text-[#A69990] italic lg:inline">soon</span>
                  </div>
                );
              })}
            </nav>

            {/* Right-hand Profile / Menu */}
            <div className="flex shrink-0 items-center gap-3">
              {/* Mobile Hamburger toggle */}
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#2B211C] transition-colors hover:bg-[#F9F3E7] md:hidden"
              >
                {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>

              {/* Avatar menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAvatarMenuOpen((open) => !open)}
                  aria-label="Account menu"
                  aria-expanded={avatarMenuOpen}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#E8DCC8] bg-[#F9F3E7] text-[#7A0710] shadow-sm transition-all hover:border-[#D6A33A] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D6A33A]/30"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
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
                    <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-[#E8DCC8] bg-[#FFFFFF] p-2 shadow-lg animate-in fade-in zoom-in-95 duration-150">
                      <div className="border-b border-[#F3EBDD] px-3 py-2">
                        <p className="truncate text-sm font-semibold text-[#2B211C]">
                          {profile?.fullName || 'My Account'}
                        </p>
                        <p className="truncate text-xs text-[#776B62]">
                          {profile?.details?.email || 'Nadar Kalyanam Member'}
                        </p>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/profile"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#2B211C] transition-colors hover:bg-[#F9F3E7] hover:text-[#7A0710]"
                        >
                          <UserIcon className="h-4 w-4 text-[#7A0710]" />
                          My Profile
                        </Link>
                        <Link
                          href="/membership"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#2B211C] transition-colors hover:bg-[#F9F3E7] hover:text-[#7A0710]"
                        >
                          <StarIcon className="h-4 w-4 text-[#7A0710]" />
                          Membership
                        </Link>
                        <Link
                          href="/"
                          onClick={() => setAvatarMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#2B211C] transition-colors hover:bg-[#F9F3E7] hover:text-[#7A0710]"
                        >
                          <HomeIcon className="h-4 w-4 text-[#776B62]" />
                          Home Page
                        </Link>
                      </div>

                      <div className="border-t border-[#F3EBDD] pt-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#94151C] transition-colors hover:bg-red-50"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          Log out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Drawer */}
      {isAuthenticated && menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 bg-black/20 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="relative z-20 flex flex-col gap-1 border-b border-[#E8DCC8] bg-[#FFFDF9] p-3 shadow-lg md:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.href ? pathname === item.href : false;

              if (item.href) {
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#F9F3E7] text-[#7A0710] font-semibold border-l-4 border-[#7A0710]'
                        : 'text-[#2B211C] hover:bg-[#F9F3E7]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-[#7A0710]" />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#D6A33A]" />}
                  </Link>
                );
              }

              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-[#776B62]/75"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-[#968A82]" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] text-[#A69990] italic">Coming soon</span>
                </div>
              );
            })}

            <div className="mt-2 border-t border-[#F3EBDD] pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#94151C] hover:bg-red-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log out
              </button>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}

