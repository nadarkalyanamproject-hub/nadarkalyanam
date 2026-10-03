import { summaryReportRequestSchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it } from 'vitest';
import { AdminService } from '../admin.service.js';
import { istDate } from '../member-activity.js';
import { buildPdf, extractPdfText } from './pdf-writer.js';
import { buildSummaryReportPdf, collectSummaryReportData, summaryReportFilename } from './summary-report.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('pdf writer', () => {
  it('writes a structurally valid PDF whose xref points at every object', () => {
    const pdf = buildPdf([{ kind: 'text', x: 10, y: 10, size: 12, text: 'Hello' }], { title: 'T', createdAt: new Date('2026-10-03T00:00:00Z') });
    const raw = pdf.toString('latin1');
    expect(raw.startsWith('%PDF-1.4\n')).toBe(true);
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
    const xrefAt = Number(raw.match(/startxref\n(\d+)/)![1]);
    expect(raw.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...raw.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(7);
    offsets.forEach((offset, i) => expect(raw.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
    const length = Number(raw.match(/<< \/Length (\d+) >>\nstream\n/)![1]);
    const start = raw.indexOf('stream\n') + 'stream\n'.length;
    expect(raw.slice(start + length, start + length + 10)).toBe('\nendstream');
  });

  it('escapes PDF string syntax and never emits non-ASCII', () => {
    const pdf = buildPdf([{ kind: 'text', x: 0, y: 0, size: 10, text: 'a (b) c\\d – ₹' }], { title: 'T', createdAt: new Date() });
    expect(extractPdfText(pdf)).toEqual(['a (b) c\\d ? ?']);
  });
});

// A known dataset; every figure in the PDF must equal a count taken directly
// from it, the same way the real queries count the database.
const NOW = new Date('2026-10-03T06:30:00.000Z'); // 12:00 IST
const DAY = 86_400_000;
const users = [
  ...Array.from({ length: 6 }, (_, i) => ({ status: 'ACTIVE', createdAt: new Date(NOW.getTime() - (40 + i) * DAY) })),
  { status: 'ACTIVE', createdAt: new Date(NOW.getTime() - 20 * DAY) },
  { status: 'SUSPENDED', createdAt: new Date(NOW.getTime() - 10 * DAY) },
  { status: 'PENDING_DELETION', createdAt: new Date(NOW.getTime() - 3 * DAY) },
  { status: 'DELETED', createdAt: new Date(NOW.getTime() - 2 * DAY) },
  { status: 'ACTIVE', createdAt: new Date(NOW.getTime() - 1 * 3600_000) },
].map((u, i) => ({ id: `u${i}`, phoneNumber: `+91900000000${i}`, profile: { fullName: `Secret Name ${i}` }, ...u }));
const reports = [{ status: 'OPEN' }, { status: 'IN_REVIEW' }, { status: 'RESOLVED' }, { status: 'DISMISSED' }, { status: 'OPEN' }];
const verifiedProfiles = 4;

function service() {
  const inRange = (d: Date, where: any) => (!where?.createdAt?.gte || d >= where.createdAt.gte) && (!where?.createdAt?.lt || d < where.createdAt.lt);
  const prisma = {
    user: {
      count: async (args?: any) => users.filter((u) => inRange(u.createdAt, args?.where)).length,
      groupBy: async () =>
        Object.entries(users.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.status]: (acc[u.status] ?? 0) + 1 }), {})).map(([status, c]) => ({ status, _count: { _all: c } })),
      findMany: async () => users.slice(0, 5),
    },
    report: { count: async ({ where }: any) => reports.filter((r) => where.status.in.includes(r.status)).length },
    profile: { count: async () => verifiedProfiles },
    verificationRequest: { count: async () => 0 },
    $queryRaw: async (_s: TemplateStringsArray, _offset: number, start: Date) => {
      const counts = new Map<string, number>();
      for (const u of users.filter((x) => x.createdAt >= start)) counts.set(istDate(u.createdAt), (counts.get(istDate(u.createdAt)) ?? 0) + 1);
      return [...counts].map(([day, count]) => ({ day, count }));
    },
  };
  return new AdminService(prisma as never, {} as never, {} as never, {} as never);
}

const lineAfter = (lines: string[], label: string) => lines[lines.indexOf(label) + 1];

describe('summary report PDF', () => {
  it.each([7, 30, 90])('every figure equals a direct count of the dataset (%i-day window)', async (days) => {
    const data = await collectSummaryReportData(service(), days, NOW);
    const lines = extractPdfText(buildSummaryReportPdf(data));

    const windowStart = new Date(Date.parse(`${istDate(NOW)}T00:00:00Z`) - 330 * 60_000 - (days - 1) * DAY);
    const expected = {
      total: users.length,
      active: users.filter((u) => u.status === 'ACTIVE').length,
      suspended: users.filter((u) => u.status === 'SUSPENDED').length,
      pending: users.filter((u) => u.status === 'PENDING_DELETION').length,
      deleted: users.filter((u) => u.status === 'DELETED').length,
      signups: users.filter((u) => u.createdAt >= windowStart).length,
      open: reports.filter((r) => r.status === 'OPEN' || r.status === 'IN_REVIEW').length,
    };
    expect(lineAfter(lines, 'Total members')).toBe(String(expected.total));
    expect(lineAfter(lines, 'Active')).toBe(String(expected.active));
    expect(lineAfter(lines, 'Suspended')).toBe(String(expected.suspended));
    expect(lineAfter(lines, 'Pending deletion')).toBe(String(expected.pending));
    expect(lineAfter(lines, 'Deleted (anonymized)')).toBe(String(expected.deleted));
    expect(lines).toContain(`NEW SIGNUPS - LAST ${days} DAYS`);
    const windowLine = lines.find((l) => l.endsWith('(India time)'))!;
    expect(lineAfter(lines, windowLine)).toBe(String(expected.signups));
    expect(lineAfter(lines, 'Verified profiles')).toBe(String(verifiedProfiles));
    expect(lineAfter(lines, 'Open reports (open or in review)')).toBe(String(expected.open));
  });

  it('shows the window dates and generation time, and the expected signups for known windows', async () => {
    const lines = extractPdfText(buildSummaryReportPdf(await collectSummaryReportData(service(), 7, NOW)));
    expect(lines).toContain('Generated 3 Oct 2026, 12:00 IST');
    expect(lines).toContain('27 Sept 2026 to 3 Oct 2026 (India time)');
    expect(lineAfter(lines, '27 Sept 2026 to 3 Oct 2026 (India time)')).toBe('3'); // 3 days, 2 days and 1 hour ago
  });

  it('contains no member details and no financial figures', async () => {
    const pdf = buildSummaryReportPdf(await collectSummaryReportData(service(), 90, NOW));
    const text = extractPdfText(pdf).join('\n');
    expect(text).not.toMatch(/Secret Name|\+9190000/);
    // No currency amounts and no revenue/payment rows (only the note saying they're excluded).
    expect(text).not.toMatch(/\b(Rs|INR)\b|^(revenue|payments?|orders|subscriptions)\b/im);
    expect(text).toMatch(/Not included: individual member details, and payment or revenue figures/);
  });

  it('names the file after the window', async () => {
    const data = await collectSummaryReportData(service(), 30, NOW);
    expect(summaryReportFilename(data)).toBe('nadar-kalyanam-summary-2026-10-03-30d.pdf');
  });

  it('accepts only the dashboard windows', () => {
    expect(summaryReportRequestSchema.parse({ days: 30 })).toEqual({ days: 30 });
    for (const days of [0, 14, 365]) expect(summaryReportRequestSchema.safeParse({ days }).success).toBe(false);
  });
});
