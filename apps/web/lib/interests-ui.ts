import type { InterestResponse, InterestStatus } from '@nadar-kalyanam/schemas';

// Display helpers for the Interests page (kept out of the page file: a
// Next.js page may only export the page itself).

export interface DisplayInterest {
  id: string;
  profileId: string;
  fullName: string;
  age: number;
  city: string | null;
  state: string | null;
  // The member's profession, or their education level when no profession.
  occupation: string | null;
  primaryPhotoUrl: string | null;
  status: InterestStatus;
  createdAt: string;
}

export function formatInterestDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

// Only real profile fields; anything the member hasn't filled in stays null
// and its line is hidden rather than shown as a placeholder.
export function mapApiInterestToDisplay(interest: InterestResponse, isReceived: boolean): DisplayInterest {
  const party = isReceived ? interest.sender : interest.target;
  return {
    id: interest.id,
    profileId: party.profileId,
    fullName: party.fullName.split(' ')[0] || party.fullName,
    age: party.age,
    city: party.city || null,
    state: party.state || null,
    occupation: party.profession || party.educationLevel || null,
    primaryPhotoUrl: party.primaryPhotoUrl,
    status: interest.status,
    createdAt: interest.createdAt,
  };
}

// "27 · Madurai", or just "27" without a city (null when neither is known).
export function ageAndCity(item: Pick<DisplayInterest, 'age' | 'city'>): string | null {
  const parts = [item.age > 0 ? String(item.age) : null, item.city].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// "Madurai, Tamil Nadu", whichever parts are known (null when neither).
export function placeLine(item: Pick<DisplayInterest, 'city' | 'state'>): string | null {
  const parts = [item.city, item.state].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
