import { PERMISSIONS, type PermissionCode } from './permissions.js';

// Which permission codes each seeded Role grants — the data prisma/seed.ts
// writes into role_permissions. Kept here (not inline in seed.ts) so tests
// can check route access against the exact same mapping production is
// seeded with. Changing this requires re-running the seed in every
// environment: the API only ever reads role_permissions, never this file.
export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  // Batch 3 adds VIP enquiries only (no subscriptions, plans, refunds or
  // finance); its existing member/report permissions are unchanged.
  OPERATIONS_ADMIN: [
    PERMISSIONS.VIP_MANAGE,
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.MEMBERS_SUSPEND,
    PERMISSIONS.MEMBERS_REINSTATE,
    PERMISSIONS.REPORTS_REVIEW,
  ],
  MODERATOR: [
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.MEMBERS_SUSPEND,
    PERMISSIONS.MEMBERS_REINSTATE,
    PERMISSIONS.REPORTS_REVIEW,
  ],
  VERIFICATION_AGENT: [PERMISSIONS.VERIFICATION_REVIEW],
  FINANCE_ADMIN: [
    PERMISSIONS.PAYMENTS_REFUND,
    PERMISSIONS.FINANCE_DASHBOARD_VIEW,
    PERMISSIONS.PLANS_MANAGE,
    PERMISSIONS.SUBSCRIPTIONS_MANAGE,
    PERMISSIONS.MEMBERS_VIEW,
  ],
  CONTENT_ADMIN: [PERMISSIONS.CMS_MANAGE],
};
