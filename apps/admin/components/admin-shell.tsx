'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Camera,
  ChevronDown,
  Crown,
  Flag,
  Hourglass,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptIndianRupee,
  ScrollText,
  Search,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { listReports, logoutAdmin } from '../lib/api-client';
import { useCurrentAdmin } from '../lib/use-current-admin';
import { CommandBar, openCommandBar } from './command-bar';
import { Avatar, Kbd } from './ui/kit';

interface NavItem {
  href: string;
  label: string;
  permission: string;
  icon: LucideIcon;
}

// Each item is shown only to admins holding the permission its API routes
// require, so nobody is offered a page that would just 403. Grouped the way
// staff think about the work.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ href: '/', label: 'Dashboard', permission: 'members.view', icon: LayoutDashboard }],
  },
  {
    label: 'Members',
    items: [
      { href: '/members', label: 'Members', permission: 'members.view', icon: Users },
      { href: '/photos', label: 'Photos', permission: 'photos.moderate', icon: Camera },
      { href: '/verifications', label: 'Verifications', permission: 'verification.review', icon: ShieldCheck },
      { href: '/reports', label: 'Reports', permission: 'reports.review', icon: Flag },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/finance', label: 'Finance', permission: 'finance.dashboard.view', icon: IndianRupee },
      { href: '/orders', label: 'Orders', permission: 'finance.dashboard.view', icon: ReceiptIndianRupee },
      { href: '/left-at-payment', label: 'Left at payment', permission: 'finance.dashboard.view', icon: Hourglass },
      { href: '/subscriptions', label: 'Subscriptions', permission: 'subscriptions.manage', icon: WalletCards },
      { href: '/plans', label: 'Plans', permission: 'plans.manage', icon: Tags },
    ],
  },
  {
    label: 'Sales',
    items: [{ href: '/vip-enquiries', label: 'VIP enquiries', permission: 'vip.manage', icon: Crown }],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admins', label: 'Admins', permission: 'admin_users.manage', icon: UserCog },
      { href: '/audit-logs', label: 'Audit log', permission: 'admin_users.manage', icon: ScrollText },
    ],
  },
];

// The pendant mark, as in the member app's logo (apps/web/components/brand/
// logo.tsx) and the app icon (app/icon.svg).
function Emblem({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 10 100 118" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="nk-emblem" gradientUnits="userSpaceOnUse" x1="20" y1="10" x2="80" y2="128">
          <stop offset="0" stopColor="#D9B45C" />
          <stop offset=".55" stopColor="#C89B3C" />
          <stop offset="1" stopColor="#B98B32" />
        </linearGradient>
      </defs>
      <g fill="url(#nk-emblem)">
        <path
          fillRule="evenodd"
          d="M6 128V32A22 22 0 0 1 50 32A22 22 0 0 1 94 32V128ZM13.5 82V33A14.5 14.5 0 0 1 42.5 33V82ZM57.5 82V33A14.5 14.5 0 0 1 86.5 33V82ZM14 90H43V128H14ZM57 90H86V128H57Z"
        />
        <polyline points="14,90 28.5,118 43,90" fill="none" stroke="url(#nk-emblem)" strokeWidth="6.5" />
        <polyline points="57,90 71.5,118 86,90" fill="none" stroke="url(#nk-emblem)" strokeWidth="6.5" />
        <path d="M18.8 63H37.2V66.2L34.2 69V70.4L37.2 73.4V77.4H18.8V73.4L21.8 70.4V69L18.8 66.2Z M22.8 63V53.2A5.2 5.2 0 0 1 33.2 53.2V63Z" />
        <path d="M69.2 41.2L69.8 38.4H70.7L71.3 35.2H72.7L73.3 38.4H74.2L74.8 41.2Z M67.4 48Q72 46 76.6 48L75.3 58.4L77.9 74.4H66.1L68.7 58.4Z M64.8 74.6H79.2V77.4H64.8Z" />
        <circle cx="72" cy="43" r="2.8" />
      </g>
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg">
      <Emblem className="h-7 w-auto" />
      <span className="leading-tight">
        <span className="block text-[14px] font-semibold tracking-[-0.01em] text-foreground">Nadar Kalyanam</span>
        <span className="block text-[11px] font-medium text-faint">Admin console</span>
      </span>
    </Link>
  );
}

const roleLabel = (roleName: string) => roleName.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, clearAuth } = useAdminAuth();
  const { admin, can } = useCurrentAdmin();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openReports, setOpenReports] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canReviewReports = can('reports.review');

  // Revokes the session server-side first; a failed call (network, already
  // expired token) still signs out locally rather than trapping the admin.
  async function handleLogout() {
    try {
      if (data.accessToken) await logoutAdmin(data.accessToken);
    } catch {
      // Local sign-out below still happens.
    } finally {
      clearAuth();
      router.push('/login');
    }
  }

  // Bell count: reports still needing attention (open or in review), the
  // same figure as the dashboard's "Pending reports".
  useEffect(() => {
    if (!data.accessToken || !canReviewReports) return;
    let cancelled = false;
    Promise.all([listReports(data.accessToken, { status: 'OPEN', limit: 1 }), listReports(data.accessToken, { status: 'IN_REVIEW', limit: 1 })])
      .then(([open, inReview]) => {
        if (!cancelled) setOpenReports(open.total + inReview.total);
      })
      .catch(() => {
        // No count rather than a wrong one.
      });
    return () => {
      cancelled = true;
    };
  }, [data.accessToken, canReviewReports, pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => can(item.permission)) })).filter((g) => g.items.length > 0);
  const commandPages = groups.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label })));
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex flex-col gap-5" aria-label="Admin">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wide text-faint">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors',
                    active ? 'bg-gold-soft font-semibold text-primary' : 'font-medium text-ink-soft hover:bg-black/[0.035] hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-[18px] w-[18px]', active ? 'text-primary' : 'text-faint')} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {href === '/reports' && openReports !== null && openReports > 0 && (
                    <span className="text-[12px] font-semibold tabular-nums text-bad">{openReports > 99 ? '99+' : openReports}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const adminName = admin?.email ?? '';

  return (
    <div className="min-h-screen bg-background lg:flex">
      <CommandBar pages={commandPages} accessToken={data.accessToken ?? null} canSearchMembers={can('members.view')} />

      {/* Desktop: persistent sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-black/[0.06] bg-card/70 backdrop-blur-xl lg:block" data-testid="admin-sidebar">
        <div className="thin-scroll sticky top-0 flex h-screen flex-col gap-7 overflow-y-auto px-3 py-5">
          <div className="px-2">
            <Brand />
          </div>
          {nav}
          {admin && (
            <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar name={adminName} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">{admin.email}</p>
                <p className="text-[12px] text-muted-foreground">{roleLabel(admin.roleName)}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Below desktop: the same sidebar as a drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <aside className="thin-scroll relative flex h-full w-72 max-w-[85vw] flex-col gap-7 overflow-y-auto bg-card px-3 py-5 shadow-pop" data-testid="admin-drawer">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-ink-soft hover:bg-black/[0.09]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-black/[0.06] bg-card/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-black/[0.05] lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="lg:hidden">
              <Brand />
            </span>
            <button
              type="button"
              onClick={openCommandBar}
              className="hidden h-9 w-80 items-center gap-2 rounded-lg border border-black/[0.06] bg-black/[0.04] pl-3 pr-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-black/[0.07] hover:text-ink-soft lg:flex"
              aria-label="Search (Ctrl K)"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 text-left">Search members or pages</span>
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button type="button" onClick={openCommandBar} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-black/[0.05] lg:hidden" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            {canReviewReports && (
              <Link
                href="/reports"
                className="relative grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-black/[0.05] hover:text-foreground"
                aria-label={openReports ? `${openReports} open reports` : 'Reports'}
                data-testid="header-bell"
              >
                <Bell className="h-5 w-5" />
                {openReports !== null && openReports > 0 && (
                  <span
                    className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white"
                    data-testid="header-bell-count"
                  >
                    {openReports > 99 ? '99+' : openReports}
                  </span>
                )}
              </Link>
            )}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className={cn('flex h-9 items-center gap-2 rounded-full pl-1 pr-2 transition-colors hover:bg-black/[0.05]', menuOpen && 'bg-black/[0.05]')}
              >
                <span data-testid="header-avatar">{admin ? <Avatar name={adminName} size="sm" /> : <span className="block h-7 w-7 rounded-full bg-muted" />}</span>
                {admin && (
                  <span className="hidden max-w-[200px] truncate text-[13px] font-medium text-foreground md:block" data-testid="header-email">
                    {admin.email}
                  </span>
                )}
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', menuOpen && 'rotate-180')} />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-[18px] border border-black/[0.06] bg-card/95 p-1.5 shadow-pop backdrop-blur-xl animate-menu-in">
                  {admin && (
                    <div className="flex items-center gap-3 px-3 py-3">
                      <Avatar name={adminName} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-foreground">{admin.email}</p>
                        <p className="text-[13px] text-muted-foreground">{roleLabel(admin.roleName)}</p>
                      </div>
                    </div>
                  )}
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-black/[0.04]"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {/* Wide tables scroll inside the content area instead of the whole page. */}
        <main className="mx-auto w-full min-w-0 max-w-[1240px] overflow-x-auto px-4 py-6 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
