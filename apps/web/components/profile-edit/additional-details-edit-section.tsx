'use client';

import { useState, type FormEvent } from 'react';
import { additionalDetailsSchema, type ProfileResponse } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import {
  AdditionalDetailsFields,
  type AdditionalDetailsFormState,
} from '../profile-form-fields/additional-details-fields';
import { ApiError, updateProfile } from '../../lib/api-client';
import { profileToAdditionalDetailsForm, toCreateProfileRequest } from '../../lib/profile-mapping';
import { toFieldErrors } from '../../lib/zod-errors';
import { useRegistration } from '../../app/providers/registration-provider';

export function AdditionalDetailsEditSection({
  profile,
  onCancel,
  onSaved,
}: {
  profile: ProfileResponse;
  onCancel: () => void;
  onSaved: (updated: ProfileResponse) => void;
}) {
  const { data } = useRegistration();
  const [form, setForm] = useState<AdditionalDetailsFormState>(() =>
    profileToAdditionalDetailsForm(profile),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof AdditionalDetailsFormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const result = additionalDetailsSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const updated = await updateProfile(data.accessToken!, {
        ...toCreateProfileRequest(profile),
        additional: result.data,
      });
      onSaved(updated);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not save your changes. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <AdditionalDetailsFields form={form} errors={errors} onChange={update} />

      {formError ? <FormError>{formError}</FormError> : null}

      <div className="mt-2 flex gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" size="lg" disabled={submitting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
