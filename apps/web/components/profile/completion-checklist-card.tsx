'use client';

interface SectionItem {
  id: string;
  label: string;
  completed: boolean;
}

export function CompletionChecklistCard({
  percentage = 68,
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
    <div className="rounded-2xl border border-[#E8DCC8] bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-[#7A0710]">
          Profile Completion
        </h2>
        <span className="text-sm font-bold text-[#7A0710]">
          {percentage}% Complete
        </span>
      </div>

      <div className="mb-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F2E8DC]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7A0710] via-[#94151C] to-[#D6A33A] transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#776B62]">
        Complete your profile
      </p>

      <ul className="space-y-2.5">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-center gap-2.5 text-xs font-medium">
            {item.completed ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#7A0710] text-white">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-2.5 w-2.5">
                  <path d="m3.5 8 3 3 6-6" />
                </svg>
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border-1.5 border-[#D6A33A] bg-[#FFF9ED]" />
            )}
            <span className={item.completed ? 'text-[#2B211C]' : 'text-[#776B62]'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onCompleteClick?.(nextIncomplete?.id || 'education')}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#94151C] to-[#7A0710] py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-[#A81C24] hover:to-[#94151C] hover:shadow hover:scale-[1.01]"
      >
        <span>Complete Profile</span>
        <span>→</span>
      </button>
    </div>
  );
}
