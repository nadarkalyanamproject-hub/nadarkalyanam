'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BadgeCheck, Flag, ScrollText, UserPlus } from 'lucide-react';
import type { RecentActivityItem } from '@nadar-kalyanam/schemas';
import { Card } from '@nadar-kalyanam/ui';
import { formatRelativeTime } from '@nadar-kalyanam/ui/relative-time';
import { ApiError, getRecentActivity } from '../lib/api-client';
import { auditActionLabel } from '../lib/audit-actions';

type Member = { userId: string; fullName: string | null; phoneNumber: string };

function MemberLink({ member }: { member: Member }) {
  return (
    <Link href={`/members/${member.userId}`} className="font-medium text-primary hover:underline">
      {member.fullName ?? member.phoneNumber}
    </Link>
  );
}

// One line of the feed: what happened (a friendly description built from the
// real record) and who/what it was about.
function describe(item: RecentActivityItem): { icon: ReactNode; title: string; detail: ReactNode } {
  switch (item.type) {
    case 'registration':
      return {
        icon: <UserPlus className="h-4 w-4" />,
        title: 'New member registered',
        detail: (
          <>
            <MemberLink member={item.member} />
            {item.member.fullName && <span className="text-muted-foreground"> · {item.member.phoneNumber}</span>}
          </>
        ),
      };
    case 'verification':
      return { icon: <BadgeCheck className="h-4 w-4" />, title: 'Profile verified', detail: <MemberLink member={item.member} /> };
    case 'report':
      return {
        icon: <Flag className="h-4 w-4" />,
        title: 'Report filed',
        detail: (
          <Link href="/reports" className="text-primary hover:underline">
            Against a {item.targetType.toLowerCase()} · {item.status.replace('_', ' ').toLowerCase()}
          </Link>
        ),
      };
    case 'admin_action':
      return {
        icon: <ScrollText className="h-4 w-4" />,
        title: auditActionLabel(item.action),
        detail: (
          <>
            {item.member ? (
              <MemberLink member={item.member} />
            ) : item.targetAdminEmail ? (
              <span className="text-foreground">{item.targetAdminEmail}</span>
            ) : item.targetType === 'Report' ? (
              <Link href="/reports" className="text-primary hover:underline">
                a report
              </Link>
            ) : null}
            {item.actorEmail && <span className="text-muted-foreground"> · by {item.actorEmail}</span>}
          </>
        ),
      };
  }
}

export function RecentActivity({ accessToken }: { accessToken: string }) {
  const [items, setItems] = useState<RecentActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecentActivity(accessToken, 15)
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load recent activity.');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <Card className="overflow-hidden rounded-2xl p-0 shadow-sm" data-testid="recent-activity">
      <div className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
      </div>
      {error && <p className="px-5 py-6 text-center text-sm text-destructive">{error}</p>}
      {!items && !error && <p className="px-5 py-6 text-center text-sm text-muted-foreground">Loading…</p>}
      {items && items.length === 0 && (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground" data-testid="recent-activity-empty">
          No activity yet. New registrations, reports and admin actions will appear here as they happen.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const { icon, title, detail } = describe(item);
            return (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3" data-activity-type={item.type} data-activity-at={item.at}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-primary" aria-hidden="true">
                  {icon}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-foreground" data-testid="activity-title">{title}</p>
                  <p className="truncate text-xs">{detail}</p>
                </div>
                <time dateTime={item.at} title={new Date(item.at).toLocaleString('en-IN')} className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(item.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
