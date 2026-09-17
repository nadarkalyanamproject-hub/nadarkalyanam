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
