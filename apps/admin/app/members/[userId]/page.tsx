'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { CreateProfileRequest } from '@nadar-kalyanam/schemas';
import { Button, Card, Field, Input, Select, Textarea } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../../components/admin-shell';
import { StatusBadge } from '../../../components/status-badge';
import {
  ApiError,
  getMember,
  reinstateMember,
  removeMember,
  approveMemberPhoto,
  rejectMemberPhoto,
  removeMemberPhoto,
  restoreMember,
  suspendMember,
  updateMemberProfile,
  type MemberDetail,
} from '../../../lib/api-client';
import { useAdminAuth } from '../../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../../lib/use-require-admin-auth';
import { useCurrentAdmin } from '../../../lib/use-current-admin';

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
  // Not editable here; carried through so an admin save doesn't erase them.
  previousMarriageDetails: string;
  doshamDetails: string;
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
    previousMarriageDetails: (details.previousMarriageDetails as string) ?? '',
    doshamDetails: (details.doshamDetails as string) ?? '',
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
      previousMarriageDetails: form.previousMarriageDetails,
      doshamDetails: form.doshamDetails,
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
  const { can } = useCurrentAdmin();
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
  const [photoToRemove, setPhotoToRemove] = useState<string | null>(null);
  const [photoReason, setPhotoReason] = useState('');
  const [photoToReject, setPhotoToReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Whether the removal can still be cancelled — evaluated when the member
  // loads (the API re-checks on the actual request).
  const [graceElapsed, setGraceElapsed] = useState(false);

  function reload() {
    if (!data.accessToken) return;
    getMember(data.accessToken, params.userId)
      .then((result) => {
        setMember(result);
        setGraceElapsed(
          result.scheduledAnonymizationAt !== null && new Date(result.scheduledAnonymizationAt).getTime() <= Date.now(),
        );
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

  async function handleRestore() {
    if (!data.accessToken) return;
    if (
      !window.confirm(
        'Cancel this removal? The member goes back to the status they had before removal was requested and will not be anonymized.',
      )
    )
      return;
    setActionPending(true);
    setActionMessage(undefined);
    try {
      const result = await restoreMember(data.accessToken, params.userId);
      setActionMessage(
        result.status === 'SUSPENDED'
          ? 'Removal cancelled — member is back to SUSPENDED, as before the removal.'
          : 'Removal cancelled — member is active again.',
      );
      reload();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Could not cancel the removal.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleApprovePhoto(photoId: string) {
    if (!data.accessToken) return;
    setActionPending(true);
    setActionMessage(undefined);
    try {
      await approveMemberPhoto(data.accessToken, params.userId, photoId);
      setActionMessage('Photo approved — other members can now see it.');
      reload();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Could not approve photo.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleRejectPhoto(photoId: string) {
    if (!data.accessToken || !rejectReason.trim()) return;
    setActionPending(true);
    setActionMessage(undefined);
    try {
      await rejectMemberPhoto(data.accessToken, params.userId, photoId, rejectReason.trim());
      setActionMessage('Photo rejected — it stays hidden and the member sees your reason.');
      setPhotoToReject(null);
      setRejectReason('');
      reload();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Could not reject photo.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleRemovePhoto(photoId: string) {
    if (!data.accessToken || !photoReason.trim()) return;
    setActionPending(true);
    setActionMessage(undefined);
    try {
      await removeMemberPhoto(data.accessToken, params.userId, photoId, photoReason.trim());
      setActionMessage('Photo removed.');
      setPhotoToRemove(null);
      setPhotoReason('');
      reload();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Could not remove photo.');
    } finally {
      setActionPending(false);
    }
  }

  if (!ready) return null;

  const isDeleted = member?.status === 'DELETED';
  const canModeratePhotos = can('members.edit');
  const isPendingDeletion = member?.status === 'PENDING_DELETION';

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
                  <div className="mt-1">
                    <StatusBadge status={member.status} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {member.profile && !isDeleted && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing((e) => !e)}>
                      {editing ? 'Cancel edit' : 'Edit profile'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionPending || isDeleted || isPendingDeletion}
                    onClick={() => void handleToggleActive()}
                  >
                    {member.status === 'SUSPENDED' ? 'Activate' : 'Deactivate'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPendingDeletion || isDeleted}
                    onClick={() => setShowRemoveForm((s) => !s)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {isPendingDeletion && member.scheduledAnonymizationAt && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <div className="text-sm">
                    <p className="font-semibold text-destructive">
                      Scheduled for anonymization on {new Date(member.scheduledAnonymizationAt).toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Removal requested {new Date(member.deletionRequestedAt!).toLocaleString()}.{' '}
                      {graceElapsed
                        ? 'The grace period has elapsed — this removal can no longer be cancelled.'
                        : 'Hidden from search and matching until then.'}
                    </p>
                  </div>
                  <Button type="button" size="sm" disabled={actionPending || graceElapsed} onClick={() => void handleRestore()}>
                    Cancel removal
                  </Button>
                </div>
              )}
              {isDeleted && (
                <p className="mt-4 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  This account has been anonymized. Personal data and photos were removed; no further actions are
                  available.
                </p>
              )}
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
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {member.profile.photos.map((photo) => (
                      <div key={photo.id} className="flex flex-col gap-2">
                        <div className="relative aspect-square overflow-hidden rounded-lg border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt="" className="h-full w-full object-cover" />
                          {photo.isPrimary && (
                            <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                              Primary
                            </span>
                          )}
                          <span
                            data-testid="admin-photo-status"
                            className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              photo.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : photo.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {photo.status === 'APPROVED' ? 'Approved' : photo.status === 'PENDING' ? 'Pending review' : 'Rejected'}
                          </span>
                        </div>
                        {photo.status === 'REJECTED' && photo.rejectionReason && (
                          <p className="text-xs text-muted-foreground">Reason: {photo.rejectionReason}</p>
                        )}
                        {canModeratePhotos && !isDeleted && photoToReject !== photo.id && (
                          <div className="flex gap-2">
                            {photo.status !== 'APPROVED' && (
                              <Button type="button" size="sm" disabled={actionPending} onClick={() => void handleApprovePhoto(photo.id)}>
                                Approve
                              </Button>
                            )}
                            {photo.status !== 'REJECTED' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={actionPending}
                                onClick={() => {
                                  setPhotoToReject(photo.id);
                                  setRejectReason('');
                                }}
                              >
                                Reject
                              </Button>
                            )}
                          </div>
                        )}
                        {photoToReject === photo.id && (
                          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-2">
                            <Textarea
                              aria-label="Reason for rejecting this photo"
                              placeholder="Reason shown to the member (required)"
                              rows={2}
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={!rejectReason.trim() || actionPending}
                                onClick={() => void handleRejectPhoto(photo.id)}
                              >
                                Confirm reject
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPhotoToReject(null);
                                  setRejectReason('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        {photoToRemove === photo.id ? (
                          <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2">
                            <Textarea
                              aria-label="Reason for removing this photo"
                              placeholder="Reason (required)"
                              rows={2}
                              value={photoReason}
                              onChange={(e) => setPhotoReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={!photoReason.trim() || actionPending}
                                onClick={() => void handleRemovePhoto(photo.id)}
                              >
                                Confirm remove
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPhotoToRemove(null);
                                  setPhotoReason('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isDeleted}
                            onClick={() => {
                              setPhotoToRemove(photo.id);
                              setPhotoReason('');
                            }}
                          >
                            Remove photo
                          </Button>
                        )}
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
