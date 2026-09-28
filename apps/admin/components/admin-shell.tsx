'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { useCurrentAdmin } from '../lib/use-current-admin';

// Each item is shown only to admins holding the permission its API routes
// require, so nobody is offered a page that would just 403.
const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', permission: 'members.view' },
  { href: '/members', label: 'Members', permission: 'members.view' },
  { href: '/reports', label: 'Reports', permission: 'reports.review' },
  { href: '/audit-logs', label: 'Audit Log', permission: 'admin_users.manage' },
  { href: '/admins', label: 'Admins', permission: 'admin_users.manage' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAuth } = useAdminAuth();
  const { admin, can } = useCurrentAdmin();

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-primary">Nadar Kalyanam Admin</span>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.filter((item) => can(item.permission)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {admin && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {admin.email} · {admin.roleName}
              </span>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
