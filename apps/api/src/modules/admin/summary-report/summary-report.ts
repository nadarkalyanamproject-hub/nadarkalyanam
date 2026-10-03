import type { AdminService } from '../admin.service.js';
import { A4, buildPdf, type PdfOp } from './pdf-writer.js';

// Everything the summary report shows. Platform-level counts only: no
// individual member rows and no payment/revenue figures (payments are not
// live, so there are none real to report).
export interface SummaryReportData {
  generatedAt: Date;
  days: number;
  windowFirstDay: string; // YYYY-MM-DD, India time
  windowLastDay: string;
  totalMembers: number;
  membersByStatus: { active: number; suspended: number; pendingDeletion: number; deleted: number };
  newSignupsInWindow: number;
  verifiedProfiles: number;
  openReports: number;
}

// Queried fresh for each report, reusing the dashboard's own sources: the
// dashboard stats (members, statuses, verified, open reports) and the Member
// Activity series (signups per India-time day over the chosen window).
export async function collectSummaryReportData(admin: AdminService, days: number, now = new Date()): Promise<SummaryReportData> {
  const [stats, activity] = await Promise.all([admin.getDashboardStats(), admin.getMemberActivity(days, now)]);
  return {
    generatedAt: now,
    days,
    windowFirstDay: activity.points[0]!.date,
    windowLastDay: activity.points.at(-1)!.date,
    totalMembers: stats.totalMembers,
    membersByStatus: stats.membersByStatus,
    newSignupsInWindow: activity.points.reduce((sum, point) => sum + point.newSignups, 0),
    verifiedProfiles: stats.verifiedProfilesCount,
    openReports: stats.pendingReportsCount,
  };
}

const n = (value: number) => value.toLocaleString('en-IN');
const IST_MS = 330 * 60 * 1000;
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function istStamp(date: Date): string {
  const ist = new Date(date.getTime() + IST_MS);
  const day = ist.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${day}, ${ist.toISOString().slice(11, 16)} IST`;
}

export function summaryReportFilename(data: SummaryReportData): string {
  return `nadar-kalyanam-summary-${data.windowLastDay}-${data.days}d.pdf`;
}

export function buildSummaryReportPdf(data: SummaryReportData): Buffer {
  const left = 56;
  const valueX = 380;
  const right = A4.width - 56;
  let y = A4.height - 72;
  const ops: PdfOp[] = [];
  const text = (x: number, size: number, value: string, opts: { bold?: boolean; gray?: boolean } = {}) =>
    ops.push({ kind: 'text', x, y, size, text: value, ...opts });
  const rule = () => ops.push({ kind: 'line', x1: left, y1: y, x2: right, y2: y });
  const section = (title: string) => {
    y -= 30;
    text(left, 11, title.toUpperCase(), { bold: true, gray: true });
    y -= 8;
    rule();
    y -= 18;
  };
  const row = (label: string, value: number, opts: { bold?: boolean } = {}) => {
    text(left, 11, label, opts);
    text(valueX, 11, n(value), { bold: true });
    y -= 18;
  };

  text(left, 20, 'Nadar Kalyanam - Platform Summary', { bold: true });
  y -= 20;
  text(left, 10, `Generated ${istStamp(data.generatedAt)}`, { gray: true });

  section('Members');
  row('Total members', data.totalMembers, { bold: true });
  row('Active', data.membersByStatus.active);
  row('Suspended', data.membersByStatus.suspended);
  row('Pending deletion', data.membersByStatus.pendingDeletion);
  row('Deleted (anonymized)', data.membersByStatus.deleted);

  section(`New signups - last ${data.days} days`);
  row(`${longDate(data.windowFirstDay)} to ${longDate(data.windowLastDay)} (India time)`, data.newSignupsInWindow);

  section('Verification');
  row('Verified profiles', data.verifiedProfiles);

  section('Moderation');
  row('Open reports (open or in review)', data.openReports);

  y -= 22;
  rule();
  y -= 16;
  text(left, 9, 'All figures were queried live from the platform database when this report was generated.', { gray: true });
  y -= 13;
  text(left, 9, 'Not included: individual member details, and payment or revenue figures (payments are not yet live).', { gray: true });

  return buildPdf(ops, { title: `Nadar Kalyanam platform summary (${data.days} days)`, createdAt: data.generatedAt });
}
