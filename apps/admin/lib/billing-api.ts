// Admin API calls for plans, subscriptions, orders, finance and VIP
// enquiries (Batch 3). Same request helper and auth as api-client.ts.
import type {
  GrantSubscriptionRequest,
  OrderStatus,
  PlanFeature,
  SubscriptionSource,
  SubscriptionState,
  UpdatePlanRequest,
  UpdateVipEnquiryRequest,
  VipEnquiryStatus,
} from '@nadar-kalyanam/schemas';
import { adminRequest } from './api-client';

export interface AdminPlan {
  id: string;
  code: string;
  name: string;
  priceInPaise: number;
  durationDays: number;
  phoneUnlockLimit: number | null;
  isAssisted: boolean;
  isActive: boolean;
  sortOrder: number;
  features: PlanFeature[];
  activeSubscriptions: number;
}

export interface BillingMember {
  userId: string;
  fullName: string | null;
  phoneNumber: string;
  status: string;
}

export interface AdminSubscription {
  id: string;
  state: SubscriptionState;
  member: BillingMember;
  plan: { id: string; code: string; name: string };
  source: SubscriptionSource;
  orderId: string | null;
  startedAt: string;
  expiresAt: string;
  createdAt: string;
  grantedByEmail: string | null;
  grantReason: string | null;
  paymentReference: string | null;
  cancelledAt: string | null;
  cancelledByEmail: string | null;
  cancelReason: string | null;
  phoneUnlocksUsed: number;
}

export interface AdminOrder {
  id: string;
  member: BillingMember;
  plan: { id: string; code: string; name: string };
  amountInPaise: number;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  refundedByEmail: string | null;
  subscription: { id: string; state: SubscriptionState } | null;
}

export interface AdminOrderDetail extends AdminOrder {
  paymentEvents: {
    providerEventId: string;
    type: OrderStatus;
    amountInPaise: number | null;
    currency: string | null;
    signatureValid: boolean;
    processedAt: string;
  }[];
}

export interface FinanceDashboard {
  days: number;
  from: string;
  grossRevenueInPaise: number;
  paidOrdersCount: number;
  refundedInPaise: number;
  refundedCount: number;
  netRevenueInPaise: number;
  ordersByStatus: Record<string, number>;
  activeSubscriptionsByPlan: { planCode: string; planName: string; count: number }[];
  expiringNext7Days: number;
  adminGrantsCount: number;
  adminGrantsWithPaymentReference: number;
  revenuePerDay: { date: string; grossInPaise: number }[];
}

export interface AdminVipEnquiry {
  id: string;
  status: VipEnquiryStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  name: string;
  phone: string;
  assignedAdminId: string | null;
  assignedAdminEmail: string | null;
  adminNotes: string | null;
}

export interface MemberMembership {
  subscriptions: AdminSubscription[];
  currentSubscriptionId: string | null;
  phoneUnlocksThisPlan: number | null;
  phoneUnlocksTotal: number;
  interestsSentThisMonth: number;
  monthResetsAt: string;
  recentOrders: AdminOrder[];
}

const qs = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const listPlans = (t: string) => adminRequest<{ items: AdminPlan[] }>(t, '/admin/plans');
export const updatePlan = (t: string, id: string, body: UpdatePlanRequest) =>
  adminRequest<AdminPlan>(t, `/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const listSubscriptions = (
  t: string,
  params: { state?: SubscriptionState; planCode?: string; source?: SubscriptionSource; search?: string; cursor?: string; limit?: number },
) => adminRequest<{ items: AdminSubscription[]; nextCursor: string | null }>(t, `/admin/subscriptions${qs(params)}`);
export const grantSubscription = (t: string, body: GrantSubscriptionRequest) =>
  adminRequest<AdminSubscription>(t, '/admin/subscriptions/grant', { method: 'POST', body: JSON.stringify(body) });
export const cancelSubscription = (t: string, id: string, reason: string) =>
  adminRequest<AdminSubscription>(t, `/admin/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
export const getMemberMembership = (t: string, userId: string) =>
  adminRequest<MemberMembership>(t, `/admin/members/${userId}/membership`);

export const listOrders = (t: string, params: { status?: OrderStatus; from?: string; to?: string; search?: string; offset?: number; limit?: number }) =>
  adminRequest<{ items: AdminOrder[]; total: number }>(t, `/admin/orders${qs(params)}`);
export const getOrder = (t: string, id: string) => adminRequest<AdminOrderDetail>(t, `/admin/orders/${id}`);
export const ordersNeedingAttention = (t: string) =>
  adminRequest<{ paidWithoutSubscription: AdminOrder[]; staleCreated: AdminOrder[] }>(t, '/admin/orders/attention');
export const activateOrder = (t: string, id: string) =>
  adminRequest<{ created: boolean; subscriptionId: string }>(t, `/admin/orders/${id}/activate`, { method: 'POST' });
export const refundOrder = (t: string, id: string, reason: string) =>
  adminRequest<AdminOrderDetail>(t, `/admin/orders/${id}/refund`, { method: 'POST', body: JSON.stringify({ reason }) });

export const getFinanceDashboard = (t: string, days: 7 | 30 | 90) => adminRequest<FinanceDashboard>(t, `/admin/finance/dashboard?days=${days}`);

export const listVipEnquiries = (t: string, params: { status?: VipEnquiryStatus; offset?: number; limit?: number }) =>
  adminRequest<{ items: AdminVipEnquiry[]; total: number }>(t, `/admin/vip-enquiries${qs(params)}`);
export const vipAssignees = (t: string) => adminRequest<{ items: { id: string; email: string }[] }>(t, '/admin/vip-enquiries/assignees');
export const updateVipEnquiry = (t: string, id: string, body: UpdateVipEnquiryRequest) =>
  adminRequest<AdminVipEnquiry>(t, `/admin/vip-enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// Paise -> "₹1,499" (or "₹1,499.50").
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}
