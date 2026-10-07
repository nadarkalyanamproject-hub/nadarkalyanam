'use client';

import { useCallback, useEffect, useState } from 'react';
import { NAKSHATRAS, RASIS, type MyHoroscope, type SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { Button, Card, Input } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { ApiError, adminRequest } from '../lib/api-client';
import { useCurrentAdmin } from '../lib/use-current-admin';

interface Data {
  partnerPreferences: SavedPartnerPreferences | null;
  horoscope: MyHoroscope | null;
}

const MARITAL: Record<string, string> = {
  NEVER_MARRIED: 'Never married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  AWAITING_DIVORCE: 'Awaiting divorce',
};
const DOSHAM_PREF: Record<string, string> = {
  DOESNT_MATTER: "Doesn't matter",
  WITHOUT_DOSHAM: 'No dosham',
  WITH_DOSHAM: 'Has dosham',
};
const FLAG: Record<string, string> = {
  YES: 'Yes',
  NO: 'No',
  DONT_KNOW: "Don't know",
};
const VISIBILITY: Record<string, string> = {
  HIDDEN: 'Hidden (only the member)',
  CONNECTED: 'Connected members',
  EVERYONE: 'All members',
};

function rasi(code: string | null): string | null {
  const r = RASIS.find((x) => x.code === code);
  return r ? `${r.label} (${r.english})` : null;
}
function nakshatra(code: string | null, pada: number | null): string | null {
  const n = NAKSHATRAS.find((x) => x.code === code);
  return n ? (pada ? `${n.label}, pada ${pada}` : n.label) : null;
}
function range(min: number | null, max: number | null, unit: string): string | null {
  if (min === null && max === null) return null;
  return `${min ?? 'any'} – ${max ?? 'any'} ${unit}`;
}
function withMust(value: string | null, must: boolean): string | null {
  return value && must ? `${value} (must have)` : value;
}

function Rows({ rows }: { rows: [string, string | null][] }) {
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]));
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">Nothing entered.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Member detail: partner preferences and horoscope, read-only (members.view,
// which already shows the full profile), plus chart approve/reject
// (members.edit, audited). Never shown in the member list.
export function MemberPreferencesHoroscope({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const [info, setInfo] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!data.accessToken) return;
    adminRequest<Data>(data.accessToken, `/admin/members/${userId}/preferences-horoscope`)
      .then(setInfo)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load preferences and horoscope.'));
  }, [data.accessToken, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(approve: boolean) {
    if (!data.accessToken) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminRequest(data.accessToken, `/admin/members/${userId}/horoscope-chart/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: approve ? undefined : JSON.stringify({ reason: reason.trim() }),
      });
      setMessage(
        approve
          ? 'Chart approved — members the horoscope setting allows can now see it.'
          : 'Chart rejected — it stays hidden and the member sees your reason.',
      );
      setRejecting(false);
      setReason('');
      load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Could not save the decision.');
    } finally {
      setBusy(false);
    }
  }

  const p = info?.partnerPreferences ?? null;
  const h = info?.horoscope ?? null;
  return (
    <Card className="rounded-2xl p-6 shadow-sm" data-testid="member-preferences-horoscope">
      <h2 className="mb-3 text-lg font-bold text-primary">Partner preferences &amp; horoscope</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && (
        <p className="mb-2 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
      {info && (
        <div className="space-y-5">
          <section>
            <h3 className="mb-1 text-sm font-bold">Partner preferences</h3>
            {!p ? (
              <p className="text-sm text-muted-foreground">Not set.</p>
            ) : (
              <Rows
                rows={[
                  ['Age', withMust(range(p.ageMin, p.ageMax, 'yrs'), p.mustHaveAge)],
                  ['Height', range(p.heightMinCm, p.heightMaxCm, 'cm')],
                  ['Marital status', withMust(p.maritalStatuses.map((m) => MARITAL[m] ?? m).join(', ') || null, p.mustHaveMaritalStatus)],
                  ['Mother tongue', p.motherTongues.join(', ') || null],
                  ['Location', withMust([...p.states, ...p.cities].join(', ') || null, p.mustHaveLocation)],
                  ['Annual income', range(p.incomeMinLakhs, p.incomeMaxLakhs, 'lakhs')],
                  ['Dosham', p.doshamPreference === 'DOESNT_MATTER' ? null : (DOSHAM_PREF[p.doshamPreference] ?? null)],
                ]}
              />
            )}
          </section>
          <section>
            <h3 className="mb-1 text-sm font-bold">Horoscope</h3>
            {!h ? (
              <p className="text-sm text-muted-foreground">Not added.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground" data-testid="admin-horoscope-visibility">
                  Visibility: {VISIBILITY[h.visibility]} · birth time and place {h.shareBirthDetails ? 'shared with them' : 'not shared'}
                </p>
                <Rows
                  rows={[
                    ['Rasi', rasi(h.rasi)],
                    ['Nakshatra', nakshatra(h.nakshatra, h.nakshatraPada)],
                    ['Lagnam', rasi(h.lagnam)],
                    ['Sevvai dosham', h.sevvaiDosham ? (FLAG[h.sevvaiDosham] ?? null) : null],
                    ['Raghu-Kethu dosham', h.raguKethuDosham ? (FLAG[h.raguKethuDosham] ?? null) : null],
                    ['Birth time', h.birthTime],
                    ['Birth place', [h.birthCity, h.birthState, h.birthCountry].filter(Boolean).join(', ') || null],
                  ]}
                />
                {h.chart && (
                  <div className="mt-3 flex flex-wrap items-start gap-4" data-testid="admin-chart">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    <img src={h.chart.url} alt="Jathagam chart" className="h-48 w-auto max-w-full rounded-lg border object-contain" />
                    <div className="space-y-2 text-sm">
                      <p data-testid="admin-chart-status">
                        Status: <span className="font-semibold">{h.chart.status}</span>
                        {h.chart.rejectionReason ? ` — ${h.chart.rejectionReason}` : ''}
                      </p>
                      {can('members.edit') && !disabled && (
                        <div className="flex flex-wrap gap-2">
                          {h.chart.status !== 'APPROVED' && (
                            <Button type="button" size="sm" disabled={busy} onClick={() => void moderate(true)} data-testid="chart-approve">
                              Approve chart
                            </Button>
                          )}
                          {h.chart.status !== 'REJECTED' && !rejecting && (
                            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                              Reject chart
                            </Button>
                          )}
                        </div>
                      )}
                      {rejecting && (
                        <div className="flex flex-wrap gap-2">
                          <Input
                            aria-label="Rejection reason"
                            value={reason}
                            maxLength={500}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason shown to the member"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || !reason.trim()}
                            onClick={() => void moderate(false)}
                            data-testid="chart-reject"
                          >
                            Confirm rejection
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Card>
  );
}
