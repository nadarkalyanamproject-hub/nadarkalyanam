'use client';

import { DIETS, HABIT_FREQUENCIES, HOBBIES, MAX_HOBBIES, type Lifestyle } from '@nadar-kalyanam/schemas';
import { Field, Select } from '@nadar-kalyanam/ui';
import { useSubjectLabels } from './profile-for';

// Lifestyle & Habits fields, shared by onboarding step 4 and My Profile.
// Every answer is optional.
export type Hobby = (typeof HOBBIES)[number];
export type LifestyleFormState = { diet: string; smoking: string; drinking: string; hobbies: Hobby[] };
type HabitKey = 'diet' | 'smoking' | 'drinking';

export const EMPTY_LIFESTYLE_FORM: LifestyleFormState = { diet: '', smoking: '', drinking: '', hobbies: [] };

export function toLifestyleForm(lifestyle: Lifestyle | null | undefined): LifestyleFormState {
  return {
    diet: lifestyle?.diet ?? '',
    smoking: lifestyle?.smoking ?? '',
    drinking: lifestyle?.drinking ?? '',
    hobbies: lifestyle?.hobbies ?? [],
  };
}

// The onboarding draft stores plain strings, so hobbies travel as "A|B".
export function lifestyleFormToDraft(form: LifestyleFormState): Record<string, string> {
  return { diet: form.diet, smoking: form.smoking, drinking: form.drinking, hobbies: form.hobbies.join('|') };
}

export function lifestyleFormFromDraft(draft: Record<string, string> | undefined): LifestyleFormState {
  if (!draft) return EMPTY_LIFESTYLE_FORM;
  const known = new Set<string>(HOBBIES);
  return {
    diet: draft.diet ?? '',
    smoking: draft.smoking ?? '',
    drinking: draft.drinking ?? '',
    hobbies: (draft.hobbies ?? '').split('|').filter((h): h is Hobby => known.has(h)),
  };
}

// True when the member answered nothing, so onboarding can skip sending it.
export function isLifestyleFormEmpty(form: LifestyleFormState): boolean {
  return !form.diet && !form.smoking && !form.drinking && form.hobbies.length === 0;
}

export function LifestyleFields({
  form,
  errors,
  onChange,
}: {
  form: LifestyleFormState;
  errors: Record<string, string>;
  onChange: (next: LifestyleFormState) => void;
}) {
  const subject = useSubjectLabels();
  const atLimit = form.hobbies.length >= MAX_HOBBIES;

  function toggleHobby(hobby: Hobby) {
    onChange({
      ...form,
      hobbies: form.hobbies.includes(hobby) ? form.hobbies.filter((h) => h !== hobby) : [...form.hobbies, hobby],
    });
  }

  const habitSelect = (key: HabitKey, label: string, options: readonly string[]) => (
    <Field label={subject.label(label)} htmlFor={`lifestyle-${key}`} error={errors[key]}>
      <Select
        id={`lifestyle-${key}`}
        invalid={Boolean(errors[key])}
        value={form[key]}
        onChange={(e) => onChange({ ...form, [key]: e.target.value })}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {habitSelect('diet', 'Diet', DIETS)}
        {habitSelect('smoking', 'Smoking', HABIT_FREQUENCIES)}
        {habitSelect('drinking', 'Drinking', HABIT_FREQUENCIES)}
      </div>

      <Field label={subject.label('Hobbies & interests')} htmlFor="lifestyle-hobbies" error={errors.hobbies} hint={`Pick up to ${MAX_HOBBIES}.`}>
        <div id="lifestyle-hobbies" role="group" aria-label={subject.label('Hobbies & interests')} className="flex flex-wrap gap-2">
          {HOBBIES.map((hobby) => {
            const selected = form.hobbies.includes(hobby);
            return (
              <button
                key={hobby}
                type="button"
                aria-pressed={selected}
                disabled={!selected && atLimit}
                onClick={() => toggleHobby(hobby)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected
                    ? 'border-nk-maroon bg-nk-maroon text-white'
                    : 'border-nk-line bg-white text-nk-ink hover:border-nk-maroon hover:text-nk-maroon'
                }`}
              >
                {hobby}
              </button>
            );
          })}
        </div>
      </Field>
    </>
  );
}
