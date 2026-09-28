const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  SUSPENDED: { label: 'Suspended', className: 'bg-amber-100 text-amber-800' },
  PENDING_DELETION: { label: 'Pending deletion', className: 'bg-destructive/10 text-destructive' },
  DELETED: { label: 'Deleted', className: 'bg-muted text-muted-foreground' },
  OPEN: { label: 'Open', className: 'bg-destructive/10 text-destructive' },
  IN_REVIEW: { label: 'In review', className: 'bg-amber-100 text-amber-800' },
  RESOLVED: { label: 'Resolved', className: 'bg-emerald-100 text-emerald-800' },
  DISMISSED: { label: 'Dismissed', className: 'bg-muted text-muted-foreground' },
};

// Member account status and report status share one pill style so the two
// read the same way across Members, member detail and Reports.
export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}
