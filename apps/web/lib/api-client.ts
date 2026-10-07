import type {
  BlockedMembersResponse,
  ConversationDetail,
  ConversationListResponse,
  CreateOrderRequest,
  CreateProfileRequest,
  CreateProfileResponse,
  InitiateVerificationResponse,
  InterestsHasUnreadResponse,
  ListConnectionsResponse,
  ListInterestsResponse,
  ListMatchesResponse,
  ListNotificationsResponse,
  MembershipPlansResponse,
  MyHoroscopeResponse,
  PartnerPreferencesRequest,
  PartnerPreferencesResponse,
  UpdateHoroscopeRequest,
  MessageListResponse,
  MessageResponse,
  MyMembershipResponse,
  MyVipEnquiryResponse,
  SupportContactResponse,
  VipEnquiryResponse,
  NearbyMatchesResponse,
  NotificationCategory,
  PhoneStatusResponse,
  PhoneUnlockResponse,
  UnlockedContactsResponse,
  PhoneVisibility,
  OrderResponse,
  PhotoResponse,
  ProfileCardListResponse,
  ProfileListResponse,
  ProfileResponse,
  ProfileVisibility,
  PublicProfileDetail,
  ReportRequest,
  RequestUploadUrlResponse,
  SearchProfilesResponse,
  SendInterestRequest,
  SendOtpRequest,
  SendOtpResponse,
  ShortlistResponse,
  ShortlistStatusResponse,
  UnreadCountResponse,
  UnreadMessagesCountResponse,
  VerificationStatusResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@nadar-kalyanam/schemas';
import { bearerTokenOf, createSessionRefresher } from '@nadar-kalyanam/ui/session-refresh';
import { notifyTokensRefreshed, notifyUnauthorized } from './auth-events';
import { REGISTRATION_STORAGE_KEY, type RegistrationDraft } from './registration-types';

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

function readStoredDraft(): RegistrationDraft {
  try {
    return JSON.parse(window.localStorage.getItem(REGISTRATION_STORAGE_KEY) ?? '{}') as RegistrationDraft;
  } catch {
    return {};
  }
}

// Access tokens last 15 minutes; on a 401 the session's refresh token gets
// a new one (see @nadar-kalyanam/ui/session-refresh). New tokens are written
// to storage straight away (other tabs read them there) and handed to
// RegistrationProvider, which owns the in-memory auth state.
const refreshSession = createSessionRefresher({
  apiBaseUrl: API_BASE_URL,
  lockName: 'nk-member-token-refresh',
  read: () => readStoredDraft(),
  write: (tokens) => {
    try {
      window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify({ ...readStoredDraft(), ...tokens }));
    } catch {
      // Storage unavailable: the provider below still gets the tokens.
    }
    notifyTokensRefreshed(tokens);
  },
});

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...init?.headers };
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as NestErrorBody | null;
    // Centralized here so every authenticated call gets this for free. A
    // 401 on a request that carried a bearer token means the access token
    // expired or was revoked: refresh it once and retry. If the session
    // itself is over, clear auth and send the user back to the homepage
    // rather than leaving them on a page that will keep failing. Gated on
    // the Authorization header so this never fires for /auth/otp/verify's
    // unrelated 401 (wrong/expired OTP code, no token involved at all).
    const bearer = bearerTokenOf(headers);
    if (response.status === 401 && bearer) {
      if (!isRetry) {
        const outcome = await refreshSession(bearer);
        if (outcome.kind === 'refreshed') {
          return request<T>(path, { ...init, headers: { ...headers, Authorization: `Bearer ${outcome.accessToken}` } }, true);
        }
        if (outcome.kind === 'expired') notifyUnauthorized();
      } else {
        notifyUnauthorized();
      }
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

// Ends this login session on the server, so the token stops working at once.
export function logout(accessToken: string): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
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

// Phone privacy: CONNECTED lets connected members with a paid plan unlock
// your number; NEVER (the default) lets nobody.
export function updatePhoneVisibility(accessToken: string, phoneVisibility: PhoneVisibility): Promise<ProfileResponse> {
  return request<ProfileResponse>('/profiles/me/phone-visibility', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ phoneVisibility }),
  });
}

// What the caller can do about another member's phone number. Never the number.
export function getPhoneStatus(accessToken: string, profileId: string): Promise<PhoneStatusResponse> {
  return request<PhoneStatusResponse>(`/profiles/${encodeURIComponent(profileId)}/phone-status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// "My Unlocked Contacts" — never includes numbers (see unlockPhone).
export function getMyUnlockedContacts(accessToken: string, offset = 0, limit = 20): Promise<UnlockedContactsResponse> {
  return request<UnlockedContactsResponse>(`/me/phone-unlocks?offset=${offset}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Unlocks (or re-shows) another member's phone number.
export function unlockPhone(accessToken: string, profileId: string): Promise<PhoneUnlockResponse> {
  return request<PhoneUnlockResponse>(`/profiles/${encodeURIComponent(profileId)}/phone-unlock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Privacy & Visibility: changes only who can find the profile.
export function updateProfileVisibility(accessToken: string, visibility: ProfileVisibility): Promise<ProfileResponse> {
  return request<ProfileResponse>('/profiles/me/visibility', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ visibility }),
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

// Header dot: has a pending interest arrived since the last Interests visit?
export function getInterestsHasUnread(accessToken: string): Promise<InterestsHasUnreadResponse> {
  return request<InterestsHasUnreadResponse>('/interests/has-unread', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Records an Interests-page visit (clears the dot).
export function markInterestsViewed(accessToken: string): Promise<{ viewedAt: string }> {
  return request('/interests/viewed', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
}

// Members the caller is connected with (an accepted interest either way).
export function listConnections(
  accessToken: string,
  params?: { offset?: number; limit?: number },
): Promise<ListConnectionsResponse> {
  const query = new URLSearchParams();
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<ListConnectionsResponse>(`/interests/connections${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function acceptInterest(
  accessToken: string,
  interestId: string,
): Promise<{ id: string; status: string; conversationId: string }> {
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

// The thread header: who you're talking to (with a fallback if unavailable).
export function getConversation(accessToken: string, conversationId: string): Promise<ConversationDetail> {
  return request<ConversationDetail>(`/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Total unread messages for the header's Messages badge.
export function getUnreadMessageCount(accessToken: string): Promise<UnreadMessagesCountResponse> {
  return request<UnreadMessagesCountResponse>('/messages/unread-count', {
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

// Exactly the params GET /search/profiles accepts — nothing else can be sent.
export interface SearchProfilesParams {
  ageMin?: number;
  ageMax?: number;
  city?: string;
  gender?: 'MALE' | 'FEMALE';
  educationLevel?: string;
  profession?: string;
  maritalStatus?: string;
  heightMinCm?: number;
  heightMaxCm?: number;
  motherTongue?: string;
  physicalStatus?: 'NORMAL' | 'PHYSICALLY_CHALLENGED';
  religion?: string;
  casteCommunity?: string;
  dosham?: 'NO' | 'YES' | 'DONT_KNOW';
  employedIn?: string;
  incomeMinLakhs?: number;
  incomeMaxLakhs?: number;
  familyType?: 'Middle Class' | 'Upper Middle Class' | 'Rich / Affluent (Elite)';
  country?: 'India';
  nearby?: boolean;
  joinedWithinDays?: number;
  withPhoto?: boolean;
  excludeShortlisted?: boolean;
  verified?: boolean;
  // Comma-separated "any of" lists (the "Use my preferences" toggle).
  maritalStatusIn?: string;
  motherTongueIn?: string;
  stateIn?: string;
  cityIn?: string;
  sort?: 'id' | 'newest';
  cursor?: string;
  limit?: number;
}

export function searchProfiles(accessToken: string, params: SearchProfilesParams): Promise<SearchProfilesResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, String(value));
  }
  const qs = query.toString();
  return request<SearchProfilesResponse>(`/search/profiles${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// --- Partner preferences (the caller's own; never anyone else's) ---------

export function getPartnerPreferences(accessToken: string): Promise<PartnerPreferencesResponse> {
  return request('/me/partner-preferences', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function savePartnerPreferences(accessToken: string, body: PartnerPreferencesRequest): Promise<PartnerPreferencesResponse> {
  return request('/me/partner-preferences', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
}

export function resetPartnerPreferences(accessToken: string): Promise<PartnerPreferencesResponse> {
  return request('/me/partner-preferences', { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

// --- Horoscope (the caller's own) ----------------------------------------

export function getMyHoroscope(accessToken: string): Promise<MyHoroscopeResponse> {
  return request('/me/horoscope', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function saveMyHoroscope(accessToken: string, body: UpdateHoroscopeRequest): Promise<MyHoroscopeResponse> {
  return request('/me/horoscope', { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
}

export function requestHoroscopeChartUploadUrl(accessToken: string, contentType: string): Promise<RequestUploadUrlResponse> {
  return request('/me/horoscope/chart/upload-url', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ contentType }),
  });
}

export function confirmHoroscopeChart(accessToken: string, objectKey: string): Promise<MyHoroscopeResponse> {
  return request('/me/horoscope/chart/confirm', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ objectKey }),
  });
}

export function deleteHoroscopeChart(accessToken: string): Promise<MyHoroscopeResponse> {
  return request('/me/horoscope/chart', { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

export function listMatches(accessToken: string, limit?: number): Promise<ListMatchesResponse> {
  return request<ListMatchesResponse>(`/matches${limit ? `?limit=${limit}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function listNotifications(
  accessToken: string,
  params?: { unreadOnly?: boolean; category?: NotificationCategory; offset?: number; limit?: number },
): Promise<ListNotificationsResponse> {
  const query = new URLSearchParams();
  if (params?.unreadOnly) query.set('unreadOnly', 'true');
  if (params?.category && params.category !== 'all') query.set('category', params.category);
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request<ListNotificationsResponse>(`/notifications${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getUnreadNotificationCount(accessToken: string): Promise<UnreadCountResponse> {
  return request<UnreadCountResponse>('/notifications/unread-count', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function markNotificationRead(accessToken: string, id: string): Promise<{ id: string; isRead: true }> {
  return request(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// "Clear all": permanently deletes all of the caller's notifications.
export function clearAllNotifications(accessToken: string): Promise<{ deletedCount: number }> {
  return request('/notifications', { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
}

export function markAllNotificationsRead(accessToken: string): Promise<{ updatedCount: number }> {
  return request('/notifications/read-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Active plans, plus the free monthly interest limit (so copy follows the
// FREE_INTERESTS_PER_MONTH setting).
export function listMembershipPlans(): Promise<MembershipPlansResponse> {
  return request('/membership-plans');
}

// Public: the support contact details configured on the server (null when
// not set).
export function getSupportContact(): Promise<SupportContactResponse> {
  return request('/support/contact');
}

// The member's current plan (plan: null for a free member) and its expiry.
export function getMyMembership(accessToken: string): Promise<MyMembershipResponse> {
  return request<MyMembershipResponse>('/me/membership', { headers: { Authorization: `Bearer ${accessToken}` } });
}

// VIP Assisted: ask to be called back (name and phone come from the account).
export function createVipEnquiry(accessToken: string, payload: { message?: string }): Promise<VipEnquiryResponse> {
  return request<VipEnquiryResponse>('/vip-enquiries', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

export function getMyVipEnquiry(accessToken: string): Promise<MyVipEnquiryResponse> {
  return request<MyVipEnquiryResponse>('/vip-enquiries/me', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function createOrder(accessToken: string, payload: CreateOrderRequest): Promise<OrderResponse> {
  return request<OrderResponse>('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

export function initiateVerification(accessToken: string): Promise<InitiateVerificationResponse> {
  return request<InitiateVerificationResponse>('/verification/initiate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getVerificationStatus(accessToken: string): Promise<VerificationStatusResponse> {
  return request<VerificationStatusResponse>('/verification/status', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// --- Blocking -----------------------------------------------------------------

// Block by user id (chat header) or profile id (profile page). After this the
// member disappears from every list and chat with them is closed.
export function blockMember(
  accessToken: string,
  target: { targetUserId: string } | { targetProfileId: string },
): Promise<{ id: string }> {
  return request<{ id: string }>('/blocks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(target),
  });
}

export function listBlockedMembers(accessToken: string): Promise<BlockedMembersResponse> {
  return request<BlockedMembersResponse>('/blocks', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function unblockMember(accessToken: string, targetUserId: string): Promise<void> {
  return request<void>(`/blocks/${encodeURIComponent(targetUserId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function reportProfile(accessToken: string, payload: ReportRequest): Promise<{ id: string }> {
  return request<{ id: string }>('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
}

// --- Shortlist --------------------------------------------------------------

export function shortlistProfile(accessToken: string, profileId: string): Promise<ShortlistResponse> {
  return request<ShortlistResponse>('/shortlists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ profileId }),
  });
}

export function unshortlistProfile(accessToken: string, profileId: string): Promise<void> {
  return request<void>(`/shortlists/by-profile/${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getShortlistStatus(accessToken: string, profileId: string): Promise<ShortlistStatusResponse> {
  return request<ShortlistStatusResponse>(`/shortlists/by-profile/${encodeURIComponent(profileId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function listShortlists(accessToken: string): Promise<ProfileCardListResponse> {
  return request<ProfileCardListResponse>('/shortlists', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export function listShortlistedMe(accessToken: string): Promise<ProfileCardListResponse> {
  return request<ProfileCardListResponse>('/shortlists/shortlisted-me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// --- Matches categories -------------------------------------------------------

export function listMatchCategory(
  accessToken: string,
  category: 'newly-joined' | 'with-photos' | 'viewed-me' | 'viewed-by-me',
): Promise<ProfileCardListResponse> {
  return request<ProfileCardListResponse>(`/match-categories/${category}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function listNearbyMatches(accessToken: string): Promise<NearbyMatchesResponse> {
  return request<NearbyMatchesResponse>('/match-categories/nearby', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
