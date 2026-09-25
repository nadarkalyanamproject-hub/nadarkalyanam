'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { CreateProfileRequest } from '@nadar-kalyanam/schemas';
import { Button, Card, Field, Input, Select, Textarea } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../../components/admin-shell';
import {
  ApiError,
  getMember,
  reinstateMember,
  removeMember,
  suspendMember,
  updateMemberProfile,
  type MemberDetail,
} from '../../../lib/api-client';
import { useAdminAuth } from '../../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../../lib/use-require-admin-auth';

type FormState = {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  motherTongue: string;
  email: string;
  height: string;
  physicalStatus: string;
  maritalStatus: string;
  religion: string;
  casteCommunity: string;
  dosham: string;
  city: string;
  state: string;
  country: string;
  educationLevel: string;
  educationDetail: string;
  profession: string;
  employedIn: string;
  annualIncomeRange: string;
  annualIncomeCurrency: string;
  familyType: string;
  about: string;
};

function toFormState(details: Record<string, unknown>, member: MemberDetail): FormState {
  const location = (details.location as Record<string, unknown>) ?? {};
  const education = (details.education as Record<string, unknown>) ?? {};
  const additional = (details.additional as Record<string, unknown>) ?? {};
  return {
    fullName: member.profile?.fullName ?? '',
    gender: member.profile?.gender ?? '',
    dateOfBirth: member.profile?.dateOfBirth ?? '',
    motherTongue: (details.motherTongue as string) ?? '',
    email: (details.email as string) ?? '',
    height: (details.height as string) ?? '',
    physicalStatus: (details.physicalStatus as string) ?? 'NORMAL',
    maritalStatus: (details.maritalStatus as string) ?? '',
    religion: (details.religion as string) ?? '',
    casteCommunity: (details.casteCommunity as string) ?? '',
    dosham: (details.dosham as string) ?? '',
    city: (location.city as string) ?? '',
    state: (location.state as string) ?? '',
    country: (location.country as string) ?? 'India',
    educationLevel: (education.educationLevel as string) ?? '',
    educationDetail: (education.educationDetail as string) ?? '',
    profession: (education.profession as string) ?? '',
    employedIn: (education.employedIn as string) ?? '',
    annualIncomeRange: (education.annualIncomeRange as string) ?? '',
    annualIncomeCurrency: (education.annualIncomeCurrency as string) ?? 'INR',
    familyType: (additional.familyType as string) ?? 'Middle Class',
    about: (additional.about as string) ?? '',
  };
}

function toCreateProfileRequest(form: FormState): CreateProfileRequest {
  return {
    fullName: form.fullName,
    gender: form.gender as CreateProfileRequest['gender'],
    dateOfBirth: form.dateOfBirth,
    motherTongue: form.motherTongue,
    email: form.email,
    personal: {
      height: form.height,
      physicalStatus: form.physicalStatus as CreateProfileRequest['personal']['physicalStatus'],
      maritalStatus: form.maritalStatus as CreateProfileRequest['personal']['maritalStatus'],
      religion: form.religion,
      casteCommunity: form.casteCommunity,
      dosham: (form.dosham || undefined) as CreateProfileRequest['personal']['dosham'],
    },
    location: {
      city: form.city,
      state: form.state,
      country: form.country,
      educationLevel: form.educationLevel,
      educationDetail: form.educationDetail,
      profession: form.profession,
      employedIn: form.employedIn,
      annualIncomeRange: form.annualIncomeRange,
      annualIncomeCurrency: form.annualIncomeCurrency,
    },
    additional: {
      familyType: form.familyType as CreateProfileRequest['additional']['familyType'],
      about: form.about,
    },
  };
}

export default function MemberDetailPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const router = useRouter();
  const params = useParams<{ userId: string }>();

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | undefined>();
  const [showRemoveForm, setShowRemoveForm] = useState(false);
  const [removeReason, setRemoveReason] = useState('');

  function reload() {
    if (!data.accessToken) return;
    getMember(data.accessToken, params.userId)
      .then((result) => {
        setMember(result);
        setForm(toFormState((result.profile?.details as Record<string, unknown>) ?? {}, result));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load member.'));
  }

  useEffect(() => {
    if (!ready) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, params.userId]);

  async function handleSave() {
    if (!data.accessToken || !form) return;
    setSaving(true);
    setError(undefined);
    try {
      await updateMemberProfile(data.accessToken, params.userId, toCreateProfileRequest(form));
      setEditing(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!data.accessToken || !member) return;
    setActionPending(true);
    setActionMessage(undefined);
    try {
      if (member.status === 'SUSPENDED') {
        await reinstateMember(data.accessToken, params.userId);
        setActionMessage('Member reinstated.');
      } else {
        const reason = window.prompt('Reason for suspending this member:');
        if (!reason) return;
        await suspendMember(data.accessToken, params.userId, reason);
        setActionMessage('Member suspended.');
      }
      reload();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleRemove() {
    if (!data.accessToken || !removeReason.trim()) return;
    setActionPending(true);
    setActionMessage(undefined);
    try {
      const result = await removeMember(data.accessToken, params.userId, removeReason.trim());
      setActionMessage(
        `Removal scheduled — account will be anonymized on ${new Date(result.scheduledAnonymizationAt).toLocaleDateString()}.`,
      );
      setShowRemoveForm(false);
      reload();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Could not remove member.');
    } finally {
      setActionPending(false);
    }
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <Button type="button" variant="outline" size="sm" onClick={() => router.push('/members')}>
          ← Back to members
        </Button>

        {member === null && !error && (
          <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>
        )}
        {error && <Card className="rounded-2xl p-6 text-sm text-destructive">{error}</Card>}

        {member && (
          <>
            <Card className="rounded-2xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {member.profile?.fullName ?? '(no profile yet)'}
                  </h1>
                  <p className="text-sm text-muted-foreground">{member.phoneNumber}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">{member.status}</p>
                  {member.deletionRequestedAt && (
                    <p className="mt-1 text-xs text-destructive">
                      Removal requested {new Date(member.deletionRequestedAt).toLocaleDateString()} — scheduled
                      anonymization {new Date(member.scheduledAnonymizationAt!).toLocaleDateString()}.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {member.profile && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
                      {editing ? 'Cancel edit' : 'Edit profile'}
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" disabled={actionPending} onClick={() => void handleToggleActive()}>
                    {member.status === 'SUSPENDED' ? 'Activate' : 'Deactivate'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={member.status === 'PENDING_DELETION'}
                    onClick={() => setShowRemoveForm((s) => !s)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              {actionMessage && <p className="mt-3 text-sm text-muted-foreground">{actionMessage}</p>}

              {showRemoveForm && (
                <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <p className="text-sm font-semibold text-destructive">
                    This starts a 14-day grace period, not immediate deletion. The account is hidden from
                    search/matching immediately; it is scheduled for anonymization in 14 days unless reversed.
                  </p>
                  <Field label="Reason (required)" htmlFor="removeReason" className="mt-3">
                    <Textarea
                      id="removeReason"
                      rows={2}
                      value={removeReason}
                      onChange={(e) => setRemoveReason(e.target.value)}
                    />
                  </Field>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      disabled={!removeReason.trim() || actionPending}
                      onClick={() => void handleRemove()}
                    >
                      Confirm removal
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowRemoveForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {!member.profile && (
              <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
                This user has not created a profile yet — nothing to view or edit.
              </Card>
            )}

            {member.profile && !editing && (
              <Card className="rounded-2xl p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-primary">Profile</h2>
                {member.profile.photos.length > 0 && (
                  <div className="mb-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
                    {member.profile.photos.map((photo) => (
                      <div key={photo.id} className="aspect-square overflow-hidden rounded-lg border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  {Object.entries(form ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
                      <dd className="mt-0.5 text-foreground">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}

            {member.profile && editing && form && (
              <Card className="rounded-2xl p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-primary">Edit profile</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(
                    [
                      ['fullName', 'Full name', 'text'],
                      ['gender', 'Gender', 'select-gender'],
                      ['dateOfBirth', 'Date of birth', 'date'],
                      ['motherTongue', 'Mother tongue', 'text'],
                      ['email', 'Email', 'email'],
                      ['height', 'Height', 'text'],
                      ['physicalStatus', 'Physical status', 'select-physical'],
                      ['maritalStatus', 'Marital status', 'select-marital'],
                      ['religion', 'Religion', 'text'],
                      ['casteCommunity', 'Community', 'text'],
                      ['dosham', 'Dosham', 'select-dosham'],
                      ['city', 'City', 'text'],
                      ['state', 'State', 'text'],
                      ['country', 'Country', 'text'],
                      ['educationLevel', 'Education level', 'text'],
                      ['educationDetail', 'Education detail', 'text'],
                      ['profession', 'Profession', 'text'],
                      ['employedIn', 'Employed in', 'text'],
                      ['annualIncomeRange', 'Annual income range', 'text'],
                      ['annualIncomeCurrency', 'Income currency', 'text'],
                      ['familyType', 'Family type', 'select-family'],
                    ] as const
                  ).map(([key, label, kind]) => (
                    <Field key={key} label={label} htmlFor={key}>
                      {kind === 'select-gender' ? (
                        <Select id={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </Select>
                      ) : kind === 'select-physical' ? (
                        <Select id={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                          <option value="NORMAL">Normal</option>
                          <option value="PHYSICALLY_CHALLENGED">Physically challenged</option>
                        </Select>
                      ) : kind === 'select-marital' ? (
                        <Select id={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                          <option value="NEVER_MARRIED">Never married</option>
                          <option value="DIVORCED">Divorced</option>
                          <option value="WIDOWED">Widowed</option>
                          <option value="AWAITING_DIVORCE">Awaiting divorce</option>
                        </Select>
                      ) : kind === 'select-dosham' ? (
                        <Select id={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                          <option value="">Select</option>
                          <option value="NO">No</option>
                          <option value="YES">Yes</option>
                          <option value="DONT_KNOW">Don&apos;t know</option>
                        </Select>
                      ) : kind === 'select-family' ? (
                        <Select id={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                          <option value="Middle Class">Middle Class</option>
                          <option value="Upper Middle Class">Upper Middle Class</option>
                          <option value="Rich / Affluent (Elite)">Rich / Affluent (Elite)</option>
                        </Select>
                      ) : (
                        <Input
                          id={key}
                          type={kind}
                          value={form[key]}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        />
                      )}
                    </Field>
                  ))}
                  <div className="sm:col-span-2">
                    <Field label="About" htmlFor="about">
                      <Textarea
                        id="about"
                        rows={4}
                        value={form.about}
                        onChange={(e) => setForm({ ...form, about: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
