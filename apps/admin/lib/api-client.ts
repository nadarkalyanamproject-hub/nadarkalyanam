import type { CreateProfileRequest, ReportResponse, SendOtpResponse } from '@nadar-kalyanam/schemas';

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

export function listMembers(
  accessToken: string,
  params?: { offset?: number; limit?: number; search?: string },
): Promise<{ items: MemberSummary[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return request(`/admin/members${qs ? `?${qs}` : ''}`, { headers: authHeaders(accessToken) });
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

// --- Reports -------------------------------------------------------------

export function listReports(accessToken: string, params?: { offset?: number; limit?: number }): Promise<{ items: ReportResponse[] }> {
  const query = new URLSearchParams();
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request(`/admin/reports${qs ? `?${qs}` : ''}`, { headers: authHeaders(accessToken) });
}

export function resolveReport(
  accessToken: string,
  reportId: string,
  status: 'RESOLVED' | 'DISMISSED',
): Promise<ReportResponse> {
  return request(`/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ status }),
  });
}

// --- Audit logs ------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function listAuditLogs(
  accessToken: string,
  params?: { offset?: number; limit?: number },
): Promise<AuditLogEntry[]> {
  const query = new URLSearchParams();
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request(`/admin/audit-logs${qs ? `?${qs}` : ''}`, { headers: authHeaders(accessToken) });
}
