'use client';

import { useState, type FormEvent } from 'react';
import { locationProfessionalSchema, type ProfileResponse } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import {
  LocationProfessionalFields,
  type LocationProfessionalFormState,
} from '../profile-form-fields/location-professional-fields';
import { ApiError, updateProfile } from '../../lib/api-client';
import { profileToLocationProfessionalForm, toCreateProfileRequest } from '../../lib/profile-mapping';
import { toFieldErrors } from '../../lib/zod-errors';
import { useRegistration } from '../../app/providers/registration-provider';

export function LocationProfessionalEditSection({
  profile,
  onCancel,
  onSaved,
}: {
  profile: ProfileResponse;
  onCancel: () => void;
  onSaved: (updated: ProfileResponse) => void;
}) {
  const { data } = useRegistration();
  const [form, setForm] = useState<LocationProfessionalFormState>(() =>
    profileToLocationProfessionalForm(profile),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof LocationProfessionalFormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const result = locationProfessionalSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const updated = await updateProfile(data.accessToken!, {
        ...toCreateProfileRequest(profile),
        location: result.data,
      });
      onSaved(updated);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not save your changes. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <LocationProfessionalFields form={form} errors={errors} onChange={update} />

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
