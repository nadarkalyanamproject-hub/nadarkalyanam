import type {
  ConversationListResponse,
  CreateProfileRequest,
  CreateProfileResponse,
  ListInterestsResponse,
  MessageListResponse,
  MessageResponse,
  PhotoResponse,
  ProfileListResponse,
  ProfileResponse,
  PublicProfileDetail,
  RequestUploadUrlResponse,
  SendInterestRequest,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@nadar-kalyanam/schemas';
import { notifyUnauthorized } from './auth-events';

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
    // Centralized here so every authenticated call gets this for free: a
    // 401 on a request that carried a bearer token means that token is
    // invalid/expired, so clear it and send the user back to the homepage
    // rather than leaving them on a page that will just keep failing the
    // same way. Gated on the Authorization header so this never fires for
    // /auth/otp/verify's unrelated 401 (wrong/expired OTP code, no token
    // involved at all).
    if (response.status === 401 && 'Authorization' in headers) {
      notifyUnauthorized();
    }
    throw new ApiError(extractErrorMessage(body), response.status, body?.errorCode);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function requestOtp(payload: SendOtpRequest): Promise<SendOtpResponse> {
  return request<SendOtpResponse>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyOtp(payload: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  return request<VerifyOtpResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createProfile(
  accessToken: string,
  payload: CreateProfileRequest,
): Promise<CreateProfileResponse> {
  return request<CreateProfileResponse>('/profiles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

export function getMyProfile(accessToken: string): Promise<ProfileResponse> {
  return request<ProfileResponse>('/profiles/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function updateProfile(
  accessToken: string,
  payload: CreateProfileRequest,
): Promise<ProfileResponse> {
  return request<ProfileResponse>('/profiles/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

export function requestPhotoUploadUrl(
  accessToken: string,
  contentType: string,
): Promise<RequestUploadUrlResponse> {
  return request<RequestUploadUrlResponse>('/profiles/me/photos/upload-url', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ contentType }),
  });
}

// Uploads directly to MinIO using the pre-signed URL — NOT through this
// app's API, and deliberately not routed through `request()` above (no
// Authorization header, no JSON content-type, no API base URL: the
// signature in the URL's query string is the auth, and the body is the raw
// file bytes). The Content-Type here must exactly match what was used to
// request the pre-signed URL, or MinIO rejects the signature.
export async function uploadPhotoToStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) {
    throw new ApiError('Could not upload the photo to storage. Please try again.', response.status);
  }
}

export function confirmPhotoUpload(accessToken: string, objectKey: string): Promise<PhotoResponse> {
  return request<PhotoResponse>('/profiles/me/photos/confirm', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ objectKey }),
  });
}

export function setPrimaryPhoto(accessToken: string, photoId: string): Promise<PhotoResponse> {
  return request<PhotoResponse>(`/profiles/me/photos/${photoId}/primary`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function deletePhoto(accessToken: string, photoId: string): Promise<void> {
  return request<void>(`/profiles/me/photos/${photoId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function listProfiles(
  accessToken: string,
  params?: { offset?: number; limit?: number },
): Promise<ProfileListResponse> {
  const query = new URLSearchParams();
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<ProfileListResponse>(`/profiles${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getProfile(accessToken: string, profileId: string): Promise<PublicProfileDetail> {
  return request<PublicProfileDetail>(`/profiles/${profileId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function sendInterest(
  accessToken: string,
  payload: SendInterestRequest,
): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>('/interests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

export function listInterests(accessToken: string): Promise<ListInterestsResponse> {
  return request<ListInterestsResponse>('/interests', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function acceptInterest(accessToken: string, interestId: string): Promise<{ id: string; status: string }> {
  return request(`/interests/${interestId}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function declineInterest(accessToken: string, interestId: string): Promise<{ id: string; status: string }> {
  return request(`/interests/${interestId}/decline`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function listConversations(accessToken: string): Promise<ConversationListResponse> {
  return request<ConversationListResponse>('/conversations', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function listMessages(accessToken: string, conversationId: string): Promise<MessageListResponse> {
  return request<MessageListResponse>(`/conversations/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function sendMessage(
  accessToken: string,
  conversationId: string,
  body: string,
): Promise<MessageResponse> {
  return request<MessageResponse>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ body }),
  });
}
