'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { formatDisplayDateTime } from '@nadar-kalyanam/schemas';
import { Button } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { ApiError, getMemberConversation, getMemberHistory, type MemberHistory as Activity, type MemberConversation, type PersonRef } from '../lib/api-client';
import { auditActionLabel } from '../lib/audit-actions';
import { rupees } from '../lib/billing-api';
import { useCurrentAdmin } from '../lib/use-current-admin';
import { StatusBadge, StatusText } from './status-badge';

type TabKey = 'interests' | 'chats' | 'calls' | 'shortlists' | 'safety' | 'payments' | 'notifications' | 'access' | 'staff';

const when = (iso: string | null | undefined) => (iso ? formatDisplayDateTime(iso) : '-');
const humanize = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ');

function Person({ person }: { person: PersonRef | null }) {
  if (!person) return <span className="text-muted-foreground">Unknown member</span>;
  return (
    <span className="flex flex-col">
      <Link href={`/members/${person.userId}`} className="font-medium text-foreground hover:text-primary hover:underline">
        {person.fullName ?? 'No profile yet'}
      </Link>
      {person.phoneNumber && <span className="text-xs text-muted-foreground">{person.phoneNumber}</span>}
    </span>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-foreground/80 text-left">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap py-2 pr-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border align-top">
              {cells.map((cell, j) => (
                <td key={j} className="py-2.5 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ title, total, shown, children }: { title: string; total?: number; shown?: number; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-1 flex items-baseline gap-2 text-sm font-semibold text-foreground">
        {title}
        {total !== undefined && <span className="font-normal text-muted-foreground">{total}</span>}
      </h3>
      {children}
      {total !== undefined && shown !== undefined && total > shown && (
        <p className="mt-2 text-xs text-muted-foreground">Showing the newest {shown} of {total}.</p>
      )}
    </section>
  );
}

function ChatViewer({ userId, conversationId, onClose }: { userId: string; conversationId: string; onClose: () => void }) {
  const { data } = useAdminAuth();
  const [chat, setChat] = useState<MemberConversation | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!data.accessToken) return;
    getMemberConversation(data.accessToken, userId, conversationId)
      .then(setChat)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open this chat.'));
  }, [data.accessToken, userId, conversationId]);

  const nameOf = (id: string) => chat?.participants.find((p) => p.userId === id)?.fullName ?? 'Member';

  return (
    <div className="mt-4 border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {chat ? chat.participants.map((p) => p.fullName ?? p.phoneNumber).join(' and ') : 'Chat'}
          </p>
          <p className="text-xs text-muted-foreground">
            {chat ? `Started ${when(chat.startedAt)} · ${chat.total} messages · this view was recorded in the audit log` : 'Loading...'}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close chat
        </Button>
      </div>
      {error && <p className="px-4 py-3 text-sm text-destructive">{error}</p>}
      {chat && (
        <ol className="max-h-[480px] overflow-y-auto px-4 py-2">
          {chat.total > chat.messages.length && (
            <li className="py-2 text-xs text-muted-foreground">Showing the newest {chat.messages.length} of {chat.total} messages.</li>
          )}
          {chat.messages.map((m) => (
            <li key={m.id} className={`border-b border-border py-2.5 last:border-0 ${m.senderId === userId ? 'pl-0' : 'pl-6'}`}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className={`font-semibold ${m.senderId === userId ? 'text-primary' : 'text-foreground'}`}>{nameOf(m.senderId)}</span>
                <span className="text-muted-foreground">{when(m.createdAt)}</span>
                <StatusBadge status={m.status} />
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
            </li>
          ))}
          {chat.messages.length === 0 && <li className="py-4 text-sm text-muted-foreground">No messages in this chat.</li>}
        </ol>
      )}
    </div>
  );
}

// Everything the platform holds about one member, read-only, in tabs.
export function MemberActivity({ userId }: { userId: string }) {
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<TabKey>('interests');
  const [openChat, setOpenChat] = useState<string | null>(null);

  useEffect(() => {
    if (!data.accessToken) return;
    getMemberHistory(data.accessToken, userId)
      .then(setActivity)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load this member’s activity.'));
  }, [data.accessToken, userId]);

  if (error) return <section className="border border-border bg-card p-6 text-sm text-destructive">{error}</section>;
  if (!activity) return <section className="border border-border bg-card p-6 text-sm text-muted-foreground">Loading activity...</section>;

  const a = activity;
  const activeSessions = a.sessions.filter((s) => s.active).length;
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'interests', label: 'Interests', count: a.interests.sentTotal + a.interests.receivedTotal },
    { key: 'chats', label: 'Chats', count: a.conversations.length },
    { key: 'calls', label: 'Calls', count: a.calls.total },
    { key: 'shortlists', label: 'Shortlists', count: a.shortlists.madeTotal + a.shortlists.byTotal },
    { key: 'safety', label: 'Reports and blocks', count: a.reports.madeTotal + a.reports.againstTotal + a.blocks.made.length + a.blocks.by.length },
    { key: 'payments', label: 'Payments', count: a.orders.total },
    { key: 'notifications', label: 'Notifications', count: a.notifications.total },
    { key: 'access', label: 'Sign-ins and devices', count: activeSessions },
    { key: 'staff', label: 'Staff actions', count: a.adminActions.total },
  ];

  return (
    <section className="border border-border bg-card" data-testid="member-activity">
      <div className="border-b border-border px-6 pt-5">
        <h2 className="text-lg font-semibold text-foreground">Member activity</h2>
        <p className="text-xs text-muted-foreground">Everything this member has done on the platform, and everything staff have done to this account.</p>
        <nav className="-mb-px mt-4 flex gap-6 overflow-x-auto" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors ${
                tab === t.key ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label} <span className="ml-1 tabular-nums text-muted-foreground">{t.count}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="px-6 py-5">
        {tab === 'interests' && (
          <>
            <Block title="Sent by this member" total={a.interests.sentTotal} shown={a.interests.sent.length}>
              <Table
                head={['To', 'Status', 'Sent', 'Answered']}
                empty="No interests sent."
                rows={a.interests.sent.map((i) => [<Person key="p" person={i.member} />, <StatusBadge key="s" status={i.status} />, when(i.createdAt), when(i.respondedAt)])}
              />
            </Block>
            <Block title="Received by this member" total={a.interests.receivedTotal} shown={a.interests.received.length}>
              <Table
                head={['From', 'Status', 'Received', 'Answered']}
                empty="No interests received."
                rows={a.interests.received.map((i) => [<Person key="p" person={i.member} />, <StatusBadge key="s" status={i.status} />, when(i.createdAt), when(i.respondedAt)])}
              />
            </Block>
          </>
        )}

        {tab === 'chats' && (
          <Block title="Chats" total={a.conversations.length}>
            {!can('messages.view') && (
              <p className="mb-3 text-xs text-muted-foreground">
                You can see who this member chats with. Reading the messages needs the Read chats permission (Super Admin).
              </p>
            )}
            <Table
              head={['With', 'Messages', 'Started', 'Last message', '']}
              empty="No chats yet. A chat opens when an interest is accepted."
              rows={a.conversations.map((c) => [
                <Person key="p" person={c.with} />,
                c.messageCount,
                when(c.startedAt),
                when(c.lastMessageAt),
                can('messages.view') ? (
                  <Button key="b" type="button" variant="outline" size="sm" onClick={() => setOpenChat(openChat === c.id ? null : c.id)}>
                    {openChat === c.id ? 'Hide' : 'Read chat'}
                  </Button>
                ) : (
                  ''
                ),
              ])}
            />
            {openChat && <ChatViewer userId={userId} conversationId={openChat} onClose={() => setOpenChat(null)} />}
          </Block>
        )}

        {tab === 'calls' && (
          <Block title="Voice and video calls" total={a.calls.total} shown={a.calls.items.length}>
            <Table
              head={['Direction', 'With', 'Result', 'Started', 'Length']}
              empty="No calls."
              rows={a.calls.items.map((c) => [
                c.direction === 'OUTGOING' ? 'Made' : 'Received',
                <Person key="p" person={c.with} />,
                <StatusBadge key="s" status={c.status} />,
                when(c.startedAt),
                c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)} min ${c.durationSeconds % 60} s` : '-',
              ])}
            />
          </Block>
        )}

        {tab === 'shortlists' && (
          <>
            <Block title="Shortlisted by this member" total={a.shortlists.madeTotal} shown={a.shortlists.made.length}>
              <Table head={['Member', 'Added']} empty="Nobody shortlisted." rows={a.shortlists.made.map((s) => [<Person key="p" person={s.member} />, when(s.createdAt)])} />
            </Block>
            <Block title="Members who shortlisted this member" total={a.shortlists.byTotal} shown={a.shortlists.by.length}>
              <Table head={['Member', 'Added']} empty="Nobody has shortlisted this member." rows={a.shortlists.by.map((s) => [<Person key="p" person={s.member} />, when(s.createdAt)])} />
            </Block>
          </>
        )}

        {tab === 'safety' && (
          <>
            <Block title="Reports against this member" total={a.reports.againstTotal} shown={a.reports.against.length}>
              <Table
                head={['Reported by', 'About', 'Reason', 'Status', 'Filed', 'Closed']}
                empty="No reports against this member."
                rows={a.reports.against.map((r) => [
                  <Person key="p" person={r.reporter} />,
                  r.targetType === 'MESSAGE' ? 'A message' : 'The profile',
                  <span key="r" className="block max-w-xs whitespace-pre-wrap">{r.reason}</span>,
                  <StatusBadge key="s" status={r.status} />,
                  when(r.createdAt),
                  when(r.resolvedAt),
                ])}
              />
            </Block>
            <Block title="Reports made by this member" total={a.reports.madeTotal} shown={a.reports.made.length}>
              <Table
                head={['Against', 'About', 'Reason', 'Status', 'Filed']}
                empty="This member has not reported anyone."
                rows={a.reports.made.map((r) => [
                  <Person key="p" person={r.against} />,
                  r.targetType === 'MESSAGE' ? 'A message' : 'A profile',
                  <span key="r" className="block max-w-xs whitespace-pre-wrap">{r.reason}</span>,
                  <StatusBadge key="s" status={r.status} />,
                  when(r.createdAt),
                ])}
              />
            </Block>
            <Block title="Blocked by this member" total={a.blocks.made.length}>
              <Table head={['Member', 'Blocked']} empty="This member has not blocked anyone." rows={a.blocks.made.map((b) => [<Person key="p" person={b.member} />, when(b.createdAt)])} />
            </Block>
            <Block title="Members who blocked this member" total={a.blocks.by.length}>
              <Table head={['Member', 'Blocked']} empty="Nobody has blocked this member." rows={a.blocks.by.map((b) => [<Person key="p" person={b.member} />, when(b.createdAt)])} />
            </Block>
          </>
        )}

        {tab === 'payments' && (
          <>
            <Block title="Orders" total={a.orders.total} shown={a.orders.items.length}>
              <Table
                head={['Order', 'For', 'Amount', 'Status', 'Created', 'Paid', 'Refunded']}
                empty="No orders."
                rows={a.orders.items.map((o) => [
                  <span key="id" className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</span>,
                  o.kind === 'HOROSCOPE_MATCH' ? 'Porutham report' : (o.planName ?? 'Membership'),
                  <span key="a" className="tabular-nums">{rupees(o.amountInPaise)}</span>,
                  o.leftAtPayment ? (
                    <StatusText key="s" tone="waiting" label="Left at payment" />
                  ) : (
                    <StatusBadge key="s" status={o.status} />
                  ),
                  when(o.createdAt),
                  when(o.paidAt),
                  when(o.refundedAt),
                ])}
              />
            </Block>
            <Block title="Porutham reports bought" total={a.poruthamReports.length}>
              <Table
                head={['Match with', 'Bought', 'Order']}
                empty="No porutham reports."
                rows={a.poruthamReports.map((h) => [
                  <Person key="p" person={h.member} />,
                  when(h.createdAt),
                  h.order ? (
                    <span key="o" className="flex items-center gap-2">
                      <span className="tabular-nums">{rupees(h.order.amountInPaise)}</span>
                      <StatusBadge status={h.order.status} />
                    </span>
                  ) : (
                    'Free'
                  ),
                ])}
              />
            </Block>
          </>
        )}

        {tab === 'notifications' && (
          <Block title={`Notifications sent to this member (${a.notifications.unread} unread)`} total={a.notifications.total} shown={a.notifications.items.length}>
            <Table
              head={['Type', 'Sent', 'Seen']}
              empty="No notifications."
              rows={a.notifications.items.map((n) => [
                humanize(n.type),
                when(n.createdAt),
                n.read ? <StatusText key="r" tone="good" label="Seen" /> : <StatusText key="r" tone="waiting" label="Not seen" />,
              ])}
            />
          </Block>
        )}

        {tab === 'access' && (
          <>
            <Block title={`Sign-ins (${activeSessions} signed in now)`} total={a.sessions.length}>
              <Table
                head={['Device', 'State', 'Signed in', 'Ends', 'Signed out']}
                empty="No sign-ins."
                rows={a.sessions.map((s) => [
                  s.deviceLabel ?? 'Unknown device',
                  s.active ? <StatusBadge key="s" status="ACTIVE" label="Signed in" /> : <StatusBadge key="s" status="SIGNED_OUT" label={s.revokedAt ? 'Signed out' : 'Expired'} />,
                  when(s.createdAt),
                  when(s.expiresAt),
                  when(s.revokedAt),
                ])}
              />
            </Block>
            <Block title="App installs" total={a.devices.length}>
              <Table
                head={['Platform', 'Push notifications', 'Registered']}
                empty="No app installs registered."
                rows={a.devices.map((d) => [
                  humanize(d.platform),
                  d.pushEnabled ? <StatusText key="p" tone="good" label="On" /> : <StatusText key="p" tone="neutral" label="Off" />,
                  when(d.createdAt),
                ])}
              />
            </Block>
          </>
        )}

        {tab === 'staff' && (
          <Block title="Staff actions on this account" total={a.adminActions.total} shown={a.adminActions.items.length}>
            <Table
              head={['Action', 'By', 'When', 'Details']}
              empty="No staff actions on this account."
              rows={a.adminActions.items.map((x) => [
                auditActionLabel(x.action),
                x.admin,
                when(x.createdAt),
                <span key="m" className="block max-w-sm text-xs text-muted-foreground">
                  {typeof x.metadata.reason === 'string' ? `Reason: ${x.metadata.reason}` : ''}
                </span>,
              ])}
            />
          </Block>
        )}
      </div>
    </section>
  );
}
