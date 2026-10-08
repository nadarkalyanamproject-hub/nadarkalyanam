'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { UnlockedContact } from '@nadar-kalyanam/schemas';
import { Card } from '@/components/ui/card';
import { AppHeader, UserIcon } from '../../../components/app-header';
import { ApiError, getMyUnlockedContacts, unlockPhone } from '../../../lib/api-client';
import { formatPlanDate } from '../../../lib/membership';
import { useRequireAuth } from '../../../lib/use-require-auth';
import { useRegistration } from '../../providers/registration-provider';
import { PlanGate } from '../../../components/plan/plan-gate';

const PAGE = 20;

// One contact. The number is fetched only on request, through the same
// guarded endpoint as the profile page (re-showing an earlier unlock is free).
function ContactRow({ contact, accessToken }: { contact: UnlockedContact; accessToken: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setBusy(true);
    setError(null);
    try {
      setPhone((await unlockPhone(accessToken, contact.profileId)).phoneNumber);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not show the number. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3" data-testid="unlocked-contact">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E8DCC8] bg-[#FAF6EF] text-[#A8988C]">
        {contact.primaryPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contact.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/browse/${contact.profileId}`} className="truncate text-sm font-semibold text-[#2B211C] hover:text-[#7A0710]">
          {contact.fullName}, {contact.age}
        </Link>
        <p className="text-xs text-[#776B62]">
          {[contact.city, contact.state].filter(Boolean).join(', ') || 'Location not added'} · unlocked {formatPlanDate(contact.unlockedAt)}
        </p>
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      {phone ? (
        <span className="font-mono text-sm text-[#2B211C]" data-testid="contact-phone">{phone}</span>
      ) : (
        <button
          type="button"
          onClick={() => void show()}
          disabled={busy}
          className="rounded-md border border-[#E8DCC8] bg-[#FFFDF9] px-4 py-1.5 text-xs font-semibold text-[#7A0710] hover:bg-[#FFF9ED] disabled:opacity-60"
        >
          {busy ? 'Loading…' : 'Show number'}
        </button>
      )}
    </li>
  );
}

function UnlockedContactsPageContent() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [items, setItems] = useState<UnlockedContact[] | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (offset: number) => {
      if (!data.accessToken) return;
      getMyUnlockedContacts(data.accessToken, offset, PAGE)
        .then((r) => {
          setItems((prev) => (offset > 0 && prev ? [...prev, ...r.items] : r.items));
          setNextOffset(r.nextOffset);
        })
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load your unlocked contacts.'));
    },
    [data.accessToken],
  );

  useEffect(() => {
    if (ready) load(0);
  }, [ready, load]);

  if (!ready) return null;
  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-[#FFFDF9] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Link href="/membership" className="text-xs font-semibold text-[#7E6F65] hover:text-[#7A0710]">
            ← Back to Membership
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#2B1515]">My unlocked contacts</h1>
            <p className="mt-1 text-sm text-[#73645C]">
              Members whose phone numbers you unlocked. Someone disappears from this list if they turn sharing off, if either of
              you blocks the other, or if you&apos;re no longer connected.
            </p>
          </div>
          {error && <Card className="rounded-2xl p-4 text-sm text-destructive" role="alert">{error}</Card>}
          {items === null && !error && <Card className="rounded-2xl p-6 text-sm text-[#73645C]">Loading…</Card>}
          {items?.length === 0 && (
            <Card className="rounded-2xl p-6 text-sm text-[#73645C]" data-testid="contacts-empty">
              You haven&apos;t unlocked any phone numbers yet. You can unlock the number of a member you&apos;re connected with from
              their profile.
            </Card>
          )}
          {items && items.length > 0 && data.accessToken && (
            <Card className="rounded-2xl px-4">
              <ul className="divide-y divide-[#F3EBDD]">
                {items.map((c) => <ContactRow key={c.profileId} contact={c} accessToken={data.accessToken!} />)}
              </ul>
            </Card>
          )}
          {nextOffset !== null && (
            <button type="button" onClick={() => load(nextOffset)} className="self-center rounded-md border border-[#E8DCC8] px-4 py-1.5 text-xs font-semibold text-[#7A0710]">
              Load more
            </button>
          )}
        </div>
      </main>
    </>
  );
}

// Needs a membership plan when the server requires one (see PlanGate).
export default function UnlockedContactsPage() {
  return (
    <PlanGate>
      <UnlockedContactsPageContent />
    </PlanGate>
  );
}
