'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, FormError, Input } from '@nadar-kalyanam/ui';
import { AuthShell } from '../../../components/auth-shell';
import { ApiError, requestOtp, verifyOtp } from '../../../lib/api-client';
import { fromE164 } from '../../../lib/phone';
import { useRegistration } from '../../providers/registration-provider';

export default function VerifyOtpPage() {
  const router = useRouter();
  const { data, hydrated, setAuth, setDevOtp } = useRegistration();

  const [otp, setOtp] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (hydrated && !data.phoneNumber) {
      router.replace('/register');
    }
  }, [hydrated, data.phoneNumber, router]);

  if (!hydrated || !data.phoneNumber) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    if (!/^\d{6}$/.test(otp)) {
      setFieldError('Enter the 6-digit code');
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      const result = await verifyOtp({ phoneNumber: data.phoneNumber!, otp });
      setAuth({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.user.id,
        hasProfile: result.user.hasProfile,
      });
      router.push(result.user.hasProfile ? '/' : '/onboarding/basic-details');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not verify OTP. Please try again.');
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setFormError(undefined);
    setResending(true);
    try {
      const { devOtp } = await requestOtp({ phoneNumber: data.phoneNumber! });
      setDevOtp(devOtp);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell
      title="Verify Your Number"
      subtitle={`Enter the 6-digit code sent to +91 ${fromE164(data.phoneNumber)}`}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Field label="OTP code" htmlFor="otp" error={fieldError}>
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            autoComplete="one-time-code"
            invalid={Boolean(fieldError)}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        {data.devOtp ? (
          <p className="text-xs text-muted-foreground">
            Dev mode: your OTP is <span className="font-mono font-semibold">{data.devOtp}</span>
          </p>
        ) : null}

        {formError ? <FormError>{formError}</FormError> : null}

        <Button type="submit" size="lg" disabled={submitting} className="mt-2">
          {submitting ? 'Verifying...' : 'Verify & Continue'}
        </Button>
        <Button type="button" variant="outline" disabled={resending} onClick={handleResend}>
          {resending ? 'Resending...' : 'Resend OTP'}
        </Button>
      </form>
    </AuthShell>
  );
}
