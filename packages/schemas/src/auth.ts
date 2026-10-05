import { z } from 'zod';

export const sendOtpRequestSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format, e.g. +919876543210'),
});
export type SendOtpRequest = z.infer<typeof sendOtpRequestSchema>;

export const verifyOtpRequestSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/),
  otp: z.string().length(6),
  // Omitted defaults to 'register': upsert-or-create the user, same as
  // always. 'login' instead requires an existing user and rejects unknown
  // numbers — see AuthService.verifyOtp.
  intent: z.enum(['register', 'login']).optional(),
});
export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

// POST /auth/refresh: the refresh token is spent and a new pair returned
// (AuthTokens). Presenting a spent token again revokes the whole session.
export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

export const sendOtpResponseSchema = z.object({
  expiresInSeconds: z.number(),
  devOtp: z.string().optional(),
});
export type SendOtpResponse = z.infer<typeof sendOtpResponseSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  hasProfile: z.boolean(),
  // True only when this login resolved to an admin-scoped token (see
  // AuthService.verifyOtp) — lets a client distinguish an admin login from
  // a member one without having to decode the JWT itself.
  isAdmin: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const verifyOtpResponseSchema = authTokensSchema.extend({
  user: authUserSchema,
});
export type VerifyOtpResponse = z.infer<typeof verifyOtpResponseSchema>;
