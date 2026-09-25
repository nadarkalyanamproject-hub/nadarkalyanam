'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/members', label: 'Members' },
  { href: '/reports', label: 'Reports' },
  { href: '/audit-logs', label: 'Audit Log' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAuth } = useAdminAuth();

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
              {NAV_ITEMS.map((item) => (
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
          <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
