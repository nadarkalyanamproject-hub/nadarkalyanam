'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { OTPInputGroup } from '../../components/ui/otp-input-group';
import { ApiError, requestOtp, verifyOtp } from '../../lib/api-client';
import { isValidLocalPhone, toE164 } from '../../lib/phone';
import { useAdminAuth } from '../providers/admin-auth-provider';
import './login.css';

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
      setError(err instanceof ApiError ? err.message : 'Could not send OTP. Please try again.');
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
      // verify OTP (their login always succeeds) — it just returns a
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
      setError(err instanceof ApiError ? err.message : 'Could not verify OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-overlay" />
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1 className="admin-login-title">Admin Sign In</h1>
          <p className="admin-login-sub">
            {step === 'phone'
              ? 'Nadar Kalyanam admin back-office'
              : `Enter the 6-digit code sent to +91 ${phone}`}
          </p>
        </div>

        {step === 'phone' && (
          <form onSubmit={(e) => void handlePhoneSubmit(e)} className="admin-login-form">
            <div className={`admin-login-form-group${phoneError ? ' has-error' : ''}`}>
              <div className="admin-login-input-wrapper">
                <input
                  type="tel"
                  className="admin-login-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                />
              </div>
              {phoneError && (
                <span className="admin-login-error-msg">Enter a valid 10-digit phone number.</span>
              )}
            </div>
            {error && <p className="admin-login-error-msg">{error}</p>}
            <button type="submit" className="admin-login-btn-submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <span>Send OTP</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={(e) => void handleOtpSubmit(e)} className="admin-login-form">
            <div className="py-2">
              <OTPInputGroup value={otp} onChange={setOtp} length={6} disabled={submitting} hasError={Boolean(error)} />
            </div>

            {error && <p className="admin-login-error-msg" style={{ textAlign: 'center' }}>{error}</p>}

            {devOtp && (
              <div className="admin-login-devotp">
                Dev mode: your OTP is <strong>{devOtp}</strong>
              </div>
            )}

            <button
              type="submit"
              className="admin-login-btn-submit"
              disabled={submitting || otp.length !== 6}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <span>Verify & Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <button
              type="button"
              className="admin-login-btn-outline"
              disabled={submitting}
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError(undefined);
              }}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
