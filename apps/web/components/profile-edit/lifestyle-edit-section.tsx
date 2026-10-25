'use client';

import { useState, type FormEvent } from 'react';
import { lifestyleSchema, type ProfileResponse } from '@nadar-kalyanam/schemas';
import { Button, FormError } from '@nadar-kalyanam/ui';
import {
  LifestyleFields,
  toLifestyleForm,
  type LifestyleFormState,
} from '../profile-form-fields/lifestyle-fields';
import { ApiError, updateLifestyle } from '../../lib/api-client';
import { toFieldErrors } from '../../lib/zod-errors';
import { useRegistration } from '../../app/providers/registration-provider';

export function LifestyleEditSection({
  profile,
  onCancel,
  onSaved,
}: {
  profile: ProfileResponse;
  onCancel: () => void;
  onSaved: (updated: ProfileResponse) => void;
}) {
  const { data } = useRegistration();
  const [form, setForm] = useState<LifestyleFormState>(() => toLifestyleForm(profile.details?.lifestyle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    const result = lifestyleSchema.safeParse(form);
    if (!result.success) {
      setErrors(toFieldErrors(result.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const updated = await updateLifestyle(data.accessToken!, result.data);
      onSaved(updated);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not save your changes. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <LifestyleFields form={form} errors={errors} onChange={setForm} />

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
