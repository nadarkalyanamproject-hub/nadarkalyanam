'use client';

import { useState } from 'react';
import { FileBarChart } from 'lucide-react';
import { ApiError, downloadSummaryReport } from '../lib/api-client';

const WINDOWS = [7, 30, 90] as const;

// "Generate Reports": builds a fresh PDF of platform-level figures on the
// server and downloads it. The window sets the new-signups figure, matching
// the Member Activity chart's windows.
export function GenerateReport({ accessToken }: { accessToken: string }) {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await downloadSummaryReport(accessToken, days);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the report. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border px-3 py-2.5" data-testid="quick-action-reports">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary disabled:opacity-60"
        >
          <FileBarChart className="h-4 w-4 text-primary" aria-hidden="true" />
          {busy ? 'Generating report…' : 'Generate Reports'}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Signups:
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as (typeof WINDOWS)[number])}
            disabled={busy}
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
            aria-label="New signups window for the report"
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                Last {w} days
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">PDF summary: members, signups, verification, open reports.</p>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
