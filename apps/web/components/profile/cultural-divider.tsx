export function CulturalDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-1 ${className}`}>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FDE68A] to-transparent" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4 text-[#F59E0B] opacity-90"
        aria-hidden="true"
      >
        <path
          d="M12 2C12 2 14 7 19 7C14 7 14 12 12 12C12 12 10 7 5 7C10 7 10 2 12 2Z"
          fill="currentColor"
        />
        <path
          d="M12 12C12 12 14 17 19 17C14 17 14 22 12 22C12 22 10 17 5 17C10 17 10 12 12 12Z"
          fill="currentColor"
        />
      </svg>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#FDE68A] to-transparent" />
    </div>
  );
}

export function LotusOrnament({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={`text-[#D6A33A] ${className}`} aria-hidden="true">
      {/* Central petal */}
      <path
        d="M16 4C14 9 13 14 16 23C19 14 18 9 16 4Z"
        fill="#D6A33A"
        opacity="0.9"
      />
      {/* Left petal */}
      <path
        d="M16 11C12 12 7 15 9 22C12 21 14 19 16 16V11Z"
        fill="#7A0710"
        opacity="0.85"
      />
      {/* Right petal */}
      <path
        d="M16 11C20 12 25 15 23 22C20 21 18 19 16 16V11Z"
        fill="#7A0710"
        opacity="0.85"
      />
      {/* Base curve */}
      <path
        d="M6 24C12 26 20 26 26 24C24 25.5 18 27 16 27C14 27 8 25.5 6 24Z"
        fill="#D6A33A"
      />
    </svg>
  );
}
