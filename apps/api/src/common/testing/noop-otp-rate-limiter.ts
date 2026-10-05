// Test-only stand-in for OtpRateLimiter that never limits, for specs about
// other parts of the OTP flow. The limiter itself is covered by
// otp-rate-limiter.spec.ts.
export const noopOtpRateLimiter = {
  assertCanRequest: async () => {},
  assertCanVerify: async () => {},
  recordFailedVerify: async () => 4,
  clearFailedVerifies: async () => {},
};
