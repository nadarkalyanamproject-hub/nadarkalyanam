'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement, type SVGProps } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRegistration } from '../app/providers/registration-provider';
import { getUnreadNotificationCount } from '../lib/api-client';
import { claimAuthRedirect } from '../lib/auth-events';
import { formatBadgeCount, NOTIFICATIONS_CHANGED_EVENT } from '../lib/notifications';
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
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
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

function CrownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 18h18M4 14l3-8 5 4 5-4 3 8H4Z" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="12" cy="4" r="1" fill="currentColor" />
      <circle cx="20" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

interface NavItem {
  key: string;
  label: string;
  href?: string;
  icon: (props: IconProps) => ReactElement;
}

// How often the header re-checks the unread count (it also re-checks on
// every route change and whenever the notifications page marks something
// read). Polling only — no websocket dependency.
const UNREAD_POLL_MS = 45_000;

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', href: '/', icon: HomeIcon },
  { key: 'matches', label: 'Matches', href: '/matches', icon: HeartIcon },
  { key: 'search', label: 'Search', href: '/search', icon: SearchIcon },
  { key: 'interests', label: 'Interests', href: '/interests', icon: StarIcon },
  { key: 'messages', label: 'Messages', href: '/messages', icon: ChatIcon },
  { key: 'notifications', label: 'Notifications', href: '/notifications', icon: BellIcon },
  { key: 'membership', label: 'Membership', href: '/membership', icon: CrownIcon },
];

// The profile icon's dropdown — the one profile entry point, desktop and
// mobile alike.
const ACCOUNT_MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus:outline-none';

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, hydrated, clearAuth } = useRegistration();
  const { profile } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  // The account menu remembers the path it was opened on, and only counts as
  // open while still on that path — so any navigation closes it without a
  // state-syncing effect.
  const [avatarMenuPath, setAvatarMenuPath] = useState<string | null>(null);
  const avatarMenuOpen = avatarMenuPath !== null && avatarMenuPath === pathname;
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const isAuthenticated = hydrated && Boolean(data.accessToken);
  const [unreadCount, setUnreadCount] = useState(0);
  const avatarUrl = profile?.photos?.find((photo) => photo.isPrimary)?.url ?? profile?.photos?.[0]?.url;

  function closeAvatarMenu() {
    setAvatarMenuPath(null);
  }

  function toggleAvatarMenu() {
    setMenuOpen(false);
    setAvatarMenuPath(avatarMenuOpen ? null : pathname);
  }

  // Outside press closes; Escape closes and hands focus back to the icon.
  // Listeners exist only while the menu is open and are removed on close or
  // unmount. A press on the icon itself is "inside", so the icon's own click
  // is what toggles it shut rather than this listener racing it.
  useEffect(() => {
    if (!avatarMenuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!avatarMenuRef.current?.contains(event.target as Node)) {
        setAvatarMenuPath(null);
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setAvatarMenuPath(null);
        avatarButtonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [avatarMenuOpen]);

  // Unread-notification badge. Failures are ignored (the badge just keeps
  // its last value); a 401 is already handled by the api-client's
  // unauthorized bridge.
  useEffect(() => {
    const token = data.accessToken;
    if (!hydrated || !token) return;
    let cancelled = false;
    const refresh = () => {
      getUnreadNotificationCount(token)
        .then((result) => {
          if (!cancelled) setUnreadCount(result.unreadCount);
        })
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, UNREAD_POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [hydrated, data.accessToken, pathname]);
  const unreadBadge = isAuthenticated ? formatBadgeCount(unreadCount) : null;

  // Arrow-key movement between the menu's items (role="menu" convention).
  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  function handleLogout() {
    closeAvatarMenu();
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
                      {item.key === 'notifications' && unreadBadge && (
                        <span
                          aria-label={`${unreadCount} unread notifications`}
                          data-testid="notifications-badge"
                          className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#7A0710] px-1 text-[10px] font-bold leading-none text-white"
                        >
                          {unreadBadge}
                        </span>
                      )}
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
                onClick={() => {
                  closeAvatarMenu();
                  setMenuOpen((open) => !open);
                }}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#2B211C] transition-colors hover:bg-[#F9F3E7] md:hidden"
              >
                {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                {!menuOpen && unreadBadge && (
                  <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#7A0710]" />
                )}
              </button>

              {/* Account menu: the only profile entry point (desktop + mobile).
                  The icon only toggles the menu; it never navigates. */}
              <div className="relative" ref={avatarMenuRef}>
                <button
                  ref={avatarButtonRef}
                  type="button"
                  onClick={toggleAvatarMenu}
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={avatarMenuOpen}
                  aria-controls="account-menu"
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#E8DCC8] bg-[#F9F3E7] text-[#7A0710] shadow-sm transition-all hover:border-[#D6A33A] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#D6A33A]/30"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </button>

                {avatarMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-[#E8DCC8] bg-[#FFFFFF] p-2 shadow-lg animate-in fade-in zoom-in-95 duration-150">
                    <div className="border-b border-[#F3EBDD] px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[#2B211C]">
                        {profile?.fullName || 'My Account'}
                      </p>
                      <p className="truncate text-xs text-[#776B62]">
                        {profile?.details?.email || 'Nadar Kalyanam Member'}
                      </p>
                    </div>

                    <div id="account-menu" role="menu" aria-label="Account" onKeyDown={handleMenuKeyDown}>
                      <div className="py-1">
                        <Link
                          href="/profile"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-[#2B211C] hover:bg-[#F9F3E7] hover:text-[#7A0710] focus:bg-[#F9F3E7]`}
                        >
                          <UserIcon className="h-4 w-4 text-[#7A0710]" />
                          My Profile
                        </Link>
                        <Link
                          href="/membership"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-[#2B211C] hover:bg-[#F9F3E7] hover:text-[#7A0710] focus:bg-[#F9F3E7]`}
                        >
                          <CrownIcon className="h-4 w-4 text-[#7A0710]" />
                          Membership
                        </Link>
                        <Link
                          href="/"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-[#2B211C] hover:bg-[#F9F3E7] hover:text-[#7A0710] focus:bg-[#F9F3E7]`}
                        >
                          <HomeIcon className="h-4 w-4 text-[#776B62]" />
                          Home Page
                        </Link>
                      </div>

                      <div className="border-t border-[#F3EBDD] pt-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-[#94151C] hover:bg-red-50 focus:bg-red-50`}
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
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {!isAuthenticated && (
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/"
              className="text-xs sm:text-sm font-semibold text-[#2B211C] hover:text-[#7A0710] transition-colors"
            >
              Home
            </Link>
            <Link
              href="/membership"
              className={`text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                pathname === '/membership'
                  ? 'text-[#7A0710] font-bold'
                  : 'text-[#2B211C] hover:text-[#7A0710]'
              }`}
            >
              <CrownIcon className="h-4 w-4 text-[#C89B3C]" />
              <span>Membership</span>
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[#7A0710] bg-[#FFFBF5] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#7A0710] shadow-xs transition-all hover:bg-[#7A0710] hover:text-white"
            >
              Log In
            </Link>
          </div>
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
                      {item.key === 'notifications' && unreadBadge && (
                        <span
                          aria-label={`${unreadCount} unread notifications`}
                          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#7A0710] px-1 text-[10px] font-bold leading-none text-white"
                        >
                          {unreadBadge}
                        </span>
                      )}
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

          </nav>
        </>
      )}
    </header>
  );
}

