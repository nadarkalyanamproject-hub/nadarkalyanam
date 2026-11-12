'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { Emblem } from '../../components/admin-shell';
import { OTPInputGroup } from '../../components/ui/otp-input-group';
import { ApiError, requestOtp, verifyOtp } from '../../lib/api-client';
import { isValidLocalPhone, toE164 } from '../../lib/phone';
import { useAdminAuth } from '../providers/admin-auth-provider';

const primaryButton =
  'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[#a3161f] disabled:cursor-not-allowed disabled:opacity-60';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAdminAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidLocalPhone(phone)) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await requestOtp(toE164(phone));
      setDevOtp(result.devOtp);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      const result = await verifyOtp(toE164(phone), otp);
      // Critical check: a regular member's phone number can successfully
      // verify OTP (their login always succeeds) but it returns a
      // non-admin token. That token must never be let into the admin app.
      if (!result.user.isAdmin) {
        setError('This account does not have admin access.');
        return;
      }
      setAuth({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        adminUserId: result.user.id,
      });
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel, wide screens only. */}
      <aside className="relative hidden overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <Emblem className="h-9 w-auto" />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-[-0.01em]">Nadar Kalyanam</span>
            <span className="block text-[12px] font-medium text-primary-foreground/60">Admin console</span>
          </span>
        </div>

        <div className="my-auto max-w-md">
          <h2 className="font-[family-name:var(--font-heading)] text-[46px] font-semibold leading-[1.05] tracking-[-0.01em]">
            Run the platform from one place.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-primary-foreground/70">
            Members, photo and report reviews, payments and plans, all in one console. Each admin sees only the
            pages their role allows.
          </p>
        </div>

        <p className="text-[12px] text-primary-foreground/50">
          Restricted area. Every sign-in and action is recorded in the audit log.
        </p>

        {/* Large faint emblem as a quiet watermark. */}
        <Emblem className="pointer-events-none absolute -bottom-16 -right-14 h-[420px] w-auto opacity-[0.07]" />
      </aside>

      {/* Form side. */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Emblem className="h-8 w-auto" />
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold text-foreground">Nadar Kalyanam</span>
              <span className="block text-[11px] font-medium text-faint">Admin console</span>
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-7 shadow-sm sm:p-8">
            {step === 'phone' ? (
              <>
                <h1 className="text-[22px] font-semibold text-ink">Sign in</h1>
                <p className="mt-1.5 text-[14px] text-muted-foreground">
                  Enter the mobile number linked to your admin account. We will send a 6-digit code.
                </p>

                <form onSubmit={(e) => void handlePhoneSubmit(e)} className="mt-6 space-y-4" noValidate>
                  <div>
                    <label htmlFor="admin-phone" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
                      Mobile number
                    </label>
                    <div
                      className={`flex h-11 items-center rounded-xl border bg-card transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--color-accent-soft)] ${
                        phoneError ? 'border-bad' : 'border-input'
                      }`}
                    >
                      <span className="flex h-full items-center border-r border-border px-3.5 text-[14px] font-medium text-muted-foreground">
                        +91
                      </span>
                      <input
                        id="admin-phone"
                        data-bare
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        autoFocus
                        className="h-full w-full bg-transparent px-3.5 text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-faint"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="98765 43210"
                        aria-invalid={phoneError}
                      />
                    </div>
                    {phoneError && (
                      <p className="mt-1.5 text-[12.5px] font-medium text-bad">Enter a valid 10-digit mobile number.</p>
                    )}
                  </div>

                  {error && <ErrorBox message={error} />}

                  <button type="submit" className={primaryButton} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending code
                      </>
                    ) : (
                      <>
                        Send code
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="-ml-1 mb-4 inline-flex items-center gap-1.5 rounded-lg px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-ink disabled:opacity-60"
                  disabled={submitting}
                  onClick={() => {
                    setStep('phone');
                    setOtp('');
                    setError(undefined);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change number
                </button>
                <h1 className="text-[22px] font-semibold text-ink">Enter the code</h1>
                <p className="mt-1.5 text-[14px] text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium text-ink">+91 {phone}</span>.
                </p>

                <form onSubmit={(e) => void handleOtpSubmit(e)} className="mt-6 space-y-4">
                  <OTPInputGroup
                    value={otp}
                    onChange={setOtp}
                    length={6}
                    disabled={submitting}
                    hasError={Boolean(error)}
                    className="!justify-between"
                  />

                  {error && <ErrorBox message={error} />}

                  {devOtp && (
                    <p className="rounded-xl border border-gold/40 bg-gold-soft px-3.5 py-2.5 text-[13px] text-warn">
                      Dev mode: your code is <strong className="font-semibold tracking-wider">{devOtp}</strong>
                    </p>
                  )}

                  <button type="submit" className={primaryButton} disabled={submitting || otp.length !== 6}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying
                      </>
                    ) : (
                      <>
                        Verify and sign in
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[12.5px] text-faint">
            <ShieldCheck className="h-3.5 w-3.5" />
            For authorised Nadar Kalyanam staff only
          </p>
        </div>
      </main>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-bad/20 bg-bad-soft px-3.5 py-2.5 text-[13px] font-medium text-bad">
      {message}
    </p>
  );
}
