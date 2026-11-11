'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Camera, ChevronDown, Crown, Flag, IndianRupee, LayoutDashboard, LogOut, Menu, Receipt, ScrollText, ShieldCheck, Tags, Users, WalletCards, X } from 'lucide-react';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { listReports, logoutAdmin } from '../lib/api-client';
import { useCurrentAdmin } from '../lib/use-current-admin';

// Each item is shown only to admins holding the permission its API routes
// require, so nobody is offered a page that would just 403.
const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', permission: 'members.view', icon: LayoutDashboard },
  { href: '/members', label: 'Members', permission: 'members.view', icon: Users },
  { href: '/photos', label: 'Photos', permission: 'photos.moderate', icon: Camera },
  { href: '/verifications', label: 'Verifications', permission: 'verification.review', icon: ShieldCheck },
  { href: '/reports', label: 'Reports', permission: 'reports.review', icon: Flag },
  { href: '/plans', label: 'Plans', permission: 'plans.manage', icon: Tags },
  { href: '/subscriptions', label: 'Subscriptions', permission: 'subscriptions.manage', icon: WalletCards },
  { href: '/orders', label: 'Orders', permission: 'finance.dashboard.view', icon: Receipt },
  { href: '/finance', label: 'Finance', permission: 'finance.dashboard.view', icon: IndianRupee },
  { href: '/vip-enquiries', label: 'VIP enquiries', permission: 'vip.manage', icon: Crown },
  { href: '/audit-logs', label: 'Audit Log', permission: 'admin_users.manage', icon: ScrollText },
  { href: '/admins', label: 'Admins', permission: 'admin_users.manage', icon: ShieldCheck },
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
    <Link href="/" className="flex items-center gap-2.5">
      <Emblem />
      <span className="leading-tight">
        <span className="block text-sm font-bold text-primary">Nadar Kalyanam</span>
        <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Admin</span>
      </span>
    </Link>
  );
}

// "SUPER_ADMIN" -> "SA"
const initials = (roleName: string) =>
  roleName
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
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

  // Bell count: reports still needing attention (open or in review) — the
  // same figure as the dashboard's "Pending reports", read from the Reports
  // queue's own totals, so only admins who can review reports see it.
  useEffect(() => {
    if (!data.accessToken || !canReviewReports) return;
    let cancelled = false;
    Promise.all([
      listReports(data.accessToken, { status: 'OPEN', limit: 1 }),
      listReports(data.accessToken, { status: 'IN_REVIEW', limit: 1 }),
    ])
      .then(([open, inReview]) => {
        if (!cancelled) setOpenReports(open.total + inReview.total);
      })
      .catch(() => {
        // No badge rather than a wrong one.
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

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {NAV_ITEMS.filter((item) => can(item.permission)).map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setDrawerOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm transition-colors ${
              active
                ? 'border-primary bg-muted font-semibold text-primary'
                : 'border-transparent font-medium text-foreground hover:bg-muted/60'
            }`}
          >
            <Icon className={`h-4.5 w-4.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary lg:flex">
      {/* Desktop: persistent sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:block" data-testid="admin-sidebar">
        <div className="sticky top-0 flex h-screen flex-col gap-6 px-4 py-5">
          <Brand />
          {nav}
        </div>
      </aside>

      {/* Below desktop: the same sidebar as a drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-64 max-w-[80vw] flex-col gap-6 bg-card px-4 py-5 shadow-xl" data-testid="admin-drawer">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:invisible">
            <button type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)} className="rounded-md p-1.5 text-foreground hover:bg-muted lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <span className="lg:hidden">
              <Brand />
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {canReviewReports && (
              <Link
                href="/reports"
                className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={openReports ? `${openReports} open reports` : 'Reports'}
                data-testid="header-bell"
              >
                <Bell className="h-5 w-5" />
                {openReports !== null && openReports > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground" data-testid="header-bell-count">
                    {openReports > 99 ? '99+' : openReports}
                  </span>
                )}
              </Link>
            )}
            {admin && <span className="hidden text-sm text-muted-foreground md:inline" data-testid="header-email">{admin.email}</span>}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex items-center gap-1 rounded-full p-0.5 hover:bg-muted"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" data-testid="header-avatar">
                  {admin ? initials(admin.roleName) : ''}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                  {admin && (
                    <div className="border-b border-border px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-foreground">{admin.email}</p>
                      <p className="text-xs text-muted-foreground">{roleLabel(admin.roleName)}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {/* Wide tables scroll inside the content area instead of the whole page. */}
        <main className="mx-auto w-full min-w-0 max-w-6xl overflow-x-auto px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
