'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement, type SVGProps } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRegistration } from '../app/providers/registration-provider';
import { getInterestsHasUnread, getUnreadMessageCount, getUnreadNotificationCount, logout } from '../lib/api-client';
import { claimAuthRedirect } from '../lib/auth-events';
import {
  formatBadgeCount,
  INTERESTS_CHANGED_EVENT,
  MESSAGES_CHANGED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
} from '../lib/notifications';
import { useProfile } from '../lib/use-profile';
import { Heart, Crown } from 'lucide-react';

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
  return <Heart strokeWidth={1.8} fill="none" {...props} />;
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

export function MandalaEmblem() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="h-7 w-7 text-nk-maroon">
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
  return <Crown strokeWidth={1.8} fill="none" {...props} />;
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [hasNewInterests, setHasNewInterests] = useState(false);
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

  // Unread badges for Notifications and Messages — one poll for both, also
  // re-run on route change and whenever a page announces it just marked
  // something read. Failures are ignored (a badge keeps its last value); a
  // 401 is already handled by the api-client's unauthorized bridge.
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
      getUnreadMessageCount(token)
        .then((result) => {
          if (!cancelled) setUnreadMessages(result.unreadCount);
        })
        .catch(() => {});
      getInterestsHasUnread(token)
        .then((result) => {
          if (!cancelled) setHasNewInterests(result.hasUnread);
        })
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, UNREAD_POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    window.addEventListener(MESSAGES_CHANGED_EVENT, refresh);
    window.addEventListener(INTERESTS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      window.removeEventListener(MESSAGES_CHANGED_EVENT, refresh);
      window.removeEventListener(INTERESTS_CHANGED_EVENT, refresh);
    };
  }, [hydrated, data.accessToken, pathname]);
  // Badge per nav item (null = none). Counts are capped at "9+"; Interests
  // is a dot only ("something new since your last visit"), by design.
  const navBadges: Record<string, { text: string; label: string; dot?: true } | null> = {
    interests: isAuthenticated && hasNewInterests ? { text: '', label: 'New interests', dot: true } : null,
    notifications: isAuthenticated && formatBadgeCount(unreadCount)
      ? { text: formatBadgeCount(unreadCount)!, label: `${unreadCount} unread notifications` }
      : null,
    messages: isAuthenticated && formatBadgeCount(unreadMessages)
      ? { text: formatBadgeCount(unreadMessages)!, label: `${unreadMessages} unread messages` }
      : null,
  };
  const anyBadge = Boolean(navBadges.notifications || navBadges.messages || navBadges.interests);

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

  const [loggingOut, setLoggingOut] = useState(false);

  // Revokes the session server-side first, then clears local state. A failed
  // call (network, already-expired token) still signs the user out locally
  // rather than leaving them stuck.
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    closeAvatarMenu();
    claimAuthRedirect();
    try {
      if (data.accessToken) await logout(data.accessToken);
    } catch {
      // Local sign-out below still happens; the token expires on its own.
    } finally {
      clearAuth();
      setLoggingOut(false);
      router.push('/');
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b-2 border-nk-turmeric bg-nk-butter transition-shadow">
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* Brand Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-transform hover:scale-[1.01]">
          <MandalaEmblem />
          <div className="flex flex-col">
            <span className="font-[family-name:var(--font-body)] text-xl font-bold tracking-tight text-nk-maroon sm:text-2xl">
              Nadar Kalyanam
            </span>
            <span className="hidden text-[10px] font-medium tracking-wider text-nk-muted uppercase sm:inline-block">
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
                          ? 'text-nk-maroon font-semibold'
                          : 'text-nk-ink hover:bg-nk-butter-deep hover:text-nk-maroon'
                      }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          isActive ? 'text-nk-maroon' : 'text-nk-muted group-hover:text-nk-maroon'
                        }`}
                      />
                      <span>{item.label}</span>
                      {navBadges[item.key] &&
                        (navBadges[item.key]!.dot ? (
                          <span
                            role="status"
                            aria-label={navBadges[item.key]!.label}
                            data-testid={`${item.key}-badge`}
                            className="ml-0.5 inline-block h-2 w-2 rounded-full bg-nk-maroon"
                          />
                        ) : (
                          <span
                            aria-label={navBadges[item.key]!.label}
                            data-testid={`${item.key}-badge`}
                            className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-nk-maroon px-1 text-[10px] font-bold leading-none text-white"
                          >
                            {navBadges[item.key]!.text}
                          </span>
                        ))}
                      {/* Active gold/maroon indicator */}
                      {isActive && (
                        <span className="absolute bottom-0 left-2.5 right-2.5 h-[2.5px] rounded-full bg-nk-gold-light" />
                      )}
                    </Link>
                  );
                }

                // Unavailable features: subtle muted link with gentle tooltip instead of jarring SOON badges
                return (
                  <div
                    key={item.key}
                    title={`${item.label} — Coming soon`}
                    className="group relative flex cursor-default items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-nk-muted/75 transition-colors hover:text-nk-ink"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 text-[#968A82]" />
                    <span>{item.label}</span>
                    <span className="hidden text-[9px] text-nk-subtle italic lg:inline">soon</span>
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
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-nk-ink transition-colors hover:bg-nk-butter-deep md:hidden"
              >
                {menuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                {!menuOpen && anyBadge && (
                  <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-nk-maroon" />
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
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-nk-line bg-nk-sand text-nk-maroon shadow-sm transition-all hover:border-nk-gold-light hover:shadow-md focus:outline-none focus:ring-2 focus:ring-nk-gold-light/30"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </button>

                {avatarMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-nk-line bg-[#FFFFFF] p-2 shadow-lg animate-in fade-in zoom-in-95 duration-150">
                    <div className="border-b border-nk-line-soft px-3 py-2">
                      <p className="truncate text-sm font-semibold text-nk-ink">
                        {profile?.fullName || 'My Account'}
                      </p>
                      <p className="truncate text-xs text-nk-muted">
                        {profile?.details?.email || 'Nadar Kalyanam Member'}
                      </p>
                    </div>

                    <div id="account-menu" role="menu" aria-label="Account" onKeyDown={handleMenuKeyDown}>
                      <div className="py-1">
                        <Link
                          href="/profile"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-nk-ink hover:bg-nk-butter-deep hover:text-nk-maroon focus:bg-nk-sand`}
                        >
                          <UserIcon className="h-4 w-4 text-nk-maroon" />
                          My Profile
                        </Link>
                        <Link
                          href="/membership"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-nk-ink hover:bg-nk-butter-deep hover:text-nk-maroon focus:bg-nk-sand`}
                        >
                          <CrownIcon className="h-4 w-4 text-nk-maroon" />
                          Membership
                        </Link>
                        <Link
                          href="/membership/contacts"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-nk-ink hover:bg-nk-butter-deep hover:text-nk-maroon focus:bg-nk-sand`}
                        >
                          <UserIcon className="h-4 w-4 text-nk-muted" />
                          My Unlocked Contacts
                        </Link>
                        <Link
                          href="/contact"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-nk-ink hover:bg-nk-butter-deep hover:text-nk-maroon focus:bg-nk-sand`}
                        >
                          <ChatIcon className="h-4 w-4 text-nk-muted" />
                          Contact Us
                        </Link>
                        <Link
                          href="/"
                          role="menuitem"
                          onClick={closeAvatarMenu}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-nk-ink hover:bg-nk-butter-deep hover:text-nk-maroon focus:bg-nk-sand`}
                        >
                          <HomeIcon className="h-4 w-4 text-nk-muted" />
                          Home Page
                        </Link>
                      </div>

                      <div className="border-t border-nk-line-soft pt-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleLogout()}
                          className={`${ACCOUNT_MENU_ITEM_CLASS} text-nk-maroon-bright hover:bg-red-50 focus:bg-red-50`}
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
            {/* The logo already links home; this text link would push the
                header past a phone's width. */}
            <Link
              href="/"
              className="hidden sm:inline text-xs sm:text-sm font-semibold text-nk-ink hover:text-nk-maroon transition-colors"
            >
              Home
            </Link>
            <Link
              href="/membership"
              className={`text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                pathname === '/membership'
                  ? 'text-nk-maroon font-bold'
                  : 'text-nk-ink hover:text-nk-maroon'
              }`}
            >
              <CrownIcon className="h-4 w-4 text-nk-maroon" />
              <span>Membership</span>
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-nk-maroon bg-[#FFFBF5] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-nk-maroon shadow-xs transition-all hover:bg-nk-maroon hover:text-white"
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
          <nav className="relative z-20 flex flex-col gap-1 border-b border-nk-line bg-nk-ivory p-3 shadow-lg md:hidden">
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
                        ? 'bg-nk-sand text-nk-maroon font-semibold border-l-4 border-nk-maroon'
                        : 'text-nk-ink hover:bg-nk-butter-deep'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-nk-maroon" />
                      <span>{item.label}</span>
                      {navBadges[item.key] &&
                        (navBadges[item.key]!.dot ? (
                          <span
                            role="status"
                            aria-label={navBadges[item.key]!.label}
                            className="inline-block h-2 w-2 rounded-full bg-nk-maroon"
                          />
                        ) : (
                          <span
                            aria-label={navBadges[item.key]!.label}
                            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-nk-maroon px-1 text-[10px] font-bold leading-none text-white"
                          >
                            {navBadges[item.key]!.text}
                          </span>
                        ))}
                    </div>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-nk-gold-light" />}
                  </Link>
                );
              }

              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-nk-muted/75"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-[#968A82]" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] text-nk-subtle italic">Coming soon</span>
                </div>
              );
            })}

          </nav>
        </>
      )}
    </header>
  );
}

