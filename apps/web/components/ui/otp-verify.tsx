"use client";

import React, { useState, useRef, useEffect } from "react";
import { Loader2, ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";

export interface OTPInputGroupProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  theme?: "light" | "dark";
  className?: string;
}

export function OTPInputGroup({
  value,
  onChange,
  length = 6,
  disabled = false,
  hasError = false,
  autoFocus = true,
  theme = "light",
  className = "",
}: OTPInputGroupProps) {
  const digits = Array.from({ length }, (_, i) => value[i] || "");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanVal = rawVal.replace(/\D/g, "");

    // Handling multi-character paste into any box
    if (cleanVal.length > 1) {
      const chars = cleanVal.slice(0, length);
      const newChars = Array.from({ length }, (_, i) => {
        if (i < index) return value[i] || "";
        const charFromPaste = chars[i - index];
        return charFromPaste !== undefined ? charFromPaste : value[i] || "";
      });
      const nextVal = newChars.join("");
      onChange(nextVal);
      const nextFocus = Math.min(index + cleanVal.length, length - 1);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const newChars = [...digits];
    newChars[index] = cleanVal;
    const nextVal = newChars.join("");
    onChange(nextVal);

    if (cleanVal && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newChars = [...digits];
        newChars[index - 1] = "";
        onChange(newChars.join(""));
      } else {
        const newChars = [...digits];
        newChars[index] = "";
        onChange(newChars.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const targetIdx = Math.min(pasted.length, length - 1);
    inputRefs.current[targetIdx]?.focus();
  };

  const isDark = theme === "dark";

  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-2.5 ${className}`}>
      {Array.from({ length }).map((_, index) => {
        const char = digits[index] || "";
        const isFilled = Boolean(char);

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            disabled={disabled}
            value={char}
            autoComplete="one-time-code"
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`
              w-10 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl transition-all duration-200 outline-none
              ${
                isDark
                  ? `bg-white/10 text-white placeholder-white/40 border border-white/20
                     focus:bg-white/20 focus:border-[#FFD54F] focus:ring-2 focus:ring-[#FFD54F]/40 shadow-lg`
                  : `bg-[#FFFDF8] text-[#2B1515] border border-[#EADBCA]
                     focus:border-[#8E1B24] focus:ring-2 focus:ring-[#F59E0B]/40 focus:bg-white shadow-sm`
              }
              ${hasError ? "!border-[#C22020] !bg-red-50/50 !text-[#C22020] focus:!ring-red-200" : ""}
              ${isFilled && !hasError && !isDark ? "border-[#8E1B24] bg-white text-[#8E1B24]" : ""}
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
            aria-label={`Digit ${index + 1} of ${length}`}
          />
        );
      })}
    </div>
  );
}

export interface OTPVerificationProps {
  length?: number;
  emailOrPhone?: string;
  devOtp?: string;
  error?: string;
  isLoading?: boolean;
  onVerify?: (otpCode: string) => Promise<void> | void;
  onResend?: () => Promise<void> | void;
  onChangeNumber?: () => void;
  variant?: "full" | "embedded";
  theme?: "light" | "dark";
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  backgroundImageUrl?: string;
  className?: string;
}

export function OTPVerification({
  length = 6,
  emailOrPhone = "+91 98765 43210",
  devOtp,
  error,
  isLoading = false,
  onVerify,
  onResend,
  onChangeNumber,
  variant = "full",
  theme,
  title = "Verify Your Number",
  subtitle,
  buttonLabel = "Verify & Proceed",
  backgroundImageUrl = "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=1200",
  className = "",
}: OTPVerificationProps) {
  const [otp, setOtp] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const activeLoading = isLoading || internalLoading;
  const isComplete = otp.length === length;
  const activeTheme = theme || (variant === "full" ? "dark" : "light");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isComplete || activeLoading) return;

    if (onVerify) {
      await onVerify(otp);
    } else {
      setInternalLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("Verified OTP:", otp);
      setInternalLoading(false);
    }
  };

  const handleResendClick = async () => {
    if (resending || resendCooldown > 0) return;
    setResending(true);
    try {
      if (onResend) {
        await onResend();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        console.log("Resent OTP code");
      }
      setResendCooldown(30);
    } finally {
      setResending(false);
    }
  };

  // Embedded view for use inside registration cards and login modal
  if (variant === "embedded") {
    return (
      <form onSubmit={handleSubmit} className={`flex flex-col gap-4 ${className}`} noValidate>
        <div className="space-y-1 text-center">
          {subtitle && (
            <p className="text-xs sm:text-sm text-[#5E3D3D] leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="py-2">
          <OTPInputGroup
            value={otp}
            onChange={setOtp}
            length={length}
            disabled={activeLoading}
            hasError={Boolean(error)}
            theme={activeTheme}
          />
        </div>

        {error && (
          <p className="text-center text-xs font-semibold text-[#C22020] animate-shake">
            {error}
          </p>
        )}

        {devOtp && (
          <div className="rounded-lg border border-[#FDE68A] bg-[#FEF3C7] px-3 py-1.5 text-center text-xs text-[#92400E]">
            Dev mode code: <strong className="font-bold tracking-wider">{devOtp}</strong>
          </div>
        )}

        <button
          type="submit"
          disabled={!isComplete || activeLoading}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8E1B24] to-[#6C1118] text-white font-semibold text-sm shadow-md transition-all hover:from-[#A8242F] hover:to-[#8E1B24] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {activeLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#FFD54F]" />
              <span>Verifying Code…</span>
            </>
          ) : (
            <>
              <span>{buttonLabel}</span>
              <ArrowRight className="w-4 h-4 text-[#FFD54F]" />
            </>
          )}
        </button>

        <div className="flex items-center justify-between text-xs pt-1 px-1">
          {onChangeNumber && (
            <button
              type="button"
              disabled={activeLoading}
              onClick={onChangeNumber}
              className="text-[#5E3D3D] hover:text-[#8E1B24] font-medium transition-colors"
            >
              ← Change number
            </button>
          )}

          <button
            type="button"
            disabled={resending || resendCooldown > 0 || activeLoading}
            onClick={handleResendClick}
            className="ml-auto flex items-center gap-1 font-semibold text-[#8E1B24] hover:text-[#6C1118] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
            </span>
          </button>
        </div>
      </form>
    );
  }

  // Full-page / Standalone Nadar Kalyanam themed verification view
  return (
    <div className={`min-h-screen flex items-center justify-center bg-[#2B1515] p-4 ${className}`}>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl border border-[#F59E0B]/30">
        {/* Background Image & Cultural Vignette */}
        <div className="absolute inset-0 z-0">
          <img
            src={backgroundImageUrl}
            alt="Traditional Nadar wedding atmosphere"
            className="w-full h-full object-cover opacity-40 scale-105 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#6C1118]/85 via-[#8E1B24]/90 to-[#2B1515]/98" />
        </div>

        <div className="relative z-10 p-6 sm:p-10 py-10 sm:py-12 flex flex-col items-center">
          {/* Sacred Emblem Icon */}
          <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFD54F]/20 to-[#F59E0B]/10 border border-[#FFD54F]/40 shadow-inner">
            <ShieldCheck className="w-7 h-7 text-[#FFD54F]" />
          </div>

          <div className="text-center mb-6">
            <h1 className="font-[family-name:var(--font-heading,serif)] text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              {title}
            </h1>
            <p className="text-[#FFE082]/90 text-xs sm:text-sm leading-relaxed max-w-xs">
              {subtitle || (
                <>
                  Enter the 6-digit code sent to
                  <br />
                  <span className="font-semibold text-white tracking-wide">{emailOrPhone}</span>
                </>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            <div className="py-2">
              <OTPInputGroup
                value={otp}
                onChange={setOtp}
                length={length}
                disabled={activeLoading}
                hasError={Boolean(error)}
                theme="dark"
              />
            </div>

            {error && (
              <p className="text-center text-xs font-semibold text-[#FF8A8A] bg-red-950/60 border border-red-800/60 rounded-lg py-1.5 px-3">
                {error}
              </p>
            )}

            {devOtp && (
              <div className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-3 py-1.5 text-center text-xs text-[#FFD54F]">
                Dev code: <strong className="font-bold tracking-widest">{devOtp}</strong>
              </div>
            )}

            <button
              type="submit"
              disabled={!isComplete || activeLoading}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFD54F] via-[#F59E0B] to-[#D97706] text-[#680A0E] font-bold text-sm sm:text-base shadow-lg transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#680A0E]" />
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <span>{buttonLabel}</span>
                  <ArrowRight className="w-4 h-4 text-[#680A0E]" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-white/70 pt-1">
              {onChangeNumber && (
                <button
                  type="button"
                  onClick={onChangeNumber}
                  disabled={activeLoading}
                  className="hover:text-white transition-colors"
                >
                  ← Change number
                </button>
              )}

              <button
                type="button"
                onClick={handleResendClick}
                disabled={resending || resendCooldown > 0 || activeLoading}
                className="ml-auto flex items-center gap-1.5 font-medium text-[#FFD54F] hover:text-[#FFE082] transition-colors disabled:opacity-40"
              >
                {resending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </span>
              </button>
            </div>
          </form>

          <div className="mt-8 text-center border-t border-white/10 pt-4 w-full">
            <p className="text-white/50 text-[11px] leading-relaxed">
              By verifying, you agree to our{" "}
              <a href="#terms" className="text-[#FFD54F]/80 hover:text-[#FFD54F] underline">
                Terms of Service
              </a>{" "}
              &amp;{" "}
              <a href="#privacy" className="text-[#FFD54F]/80 hover:text-[#FFD54F] underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
