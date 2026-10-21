// "Write it for me" for the About you box: a two-line starting point built
// only from what the member has already entered, which they can then edit.
// Runs in the browser; nothing is sent anywhere.

export interface AboutDraftInput {
  fullName?: string;
  dateOfBirth?: string;
  religion?: string;
  casteCommunity?: string;
  profession?: string;
  educationLevel?: string;
  city?: string;
  state?: string;
  familyType?: string;
}

const FAMILY_WORDS: Record<string, string> = {
  'Middle Class': 'middle-class',
  'Upper Middle Class': 'upper-middle-class',
  'Rich / Affluent (Elite)': 'well-established',
};

function ageFrom(dateOfBirth: string | undefined, now: Date): number | null {
  const match = dateOfBirth?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age > 0 ? age : null;
}

const clean = (value: string | undefined) => value?.trim() ?? '';
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
// "Teacher" -> "teacher", but "IT Manager" / "MBBS" stay as typed.
const asWord = (value: string) => (/^[A-Z][a-z]+(\s[a-z]+)*$/.test(value) ? value.toLowerCase() : value);

export function buildAboutDraft(input: AboutDraftInput, now: Date = new Date()): string {
  const firstName = clean(input.fullName).split(/\s+/)[0];
  const age = ageFrom(input.dateOfBirth, now);
  const profession = asWord(clean(input.profession));
  const education = clean(input.educationLevel);
  const place = [clean(input.city), clean(input.state)].filter(Boolean).join(', ');
  const sub = clean(input.casteCommunity);
  const community = sub && sub !== 'Other' ? `${sub} Nadar` : 'Nadar';
  const family = FAMILY_WORDS[clean(input.familyType)] ?? '';
  const religion = clean(input.religion);

  // "I'm Kavitha, 29, a teacher from Madurai, Tamil Nadu."
  const parts = [firstName, age ? String(age) : '', profession ? `${article(profession)} ${profession}` : ''].filter(Boolean);
  let line1 = parts.length ? `I'm ${parts.join(', ')}` : '';
  if (place) line1 = line1 ? `${line1} from ${place}` : `I'm from ${place}`;
  if (line1) line1 += '.';

  // "I come from an upper-middle-class Christian Gramani Nadar family and have studied Masters."
  const background = [family, religion, community].filter(Boolean).join(' ');
  const roots = `I come from ${article(background)} ${background} family${education ? ` and have studied ${education}` : ''}.`;

  const line2 =
    'I value family, honesty and our traditions, and I am looking for a kind, understanding partner to build a happy life together.';
  return `${[line1, roots].filter(Boolean).join(' ')}\n${line2}`;
}
