import type {
  AccountStatus,
  CreateAdminRequest,
  CreateProfileRequest,
  ReportResponse,
  ReportStatus,
  SendOtpResponse,
  UpdateAdminRequest,
} from '@nadar-kalyanam/schemas';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface NestErrorBody {
  message?: string | { path: string; message: string }[];
  errorCode?: string;
}

function extractErrorMessage(body: NestErrorBody | null): string {
  if (!body?.message) return 'Something went wrong. Please try again.';
  if (typeof body.message === 'string') return body.message;
  return body.message.map((issue) => issue.message).join(', ');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...init?.headers };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as NestErrorBody | null;
    throw new ApiError(extractErrorMessage(body), response.status, body?.errorCode);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 0) query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// --- Auth (same phone/OTP flow as the member web app — no separate admin
// credential exists) --------------------------------------------------------

export function requestOtp(phoneNumber: string): Promise<SendOtpResponse> {
  return request<SendOtpResponse>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
}

export interface AdminVerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; phoneNumber: string; hasProfile: boolean; isAdmin: boolean };
}

export function verifyOtp(phoneNumber: string, otp: string): Promise<AdminVerifyOtpResponse> {
  return request<AdminVerifyOtpResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, otp, intent: 'login' }),
  });
}

// --- Dashboard ---------------------------------------------------------

export interface DashboardStats {
  totalMembers: number;
  membersByStatus: { active: number; suspended: number; pendingDeletion: number; deleted: number };
  newSignupsLast7Days: number;
  // Signups in the 7 days before the last 7 (week-over-week comparison).
  newSignupsPrevious7Days: number;
  pendingReportsCount: number;
  verifiedProfilesCount: number;
  // Identity verifications that completed successfully in the last 7 days.
  verificationsLast7Days: number;
  recentSignups: { id: string; fullName: string | null; phoneNumber: string; createdAt: string }[];
}

// Ends this admin login session on the server (same session revocation as
// member logout), so this token stops working at once.
export function logoutAdmin(accessToken: string): Promise<void> {
  return request<void>('/admin/logout', { method: 'POST', headers: authHeaders(accessToken) });
}

export function getDashboardStats(accessToken: string): Promise<DashboardStats> {
  return request('/admin/dashboard', { headers: authHeaders(accessToken) });
}

// Member Activity: per-day new signups and running member total (India time).
export interface MemberActivity {
  days: number;
  timezone: 'Asia/Kolkata';
  points: { date: string; newSignups: number; totalMembers: number }[];
}

export function getMemberActivity(accessToken: string, days: 7 | 30 | 90): Promise<MemberActivity> {
  return request(`/admin/dashboard/activity?days=${days}`, { headers: authHeaders(accessToken) });
}

// --- Members -----------------------------------------------------------

export interface MemberSummary {
  id: string;
  phoneNumber: string;
  status: string;
  createdAt: string;
  profileId: string | null;
  fullName: string | null;
  completionScore: number | null;
  isVerified: boolean;
}

export interface MemberListParams {
  offset?: number;
  limit?: number;
  search?: string;
  status?: AccountStatus;
  verified?: 'true' | 'false';
  sort?: 'newest' | 'oldest';
}

export function listMembers(
  accessToken: string,
  params: MemberListParams = {},
): Promise<{ items: MemberSummary[]; total: number }> {
  return request(`/admin/members${toQueryString({ ...params })}`, { headers: authHeaders(accessToken) });
}

export interface MemberDetail {
  id: string;
  phoneNumber: string;
  status: string;
  deletionRequestedAt: string | null;
  scheduledAnonymizationAt: string | null;
  createdAt: string;
  profile: {
    id: string;
    fullName: string;
    gender: string;
    dateOfBirth: string;
    visibility: string;
    completionScore: number;
    isVerified: boolean;
    details: Record<string, unknown>;
    photos: { id: string; url: string; isPrimary: boolean; sortOrder: number }[];
  } | null;
}

export function getMember(accessToken: string, userId: string): Promise<MemberDetail> {
  return request(`/admin/members/${userId}`, { headers: authHeaders(accessToken) });
}

export function updateMemberProfile(
  accessToken: string,
  userId: string,
  payload: CreateProfileRequest,
): Promise<unknown> {
  return request(`/admin/members/${userId}/profile`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function suspendMember(accessToken: string, userId: string, reason: string): Promise<{ id: string; status: string }> {
  return request(`/admin/members/${userId}/suspend`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reason }),
  });
}

export function reinstateMember(accessToken: string, userId: string): Promise<{ id: string; status: string }> {
  return request(`/admin/members/${userId}/reinstate`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export interface RemoveMemberResponse {
  id: string;
  status: string;
  deletionRequestedAt: string;
  scheduledAnonymizationAt: string;
}

export function removeMember(accessToken: string, userId: string, reason: string): Promise<RemoveMemberResponse> {
  return request(`/admin/members/${userId}/remove`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reason }),
  });
}

export function restoreMember(accessToken: string, userId: string): Promise<{ id: string; status: string }> {
  return request(`/admin/members/${userId}/restore`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function removeMemberPhoto(
  accessToken: string,
  userId: string,
  photoId: string,
  reason: string,
): Promise<{ id: string; removed: boolean }> {
  return request(`/admin/members/${userId}/photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reason }),
  });
}

// --- Reports -------------------------------------------------------------

export interface ReportMemberSummary {
  userId: string;
  profileId: string | null;
  fullName: string | null;
  phoneNumber: string;
  status: string;
}

export interface AdminReport extends ReportResponse {
  reporter: ReportMemberSummary | null;
  reportedMember: ReportMemberSummary | null;
  reportedMessage: { id: string; body: string; createdAt: string } | null;
  note: string | null;
}

export function listReports(
  accessToken: string,
  params: { offset?: number; limit?: number; status?: ReportStatus } = {},
): Promise<{ items: AdminReport[]; total: number }> {
  return request(`/admin/reports${toQueryString({ ...params })}`, { headers: authHeaders(accessToken) });
}

export function updateReport(
  accessToken: string,
  reportId: string,
  status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED',
  note?: string,
): Promise<ReportResponse> {
  return request(`/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(note ? { status, note } : { status }),
  });
}

// --- Audit logs ------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  adminPhoneNumber: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogParams {
  offset?: number;
  limit?: number;
  action?: string;
  adminId?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

export function listAuditLogs(
  accessToken: string,
  params: AuditLogParams = {},
): Promise<{ items: AuditLogEntry[]; total: number }> {
  return request(`/admin/audit-logs${toQueryString({ ...params })}`, { headers: authHeaders(accessToken) });
}

// --- Admin users -------------------------------------------------------------

export interface AdminSummary {
  id: string;
  userId: string;
  email: string;
  phoneNumber: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CurrentAdmin extends AdminSummary {
  permissions: string[];
}

export interface RoleSummary {
  id: string;
  name: string;
  permissions: string[];
}

export function getCurrentAdmin(accessToken: string): Promise<CurrentAdmin> {
  return request('/admin/me', { headers: authHeaders(accessToken) });
}

export function listAdmins(accessToken: string): Promise<{ items: AdminSummary[] }> {
  return request('/admin/admins', { headers: authHeaders(accessToken) });
}

export function listRoles(accessToken: string): Promise<{ items: RoleSummary[] }> {
  return request('/admin/roles', { headers: authHeaders(accessToken) });
}

export function createAdmin(accessToken: string, payload: CreateAdminRequest): Promise<AdminSummary> {
  return request('/admin/admins', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}

export function updateAdmin(accessToken: string, adminId: string, payload: UpdateAdminRequest): Promise<AdminSummary> {
  return request(`/admin/admins/${adminId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
}
