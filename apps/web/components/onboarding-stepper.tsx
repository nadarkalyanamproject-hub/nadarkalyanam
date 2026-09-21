const STEPS = [
  'Basic Details',
  'Personal & Religious Details',
  'Location & Professional Details',
  'Additional Details',
];

const RING_SIZE = 64;
const RADIUS = 27;
const STROKE_WIDTH = 5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function OnboardingStepper({ step, activePercent }: { step: number; activePercent: number }) {
  // The track spans center-to-center of the first and last circles: with 4
  // equal-width columns, each circle's center sits at (2n-1)/8 of the row
  // width, so the track is inset 1/8 (12.5%) from each edge. The filled
  // portion grows from the start up through the active step's own center —
  // i.e. up to (step/4 - 1/8) of the row, or equivalently (step-1)/4 of the
  // track's own length.
  const filledWidthPercent = Math.max(0, Math.min(100, ((step - 1) / STEPS.length) * 100));

  return (
    <ol className="relative flex">
      <div className="absolute top-8 left-[12.5%] right-[12.5%] h-px bg-border" />
      <div
        className="absolute top-8 left-[12.5%] h-px bg-primary"
        style={{ width: `${filledWidthPercent}%` }}
      />
      {STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === step;
        const isDone = stepNumber < step;
        const percent = isActive ? Math.max(0, Math.min(100, Math.round(activePercent))) : 0;
        const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

        return (
          <li key={label} className="relative z-10 flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center">
              {isActive ? (
                <>
                  <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="h-16 w-16 -rotate-90">
                    <circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      strokeWidth={STROKE_WIDTH}
                      className="stroke-border"
                    />
                    <circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      strokeWidth={STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={offset}
                      className="stroke-primary"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">
                    {percent}%
                  </span>
                </>
              ) : isDone ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {stepNumber}
                </span>
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-sm font-semibold text-muted-foreground">
                  {stepNumber}
                </span>
              )}
            </div>

            <span className={`text-xs font-semibold ${stepNumber <= step ? 'text-primary' : 'text-muted-foreground'}`}>
              {label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Step {stepNumber} of {STEPS.length}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
