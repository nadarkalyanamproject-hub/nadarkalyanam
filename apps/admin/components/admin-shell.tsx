'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
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
import { Logo, LogoMark } from './brand/logo';
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

// Collapsed rail on desktop: remembered per browser, a convenience only.
const COLLAPSE_KEY = 'nadar-admin-sidebar-collapsed';
const collapseListeners = new Set<() => void>();
// In-memory fallback so the toggle still works when storage is blocked.
let collapsedFallback = false;

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return collapsedFallback;
  }
}

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  // Keeps other open tabs in step.
  const onStorage = (e: StorageEvent) => e.key === COLLAPSE_KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    collapseListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function toggleSidebarCollapsed() {
  const next = !readCollapsed();
  collapsedFallback = next;
  try {
    window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
  } catch {
    // Not remembered; the fallback above still flips it.
  }
  collapseListeners.forEach((l) => l());
}

function Brand({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Link href="/" className="grid place-items-center rounded-lg" aria-label="Nadar Kalyanam admin console home">
        <LogoMark className="h-9 w-auto" />
      </Link>
    );
  }
  return (
    <Link href="/" className="flex flex-col items-start rounded-lg" aria-label="Nadar Kalyanam admin console home">
      <Logo className="text-[22px]" />
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Admin console</span>
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
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const toggleCollapsed = toggleSidebarCollapsed;
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

  // Ctrl/Cmd + B toggles the sidebar, as in most editors.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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

  // compact = icon-only rail (collapsed desktop sidebar); labels move to tooltips.
  const renderNav = (compact: boolean) => (
    <nav className={cn('flex flex-col', compact ? 'gap-3' : 'gap-5')} aria-label="Admin">
      {groups.map((group, gi) => (
        <div key={group.label}>
          {compact ? (
            gi > 0 && <div className="mx-auto mb-3 h-px w-8 bg-black/[0.08]" aria-hidden="true" />
          ) : (
            <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wide text-faint">{group.label}</p>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              const reportCount = href === '/reports' && openReports !== null && openReports > 0 ? openReports : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={compact ? label : undefined}
                  title={compact ? label : undefined}
                  className={cn(
                    'relative flex items-center rounded-lg py-2 text-[14px] transition-colors',
                    compact ? 'justify-center px-0' : 'gap-3 px-3',
                    active ? 'bg-gold-soft font-semibold text-primary' : 'font-medium text-ink-soft hover:bg-black/[0.035] hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-faint')} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
                  {!compact && <span className="flex-1">{label}</span>}
                  {reportCount > 0 &&
                    (compact ? (
                      <span className="absolute right-2.5 top-1.5 h-2 w-2 rounded-full bg-bad" aria-hidden="true" />
                    ) : (
                      <span className="text-[12px] font-semibold tabular-nums text-bad">{reportCount > 99 ? '99+' : reportCount}</span>
                    ))}
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
      <aside
        className={cn(
          'hidden shrink-0 border-r border-black/[0.06] bg-card/70 backdrop-blur-xl transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
        data-testid="admin-sidebar"
        data-collapsed={collapsed}
      >
        <div className={cn('thin-scroll sticky top-0 flex h-screen flex-col gap-7 overflow-y-auto overflow-x-hidden py-5', collapsed ? 'px-2.5' : 'px-3')}>
          <div className={collapsed ? '' : 'px-2'}>
            <Brand compact={collapsed} />
          </div>
          {renderNav(collapsed)}
          <div className="mt-auto flex flex-col gap-2">
            {admin && (
              <div className={cn('flex items-center rounded-xl py-2', collapsed ? 'justify-center' : 'gap-3 px-2')} title={collapsed ? `${admin.email}, ${roleLabel(admin.roleName)}` : undefined}>
                <Avatar name={adminName} size="md" />
                {!collapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{admin.email}</p>
                    <p className="text-[12px] text-muted-foreground">{roleLabel(admin.roleName)}</p>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar (Ctrl B)' : 'Collapse sidebar (Ctrl B)'}
              className={cn(
                'flex items-center rounded-lg py-2 text-[13px] font-medium text-faint transition-colors hover:bg-black/[0.035] hover:text-foreground',
                collapsed ? 'justify-center' : 'gap-3 px-3',
              )}
              data-testid="sidebar-toggle"
            >
              {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Below desktop: the same sidebar as a drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <aside className="thin-scroll relative flex h-full w-72 max-w-[85vw] flex-col gap-7 overflow-y-auto bg-card px-3 py-5 shadow-pop animate-drawer-in motion-reduce:animate-none" data-testid="admin-drawer">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-ink-soft hover:bg-black/[0.09]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderNav(false)}
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
