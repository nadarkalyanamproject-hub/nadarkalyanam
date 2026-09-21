import type {
  CreateProfileRequest,
  CreateProfileResponse,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@nadar-kalyanam/schemas';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface NestErrorBody {
  message?: string | { path: string; message: string }[];
}

function extractErrorMessage(body: NestErrorBody | null): string {
  if (!body?.message) return 'Something went wrong. Please try again.';
  if (typeof body.message === 'string') return body.message;
  return body.message.map((issue) => issue.message).join(', ');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as NestErrorBody | null;
    throw new ApiError(extractErrorMessage(body), response.status);
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
