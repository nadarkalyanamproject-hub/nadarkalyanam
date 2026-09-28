'use client';

import Link from 'next/link';
import type { PublicProfileSummary } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { UserIcon } from '../app-header';
import { ConnectedBadge, RelationshipAction } from '../relationship/relationship-action';

const MARITAL_STATUS_LABELS: Record<string, string> = {
  NEVER_MARRIED: 'Never Married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  AWAITING_DIVORCE: 'Awaiting Divorce',
};

export function ProfileCard({ profile }: { profile: PublicProfileSummary }) {
  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {profile.primaryPhotoUrl ? (
          // Uploaded photos live in MinIO, an arbitrary external origin not
          // registered with next/image — a plain <img> is the simplest
          // correct option here, same as elsewhere in this app.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <UserIcon className="h-14 w-14" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-bold text-foreground">
          {profile.fullName}, {profile.age}
        </h3>
        {profile.relationshipStatus === 'CONNECTED' && <ConnectedBadge className="mt-1 self-start" />}
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.location.city}, {profile.location.state}
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{profile.religion}</span>
          <span>&middot;</span>
          <span>{profile.profession}</span>
          <span>&middot;</span>
          <span>{MARITAL_STATUS_LABELS[profile.maritalStatus] ?? profile.maritalStatus}</span>
        </dl>

        <div className="mt-4 flex items-start gap-2">
          <Link href={`/browse/${profile.id}`} className="flex-1">
            <Button type="button" variant="outline" size="sm" className="w-full">
              View Profile
            </Button>
          </Link>
          <RelationshipAction
            className="flex-1"
            profileId={profile.id}
            relationshipStatus={profile.relationshipStatus}
            conversationId={profile.conversationId}
          />
        </div>
      </div>
    </Card>
  );
}
