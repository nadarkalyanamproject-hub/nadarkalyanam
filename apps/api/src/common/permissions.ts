// RBAC authority (SRS §2.3): admin capabilities are checked by permission
// code, never by hard-coding behavior against a role name — see the Role/
// Permission/RolePermission models in schema.prisma. This is the fixed set
// of codes the API checks; which codes each Role grants is data (seeded),
// not code.
export const PERMISSIONS = {
  MEMBERS_VIEW: 'members.view',
  MEMBERS_EDIT: 'members.edit',
  MEMBERS_SUSPEND: 'members.suspend',
  MEMBERS_REINSTATE: 'members.reinstate',
  MEMBERS_REMOVE: 'members.remove',
  REPORTS_REVIEW: 'reports.review',
  VERIFICATION_REVIEW: 'verification.review',
  PAYMENTS_REFUND: 'payments.refund',
  FINANCE_DASHBOARD_VIEW: 'finance.dashboard.view',
  CMS_MANAGE: 'cms.manage',
  ADMIN_USERS_MANAGE: 'admin_users.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
