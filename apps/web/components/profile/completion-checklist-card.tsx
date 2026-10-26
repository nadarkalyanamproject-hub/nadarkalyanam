'use client';

interface SectionItem {
  id: string;
  label: string;
  completed: boolean;
  // Extras that don't count toward the percentage.
  optional?: boolean;
}

export function CompletionChecklistCard({
  percentage = 0,
  items,
  onCompleteClick,
}: {
  percentage?: number;
  items?: SectionItem[];
  onCompleteClick?: (sectionId: string) => void;
}) {
  const defaultItems: SectionItem[] = [
    { id: 'basic', label: 'Basic Details', completed: true },
    { id: 'personal', label: 'Personal & Religious', completed: true },
    { id: 'education', label: 'Education & Career', completed: false },
    { id: 'preferences', label: 'Partner Preferences', completed: false },
    { id: 'family', label: 'Family Details', completed: false },
  ];

  const checklist = items || defaultItems;
  const nextIncomplete = checklist.find((item) => !item.completed);

  return (
    <div className="rounded-2xl border border-nk-line bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
          Profile Completion
        </h2>
        <span className="text-sm font-bold text-nk-maroon">
          {percentage}% Complete
        </span>
      </div>

      <div className="mb-4">
        <div className="h-2 w-full overflow-hidden rounded-sm bg-nk-line-soft">
          <div
            className="h-full rounded-sm bg-gradient-to-r from-nk-maroon via-[#D97706] to-[#F59E0B] transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-nk-muted">
        Complete your profile
      </p>

      <ul className="space-y-2.5">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-center gap-2.5 text-xs font-medium">
            {item.completed ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-nk-maroon text-white">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-2.5 w-2.5">
                  <path d="m3.5 8 3 3 6-6" />
                </svg>
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border-1.5 border-[#F59E0B] bg-[#FFF9E6]" />
            )}
            <span className={item.completed ? 'text-nk-ink' : 'text-nk-muted'}>
              {item.label}
              {item.optional && <span className="ml-1 font-normal text-nk-subtle">(optional)</span>}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onCompleteClick?.(nextIncomplete?.id || 'education')}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-nk-maroon-bright to-nk-maroon py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-[#A81C24] hover:to-nk-maroon-bright hover:shadow hover:scale-[1.01]"
      >
        <span>Complete Profile</span>
        <span>→</span>
      </button>
    </div>
  );
}
