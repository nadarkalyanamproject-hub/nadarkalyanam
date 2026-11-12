'use client';

import {
  ANCESTRAL_ORIGINS,
  NET_WORTH_FAMILY_STATUS,
  NET_WORTH_RANGES,
  type AdditionalDetails,
} from '@nadar-kalyanam/schemas';
import { Sparkles } from 'lucide-react';
import { Field, Input, Textarea } from '@nadar-kalyanam/ui';
import { ProgressiveField } from '../motion/progressive-field';
import { SmartDropdown } from '../ui/smart-dropdown';
import { isRequired } from '../../lib/required-fields';
import { useSubjectLabels } from './profile-for';

export type AdditionalDetailsFormState = Record<keyof AdditionalDetails, string> & {
  ancestralOrigin?: string;
  ancestralOriginOther?: string;
};

const FAMILY_STATUS_OPTIONS = [
  'Middle Class',
  'Upper Middle Class',
  'Rich / Affluent (Elite)',
];

export function AdditionalDetailsFields({
  form,
  errors,
  onChange,
  progressive = true,
  writeAbout,
}: {
  form: AdditionalDetailsFormState;
  errors: Record<string, string>;
  onChange: <K extends keyof AdditionalDetailsFormState>(key: K, value: string) => void;
  progressive?: boolean;
  writeAbout?: () => string;
}) {
  const subject = useSubjectLabels();

  // Progressive reveal conditions:
  // 1. Show Family Status first
  // 2. After selecting Family Status, display Ancestral Origin
  const isFamilyStatusComplete = Boolean(form.familyType && form.familyType.trim() !== '');
  const showAncestralOrigin = !progressive || isFamilyStatusComplete;

  // 3. If "Others" is selected under Ancestral Origin, display Enter ancestral origin (Optional)
  const isAncestralOriginComplete = Boolean(form.ancestralOrigin && form.ancestralOrigin.trim() !== '');
  const showAncestralOriginOther = form.ancestralOrigin === 'Others';

  // 4. Finally, display A few words about myself
  const showAbout = !progressive || (showAncestralOrigin && isAncestralOriginComplete);

  function handleAncestralOriginChange(value: string) {
    onChange('ancestralOrigin', value);
    if (value !== 'Others' && form.ancestralOriginOther) {
      onChange('ancestralOriginOther', '');
    }
  }

  if (!progressive) {
    return (
      <div className="flex flex-col gap-4">
        <Field
          label="Family status"
          htmlFor="familyType"
          required={isRequired('additional', 'familyType')}
          error={errors.familyType}
        >
          <SmartDropdown
            id="familyType"
            invalid={Boolean(errors.familyType)}
            value={form.familyType}
            onChange={(val) => {
              onChange('familyType', val);
              if (val !== NET_WORTH_FAMILY_STATUS && form.netWorth) {
                onChange('netWorth', '');
              }
            }}
            options={FAMILY_STATUS_OPTIONS}
            placeholder="Select family status"
            searchable={false}
          />
        </Field>

        {form.familyType === NET_WORTH_FAMILY_STATUS && (
          <Field
            label="Family net worth (optional)"
            htmlFor="netWorth"
            required={isRequired('additional', 'netWorth')}
            error={errors.netWorth}
          >
            <SmartDropdown
              id="netWorth"
              invalid={Boolean(errors.netWorth)}
              value={form.netWorth}
              onChange={(val) => onChange('netWorth', val)}
              options={NET_WORTH_RANGES}
              placeholder="Select net worth range"
              searchable={false}
            />
          </Field>
        )}

        <Field
          label={subject.about}
          htmlFor="about"
          required={isRequired('additional', 'about')}
          error={errors.about}
          hint="At least 50 characters. You can edit anything written for you."
        >
          <Textarea
            id="about"
            invalid={Boolean(errors.about)}
            value={form.about}
            onChange={(e) => onChange('about', e.target.value)}
          />
        </Field>

        {writeAbout && (
          <button
            type="button"
            onClick={() => onChange('about', writeAbout())}
            data-testid="write-about"
            className="inline-flex items-center gap-1.5 self-end text-xs font-semibold text-nk-maroon hover:text-nk-maroon-deep"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {form.about.trim() ? 'Write it again for me' : 'Write it for me'}
          </button>
        )}
      </div>
    );
  }

  // Progressive Onboarding Mode (Step 4):
  // 1. Show Family Status first.
  // 2. After selecting Family Status, display Ancestral Origin.
  // 3. If user selects Others under Ancestral Origin, display Enter ancestral origin (Optional).
  // 4. Finally, display A few words about myself.
  return (
    <div className="flex flex-col gap-5">
      {/* 1. Family Status shown first */}
      <div className="flex flex-col gap-3">
        <Field
          label="Family status"
          htmlFor="familyType"
          required
          error={errors.familyType}
        >
          <SmartDropdown
            id="familyType"
            invalid={Boolean(errors.familyType)}
            value={form.familyType}
            onChange={(val) => {
              onChange('familyType', val);
              if (val !== NET_WORTH_FAMILY_STATUS && form.netWorth) {
                onChange('netWorth', '');
              }
            }}
            options={FAMILY_STATUS_OPTIONS}
            placeholder="Select family status"
            searchable={false}
          />
        </Field>

        {form.familyType === NET_WORTH_FAMILY_STATUS && (
          <ProgressiveField>
            <Field
              label="Family net worth (optional)"
              htmlFor="netWorth"
              error={errors.netWorth}
            >
              <SmartDropdown
                id="netWorth"
                invalid={Boolean(errors.netWorth)}
                value={form.netWorth}
                onChange={(val) => onChange('netWorth', val)}
                options={NET_WORTH_RANGES}
                placeholder="Select net worth range"
                searchable={false}
              />
            </Field>
          </ProgressiveField>
        )}
      </div>

      {/* 2. Ancestral Origin displayed after selecting Family Status */}
      {showAncestralOrigin && (
        <ProgressiveField>
          <div className="flex flex-col gap-3">
            <Field
              label="Ancestral origin"
              htmlFor="ancestralOrigin"
              required
              error={errors.ancestralOrigin}
            >
              <SmartDropdown
                id="ancestralOrigin"
                invalid={Boolean(errors.ancestralOrigin)}
                value={form.ancestralOrigin ?? ''}
                onChange={(val) => handleAncestralOriginChange(val)}
                options={ANCESTRAL_ORIGINS}
                placeholder="Select ancestral origin"
                searchable={true}
                searchPlaceholder="Search ancestral place..."
              />
            </Field>

            {/* 3. If "Others" is selected, display Enter ancestral origin (Optional) */}
            {showAncestralOriginOther && (
              <ProgressiveField>
                <Field
                  label="Enter ancestral origin (Optional)"
                  htmlFor="ancestralOriginOther"
                  error={errors.ancestralOriginOther}
                >
                  <Input
                    id="ancestralOriginOther"
                    placeholder="Enter your ancestral town or native place"
                    invalid={Boolean(errors.ancestralOriginOther)}
                    value={form.ancestralOriginOther ?? ''}
                    onChange={(e) => onChange('ancestralOriginOther', e.target.value)}
                  />
                </Field>
              </ProgressiveField>
            )}
          </div>
        </ProgressiveField>
      )}

      {/* 4. Finally, display A few words about myself */}
      {showAbout && (
        <ProgressiveField>
          <div className="flex flex-col gap-2">
            <Field
              label="A few words about myself"
              htmlFor="about"
              required
              error={errors.about}
              hint="At least 50 characters. You can edit anything written for you."
            >
              <Textarea
                id="about"
                rows={4}
                placeholder="Share about your personality, values, interests, family background and partner expectations..."
                invalid={Boolean(errors.about)}
                value={form.about}
                onChange={(e) => onChange('about', e.target.value)}
              />
            </Field>

            <div className="flex items-center justify-between text-xs">
              <span
                className={
                  form.about.trim().length >= 50
                    ? 'font-medium text-emerald-700'
                    : 'text-nk-muted'
                }
              >
                {form.about.trim().length} / 50 characters min
              </span>

              {writeAbout && (
                <button
                  type="button"
                  onClick={() => onChange('about', writeAbout())}
                  data-testid="write-about"
                  className="inline-flex items-center gap-1.5 font-semibold text-nk-maroon hover:text-nk-maroon-deep transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {form.about.trim() ? 'Write it again for me' : 'Write it for me'}
                </button>
              )}
            </div>
          </div>
        </ProgressiveField>
      )}
    </div>
  );
}
