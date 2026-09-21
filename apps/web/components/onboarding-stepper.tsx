'use client';

const STEPS = [
  { id: 1, name: 'Basic Details' },
  { id: 2, name: 'Personal & Religious' },
  { id: 3, name: 'Location & Professional' },
  { id: 4, name: 'Additional Details' },
];

function getStepStatusText(stepId: number, currentStep: number): string {
  if (stepId < currentStep) return 'Completed';
  if (stepId === currentStep) return 'Current Step';
  if (stepId === currentStep + 1 && stepId === 4) return 'Final Step';
  if (stepId === currentStep + 1) return 'Next Step';
  if (stepId === 4) return 'Final Step';
  return 'Upcoming';
}

export function OnboardingStepper({
  step,
  activePercent = 0,
}: {
  step: number;
  activePercent?: number;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(activePercent)));

  return (
    <div className="relative w-full select-none">
      {/* Top Header showing Step counter and % Completed */}
      <div className="mb-2.5 flex items-center justify-between px-1">
        <span className="text-[11px] font-bold tracking-wider uppercase text-[#8E1B24]">
          Step {step} of {STEPS.length}
        </span>
        <span className="text-xs font-bold text-[#8E1B24]">
          {percent}% Completed
        </span>
      </div>

      {/* Progress Track & Nodes Container */}
      <div className="relative w-full py-1">
        {/* Background Track Line connecting center of Node 1 to center of Node 4 */}
        <div className="absolute top-[14px] left-[12.5%] right-[12.5%] h-1.5 -translate-y-1/2 rounded-full bg-[#EAE3D9]" />

        {/* Filled Gradient Progress Bar moving with exact progress percentage */}
        <div
          className="absolute top-[14px] left-[12.5%] h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#8E1B24] via-[#B8323C] to-[#E67E22] transition-all duration-500 ease-out"
          style={{
            width: `calc(${percent}% * 0.75)`,
          }}
        />

        {/* 4 Step Nodes & Labels */}
        <div className="relative z-10 grid grid-cols-4">
          {STEPS.map((s) => {
            const isDone = s.id < step;
            const isCurrent = s.id === step;
            const statusText = getStepStatusText(s.id, step);

            return (
              <div key={s.id} className="flex flex-col items-center text-center">
                {/* Node Circle */}
                <div className="flex h-7 w-7 items-center justify-center">
                  {isDone ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8E1B24] text-white shadow-sm">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#F6C358] bg-white shadow-sm">
                      <span className="h-3.5 w-3.5 rounded-full bg-[#8E1B24]" />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DCD3C7] bg-[#FDFBF7] text-xs font-semibold text-[#6E5E5E]">
                      {s.id}
                    </div>
                  )}
                </div>

                {/* Step Title & Status */}
                <div className="mt-2 flex flex-col items-center">
                  <span
                    className={`text-xs md:text-sm tracking-tight transition-colors ${
                      isCurrent
                        ? 'font-bold text-[#8E1B24]'
                        : isDone
                          ? 'font-bold text-[#1C1313]'
                          : 'font-semibold text-[#3D2D2D]'
                    }`}
                  >
                    {s.name}
                  </span>
                  <span
                    className={`mt-0.5 text-[11px] font-medium ${
                      isCurrent ? 'font-semibold text-[#8E1B24]' : 'text-[#7A6B6B]'
                    }`}
                  >
                    {isCurrent ? `${statusText} (${percent}%)` : statusText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
