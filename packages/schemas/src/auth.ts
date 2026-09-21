import { z } from 'zod';

export const sendOtpRequestSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format, e.g. +919876543210'),
});
export type SendOtpRequest = z.infer<typeof sendOtpRequestSchema>;

export const verifyOtpRequestSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/),
  otp: z.string().length(6),
});
export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const sendOtpResponseSchema = z.object({
  expiresInSeconds: z.number(),
  devOtp: z.string().optional(),
});
export type SendOtpResponse = z.infer<typeof sendOtpResponseSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  hasProfile: z.boolean(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const verifyOtpResponseSchema = authTokensSchema.extend({
  user: authUserSchema,
});
export type VerifyOtpResponse = z.infer<typeof verifyOtpResponseSchema>;
