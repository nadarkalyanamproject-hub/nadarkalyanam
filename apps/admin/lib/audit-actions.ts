// Human-readable labels for the audit log's `action` codes. Also the list
// the Audit Log page's action filter offers. An action missing here still
// displays (as its raw code) — this is presentation only.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'member.profile.update': 'Edited member profile',
  'member.photo.remove': 'Removed member photo',
  'member.photo.approve': 'Approved member photo',
  'member.photo.reject': 'Rejected member photo',
  'member.suspend': 'Suspended member',
  'member.reinstate': 'Reinstated member',
  'member.remove': 'Scheduled member removal',
  'member.restore': 'Cancelled member removal',
  'member.anonymize': 'Anonymized member (scheduled job)',
  'report.review': 'Picked up report',
  'report.resolve': 'Closed report',
  'admin.create': 'Added admin',
  'admin.update': 'Changed admin role/access',
  'plan.update': 'Edited membership plan',
  'subscription.grant': 'Granted plan',
  'subscription.cancel': 'Cancelled plan',
  'order.activate': 'Activated plan for paid order',
  'order.refund': 'Recorded order refund',
  'vip.update': 'Updated VIP enquiry (earlier format)',
  'vip.status': 'Changed VIP enquiry status',
  'vip.assign': 'Assigned VIP enquiry',
  'vip.note': 'Added VIP enquiry note',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
