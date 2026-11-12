'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDisplayDateTime } from '@nadar-kalyanam/schemas';
import { Button, Card, Input, Select } from '@nadar-kalyanam/ui';
import { IndianRupee, PhoneCall } from 'lucide-react';
import { AdminShell } from '../../components/admin-shell';
import { StatCard } from '../../components/ui/kit';
import { StatusBadge, StatusText } from '../../components/status-badge';
import { ApiError } from '../../lib/api-client';
import { downloadUnpaidCheckoutsCsv, listAllUnpaidCheckouts, listUnpaidCheckouts, rupees, type UnpaidCheckoutsPage } from '../../lib/billing-api';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

const PAGE = 25;
const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`);

// Members who opened the payment window and did not pay within two days,
// kept as their own list so staff can call them.
export default function LeftAtPaymentPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const token = data.accessToken;
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<UnpaidCheckoutsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    listUnpaidCheckouts(token, { kind, q: search.trim(), offset, limit: PAGE })
      .then((r) => {
        setResult(r);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the list.'));
  }, [token, kind, search, offset]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [ready, load]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      const rows = await listAllUnpaidCheckouts(token, { kind, q: search.trim() });
      const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
      downloadUnpaidCheckoutsCsv(rows, `left-at-payment-${today}.csv`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the list.');
    } finally {
      setExporting(false);
    }
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[30px]">Left at payment</h1>
            <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              Members who opened the payment window and did not pay within {result ? result.afterHours / 24 : 2} days. A member leaves this list
              as soon as they pay. Attempts from the last {result?.lookbackDays ?? 180} days are shown.
            </p>
          </div>
          <Button type="button" variant="outline" disabled={exporting || !result || result.total === 0} onClick={() => void handleExport()}>
            {exporting ? 'Preparing...' : 'Download CSV'}
          </Button>
        </div>

        {result && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Members to follow up" value={result.total} icon={<PhoneCall />} tone={result.total > 0 ? 'warn' : 'neutral'} hint="Call them about the plan they wanted" />
            <StatCard label="Value not paid" value={rupees(result.totalValueInPaise)} icon={<IndianRupee />} hint={<>Price of each member&apos;s latest attempt</>} />
          </div>
        )}

        <Card className="grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_240px]">
          <Input
            placeholder="Search by name or phone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            aria-label="Search"
          />
          <Select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setOffset(0);
            }}
            aria-label="What they tried to buy"
          >
            <option value="">All purchases</option>
            <option value="MEMBERSHIP">Membership plans</option>
            <option value="HOROSCOPE_MATCH">Porutham reports</option>
          </Select>
        </Card>

        {error && <Card className="rounded-2xl p-4 text-sm text-destructive">{error}</Card>}
        {result === null && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading...</Card>}
        {result?.items.length === 0 && (
          <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Nobody has left at the payment step. Every member who opened it has paid or is still within two days.</Card>
        )}

        {result && result.items.length > 0 && (
          <Card className="overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-4 py-2.5">Wanted</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Attempts</th>
                  <th className="px-4 py-2.5">Last attempt</th>
                  <th className="px-4 py-2.5">Result</th>
                  <th className="px-4 py-2.5">Plan now</th>
                  <th className="px-4 py-2.5">Account</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((r) => (
                  <tr key={`${r.userId}-${r.kind}`} className="border-t border-border align-top" data-testid="unpaid-row">
                    <td className="px-4 py-3">
                      <Link href={`/members/${r.userId}`} className="font-medium text-primary hover:underline">
                        {r.fullName ?? 'No profile yet'}
                      </Link>
                      <a href={`tel:${r.phoneNumber}`} className="block text-xs text-muted-foreground hover:text-foreground">
                        {r.phoneNumber}
                      </a>
                    </td>
                    <td className="px-4 py-3">{r.wanted}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupees(r.amountInPaise)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.attempts}</td>
                    <td className="px-4 py-3">
                      <span className="block">{formatDisplayDateTime(r.lastAttemptAt)}</span>
                      <span className="text-xs text-muted-foreground">{ago(r.daysSinceLastAttempt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.lastStatus === 'FAILED' ? <StatusText tone="bad" label="Payment failed" /> : <StatusText tone="waiting" label="Not paid" />}
                    </td>
                    <td className="px-4 py-3">{r.currentPlan ?? <span className="text-muted-foreground">None</span>}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.accountStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {result && result.total > PAGE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {offset + 1} to {Math.min(offset + PAGE, result.total)} of {result.total}
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                Previous
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={offset + PAGE >= result.total} onClick={() => setOffset(offset + PAGE)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
