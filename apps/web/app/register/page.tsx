'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Field, FormError, Input } from '@nadar-kalyanam/ui';
import { AuthShell } from '../../components/auth-shell';
import { ApiError, requestOtp } from '../../lib/api-client';
import { isValidLocalPhone, toE164 } from '../../lib/phone';
import { useRegistration } from '../providers/registration-provider';

export default function RegisterPage() {
  const router = useRouter();
  const { data, setPhoneNumber, setDevOtp } = useRegistration();

  const [phone, setPhone] = useState(() => data.phoneNumber?.replace('+91', '') ?? '');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    if (!isValidLocalPhone(phone)) {
      setFieldError('Enter a valid 10-digit mobile number');
      return;
    }
    setFieldError(undefined);

    const phoneNumber = toE164(phone);
    setSubmitting(true);
    try {
      const { devOtp } = await requestOtp({ phoneNumber });
      setPhoneNumber(phoneNumber);
      setDevOtp(devOtp);
      router.push('/register/verify');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not send OTP. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Begin Your Journey" subtitle="Enter your mobile number to get started">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Field label="Mobile number" htmlFor="phone" error={fieldError}>
          <div className="flex items-center gap-2">
            <span className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              +91
            </span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="9876543210"
              autoComplete="tel"
              invalid={Boolean(fieldError)}
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
            />
          </div>
        </Field>

        {formError ? <FormError>{formError}</FormError> : null}

        <Button type="submit" size="lg" disabled={submitting} className="mt-2">
          {submitting ? 'Sending OTP...' : 'Send OTP'}
        </Button>
      </form>
    </AuthShell>
  );
}
