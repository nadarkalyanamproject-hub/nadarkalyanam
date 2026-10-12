'use client';

// Shared option lists (the partner-preferences editor and profile form use
// them) and the decorative emblems used across the member pages. The old
// Search filter form that lived here was replaced by Search's categories.

export const AGE_MIN_OPTIONS = [
  '18', '19', '20', '21', '22', '23', '24', '25', '26', '27',
  '28', '29', '30', '31', '32', '33', '34', '35', '36', '37',
  '38', '39', '40', '42', '45', '50', '55', '60',
];

export const AGE_MAX_OPTIONS = [
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
  '42', '45', '50', '55', '60', '65', '70',
];

// Free-text profile fields (city, education, profession, mother tongue,
// religion, caste, employment type) have no fixed list at onboarding, so
// they're typed here and matched on the whole value, ignoring case. Enum
// fields use the stored value as the option value; only the label is
// friendly.
export const HEIGHT_OPTIONS = Array.from({ length: 78 - 54 + 1 }, (_, i) => {
  const totalInches = 54 + i;
  const cm = Math.round(totalInches * 2.54);
  return { value: String(cm), label: `${Math.floor(totalInches / 12)}'${totalInches % 12}" (${cm} cm)` };
});

export const INCOME_LAKH_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100].map((lakhs) => ({
  value: String(lakhs),
  label: lakhs >= 100 ? `₹${lakhs / 100} Cr` : `₹${lakhs} L`,
}));

export function LotusEmblem({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      {/* Center upright petal */}
      <path
        d="M12 4C10.5 7.5 10.5 11.5 12 15C13.5 11.5 13.5 7.5 12 4Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Left petal */}
      <path
        d="M11 6C8.5 8.5 7 11.5 8.5 15C10 13.5 11 11 11.2 7"
        strokeLinecap="round"
      />
      {/* Right petal */}
      <path
        d="M13 6C15.5 8.5 17 11.5 15.5 15C14 13.5 13 11 12.8 7"
        strokeLinecap="round"
      />
      {/* Base petal curls */}
      <path
        d="M5 14C4 16 6 17.5 8.5 17C7.5 15.5 6.5 14.5 5 14Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path
        d="M19 14C20 16 18 17.5 15.5 17C16.5 15.5 17.5 14.5 19 14Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Lotus base underline */}
      <path
        d="M7 18C10.5 19.5 13.5 19.5 17 18"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BotanicalSprig({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Main graceful curved stem */}
      <path
        d="M20 200 C70 170 110 120 195 25"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Side branching stem 1 */}
      <path
        d="M80 145 C115 140 145 155 160 175"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Side branching stem 2 */}
      <path
        d="M130 95 C160 85 185 95 198 115"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Leaves along main stem */}
      <path
        d="M60 160 C50 140 68 128 82 142 C88 155 70 168 60 160 Z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      <path
        d="M100 125 C88 108 108 95 120 108 C128 122 110 135 100 125 Z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      <path
        d="M140 85 C128 68 148 55 160 68 C168 82 150 95 140 85 Z"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <path
        d="M175 45 C168 30 185 20 194 32 C198 42 186 52 175 45 Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      {/* Terminal tip leaf */}
      <path
        d="M195 25 C190 12 205 6 212 16 C216 25 204 32 195 25 Z"
        fill="currentColor"
        fillOpacity="0.9"
      />

      {/* Opposite / side leaves */}
      <path
        d="M72 170 C85 180 88 198 74 195 C64 190 64 175 72 170 Z"
        fill="currentColor"
        fillOpacity="0.65"
      />
      <path
        d="M112 135 C125 145 128 162 114 160 C104 155 104 140 112 135 Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
      <path
        d="M152 95 C165 105 168 122 154 120 C144 115 144 100 152 95 Z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      <path
        d="M125 145 C145 142 155 152 150 162 C140 165 130 155 125 145 Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
      <path
        d="M165 178 C175 172 185 180 180 190 C170 192 162 185 165 178 Z"
        fill="currentColor"
        fillOpacity="0.65"
      />
    </svg>
  );
}
