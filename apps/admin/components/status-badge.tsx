import { ArrowRightCircle, Ban, CheckCircle2, CircleDot, Clock3, MinusCircle, XCircle, type LucideIcon } from 'lucide-react';

// Status is shown as coloured text with an icon, never as a filled pill or a
// bordered tag. One palette for the whole panel:
//   good     green  done, active, paid, approved
//   bad      red    rejected, failed, suspended, needs action
//   waiting  amber  pending, open, queued
//   progress navy   in review, in progress
//   neutral  grey   expired, dismissed, closed, inactive
export type StatusTone = 'good' | 'bad' | 'waiting' | 'progress' | 'neutral';

const TONE: Record<StatusTone, { className: string; icon: LucideIcon }> = {
  good: { className: 'text-[#15803D]', icon: CheckCircle2 },
  bad: { className: 'text-[#DC2626]', icon: XCircle },
  waiting: { className: 'text-[#B45309]', icon: Clock3 },
  progress: { className: 'text-[#1E3A8A]', icon: ArrowRightCircle },
  neutral: { className: 'text-muted-foreground', icon: MinusCircle },
};

// Every status code used across the panel, with the words staff read.
const STATUSES: Record<string, { label: string; tone: StatusTone; icon?: LucideIcon }> = {
  // Member accounts
  ACTIVE: { label: 'Active', tone: 'good' },
  SUSPENDED: { label: 'Suspended', tone: 'bad', icon: Ban },
  PENDING_DELETION: { label: 'Pending deletion', tone: 'waiting' },
  DELETED: { label: 'Deleted', tone: 'neutral' },
  // Reports
  OPEN: { label: 'Open', tone: 'waiting', icon: CircleDot },
  IN_REVIEW: { label: 'In review', tone: 'progress' },
  RESOLVED: { label: 'Resolved', tone: 'good' },
  DISMISSED: { label: 'Dismissed', tone: 'neutral' },
  // Photos and verification
  APPROVED: { label: 'Approved', tone: 'good' },
  PENDING: { label: 'Pending', tone: 'waiting' },
  REJECTED: { label: 'Rejected', tone: 'bad' },
  VERIFIED: { label: 'Verified', tone: 'good' },
  NOT_VERIFIED: { label: 'Not verified', tone: 'neutral' },
  FAILED: { label: 'Failed', tone: 'bad' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  // Interests
  ACCEPTED: { label: 'Accepted', tone: 'good' },
  DECLINED: { label: 'Declined', tone: 'bad' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
  // Orders and subscriptions
  CREATED: { label: 'Awaiting payment', tone: 'waiting' },
  PAID: { label: 'Paid', tone: 'good' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
  QUEUED: { label: 'Queued', tone: 'progress' },
  // Calls and messages
  RINGING: { label: 'Ringing', tone: 'waiting' },
  ENDED: { label: 'Completed', tone: 'good' },
  MISSED: { label: 'Missed', tone: 'bad' },
  SENT: { label: 'Sent', tone: 'neutral' },
  DELIVERED: { label: 'Delivered', tone: 'neutral' },
  READ: { label: 'Read', tone: 'good' },
  // VIP enquiries
  NEW: { label: 'New', tone: 'waiting', icon: CircleDot },
  CONTACTED: { label: 'Contacted', tone: 'progress' },
  ONBOARDED: { label: 'Onboarded', tone: 'good' },
  SUCCEEDED: { label: 'Succeeded', tone: 'good' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  // Plans and staff accounts
  INACTIVE: { label: 'Inactive', tone: 'neutral' },
  DEACTIVATED: { label: 'Deactivated', tone: 'neutral' },
  // Sessions
  SIGNED_OUT: { label: 'Signed out', tone: 'neutral' },
};

const humanize = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ');

export function StatusText({
  tone,
  label,
  icon,
  className = '',
  testId,
}: {
  tone: StatusTone;
  label: string;
  icon?: LucideIcon;
  className?: string;
  testId?: string;
}) {
  const style = TONE[tone];
  const Icon = icon ?? style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.className} ${className}`} data-testid={testId}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

// A status code (ACTIVE, PENDING, PAID ...) in the panel's words and colours.
// Unknown codes still read as words, in grey.
export function StatusBadge({ status, label, className, testId }: { status: string; label?: string; className?: string; testId?: string }) {
  const known = STATUSES[status];
  return (
    <StatusText
      tone={known?.tone ?? 'neutral'}
      label={label ?? known?.label ?? humanize(status)}
      icon={known?.icon}
      className={className}
      testId={testId}
    />
  );
}
