'use client';

import Link from 'next/link';
import type { RelationshipStatus } from '@nadar-kalyanam/schemas';
import { Briefcase, GraduationCap, MapPin, Users } from 'lucide-react';
import { ConnectedBadge, RelationshipAction } from '../relationship/relationship-action';

export interface MatchProfileCardData {
  profileId: string;
  fullName: string;
  age: number;
  city: string | null;
  state: string | null;
  educationLevel: string | null;
  profession: string | null;
  primaryPhotoUrl: string | null;
  relationshipStatus: RelationshipStatus;
  conversationId: string | null;
  score?: number;
}

// Same card design as the Matches page's "Your Top Matches" cards, used by
// every category page. Shows only the member's real stored details — a line
// is omitted rather than filled with a placeholder.
export function MatchProfileCard({ profile }: { profile: MatchProfileCardData }) {
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  return (
    <div
      className="bg-white rounded-2xl border border-[#F0E8DD] hover:border-[#DECDBB] p-4 flex flex-col justify-between gap-4 transition-all shadow-2xs hover:shadow-xs"
      data-testid="match-card"
      data-profile-id={profile.profileId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full overflow-hidden border border-[#EADBBD] shrink-0 bg-[#FAF7F2]">
            {profile.primaryPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.primaryPhotoUrl} alt={profile.fullName} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[#A88C78]">
                <Users className="h-6 w-6" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-[#241C1A] truncate">
              {profile.fullName}, {profile.age}
            </h3>
            {location && (
              <p className="flex items-center gap-1 text-xs text-[#73645C] mt-1 truncate">
                <MapPin className="h-3 w-3 text-[#A88C78] shrink-0" />
                <span className="truncate">{location}</span>
              </p>
            )}
            {profile.educationLevel && (
              <p className="flex items-center gap-1 text-xs text-[#73645C] mt-0.5 truncate">
                <GraduationCap className="h-3 w-3 text-[#A88C78] shrink-0" />
                <span className="truncate">{profile.educationLevel}</span>
              </p>
            )}
            {profile.profession && (
              <p className="flex items-center gap-1 text-xs text-[#73645C] mt-0.5 truncate">
                <Briefcase className="h-3 w-3 text-[#A88C78] shrink-0" />
                <span className="truncate">{profile.profession}</span>
              </p>
            )}
            {profile.relationshipStatus === 'CONNECTED' && <ConnectedBadge className="mt-1.5" />}
          </div>
        </div>

        {profile.score !== undefined && (
          <span className="bg-[#FDF2F2] border border-[#F8D7DA] text-[#C53030] text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
            {/* The score can exceed 100 (preference fit and listing bonus are added on top); never show more than 100%. */}
            {Math.min(100, Math.round(profile.score))}% match
          </span>
        )}
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Link
          href={`/browse/${profile.profileId}`}
          className="border border-[#C49746] text-[#C49746] hover:bg-[#C49746]/10 active:scale-[0.98] text-xs font-semibold py-1.5 px-3 rounded-md flex-1 text-center transition-colors whitespace-nowrap"
        >
          View Profile
        </Link>
        <RelationshipAction
          className="flex-1"
          appearance="matches"
          profileId={profile.profileId}
          relationshipStatus={profile.relationshipStatus}
          conversationId={profile.conversationId}
        />
      </div>
    </div>
  );
}
